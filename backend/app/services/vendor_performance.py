from datetime import date

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db.repository import find_docs
from ..models import Incident, PurchaseOrder, QualityEvaluation, Vendor
from ..models.enums import IncidentSeverity, IncidentStatus, VendorPerformanceClassification
from ..models.purchase_order import compute_delivery
from ..schemas.vendor_performance import (
    DeliveryPerformanceSubscore,
    IncidentPerformanceSubscore,
    PaginatedVendorPerformance,
    QualityPerformanceSubscore,
    VendorPerformanceDetail,
    VendorPerformanceListItem,
    VendorPerformanceStatistics,
)

# Component weights (only available components are normalized).
COMPONENT_WEIGHTS = {"delivery": 0.40, "quality": 0.35, "incident": 0.25}
COMPONENT_NAMES = ("delivery", "quality", "incident")

# Benchmark targets used in insight text.
DELIVERY_TARGET = 85
QUALITY_TARGET = 80
INCIDENT_TARGET = 80

# Incident penalty rules.
SEVERITY_PENALTY: dict[IncidentSeverity, float] = {
    IncidentSeverity.LOW: 1,
    IncidentSeverity.MEDIUM: 3,
    IncidentSeverity.HIGH: 6,
    IncidentSeverity.CRITICAL: 10,
}
STATUS_FACTOR: dict[IncidentStatus, float] = {
    IncidentStatus.OPEN: 1.0,
    IncidentStatus.IN_PROGRESS: 1.0,
    IncidentStatus.RESOLVED: 0.5,
    IncidentStatus.CLOSED: 0.25,
}
OPEN_STATUSES = (IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS)
OVERDUE_PENALTY = 2.0
OVERDUE_PENALTY_CAP = 10.0
DELAY_PENALTY_CAP = 20.0

# Classification bands.
CLASSIFICATION_RANGES: tuple[tuple[float, VendorPerformanceClassification], ...] = (
    (85.0, VendorPerformanceClassification.EXCELLENT),
    (70.0, VendorPerformanceClassification.GOOD),
    (50.0, VendorPerformanceClassification.AVERAGE),
    (30.0, VendorPerformanceClassification.POOR),
    (0.0, VendorPerformanceClassification.CRITICAL),
)

LIMITED_DATA_CONFIDENCE = 66.67


def _round2(value: float) -> float:
    return round(value, 2)


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return max(lower, min(upper, value))


def _plural(noun: str, count: int) -> str:
    return noun if count == 1 else f"{noun}s"


def classify_performance(overall_score: float | None) -> VendorPerformanceClassification:
    """Map an overall score to a performance classification band."""
    if overall_score is None:
        return VendorPerformanceClassification.INSUFFICIENT_DATA
    for threshold, classification in CLASSIFICATION_RANGES:
        if overall_score >= threshold:
            return classification
    return VendorPerformanceClassification.CRITICAL


def _column_criteria(
    vendor_id: int | None,
    start_date: date | None,
    end_date: date | None,
    date_field: str,
) -> dict:
    """Compile the SQLAlchemy-filter equivalent as a Mongo criteria dict.

    Date-only columns are stored as ``YYYY-MM-DD`` ISO strings so the range
    comparison is lexicographic and inclusive.
    """
    criteria: dict = {}
    if vendor_id is not None:
        criteria["vendor_id"] = vendor_id
    start = start_date.isoformat() if start_date else None
    end = end_date.isoformat() if end_date else None
    if start or end:
        q: dict[str, str] = {}
        if start:
            q["$gte"] = start
        if end:
            q["$lte"] = end
        criteria[date_field] = q
    return criteria


