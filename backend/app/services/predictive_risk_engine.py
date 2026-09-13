"""Rule-based predictive risk engine (Phase 9).

Every score here is derived from real recorded data: delivery performance,
incident performance, quality, overall performance (Phase 7) and workload.
Component risks are ``100 - component score`` (higher score = better
performance = lower risk) with the workload component newly derived from
outstanding and recent order volume.

Available component weights are re-normalized (dynamic weighting) so a vendor
with partial data is never penalized for missing components, and a vendor with
no operational records at all reports no risk score instead of fabricating a
zero.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import PurchaseOrder, Vendor
from ..models.enums import (
    PurchaseOrderStatus,
    RiskConfidence,
    RiskTrend,
)
from ..schemas.predictive_risk import PositiveFactor, RiskFactor
from .ml import risk_config
from .vendor_performance import (
    compute_delivery_score,
    compute_incident_score,
    compute_quality_score,
)

_ACTIVE_ORDER_STATUSES = (
    PurchaseOrderStatus.ISSUED,
    PurchaseOrderStatus.IN_PROGRESS,
    PurchaseOrderStatus.PARTIALLY_DELIVERED,
)


def _round1(value: float) -> float:
    return round(value, 1)


def _clamp01(value: float) -> float:
    return max(0.0, min(100.0, value))


@dataclass
class ComponentRisk:
    name: str
    risk: float | None
    available: bool
    summary: str = ""


@dataclass
class RuleBasedResult:
    risk_score: float | None
    components: dict[str, ComponentRisk] = field(default_factory=dict)
    factors: list[RiskFactor] = field(default_factory=list)
    positive_factors: list[PositiveFactor] = field(default_factory=list)
    feature_summary: list[str] = field(default_factory=list)
    confidence: RiskConfidence = RiskConfidence.LOW
    total_records: int = 0
    history_days: int = 0


def _plural(noun: str, count: int) -> str:
    return noun if count == 1 else f"{noun}s"


def compute_workload_components(
    db: Session, vendor_id: int, end: date
) -> tuple[int, int]:
    """(outstanding_orders, recent_30d_orders) from real purchase orders."""
    outstanding = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.in_(_ACTIVE_ORDER_STATUSES),
            PurchaseOrder.order_date <= end,
        )
        .count()
    )
    recent = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.order_date >= end - timedelta(days=30),
            PurchaseOrder.order_date <= end,
        )
        .count()
    )
    return outstanding, recent


def compute_rule_based_components(
    db: Session,
    vendor: Vendor,
    start: date | None,
    end: date | None,
) -> tuple[dict[str, ComponentRisk], float | None]:
    """Component risks for ``vendor`` over ``[start, end]`` and combined score.

    Returns (components, combined_risk_score). The combined score is ``None``
    when no component has data (the record-gating rule).
    """
    delivery = compute_delivery_score(db, vendor.id, start, end)
    quality = compute_quality_score(db, vendor.id, start, end)
    incidents = compute_incident_score(db, vendor.id, start, end)

    span_end = end or date.today()
    outstanding, recent = compute_workload_components(db, vendor.id, span_end)

    components: dict[str, ComponentRisk] = {}

    delivery_available = delivery.data_available and delivery.score is not None
    if delivery_available:
        delivery_risk = _clamp01(100.0 - delivery.score)
        components["delivery"] = ComponentRisk(
            name="Delivery",
            risk=_round1(delivery_risk),
            available=True,
            summary=(
                f"{delivery.on_time_deliveries} of {delivery.completed_deliveries} "
                f"completed deliveries were on time "
                f"({delivery.delayed_deliveries} delayed)."
            ),
        )

    quality_available = quality.data_available and quality.score is not None
    if quality_available:
        quality_risk = _clamp01(100.0 - quality.score)
        components["quality"] = ComponentRisk(
            name="Quality",
            risk=_round1(quality_risk),
            available=True,
            summary=(
                f"Average quality score {quality.score}/100 across "
                f"{quality.total_evaluations} evaluation"
                f"{_plural('', quality.total_evaluations)}."
            ),
        )

    has_records = (
        delivery.total_orders
        + quality.total_evaluations
        + incidents.total_incidents
    ) > 0
    incident_available = incidents.data_available and has_records
    if incident_available:
        incident_risk = _clamp01(100.0 - incidents.score)
        components["incident"] = ComponentRisk(
            name="Incident",
            risk=_round1(incident_risk),
            available=True,
            summary=(
                f"{incidents.total_incidents} incident"
                f"{_plural('', incidents.total_incidents)} recorded"
                + (
                    f" ({incidents.critical} critical, {incidents.high} high)."
                    if incidents.total_incidents
                    else " (none)."
                )
            ),
        )

    if any(name in components for name in ("delivery", "quality", "incident")):
        # Overall performance risk mirrors the Phase 7 overall score.
        overall = _phase7_overall(db, vendor.id, start, end)
        if overall is not None:
            performance_risk = _clamp01(100.0 - overall)
            components["performance"] = ComponentRisk(
                name="Performance",
                risk=_round1(performance_risk),
                available=True,
                summary=f"Overall performance score {overall}/100.",
            )

    workload_available = (
        delivery.total_orders > 0 or outstanding > 0 or recent > 0
    )
    if workload_available:
        load = outstanding + recent
        workload_risk = _clamp01(
            round(load * 100 / risk_config.WORKLOAD_SATURATION, 1)
        )
        components["workload"] = ComponentRisk(
            name="Workload",
            risk=_round1(workload_risk),
            available=True,
            summary=(
                f"{outstanding} outstanding and {recent} recent order"
                f"{_plural('', recent)} in the last 30 days."
            ),
        )

    combined = _combine_risks(components)
    return components, combined


def _phase7_overall(
    db: Session, vendor_id: int, start: date | None, end: date | None
) -> float | None:
    """Phase 7 overall performance score (delivery/quality/incident blend)."""
    from .vendor_performance import COMPONENT_WEIGHTS

    delivery = compute_delivery_score(db, vendor_id, start, end)
    quality = compute_quality_score(db, vendor_id, start, end)
    incidents = compute_incident_score(db, vendor_id, start, end)

    scores: dict[str, float] = {}
    if delivery.data_available and delivery.score is not None:
        scores["delivery"] = delivery.score
    if quality.data_available and quality.score is not None:
        scores["quality"] = quality.score
    if incidents.data_available and (
        delivery.total_orders + quality.total_evaluations + incidents.total_incidents
    ) > 0:
        scores["incident"] = incidents.score
    if not scores:
        return None
    weight_sum = sum(COMPONENT_WEIGHTS[name] for name in scores)
    return round(
        sum(scores[name] * COMPONENT_WEIGHTS[name] for name in scores) / weight_sum,
        2,
    )


def _combine_risks(components: dict[str, ComponentRisk]) -> float | None:
    """Dynamic-weight-normalized combined risk; ``None`` when nothing is available."""
    available = {
        name: item.risk
        for name, item in components.items()
        if item.available and item.risk is not None
    }
    if not available:
        return None
    weight_sum = sum(
        risk_config.RISK_COMPONENT_WEIGHTS[name] for name in available
    )
    combined = (
        sum(
            available[name] * risk_config.RISK_COMPONENT_WEIGHTS[name]
            for name in available
        )
        / weight_sum
    )
    return _round1(combined)


def _impact_label(risk: float) -> str:
    if risk >= 80:
        return "CRITICAL"
    if risk >= 60:
        return "HIGH"
    if risk >= 40:
        return "MEDIUM"
    return "LOW"


def _build_factors(
    components: dict[str, ComponentRisk],
) -> list[RiskFactor]:
    scored: list[tuple[float, ComponentRisk]] = []
    for component in components.values():
        if not component.available or component.risk is None:
            continue
        if component.risk >= risk_config.FACTOR_RISK_THRESHOLD:
            scored.append((component.risk, component))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    factors: list[RiskFactor] = []
    for risk, component in scored:
        factors.append(
            RiskFactor(
                name=component.name,
                impact=_impact_label(risk),
                description=(
                    f"{component.name} risk is {risk}/100. {component.summary}"
                ),
            )
        )
    return factors


def _build_positive_factors(
    components: dict[str, ComponentRisk],
) -> list[PositiveFactor]:
    positives: list[PositiveFactor] = []
    for name, component in components.items():
        if not component.available or component.risk is None:
            continue
        if component.risk <= risk_config.POSITIVE_RISK_THRESHOLD:
            positives.append(
                PositiveFactor(
                    name=component.name,
                    description=f"{component.summary}",
                )
            )
    return positives


def _build_feature_summary(
    components: dict[str, ComponentRisk],
    total_records: int,
    history_days: int,
) -> list[str]:
    summary: list[str] = []
    for component in components.values():
        if component.available:
            summary.append(component.summary)
    if history_days and total_records:
        summary.append(
            f"Based on {total_records} recorded {_plural('event', total_records)} "
            f"across {history_days} days of history."
        )
    return summary


def _history_days(vendor: Vendor, today: date) -> int:
    anchor = vendor.vendor_since
    if anchor is None:
        return 0
    return max(0, (today - anchor).days)


def build_rule_based_risk(db: Session, vendor: Vendor) -> RuleBasedResult:
    """Full-history rule-based risk profile for ``vendor``."""
    today = date.today()
    components, combined = compute_rule_based_components(db, vendor, None, None)

    delivery = compute_delivery_score(db, vendor.id, None, None)
    quality = compute_quality_score(db, vendor.id, None, None)
    incidents = compute_incident_score(db, vendor.id, None, None)
    total_records = delivery.total_orders + quality.total_evaluations + incidents.total_incidents
    history_days = _history_days(vendor, today)
    if history_days == 0:
        history_days = _earliest_record_span(db, vendor.id, today)

    if combined is None:
        return RuleBasedResult(
            risk_score=None,
            components=components,
            confidence=RiskConfidence.LOW,
            total_records=total_records,
            history_days=history_days,
        )

    confidence = risk_config.resolve_confidence(total_records, history_days)

    return RuleBasedResult(
        risk_score=combined,
        components=components,
        factors=_build_factors(components),
        positive_factors=_build_positive_factors(components),
        feature_summary=_build_feature_summary(components, total_records, history_days),
        confidence=confidence,
        total_records=total_records,
        history_days=history_days,
    )


def _earliest_record_span(db: Session, vendor_id: int, today: date) -> int:
    from ..models import Incident, PurchaseOrder, QualityEvaluation

    anchors: list[date] = []
    for model, field_name in (
        (PurchaseOrder, "order_date"),
        (QualityEvaluation, "evaluation_date"),
        (Incident, "reported_date"),
    ):
        value = (
            db.query(getattr(model, field_name))
            .filter(model.vendor_id == vendor_id, getattr(model, field_name).isnot(None))
            .order_by(getattr(model, field_name).asc())
            .first()
        )
        if value is not None and value[0] is not None:
            anchors.append(value[0])
    if not anchors:
        return 0
    return max(0, (today - min(anchors)).days)


def compute_risk_trend(db: Session, vendor: Vendor) -> RiskTrend:
    """Risk trend from recent vs previous rule-based windows (no fabricated data)."""
    today = date.today()
    window = timedelta(days=risk_config.TREND_WINDOW_DAYS)
    recent_start = today - window
    previous_start = today - (2 * window)

    _, recent = compute_rule_based_components(db, vendor, recent_start, today)
    _, previous = compute_rule_based_components(
        db, vendor, previous_start, recent_start - timedelta(days=1)
    )
    if recent is None or previous is None:
        return RiskTrend.INSUFFICIENT_DATA

    change = previous - recent
    if change >= risk_config.TREND_CHANGE_THRESHOLD:
        return RiskTrend.IMPROVING
    if change <= -risk_config.TREND_CHANGE_THRESHOLD:
        return RiskTrend.WORSENING
    return RiskTrend.STABLE