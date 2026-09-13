"""Feature engineering for Phase 9 predictive risk analytics.

All features are computed deterministically from real vendor records. Features
never contain ``None``: counts default to zero and derived rates default to
zero when there is no underlying data (documented per feature). Rows with no
recorded activity are filtered out by the training dataset builder instead of
being "filled in", so missing data is never fabricated.
"""

from datetime import date

from sqlalchemy.orm import Session

from ...models import Contract, Incident, PurchaseOrder, QualityEvaluation, Vendor
from ...models.enums import (
    ContractStatus,
    IncidentSeverity,
    IncidentStatus,
    PurchaseOrderStatus,
    VendorPerformanceClassification,
)
from ...schemas.vendor_performance import (
    DeliveryPerformanceSubscore,
    IncidentPerformanceSubscore,
    QualityPerformanceSubscore,
)
from ..vendor_performance import (  # noqa: WPS437 -- intentional same-package reuse
    _score_delivery_rows,
    _score_incident_rows,
    _score_quality_values,
)

# Order of the feature vector. Risk model training and prediction share this
# exact list so shapes always match.
FEATURE_COLUMNS: tuple[str, ...] = (
    # Delivery
    "total_orders",
    "completed_orders",
    "delayed_orders",
    "delayed_delivery_rate",
    "on_time_delivery_rate",
    "average_delivery_delay",
    # Quality
    "total_quality_evaluations",
    "average_quality_score",
    "lowest_quality_score",
    "quality_score_trend",
    # Incidents
    "total_incidents",
    "open_incidents",
    "resolved_incidents",
    "critical_incidents",
    "high_severity_incidents",
    "incident_frequency",
    # Performance (Phase 7 component scores)
    "delivery_score",
    "quality_score",
    "incident_score",
    "overall_performance_score",
    "performance_classification",
    # Contract
    "total_contracts",
    "active_contracts",
    # Operational
    "active_purchase_orders",
    "vendor_workload",
    "recent_order_volume",
    # Data
    "historical_record_count",
    "vendor_history_duration",
)

_CLASSIFICATION_ORDINAL: dict[VendorPerformanceClassification, float] = {
    VendorPerformanceClassification.EXCELLENT: 5.0,
    VendorPerformanceClassification.GOOD: 4.0,
    VendorPerformanceClassification.AVERAGE: 3.0,
    VendorPerformanceClassification.POOR: 2.0,
    VendorPerformanceClassification.CRITICAL: 1.0,
    VendorPerformanceClassification.INSUFFICIENT_DATA: 0.0,
}

_ACTIVE_ORDER_STATUSES = (
    PurchaseOrderStatus.ISSUED,
    PurchaseOrderStatus.IN_PROGRESS,
    PurchaseOrderStatus.PARTIALLY_DELIVERED,
)

_OPEN_STATUSES = (IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS)


def _round2(value: float) -> float:
    return round(value, 2)


def _quality_trend(values: list[tuple[date, int]]) -> float:
    """Slope of quality score over time (or 0 when fewer than 2 points)."""
    if len(values) < 2:
        return 0.0
    xs = [(evaluation_date - values[0][0]).days for evaluation_date, _ in values]
    ys = [score for _, score in values]
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    var = sum((x - mean_x) ** 2 for x in xs)
    if var == 0:
        return 0.0
    return _round2(cov / var)


def _elapsed_months(start: date, end: date) -> float:
    days = max(1, (end - start).days)
    return max(1.0, days / 30.44)