def _score_delivery_rows(rows: list[tuple[date | None, date]]) -> tuple:
    """Pure delivery scoring over (actual_delivery_date, expected_delivery_date)."""
    total_orders = len(rows)
    completed = [row for row in rows if row[0] is not None]
    if not completed:
        return (None, total_orders, 0, 0, 0, False)

    on_time = 0
    delayed = 0
    total_delay_days = 0
    for actual, expected in completed:
        status, delay_days = compute_delivery(actual, expected)
        if status == "ON_TIME":
            on_time += 1
        else:
            delayed += 1
            total_delay_days += int(delay_days or 0)

    on_time_rate = (on_time / len(completed)) * 100
    penalty = min(float(total_delay_days), DELAY_PENALTY_CAP)
    score = _round2(_clamp(on_time_rate - penalty))
    return (score, total_orders, len(completed), on_time, delayed, True)


def _delivery_subscore_from_pairs(
    pairs: list[tuple[date | None, date]],
) -> DeliveryPerformanceSubscore:
    """Delivery subscore computed purely from ``(actual, expected)`` pairs."""
    score, total_orders, completed, on_time, delayed, available = _score_delivery_rows(pairs)
    return DeliveryPerformanceSubscore(
        score=score,
        total_orders=total_orders,
        completed_deliveries=completed,
        on_time_deliveries=on_time,
        delayed_deliveries=delayed,
        data_available=available,
    )


def _quality_subscore_from_values(values: list[int]) -> QualityPerformanceSubscore:
    """Quality subscore computed purely from quality evaluation scores."""
    average, total = _score_quality_values(values)
    return QualityPerformanceSubscore(
        score=average,
        total_evaluations=total,
        average_quality_score=average,
        data_available=total > 0,
    )


def _incident_subscore_from_rows(incidents: list[Incident]) -> IncidentPerformanceSubscore:
    """Incident subscore computed purely from incident models."""
    result = _score_incident_rows(incidents)
    counts = result["counts"]
    return IncidentPerformanceSubscore(
        score=result["score"],
        total_incidents=len(incidents),
        open=counts["open"],
        in_progress=counts["in_progress"],
        resolved=counts["resolved"],
        closed=counts["closed"],
        critical=counts["critical"],
        high=counts["high"],
        medium=counts["medium"],
        low=counts["low"],
        overdue=counts["overdue"],
        data_available=True,
    )


