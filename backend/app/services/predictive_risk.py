"""Phase 9 predictive risk orchestrator.

Combines the rule-based engine with the optional trained ML model into the
public risk response, as well as the risk list and statistics used by the
``/vendor-risk`` screen. No values here are fabricated; when data is missing
the response says so explicitly.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import Vendor
from ..models.enums import (
    PredictionMethod,
    RiskConfidence,
    RiskLevel,
)
from ..schemas.predictive_risk import (
    ModelInfo,
    PaginatedVendorRiskList,
    PredictiveRisk,
    RiskStatistics,
    VendorRiskListItem,
)
from .ml import risk_config
from .ml.risk_model import get_model_info, predict_ml
from .predictive_risk_engine import (
    _phase7_overall,
    build_rule_based_risk,
    compute_risk_trend,
)


def _clamp01(value: float) -> float:
    return max(0.0, min(100.0, round(value, 1)))


_NO_DATA_DETAIL = (
    "No operational records are available for this vendor yet. Record purchase "
    "orders, quality evaluations, or incidents to generate a predictive risk score."
)

_ML_NOT_APPLICABLE = (
    "An ML model is available but this vendor does not have a recent observation "
    "window with sufficient recorded data, so the prediction is rule-based."
)


def _default_model_info() -> ModelInfo:
    return ModelInfo(available=False)


def _model_info() -> ModelInfo:
    info = get_model_info()
    if info is None:
        return _default_model_info()
    return info


def build_predictive_risk(db: Session, vendor: Vendor) -> PredictiveRisk:
    """Full predictive risk response for a single vendor."""
    rule = build_rule_based_risk(db, vendor)
    generated_at = datetime.now(timezone.utc)
    model_info = _model_info()
    trend = compute_risk_trend(db, vendor)

    if rule.risk_score is None:
        return PredictiveRisk(
            vendor_id=vendor.id,
            vendor_name=vendor.company_name,
            vendor_code=vendor.vendor_code,
            risk_score=None,
            risk_level=None,
            confidence=rule.confidence,
            prediction_method=PredictionMethod.RULE_BASED,
            risk_trend=trend,
            risk_factors=[],
            positive_factors=[],
            feature_summary=[],
            model_information=model_info,
            detail=_NO_DATA_DETAIL,
            generated_at=generated_at,
        )

    ml_score = predict_ml(db, vendor.id) if model_info.available else None
    method = PredictionMethod.RULE_BASED
    risk_score = rule.risk_score
    detail: str | None = None

    if ml_score is not None:
        risk_score = _clamp01(
            risk_config.HYBRID_RULE_WEIGHT * rule.risk_score
            + risk_config.HYBRID_ML_WEIGHT * ml_score
        )
        method = PredictionMethod.HYBRID
    elif model_info.available:
        detail = _ML_NOT_APPLICABLE

    return PredictiveRisk(
        vendor_id=vendor.id,
        vendor_name=vendor.company_name,
        vendor_code=vendor.vendor_code,
        risk_score=risk_score,
        risk_level=risk_config.classify_risk_level(risk_score),
        confidence=rule.confidence,
        prediction_method=method,
        risk_trend=trend,
        risk_factors=rule.factors,
        positive_factors=rule.positive_factors,
        feature_summary=rule.feature_summary,
        model_information=model_info,
        detail=detail,
        generated_at=generated_at,
    )


def _build_list_item(db: Session, vendor: Vendor) -> VendorRiskListItem:
    risk = build_predictive_risk(db, vendor)
    overall = _phase7_overall(db, vendor.id, None, None)
    category_name = vendor.category.name if vendor.category else None
    return VendorRiskListItem(
        vendor_id=risk.vendor_id,
        vendor_name=risk.vendor_name,
        vendor_code=risk.vendor_code,
        category_name=category_name,
        performance_score=overall,
        risk_score=risk.risk_score,
        risk_level=risk.risk_level,
        confidence=risk.confidence,
        prediction_method=risk.prediction_method,
    )


def _sort_value(item: VendorRiskListItem, sort_by: str):
    if sort_by == "vendor_name":
        return item.vendor_name.lower()
    if sort_by == "performance_score":
        return item.performance_score
    return item.risk_score


def build_risk_list(
    db: Session,
    search: str | None = None,
    category_id: int | None = None,
    risk_level: RiskLevel | None = None,
    sort_by: str = "risk_score",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 10,
) -> PaginatedVendorRiskList:
    """Vendor risk list with search, filter, sort and pagination.

    Filtering by risk level happens after scoring (the level only exists after
    the score is computed). ``None`` scores always sort last regardless of the
    sort direction so the list never hides data.
    """
    query = db.query(Vendor)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Vendor.company_name.ilike(pattern)
            | Vendor.vendor_code.ilike(pattern)
        )
    if category_id is not None:
        query = query.filter(Vendor.category_id == category_id)

    vendors = query.all()
    items = [_build_list_item(db, vendor) for vendor in vendors]

    if risk_level is not None:
        items = [item for item in items if item.risk_level == risk_level]

    with_value = [
        item
        for item in items
        if _sort_value(item, sort_by) is not None
    ]
    without_value = [
        item
        for item in items
        if _sort_value(item, sort_by) is None
    ]
    with_value.sort(
        key=lambda item: _sort_value(item, sort_by),
        reverse=sort_order == "desc",
    )
    items = with_value + without_value

    total = len(items)
    total_pages = (total + page_size - 1) // page_size if total else 0
    start = (page - 1) * page_size
    paged = items[start : start + page_size]
    return PaginatedVendorRiskList(
        items=paged,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


def build_risk_statistics(db: Session) -> RiskStatistics:
    """Summary card statistics computed from every vendor's real risk data."""
    vendors = db.query(Vendor).all()
    items = [_build_list_item(db, vendor) for vendor in vendors]

    stats = RiskStatistics(total_vendors=len(items))
    scored = []
    for item in items:
        if item.risk_score is None:
            stats.no_data += 1
            continue
        scored.append(item)
        if item.risk_level == RiskLevel.VERY_LOW:
            stats.very_low_risk += 1
        elif item.risk_level == RiskLevel.LOW:
            stats.low_risk += 1
        elif item.risk_level == RiskLevel.MEDIUM:
            stats.medium_risk += 1
        elif item.risk_level == RiskLevel.HIGH:
            stats.high_risk += 1
        elif item.risk_level == RiskLevel.CRITICAL:
            stats.critical_risk += 1
        if item.confidence == RiskConfidence.HIGH:
            stats.high_confidence_predictions += 1
        elif item.confidence == RiskConfidence.LOW:
            stats.low_confidence_predictions += 1

    if scored:
        stats.average_risk_score = round(
            sum(item.risk_score for item in scored if item.risk_score is not None)
            / len(scored),
            1,
        )
    return stats