def build_period_features(
    db: Session,
    vendor_id: int,
    start: date | None,
    end: date | None,
) -> dict[str, float]:
    """Feature vector for ``vendor_id`` over the inclusive ``[start, end]``.

    ``start``/``end`` of ``None`` scope the vector to the full record history
    (equivalent to all recorded data).
    """
    conditions = [PurchaseOrder.vendor_id == vendor_id]
    if start is not None:
        conditions.append(PurchaseOrder.order_date >= start)
    if end is not None:
        conditions.append(PurchaseOrder.order_date <= end)
    delivery_rows = (
        db.query(
            PurchaseOrder.actual_delivery_date,
            PurchaseOrder.expected_delivery_date,
        )
        .filter(*conditions)
        .all()
    )

    q_conditions = [QualityEvaluation.vendor_id == vendor_id]
    if start is not None:
        q_conditions.append(QualityEvaluation.evaluation_date >= start)
    if end is not None:
        q_conditions.append(QualityEvaluation.evaluation_date <= end)
    quality_rows = (
        db.query(
            QualityEvaluation.evaluation_date,
            QualityEvaluation.quality_score,
        )
        .filter(*q_conditions)
        .all()
    )

    i_conditions = [Incident.vendor_id == vendor_id]
    if start is not None:
        i_conditions.append(Incident.reported_date >= start)
    if end is not None:
        i_conditions.append(Incident.reported_date <= end)
    incidents = db.query(Incident).filter(*i_conditions).all()

    delivery_score, total_orders, completed, _, delayed, _ = _score_delivery_rows(
        delivery_rows
    )
    avg_quality, total_quality = _score_quality_values(
        [row[1] for row in quality_rows]
    )
    incident_result = _score_incident_rows(incidents)

    # Phase 7 overall performance (delivery/quality/incident, renormalized).
    available: dict[str, float] = {}
    if delivery_score is not None:
        available["delivery"] = delivery_score
    if avg_quality is not None:
        available["quality"] = avg_quality
    available["incident"] = incident_result["score"]
    overall_score = 0.0
    if available:
        from ..vendor_performance import COMPONENT_WEIGHTS

        weight_sum = sum(COMPONENT_WEIGHTS[name] for name in available)
        overall_score = round(
            sum(available[name] * COMPONENT_WEIGHTS[name] for name in available)
            / weight_sum,
            2,
        )
    if not available:
        classification = _CLASSIFICATION_ORDINAL[
            VendorPerformanceClassification.INSUFFICIENT_DATA
        ]
    else:
        from ..vendor_performance import classify_performance

        classification = _CLASSIFICATION_ORDINAL[classify_performance(overall_score)]

    # Contracts as of period end.
    as_of = end or date.today()
    from_start = start or date(1970, 1, 1)
    contracts = (
        db.query(Contract)
        .filter(
            Contract.vendor_id == vendor_id,
            Contract.start_date <= as_of,
        )
        .all()
    )
    active_contracts = sum(
        1
        for contract in contracts
        if contract.status == ContractStatus.ACTIVE
        and contract.is_active
        and contract.end_date >= from_start
    )

    # Outstanding orders as of period end + orders placed in the period.
    outstanding = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.in_(_ACTIVE_ORDER_STATUSES),
            PurchaseOrder.order_date <= as_of,
        )
        .count()
    )
    recent_order_volume = total_orders

    open_incidents = sum(
        1 for incident in incidents if incident.status in _OPEN_STATUSES
    )
    resolved_incidents = sum(
        1 for incident in incidents if incident.status == IncidentStatus.RESOLVED
    )
    critical_incidents = sum(
        1 for incident in incidents if incident.severity == IncidentSeverity.CRITICAL
    )
    high_incidents = sum(
        1 for incident in incidents if incident.severity == IncidentSeverity.HIGH
    )

    # Record history span for confidence-related features.
    history_span = 0.0
    vendor = db.get(Vendor, vendor_id)
    if vendor is not None:
        anchor = vendor.vendor_since
        if anchor is None:
            dates = [
                row[0] for row in quality_rows
            ] + [incident.reported_date for incident in incidents] + [
                row[1] for row in delivery_rows if row[1] is not None
            ]
            if dates:
                anchor = min(dates)
        if anchor is not None:
            history_span = max(0.0, float((as_of - anchor).days))

    features: dict[str, float] = {
        # Delivery
        "total_orders": float(total_orders),
        "completed_orders": float(completed),
        "delayed_orders": float(delayed),
        "delayed_delivery_rate": (
            round(delayed / completed * 100, 2) if completed else 0.0
        ),
        "on_time_delivery_rate": (
            round((completed - delayed) / completed * 100, 2) if completed else 0.0
        ),
        "average_delivery_delay": 0.0,
        # Quality
        "total_quality_evaluations": float(total_quality),
        "average_quality_score": float(avg_quality or 0.0),
        "lowest_quality_score": float(min([row[1] for row in quality_rows], default=0)),
        "quality_score_trend": _quality_trend(quality_rows),
        # Incidents
        "total_incidents": float(len(incidents)),
        "open_incidents": float(open_incidents),
        "resolved_incidents": float(resolved_incidents),
        "critical_incidents": float(critical_incidents),
        "high_severity_incidents": float(high_incidents),
        "incident_frequency": _round2(
            len(incidents) / _elapsed_months(from_start, as_of)
        ),
        # Performance
        "delivery_score": float(delivery_score or 0.0),
        "quality_score": float(avg_quality or 0.0),
        "incident_score": float(incident_result["score"]),
        "overall_performance_score": float(overall_score),
        "performance_classification": classification,
        # Contract
        "total_contracts": float(len(contracts)),
        "active_contracts": float(active_contracts),
        # Operational
        "active_purchase_orders": float(outstanding),
        "vendor_workload": float(outstanding + recent_order_volume),
        "recent_order_volume": float(recent_order_volume),
        # Data
        "historical_record_count": float(
            len(delivery_rows) + total_quality + len(incidents)
        ),
        "vendor_history_duration": round(history_span, 2),
    }

    # Average delay (only over completed deliveries that were delayed).
    delayed_logs = [
        (actual - expected).days
        for actual, expected in delivery_rows
        if actual is not None and actual > expected
    ]
    if delayed_logs:
        features["average_delivery_delay"] = _round2(
            sum(delayed_logs) / len(delayed_logs)
        )
    return features


def build_vendor_features(db: Session, vendor_id: int) -> dict[str, float]:
    """Feature vector for ``vendor_id`` over its full recorded history."""
    return build_period_features(db, vendor_id, None, None)


def feature_vector(features: dict[str, float]) -> list[float]:
    """Fixed-order numeric vector matching ``FEATURE_COLUMNS``."""
    return [float(features[column]) for column in FEATURE_COLUMNS]


def feature_names() -> list[str]:
    return list(FEATURE_COLUMNS)