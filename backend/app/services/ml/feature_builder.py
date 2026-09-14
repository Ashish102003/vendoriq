"""Feature engineering for Phase 9 predictive risk analytics.

All features are computed deterministically from real vendor records. Features
never contain ``None``: counts default to zero and derived rates default to
zero when there is no underlying data (documented per feature). Rows with no
recorded activity are filtered out by the training dataset builder instead of
being "filled in", so missing data is never fabricated.
"""

from datetime import date

from motor.motor_asyncio import AsyncIOMotorDatabase

from ...db.repository import count_docs, find_doc, find_docs
from ...models import Contract, Incident, Vendor
from ...models.enums import (
    ContractStatus,
    IncidentSeverity,
    IncidentStatus,
    PurchaseOrderStatus,
    VendorPerformanceClassification,
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


def _d(value) -> date | None:
    if value is None:
        return None
    return value if isinstance(value, date) else date.fromisoformat(value)


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


async def build_period_features(
    db: AsyncIOMotorDatabase,
    vendor_id: int,
    start: date | None,
    end: date | None,
) -> dict[str, float]:
    """Feature vector for ``vendor_id`` over the inclusive ``[start, end]``.

    ``start``/``end`` of ``None`` scope the vector to the full record history
    (equivalent to all recorded data).
    """
    po_criteria = {"vendor_id": vendor_id}
    if start is not None:
        po_criteria.setdefault("order_date", {})["$gte"] = start.isoformat()
    if end is not None:
        po_criteria.setdefault("order_date", {})["$lte"] = end.isoformat()
    delivery_rows_raw = await find_docs(
        db,
        "purchase_orders",
        None,
        po_criteria,
        project={"actual_delivery_date": 1, "expected_delivery_date": 1, "_id": 0},
    )
    delivery_rows = [
        (
            _d(row.get("actual_delivery_date")),
            _d(row["expected_delivery_date"]),
        )
        for row in delivery_rows_raw
    ]

    q_criteria = {"vendor_id": vendor_id}
    if start is not None:
        q_criteria.setdefault("evaluation_date", {})["$gte"] = start.isoformat()
    if end is not None:
        q_criteria.setdefault("evaluation_date", {})["$lte"] = end.isoformat()
    quality_rows_raw = await find_docs(
        db,
        "quality_evaluations",
        None,
        q_criteria,
        project={"evaluation_date": 1, "quality_score": 1, "_id": 0},
    )
    quality_rows = [(_d(row["evaluation_date"]), row["quality_score"]) for row in quality_rows_raw]

    i_criteria = {"vendor_id": vendor_id}
    if start is not None:
        i_criteria.setdefault("reported_date", {})["$gte"] = start.isoformat()
    if end is not None:
        i_criteria.setdefault("reported_date", {})["$lte"] = end.isoformat()
    incidents = await find_docs(db, "incidents", Incident, i_criteria)

    delivery_score, total_orders, completed, _, delayed, _ = _score_delivery_rows(
        delivery_rows
    )
    avg_quality, total_quality = _score_quality_values(
        [score for _, score in quality_rows]
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
    contracts = await find_docs(
        db,
        "contracts",
        Contract,
        {"vendor_id": vendor_id, "start_date": {"$lte": as_of.isoformat()}},
    )
    active_contracts = sum(
        1
        for contract in contracts
        if contract.status == ContractStatus.ACTIVE
        and contract.is_active
        and contract.end_date >= from_start
    )

    # Outstanding orders as of period end + orders placed in the period.
    outstanding = await count_docs(
        db,
        "purchase_orders",
        {
            "vendor_id": vendor_id,
            "status": {"$in": [s.value for s in _ACTIVE_ORDER_STATUSES]},
            "order_date": {"$lte": as_of.isoformat()},
        },
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
    vendor = await find_doc(db, "vendors", Vendor, {"id": vendor_id})
    if vendor is not None:
        anchor = vendor.vendor_since
        if anchor is None:
            dates = (
                [eval_date for eval_date, _ in quality_rows]
                + [incident.reported_date for incident in incidents]
                + [actual for actual, _ in delivery_rows if actual is not None]
            )
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
        "lowest_quality_score": float(min([score for _, score in quality_rows], default=0)),
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


async def build_vendor_features(
    db: AsyncIOMotorDatabase, vendor_id: int
) -> dict[str, float]:
    """Feature vector for ``vendor_id`` over its full recorded history."""
    return await build_period_features(db, vendor_id, None, None)


def feature_vector(features: dict[str, float]) -> list[float]:
    """Fixed-order numeric vector matching ``FEATURE_COLUMNS``."""
    return [float(features[column]) for column in FEATURE_COLUMNS]


def feature_names() -> list[str]:
    return list(FEATURE_COLUMNS)