async def compute_delivery_score(
    db: AsyncIOMotorDatabase,
    vendor_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> DeliveryPerformanceSubscore:
    """Score delivery performance from recorded purchase order deliveries.

    Completed deliveries are purchase orders with an ``actual_delivery_date``.
    The base score is the on-time rate (on-time / completed * 100) reduced by a
    delay penalty (total delay days, capped at 20 points). Scores are clamped
    to 0-100. Deliveries are never fake or estimated.

    When ``vendor_id`` is None all vendors are scored; ``start_date`` and
    ``end_date`` (inclusive, applied to ``order_date``) scope the results to a
    historical period without changing the scoring math.
    """
    criteria = _column_criteria(vendor_id, start_date, end_date, "order_date")
    rows = await find_docs(
        db,
        "purchase_orders",
        None,
        criteria,
        project={"actual_delivery_date": 1, "expected_delivery_date": 1, "_id": 0},
    )
    pairs = [
        (
            date.fromisoformat(row["actual_delivery_date"])
            if row.get("actual_delivery_date")
            else None,
            date.fromisoformat(row["expected_delivery_date"])
            if row.get("expected_delivery_date")
            else None,
        )
        for row in rows
    ]
    return _delivery_subscore_from_pairs(pairs)


def _score_quality_values(values: list[int]) -> tuple[float | None, int]:
    """Pure quality scoring over raw quality evaluation scores."""
    total = len(values)
    if total == 0:
        return (None, 0)
    return (_round2(sum(values) / total), total)


async def compute_quality_score(
    db: AsyncIOMotorDatabase,
    vendor_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> QualityPerformanceSubscore:
    """Score quality performance as the average quality evaluation score (0-100).

    ``start_date``/``end_date`` (inclusive) scope records by ``evaluation_date``.
    """
    criteria = _column_criteria(vendor_id, start_date, end_date, "evaluation_date")
    rows = await find_docs(
        db,
        "quality_evaluations",
        None,
        criteria,
        project={"quality_score": 1, "_id": 0},
    )
    return _quality_subscore_from_values([row["quality_score"] for row in rows])


def _score_incident_rows(incidents: list[Incident]) -> dict:
    """Pure incident scoring over Incident ORM objects (see compute_incident_score)."""
    counts: dict[str, int] = {
        "open": 0,
        "in_progress": 0,
        "resolved": 0,
        "closed": 0,
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "overdue": 0,
    }
    if not incidents:
        return {"score": 100.0, "counts": counts}

    today = date.today()
    penalty_total = 0.0
    overdue_total = 0.0
    for incident in incidents:
        if incident.status == IncidentStatus.OPEN:
            counts["open"] += 1
        elif incident.status == IncidentStatus.IN_PROGRESS:
            counts["in_progress"] += 1
        elif incident.status == IncidentStatus.RESOLVED:
            counts["resolved"] += 1
        else:
            counts["closed"] += 1

        if incident.severity == IncidentSeverity.CRITICAL:
            counts["critical"] += 1
        elif incident.severity == IncidentSeverity.HIGH:
            counts["high"] += 1
        elif incident.severity == IncidentSeverity.MEDIUM:
            counts["medium"] += 1
        else:
            counts["low"] += 1

        impact_factor = incident.impact_score / 10.0
        penalty_total += (
            SEVERITY_PENALTY[incident.severity]
            * impact_factor
            * STATUS_FACTOR[incident.status]
        )

        if (
            incident.status in OPEN_STATUSES
            and incident.due_date is not None
            and incident.due_date < today
        ):
            counts["overdue"] += 1
            overdue_total += OVERDUE_PENALTY

    overdue_capped = min(overdue_total, OVERDUE_PENALTY_CAP)
    score = _round2(_clamp(100 - penalty_total - overdue_capped))
    return {"score": score, "counts": counts}


async def compute_incident_score(
    db: AsyncIOMotorDatabase,
    vendor_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> IncidentPerformanceSubscore:
    """Score incident performance as 100 minus severity/impact/status penalties.

    Penalty per incident = severity weight x (impact score / 10) x status
    factor; overdue incidents add 2 more points (total overdue penalty capped
    at 10). Zero incidents always scores 100 and counts as available data.

    ``start_date``/``end_date`` (inclusive) scope records by ``reported_date``.
    """
    criteria = _column_criteria(vendor_id, start_date, end_date, "reported_date")
    incidents = await find_docs(db, "incidents", Incident, criteria)
    return _incident_subscore_from_rows(incidents)


def _combine_scores(
    vendor: Vendor,
    delivery: DeliveryPerformanceSubscore,
    quality: QualityPerformanceSubscore,
    incidents: IncidentPerformanceSubscore,
) -> tuple[float | None, float, float, list[str], list[str]]:
    """Merge component scores into an overall score using dynamic weights.

    Returns (overall_score, data_confidence, limited_data, available, missing).
    Unavailable components are excluded and the remaining weights are
    renormalized so a partially-scored vendor is not unfairly penalized.
    """
    available: list[str] = []
    scores: dict[str, float] = {}
    has_records = (
        delivery.total_orders + quality.total_evaluations + incidents.total_incidents > 0
    )
    if delivery.data_available and delivery.score is not None:
        available.append("delivery")
        scores["delivery"] = delivery.score
    if quality.data_available and quality.score is not None:
        available.append("quality")
        scores["quality"] = quality.score
    if incidents.data_available and has_records:
        available.append("incident")
        scores["incident"] = incidents.score

    missing = [name for name in COMPONENT_NAMES if name not in available]

    if not available:
        return None, 0.0, True, [], missing

    weight_sum = sum(COMPONENT_WEIGHTS[name] for name in available)
    overall = (
        sum(scores[name] * COMPONENT_WEIGHTS[name] for name in available)
        / weight_sum
    )
    overall = _round2(overall)

    confidence = _round2((len(available) / len(COMPONENT_NAMES)) * 100)
    limited = confidence < LIMITED_DATA_CONFIDENCE
    return overall, confidence, limited, available, missing


def _build_insights(
    vendor_name: str,
    overall_score: float | None,
    confidence: float,
    limited: bool,
    available: list[str],
    missing: list[str],
    delivery: DeliveryPerformanceSubscore,
    quality: QualityPerformanceSubscore,
    incidents: IncidentPerformanceSubscore,
) -> tuple[list[str], list[str], list[str]]:
    """Generate deterministic, fact-based strengths/weaknesses/attention areas."""
    strengths: list[str] = []
    weaknesses: list[str] = []
    attention: list[str] = []

    if "delivery" in available and delivery.score is not None and delivery.score >= 85:
        strengths.append(
            f"Delivery performance is excellent: {delivery.on_time_deliveries} of "
            f"{delivery.completed_deliveries} deliveries were on time."
        )
    if "quality" in available and quality.score is not None and quality.score >= 85:
        strengths.append(
            f"Quality is excellent with an average evaluation score of "
            f"{quality.score}/100 across {quality.total_evaluations} evaluations."
        )
    if "incident" in available and incidents.score >= 85:
        strengths.append(
            f"Operational incidents are under control with an incident score of "
            f"{incidents.score}/100."
        )

    if "delivery" in available and delivery.score is not None and delivery.score < 60:
        weaknesses.append(
            f"Delivery performance is weak ({delivery.score}/100) with "
            f"{delivery.delayed_deliveries} delayed delivery "
            f"{_plural('order', delivery.delayed_deliveries)}."
        )
    if "quality" in available and quality.score is not None and quality.score < 60:
        weaknesses.append(
            f"Quality performance is weak ({quality.score}/100) based on "
            f"{quality.total_evaluations} evaluation{_plural('', quality.total_evaluations)}."
        )
    if "incident" in available and incidents.score < 60:
        weaknesses.append(
            f"Incident performance is a concern ({incidents.score}/100) with "
            f"{incidents.total_incidents} incident{_plural('', incidents.total_incidents)}."
        )

    unresolved = incidents.open + incidents.in_progress
    if unresolved > 0:
        weaknesses.append(
            f"{unresolved} unresolved incident{'s' if unresolved != 1 else ''} require attention."
        )
    if incidents.critical > 0:
        weaknesses.append(
            f"{incidents.critical} critical incident{'s' if incidents.critical != 1 else ''} were reported."
        )
    if incidents.overdue > 0:
        weaknesses.append(
            f"{incidents.overdue} overdue incident{'s' if incidents.overdue != 1 else ''} need immediate resolution."
        )

    component_scores = {
        "delivery": delivery.score if "delivery" in available else None,
        "quality": quality.score if "quality" in available else None,
        "incident": incidents.score if "incident" in available else None,
    }
    targets = {
        "delivery": DELIVERY_TARGET,
        "quality": QUALITY_TARGET,
        "incident": INCIDENT_TARGET,
    }
    for name in COMPONENT_NAMES:
        score = component_scores[name]
        if score is not None and score < targets[name]:
            attention.append(
                f"{name.capitalize()} performance ({score}/100) is below the "
                f"{targets[name]} target."
            )

    if "delivery" not in available:
        attention.append("No completed deliveries are recorded yet, so no delivery data is available.")
    if "quality" not in available:
        attention.append("No quality evaluations are recorded yet, so no quality data is available.")

    if limited:
        attention.append(
            f"Based on limited data (data confidence {confidence}%) — add delivery, "
            "quality, or incident records to improve accuracy."
        )

    if overall_score is None:
        attention.append(
            f"No performance data is available for {vendor_name} yet. Record deliveries, "
            "quality evaluations, or incidents to generate a score."
        )

    return strengths, weaknesses, attention


async def build_vendor_performance(
    db: AsyncIOMotorDatabase,
    vendor: Vendor,
    start_date: date | None = None,
    end_date: date | None = None,
) -> VendorPerformanceDetail:
    """Compute the full performance profile for a single vendor.

    Optional ``start_date``/``end_date`` scope component data to a period
    using the same scoring math (used by historical analytics).
    """
    delivery = await compute_delivery_score(db, vendor.id, start_date, end_date)
    quality = await compute_quality_score(db, vendor.id, start_date, end_date)
    incidents = await compute_incident_score(db, vendor.id, start_date, end_date)
    overall, confidence, limited, available, missing = _combine_scores(
        vendor, delivery, quality, incidents
    )
    strengths, weaknesses, attention = _build_insights(
        vendor.company_name,
        overall,
        confidence,
        limited,
        available,
        missing,
        delivery,
        quality,
        incidents,
    )
    return VendorPerformanceDetail(
        vendor_id=vendor.id,
        vendor_name=vendor.company_name,
        vendor_code=vendor.vendor_code,
        overall_score=overall,
        classification=classify_performance(overall),
        limited_data=limited,
        data_confidence=confidence,
        available_components=available,
        missing_components=missing,
        delivery=delivery,
        quality=quality,
        incidents=incidents,
        strengths=strengths,
        weaknesses=weaknesses,
        attention_areas=attention,
    )


def _performance_item_from_subscores(
    vendor: Vendor,
    delivery: DeliveryPerformanceSubscore,
    quality: QualityPerformanceSubscore,
    incidents: IncidentPerformanceSubscore,
) -> VendorPerformanceListItem:
    """Compact list representation derived from pre-computed subscores."""
    overall, confidence, limited, available, missing = _combine_scores(
        vendor, delivery, quality, incidents
    )
    return VendorPerformanceListItem(
        vendor_id=vendor.id,
        vendor_name=vendor.company_name,
        vendor_code=vendor.vendor_code,
        overall_score=overall,
        classification=classify_performance(overall),
        limited_data=limited,
        data_confidence=confidence,
        delivery_score=delivery.score,
        quality_score=quality.score,
        incident_score=incidents.score,
        available_components=available,
        missing_components=missing,
    )


async def build_performance_list_item(
    db: AsyncIOMotorDatabase,
    vendor: Vendor,
    start_date: date | None = None,
    end_date: date | None = None,
) -> VendorPerformanceListItem:
    """Compute the compact list representation for one vendor.

    ``start_date``/``end_date`` optionally scope component data to a period.
    """
    delivery = await compute_delivery_score(db, vendor.id, start_date, end_date)
    quality = await compute_quality_score(db, vendor.id, start_date, end_date)
    incidents = await compute_incident_score(db, vendor.id, start_date, end_date)
    return _performance_item_from_subscores(vendor, delivery, quality, incidents)


async def build_performance_list_items(
    db: AsyncIOMotorDatabase,
    vendors: list[Vendor],
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[VendorPerformanceListItem]:
    """Compute list representations for many vendors with 3 queries total.

    Replaces the per-vendor N+1 pattern (which issued 3 sequential queries per
    vendor) with one query per source collection, followed by pure in-memory
    scoring — identical math, far fewer round trips.
    """
    if not vendors:
        return []
    vendor_ids = [vendor.id for vendor in vendors]
    in_clause = {"vendor_id": {"$in": vendor_ids}}

    delivery_criteria = _column_criteria(None, start_date, end_date, "order_date")
    delivery_criteria.update(in_clause)
    delivery_docs = await find_docs(
        db,
        "purchase_orders",
        None,
        delivery_criteria,
        project={
            "vendor_id": 1,
            "actual_delivery_date": 1,
            "expected_delivery_date": 1,
            "_id": 0,
        },
    )
    delivery_by_vendor: dict[int, list[tuple[date | None, date]]] = {}
    for row in delivery_docs:
        delivery_by_vendor.setdefault(row["vendor_id"], []).append(
            (
                date.fromisoformat(row["actual_delivery_date"])
                if row.get("actual_delivery_date")
                else None,
                date.fromisoformat(row["expected_delivery_date"])
                if row.get("expected_delivery_date")
                else None,
            )
        )

    quality_criteria = _column_criteria(None, start_date, end_date, "evaluation_date")
    quality_criteria.update(in_clause)
    quality_docs = await find_docs(
        db,
        "quality_evaluations",
        None,
        quality_criteria,
        project={"vendor_id": 1, "quality_score": 1, "_id": 0},
    )
    quality_by_vendor: dict[int, list[int]] = {}
    for row in quality_docs:
        quality_by_vendor.setdefault(row["vendor_id"], []).append(row["quality_score"])

    incident_criteria = _column_criteria(None, start_date, end_date, "reported_date")
    incident_criteria.update(in_clause)
    incident_docs = await find_docs(db, "incidents", Incident, incident_criteria)
    incidents_by_vendor: dict[int, list[Incident]] = {}
    for incident in incident_docs:
        incidents_by_vendor.setdefault(incident.vendor_id, []).append(incident)

    items: list[VendorPerformanceListItem] = []
    for vendor in vendors:
        delivery = _delivery_subscore_from_pairs(
            delivery_by_vendor.get(vendor.id, [])
        )
        quality = _quality_subscore_from_values(
            quality_by_vendor.get(vendor.id, [])
        )
        incidents = _incident_subscore_from_rows(
            incidents_by_vendor.get(vendor.id, [])
        )
        items.append(_performance_item_from_subscores(vendor, delivery, quality, incidents))
    return items


async def compute_performance_statistics(
    db: AsyncIOMotorDatabase, vendors: list[Vendor] | None = None
) -> VendorPerformanceStatistics:
    """Statistics for the performance dashboard cards (real data only)."""
    if vendors is None:
        vendors = await find_docs(db, "vendors", Vendor, {})
    items = await build_performance_list_items(db, vendors)
    counts: dict[VendorPerformanceClassification, int] = {
        VendorPerformanceClassification.EXCELLENT: 0,
        VendorPerformanceClassification.GOOD: 0,
        VendorPerformanceClassification.AVERAGE: 0,
        VendorPerformanceClassification.POOR: 0,
        VendorPerformanceClassification.CRITICAL: 0,
        VendorPerformanceClassification.INSUFFICIENT_DATA: 0,
    }
    limited_data = 0
    for item in items:
        counts[item.classification] += 1
        if item.limited_data:
            limited_data += 1
    return VendorPerformanceStatistics(
        total_vendors=len(items),
        excellent=counts[VendorPerformanceClassification.EXCELLENT],
        good=counts[VendorPerformanceClassification.GOOD],
        average=counts[VendorPerformanceClassification.AVERAGE],
        poor=counts[VendorPerformanceClassification.POOR],
        critical=counts[VendorPerformanceClassification.CRITICAL],
        insufficient_data=counts[VendorPerformanceClassification.INSUFFICIENT_DATA],
        requiring_attention=counts[VendorPerformanceClassification.POOR]
        + counts[VendorPerformanceClassification.CRITICAL],
        limited_data=limited_data,
    )


def paginate_items(
    items: list[VendorPerformanceListItem],
    page: int,
    page_size: int,
) -> PaginatedVendorPerformance:
    total = len(items)
    total_pages = (total + page_size - 1) // page_size if total else 0
    start = (page - 1) * page_size
    paged = items[start : start + page_size]
    return PaginatedVendorPerformance(
        items=paged,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )