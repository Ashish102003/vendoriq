from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Incident, PurchaseOrder, QualityEvaluation, Vendor, VendorCategory
from ..models.enums import (
    IncidentSeverity,
    IncidentStatus,
    VendorPerformanceClassification,
)
from ..schemas.analytics import (
    AnalyticsInsight,
    AnalyticsOverview,
    CategoryPerformance,
    CategoryPerformanceItem,
    DeliveryAnalytics,
    DeliveryTrend,
    DeliveryTrendPoint,
    IncidentAnalytics,
    IncidentSeverityDistribution,
    IncidentSeverityItem,
    IncidentTrend,
    IncidentTrendPoint,
    PerformanceDistribution,
    PerformanceDistributionItem,
    PerformanceTrend,
    PerformanceTrendPoint,
    QualityAnalytics,
    QualityTrend,
    QualityTrendPoint,
    VendorComparison,
    VendorComparisonMetric,
    VendorRanking,
    VendorRankingItem,
    CLASSIFICATION_LABELS,
    CLASSIFICATION_ORDER,
)
from ..schemas.vendor_performance import (
    DeliveryPerformanceSubscore,
    IncidentPerformanceSubscore,
    QualityPerformanceSubscore,
)
from .vendor_performance import (  # noqa: WPS437 -- intentional same-package reuse
    _combine_scores,
    _score_delivery_rows,
    _score_incident_rows,
    _score_quality_values,
    build_performance_list_item,
    build_vendor_performance,
)

# Default analytics window when no date range is supplied (last 6 months).
DEFAULT_RANGE_DAYS = 180

# Maximum range accepted for daily-granularity trend endpoints.
MAX_DAILY_RANGE_DAYS = 62

DISTRIBUTION_ATTENTION_CLASSIFICATIONS = (
    VendorPerformanceClassification.POOR,
    VendorPerformanceClassification.CRITICAL,
)


def _round2(value: float) -> float:
    return round(value, 2)


def _round1(value: float) -> float:
    return round(value, 1)


def resolve_date_range(
    start_date: date | None, end_date: date | None
) -> tuple[date, date]:
    """Resolve optional bounds into an inclusive [start, end] window.

    Defaults to the last ``DEFAULT_RANGE_DAYS`` days. Raises ValueError when
    start is after end.
    """
    today = date.today()
    if start_date is None and end_date is None:
        start, end = today - timedelta(days=DEFAULT_RANGE_DAYS), today
    elif start_date is None:
        end = end_date or today
        start = end - timedelta(days=DEFAULT_RANGE_DAYS)
    elif end_date is None:
        start, end = start_date, today
    else:
        start, end = start_date, end_date
    if start > end:
        raise ValueError("start_date must not be after end_date.")
    return start, end


def _month_buckets(
    start: date, end: date
) -> list[tuple[str, date, date]]:
    """Calendar-month buckets covering [start, end] (inclusive, clamped)."""
    buckets: list[tuple[str, date, date]] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        if month == 12:
            next_start = date(year + 1, 1, 1)
        else:
            next_start = date(year, month + 1, 1)
        month_start = date(year, month, 1)
        month_end = next_start - timedelta(days=1)
        buckets.append(
            (
                f"{year:04d}-{month:02d}",
                max(month_start, start),
                min(month_end, end),
            )
        )
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    return buckets


def _day_buckets(start: date, end: date) -> list[tuple[str, date, date]]:
    cursor = start
    one_day = timedelta(days=1)
    buckets = []
    while cursor <= end:
        buckets.append((cursor.isoformat(), cursor, cursor))
        cursor += one_day
    return buckets


def scoped_vendors(
    db: Session, vendor_id: int | None = None, category_id: int | None = None
) -> list[Vendor]:
    """Vendors matching the optional vendor/category filters."""
    query = db.query(Vendor)
    if vendor_id is not None:
        query = query.filter(Vendor.id == vendor_id)
    if category_id is not None:
        query = query.filter(Vendor.category_id == category_id)
    return query.all()


def _current_unresolved_map(
    db: Session, vendor_ids: set[int] | None
) -> dict[int, int]:
    """Current (open + in progress) incident counts per vendor."""
    query = db.query(Incident.vendor_id).filter(
        Incident.status.in_((IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS))
    )
    if vendor_ids is not None:
        query = query.filter(Incident.vendor_id.in_(vendor_ids))
    counts: dict[int, int] = {}
    for (vendor_id,) in query.all():
        counts[vendor_id] = counts.get(vendor_id, 0) + 1
    return counts


def _build_distribution(
    items: list, records_set: set[int] | None = None
) -> list[PerformanceDistributionItem]:
    """Distribution of current classifications.

    Vendors without any operational records are reported as Insufficient data
    instead of the engine's vacuously-100 incident score, so analytics never
    fabricates a strong score for a vendor with no history.
    """
    total = len(items)
    counts: dict[VendorPerformanceClassification, int] = {
        cls: 0 for cls in CLASSIFICATION_ORDER
    }
    for item in items:
        cls = item.classification
        if records_set is not None and item.vendor_id not in records_set:
            cls = VendorPerformanceClassification.INSUFFICIENT_DATA
        counts[cls] = counts.get(cls, 0) + 1
    return [
        PerformanceDistributionItem(
            classification=cls,
            label=CLASSIFICATION_LABELS[cls],
            count=counts[cls],
            percentage=_round1(counts[cls] / total * 100) if total else 0.0,
        )
        for cls in CLASSIFICATION_ORDER
    ]


def _vendor_ids_with_records(
    db: Session, vendor_ids: set[int] | None
) -> set[int]:
    """Vendor IDs that have at least one operational record (order, evaluation,
    or incident) — the definition of "real performance data" for analytics."""
    if not vendor_ids:
        return set()
    ids: set[int] = set()
    queries = (
        db.query(PurchaseOrder.vendor_id).filter(
            PurchaseOrder.vendor_id.in_(vendor_ids)
        ),
        db.query(QualityEvaluation.vendor_id).filter(
            QualityEvaluation.vendor_id.in_(vendor_ids)
        ),
        db.query(Incident.vendor_id).filter(
            Incident.vendor_id.in_(vendor_ids)
        ),
    )
    for query in queries:
        ids.update(row[0] for row in query.all())
    return ids


def build_distribution(db: Session, vendors: list[Vendor]) -> PerformanceDistribution:
    items = [build_performance_list_item(db, vendor) for vendor in vendors]
    records_set = _vendor_ids_with_records(db, {vendor.id for vendor in vendors})
    return PerformanceDistribution(
        total_vendors=len(items),
        items=_build_distribution(items, records_set),
    )


def build_vendor_ranking(db: Session, vendors: list[Vendor]) -> VendorRanking:
    items = [build_performance_list_item(db, vendor) for vendor in vendors]
    records_set = _vendor_ids_with_records(db, {vendor.id for vendor in vendors})
    scored = [
        item
        for item in items
        if item.overall_score is not None and item.vendor_id in records_set
    ]
    scored.sort(key=lambda item: item.overall_score or 0.0, reverse=True)
    ranking: list[VendorRankingItem] = []
    for rank, item in enumerate(scored, start=1):
        ranking.append(
            VendorRankingItem(
                rank=rank,
                vendor_id=item.vendor_id,
                vendor_name=item.vendor_name,
                vendor_code=item.vendor_code,
                overall_score=item.overall_score or 0.0,
                classification=item.classification,
                limited_data=item.limited_data,
                data_confidence=item.data_confidence,
                delivery_score=item.delivery_score,
                quality_score=item.quality_score,
                incident_score=item.incident_score,
            )
        )
    return VendorRanking(
        total_vendors=len(items),
        vendors_with_score=len(scored),
        items=ranking,
    )


def build_delivery_analytics(
    db: Session, vendor_ids: set[int] | None, start: date, end: date
) -> DeliveryAnalytics:
    query = db.query(
        PurchaseOrder.order_date,
        PurchaseOrder.actual_delivery_date,
        PurchaseOrder.expected_delivery_date,
    ).filter(
        PurchaseOrder.order_date >= start,
        PurchaseOrder.order_date <= end,
    )
    if vendor_ids is not None:
        query = query.filter(PurchaseOrder.vendor_id.in_(vendor_ids))
    rows = query.all()
    completed = [row for row in rows if row[1] is not None]
    on_time = 0
    delayed = 0
    total_delay = 0
    for _, actual, expected in completed:
        if actual <= expected:
            on_time += 1
        else:
            delayed += 1
            total_delay += (actual - expected).days
    on_time_rate = _round1(on_time / len(completed) * 100) if completed else None
    average_delay = _round1(total_delay / delayed) if delayed else None
    return DeliveryAnalytics(
        total_orders=len(rows),
        completed_orders=len(completed),
        pending_orders=len(rows) - len(completed),
        on_time_deliveries=on_time,
        delayed_deliveries=delayed,
        on_time_rate=on_time_rate,
        total_delay_days=total_delay,
        average_delay_days=average_delay,
    )


def build_quality_analytics(
    db: Session, vendor_ids: set[int] | None, start: date, end: date
) -> QualityAnalytics:
    query = db.query(
        func.count(QualityEvaluation.id),
        func.avg(QualityEvaluation.quality_score),
    ).filter(
        QualityEvaluation.evaluation_date >= start,
        QualityEvaluation.evaluation_date <= end,
    )
    if vendor_ids is not None:
        query = query.filter(QualityEvaluation.vendor_id.in_(vendor_ids))
    total, average = query.one()
    total = int(total or 0)
    average_score = _round1(float(average or 0.0)) if total else None
    return QualityAnalytics(
        total_evaluations=total,
        average_quality_score=average_score,
    )


def build_incident_analytics(
    db: Session, vendor_ids: set[int] | None, start: date, end: date
) -> IncidentAnalytics:
    query = db.query(Incident).filter(
        Incident.reported_date >= start,
        Incident.reported_date <= end,
    )
    if vendor_ids is not None:
        query = query.filter(Incident.vendor_id.in_(vendor_ids))
    incidents = query.all()
    status_counts: dict[IncidentStatus, int] = {
        IncidentStatus.OPEN: 0,
        IncidentStatus.IN_PROGRESS: 0,
        IncidentStatus.RESOLVED: 0,
        IncidentStatus.CLOSED: 0,
    }
    severity_counts: dict[IncidentSeverity, int] = {
        IncidentSeverity.CRITICAL: 0,
        IncidentSeverity.HIGH: 0,
        IncidentSeverity.MEDIUM: 0,
        IncidentSeverity.LOW: 0,
    }
    overdue = 0
    today = date.today()
    for incident in incidents:
        status_counts[incident.status] = status_counts.get(incident.status, 0) + 1
        severity_counts[incident.severity] = (
            severity_counts.get(incident.severity, 0) + 1
        )
        if (
            incident.status in (IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS)
            and incident.due_date is not None
            and incident.due_date < today
        ):
            overdue += 1
    total = len(incidents)
    resolved = status_counts[IncidentStatus.RESOLVED]
    closed = status_counts[IncidentStatus.CLOSED]
    resolution_rate = (
        _round1((resolved + closed) / total * 100) if total else None
    )
    return IncidentAnalytics(
        total_incidents=total,
        open=status_counts[IncidentStatus.OPEN],
        in_progress=status_counts[IncidentStatus.IN_PROGRESS],
        resolved=resolved,
        closed=closed,
        unresolved=status_counts[IncidentStatus.OPEN]
        + status_counts[IncidentStatus.IN_PROGRESS],
        critical=severity_counts[IncidentSeverity.CRITICAL],
        high=severity_counts[IncidentSeverity.HIGH],
        medium=severity_counts[IncidentSeverity.MEDIUM],
        low=severity_counts[IncidentSeverity.LOW],
        overdue=overdue,
        resolution_rate=resolution_rate,
    )


def _incident_rows_per_month(
    db: Session,
    vendor_ids: set[int] | None,
    start: date,
    end: date,
) -> list[Incident]:
    """Fetch incidents once; used to compute per-period scoring in memory."""
    query = db.query(Incident).filter(
        Incident.reported_date >= start,
        Incident.reported_date <= end,
    )
    if vendor_ids is not None:
        query = query.filter(Incident.vendor_id.in_(vendor_ids))
    return query.all()


def _incident_subscore(incidents: list[Incident]) -> IncidentPerformanceSubscore:
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


def _delivery_subscore(
    rows: list[tuple[date | None, date]],
) -> DeliveryPerformanceSubscore:
    score, total, completed, on_time, delayed, available = _score_delivery_rows(rows)
    return DeliveryPerformanceSubscore(
        score=score,
        total_orders=total,
        completed_deliveries=completed,
        on_time_deliveries=on_time,
        delayed_deliveries=delayed,
        data_available=available,
    )


def _quality_subscore(values: list[int]) -> QualityPerformanceSubscore:
    average, total = _score_quality_values(values)
    return QualityPerformanceSubscore(
        score=average,
        total_evaluations=total,
        average_quality_score=average,
        data_available=total > 0,
    )


def _period_overall(
    vendor: Vendor,
    delivery_rows: list[tuple[date | None, date]],
    quality_values: list[int],
    incident_rows: list[Incident],
) -> tuple[float | None, bool, list[str]]:
    """In-memory overall score for one vendor within a single period.

    A vendor with no records of any kind in the period contributes nothing
    (overall None), so historical trends never fabricate a score for months
    without source data. When a vendor has records but no incidents, the
    zero-incident incident component (score 100) still counts, matching the
    performance engine.
    """
    if not delivery_rows and not quality_values and not incident_rows:
        return None, True, []
    delivery = _delivery_subscore(delivery_rows)
    quality = _quality_subscore(quality_values)
    incidents = _incident_subscore(incident_rows)
    overall, confidence, limited, available, missing = _combine_scores(
        vendor, delivery, quality, incidents
    )
    return overall, limited, available


def build_delivery_trend(
    db: Session,
    vendors: list[Vendor],
    start: date,
    end: date,
    granularity: str = "monthly",
) -> DeliveryTrend:
    vendor_ids = {vendor.id for vendor in vendors}
    query = db.query(
        PurchaseOrder.order_date,
        PurchaseOrder.actual_delivery_date,
        PurchaseOrder.expected_delivery_date,
    ).filter(
        PurchaseOrder.order_date >= start,
        PurchaseOrder.order_date <= end,
    )
    if vendor_ids is not None:
        query = query.filter(PurchaseOrder.vendor_id.in_(vendor_ids))
    rows = query.all()
    if granularity == "daily":
        buckets = _day_buckets(start, end)
    else:
        buckets = _month_buckets(start, end)

    points: list[DeliveryTrendPoint] = []
    for period, bucket_start, bucket_end in buckets:
        subset = [
            row
            for row in rows
            if bucket_start <= row[0] <= bucket_end
        ]
        score, total, completed, on_time, delayed, available = _score_delivery_rows(
            [(actual, expected) for _, actual, expected in subset]
        )
        on_time_rate = (
            _round1(on_time / completed * 100) if completed else None
        )
        points.append(
            DeliveryTrendPoint(
                period=period,
                start_date=bucket_start,
                end_date=bucket_end,
                has_data=bool(subset),
                completed_deliveries=completed,
                on_time_rate=on_time_rate,
                delivery_score=score,
            )
        )
    summary = build_delivery_analytics(db, vendor_ids, start, end)
    has_sufficient_data = _has_sufficient_data(points)
    return DeliveryTrend(
        granularity=granularity,
        has_sufficient_data=has_sufficient_data,
        summary=summary,
        items=points,
    )


def build_quality_trend(
    db: Session,
    vendors: list[Vendor],
    start: date,
    end: date,
    granularity: str = "monthly",
) -> QualityTrend:
    vendor_ids = {vendor.id for vendor in vendors}
    query = db.query(
        QualityEvaluation.evaluation_date,
        QualityEvaluation.quality_score,
    ).filter(
        QualityEvaluation.evaluation_date >= start,
        QualityEvaluation.evaluation_date <= end,
    )
    if vendor_ids is not None:
        query = query.filter(QualityEvaluation.vendor_id.in_(vendor_ids))
    rows = query.all()
    if granularity == "daily":
        buckets = _day_buckets(start, end)
    else:
        buckets = _month_buckets(start, end)

    points: list[QualityTrendPoint] = []
    for period, bucket_start, bucket_end in buckets:
        subset = [
            row
            for row in rows
            if bucket_start <= row[0] <= bucket_end
        ]
        values = [score for _, score in subset]
        average, total = _score_quality_values(values)
        points.append(
            QualityTrendPoint(
                period=period,
                start_date=bucket_start,
                end_date=bucket_end,
                has_data=bool(subset),
                evaluations=total,
                average_score=average,
            )
        )
    summary = build_quality_analytics(db, vendor_ids, start, end)
    return QualityTrend(
        granularity=granularity,
        has_sufficient_data=_has_sufficient_data(points),
        summary=summary,
        items=points,
    )


def build_incident_trend(
    db: Session,
    vendors: list[Vendor],
    start: date,
    end: date,
    granularity: str = "monthly",
) -> IncidentTrend:
    vendor_ids = {vendor.id for vendor in vendors}
    incidents = _incident_rows_per_month(db, vendor_ids, start, end)
    if granularity == "daily":
        buckets = _day_buckets(start, end)
    else:
        buckets = _month_buckets(start, end)

    points: list[IncidentTrendPoint] = []
    for period, bucket_start, bucket_end in buckets:
        subset = [
            incident
            for incident in incidents
            if bucket_start <= incident.reported_date <= bucket_end
        ]
        subscore = _incident_subscore(subset)
        points.append(
            IncidentTrendPoint(
                period=period,
                start_date=bucket_start,
                end_date=bucket_end,
                has_data=bool(subset),
                incidents=subscore.total_incidents,
                unresolved=subscore.open + subscore.in_progress,
                critical=subscore.critical,
                incident_score=subscore.score,
            )
        )
    summary = build_incident_analytics(db, vendor_ids, start, end)
    return IncidentTrend(
        granularity=granularity,
        has_sufficient_data=_has_sufficient_data(points),
        summary=summary,
        items=points,
    )


def _has_sufficient_data(points: list) -> bool:
    """A trend is only meaningful when several periods contain source records."""
    with_data = [point for point in points if point.has_data]
    return len(points) >= 2 and len(with_data) >= 2


def build_performance_trend(
    db: Session,
    vendors: list[Vendor],
    start: date,
    end: date,
    granularity: str = "monthly",
) -> PerformanceTrend:
    vendor_ids = {vendor.id for vendor in vendors}

    d_query = db.query(
        PurchaseOrder.vendor_id,
        PurchaseOrder.order_date,
        PurchaseOrder.actual_delivery_date,
        PurchaseOrder.expected_delivery_date,
    ).filter(
        PurchaseOrder.order_date >= start,
        PurchaseOrder.order_date <= end,
    )
    if vendor_ids is not None:
        d_query = d_query.filter(PurchaseOrder.vendor_id.in_(vendor_ids))
    delivery_by_vendor: dict[int, list] = {}
    for vendor_id, order_date, actual, expected in d_query.all():
        delivery_by_vendor.setdefault(vendor_id, []).append(
            (order_date, actual, expected)
        )

    q_query = db.query(
        QualityEvaluation.vendor_id,
        QualityEvaluation.evaluation_date,
        QualityEvaluation.quality_score,
    ).filter(
        QualityEvaluation.evaluation_date >= start,
        QualityEvaluation.evaluation_date <= end,
    )
    if vendor_ids is not None:
        q_query = q_query.filter(QualityEvaluation.vendor_id.in_(vendor_ids))
    quality_by_vendor: dict[int, list] = {}
    for vendor_id, evaluation_date, quality_score in q_query.all():
        quality_by_vendor.setdefault(vendor_id, []).append(
            (evaluation_date, quality_score)
        )

    i_query = db.query(Incident).filter(
        Incident.reported_date >= start,
        Incident.reported_date <= end,
    )
    if vendor_ids is not None:
        i_query = i_query.filter(Incident.vendor_id.in_(vendor_ids))
    incidents_by_vendor: dict[int, list[Incident]] = {}
    for incident in i_query.all():
        incidents_by_vendor.setdefault(incident.vendor_id, []).append(incident)

    if granularity == "daily":
        buckets = _day_buckets(start, end)
    else:
        buckets = _month_buckets(start, end)

    points: list[PerformanceTrendPoint] = []
    for period, bucket_start, bucket_end in buckets:
        scores: list[float] = []
        contributors = 0
        any_data = False
        for vendor in vendors:
            delivery_rows = [
                (actual, expected)
                for order_date, actual, expected in delivery_by_vendor.get(
                    vendor.id, []
                )
                if bucket_start <= order_date <= bucket_end
            ]
            quality_values = [
                score
                for evaluation_date, score in quality_by_vendor.get(vendor.id, [])
                if bucket_start <= evaluation_date <= bucket_end
            ]
            incident_rows = [
                incident
                for incident in incidents_by_vendor.get(vendor.id, [])
                if bucket_start <= incident.reported_date <= bucket_end
            ]
            overall, limited, available = _period_overall(
                vendor, delivery_rows, quality_values, incident_rows
            )
            if available:
                any_data = True
            if overall is not None:
                scores.append(overall)
                contributors += 1
        average = _round2(sum(scores) / len(scores)) if scores else None
        points.append(
            PerformanceTrendPoint(
                period=period,
                start_date=bucket_start,
                end_date=bucket_end,
                has_data=any_data,
                average_overall_score=average,
                vendors_contributing=contributors,
            )
        )
    return PerformanceTrend(
        granularity=granularity,
        has_sufficient_data=_has_sufficient_data(points),
        items=points,
    )


def build_incident_severity_distribution(
    db: Session, vendor_ids: set[int] | None, start: date, end: date
) -> IncidentSeverityDistribution:
    query = db.query(Incident.severity, func.count(Incident.id)).filter(
        Incident.reported_date >= start,
        Incident.reported_date <= end,
    )
    if vendor_ids is not None:
        query = query.filter(Incident.vendor_id.in_(vendor_ids))
    query = query.group_by(Incident.severity)
    counts: dict[IncidentSeverity, int] = {severity: 0 for severity in IncidentSeverity}
    for severity, count in query.all():
        counts[severity] = int(count)
    total = sum(counts.values())
    order = (
        IncidentSeverity.CRITICAL,
        IncidentSeverity.HIGH,
        IncidentSeverity.MEDIUM,
        IncidentSeverity.LOW,
    )
    items = [
        IncidentSeverityItem(
            severity=severity,
            count=counts[severity],
            percentage=_round1(counts[severity] / total * 100) if total else 0.0,
        )
        for severity in order
    ]
    return IncidentSeverityDistribution(total_incidents=total, items=items)


def build_category_performance(
    db: Session, vendors: list[Vendor]
) -> CategoryPerformance:
    categories = db.query(VendorCategory).all()
    records_set = _vendor_ids_with_records(db, {vendor.id for vendor in vendors})
    by_category: dict[int, list[Vendor]] = {}
    for vendor in vendors:
        by_category.setdefault(vendor.category_id, []).append(vendor)

    items: list[CategoryPerformanceItem] = []
    for category in categories:
        category_vendors = by_category.get(category.id, [])
        if not category_vendors:
            continue
        perf_items = [
            build_performance_list_item(db, vendor) for vendor in category_vendors
        ]
        scored = [
            item
            for item in perf_items
            if item.overall_score is not None and item.vendor_id in records_set
        ]
        average_overall = (
            _round2(sum(item.overall_score or 0.0 for item in scored) / len(scored))
            if scored
            else None
        )
        delivery_scores = [
            item.delivery_score for item in perf_items if item.delivery_score is not None
        ]
        quality_scores = [
            item.quality_score for item in perf_items if item.quality_score is not None
        ]
        incident_scores = [
            item.incident_score for item in perf_items if item.incident_score is not None
        ]
        best = max(scored, key=lambda item: item.overall_score or 0.0) if scored else None
        items.append(
            CategoryPerformanceItem(
                category_id=category.id,
                category_name=category.name,
                vendor_count=len(category_vendors),
                vendors_with_score=len(scored),
                average_overall_score=average_overall,
                average_delivery_score=(
                    _round2(sum(delivery_scores) / len(delivery_scores))
                    if delivery_scores
                    else None
                ),
                average_quality_score=(
                    _round2(sum(quality_scores) / len(quality_scores))
                    if quality_scores
                    else None
                ),
                average_incident_score=(
                    _round2(sum(incident_scores) / len(incident_scores))
                    if incident_scores
                    else None
                ),
                best_vendor_name=best.vendor_name if best else None,
                best_overall_score=best.overall_score if best else None,
            )
        )

    def sort_key(item: CategoryPerformanceItem):
        return (
            0 if item.average_overall_score is not None else 1,
            -(item.average_overall_score or 0.0),
            item.category_name.lower(),
        )

    items.sort(key=sort_key)
    return CategoryPerformance(total_categories=len(items), items=items)


def build_vendor_comparison(
    db: Session,
    vendors: list[Vendor],
    start: date,
    end: date,
) -> VendorComparison:
    metrics: list[VendorComparisonMetric] = []
    for vendor in vendors:
        detail = build_vendor_performance(db, vendor)
        delivery = build_delivery_analytics(db, {vendor.id}, start, end)
        quality = build_quality_analytics(db, {vendor.id}, start, end)
        incidents = build_incident_analytics(db, {vendor.id}, start, end)
        metrics.append(
            VendorComparisonMetric(
                vendor_id=vendor.id,
                vendor_name=vendor.company_name,
                vendor_code=vendor.vendor_code,
                overall_score=detail.overall_score,
                classification=detail.classification,
                limited_data=detail.limited_data,
                data_confidence=detail.data_confidence,
                delivery_score=detail.delivery.score,
                quality_score=detail.quality.score,
                incident_score=detail.incidents.score,
                delivery=delivery,
                quality=quality,
                incidents=incidents,
            )
        )
    return VendorComparison(vendors=metrics)


def _average_period_overall(
    vendors: list[Vendor],
    delivery_by_vendor: dict[int, list],
    quality_by_vendor: dict[int, list],
    incidents_by_vendor: dict[int, list[Incident]],
    start: date,
    end: date,
) -> float | None:
    scores: list[float] = []
    for vendor in vendors:
        delivery_rows = [
            (actual, expected)
            for order_date, actual, expected in delivery_by_vendor.get(vendor.id, [])
            if start <= order_date <= end
        ]
        quality_values = [
            score
            for evaluation_date, score in quality_by_vendor.get(vendor.id, [])
            if start <= evaluation_date <= end
        ]
        incident_rows = [
            incident
            for incident in incidents_by_vendor.get(vendor.id, [])
            if start <= incident.reported_date <= end
        ]
        overall, limited, available = _period_overall(
            vendor, delivery_rows, quality_values, incident_rows
        )
        if overall is not None:
            scores.append(overall)
    if not scores:
        return None
    return sum(scores) / len(scores)


def _performance_change(
    vendors: list[Vendor],
    delivery_by_vendor: dict[int, list],
    quality_by_vendor: dict[int, list],
    incidents_by_vendor: dict[int, list[Incident]],
    start: date,
    end: date,
) -> tuple[float | None, str | None]:
    """Period-over-period average change within the selected window.

    The window is split into two halves; the change is the recent-half average
    minus the earlier-half average. Returns (None, None) whenever either half
    cannot be derived, never fabricating a 0 or 0% comparison.
    """
    total_days = (end - start).days
    if total_days < 2:
        return None, None
    half = total_days // 2
    previous_end = start + timedelta(days=half - 1)
    current_start = start + timedelta(days=half)
    previous_avg = _average_period_overall(
        vendors,
        delivery_by_vendor,
        quality_by_vendor,
        incidents_by_vendor,
        start,
        previous_end,
    )
    current_avg = _average_period_overall(
        vendors,
        delivery_by_vendor,
        quality_by_vendor,
        incidents_by_vendor,
        current_start,
        end,
    )
    if previous_avg is None or current_avg is None:
        return None, None
    return _round2(current_avg - previous_avg), current_start.strftime("%b %Y")


def _build_insights(
    total_vendors: int,
    vendors_with_score: int,
    limited_count: int,
    attention: int,
    delivery: DeliveryAnalytics,
    quality: QualityAnalytics,
    incidents: IncidentAnalytics,
    monthly_incident_counts: dict[str, int],
    performance_change: float | None,
    change_label: str | None,
) -> list[AnalyticsInsight]:
    insights: list[AnalyticsInsight] = []

    if attention > 0:
        insights.append(
            AnalyticsInsight(
                key="attention",
                kind="warning",
                title=f"{attention} vendor{'s' if attention != 1 else ''} require attention",
                detail=(
                    "Vendors scoring Poor or Critical (or with several unresolved "
                    "incidents despite limited data) should be reviewed."
                ),
            )
        )
    else:
        insights.append(
            AnalyticsInsight(
                key="attention",
                kind="positive",
                title="No vendors currently require attention",
                detail="No vendor is in Poor/Critical standing or shows a concerning unresolved incident pattern.",
            )
        )

    if delivery.completed_orders > 0 and delivery.on_time_rate is not None:
        if delivery.on_time_rate >= 85:
            insights.append(
                AnalyticsInsight(
                    key="delivery",
                    kind="positive",
                    title="Strong on-time delivery",
                    detail=(
                        f"{delivery.on_time_deliveries} of {delivery.completed_orders} "
                        f"deliveries were on time ({delivery.on_time_rate}%)."
                    ),
                )
            )
        elif delivery.on_time_rate < 70:
            insights.append(
                AnalyticsInsight(
                    key="delivery",
                    kind="warning",
                    title="On-time delivery below 70%",
                    detail=(
                        f"The on-time rate is {delivery.on_time_rate}% with "
                        f"{delivery.delayed_deliveries} delayed delivery"
                        f"{'s' if delivery.delayed_deliveries != 1 else ''}."
                    ),
                )
            )

    if quality.total_evaluations > 0 and quality.average_quality_score is not None:
        if quality.average_quality_score >= 80:
            insights.append(
                AnalyticsInsight(
                    key="quality",
                    kind="positive",
                    title="Healthy quality average",
                    detail=(
                        f"Average quality score is {quality.average_quality_score}/100 "
                        f"across {quality.total_evaluations} evaluations."
                    ),
                )
            )
        elif quality.average_quality_score < 70:
            insights.append(
                AnalyticsInsight(
                    key="quality",
                    kind="warning",
                    title="Quality average below 70",
                    detail=(
                        f"Average quality score is {quality.average_quality_score}/100 across "
                        f"{quality.total_evaluations} evaluations."
                    ),
                )
            )

    total_monthly = sum(monthly_incident_counts.values())
    if total_monthly >= 5 and monthly_incident_counts:
        average_load = total_monthly / len(monthly_incident_counts)
        peak_period = max(monthly_incident_counts, key=lambda key: monthly_incident_counts[key])
        peak_count = monthly_incident_counts[peak_period]
        if peak_count >= max(3, 2 * average_load):
            insights.append(
                AnalyticsInsight(
                    key="incident_spike",
                    kind="watch",
                    title="Incident concentration detected",
                    detail=(
                        f"{peak_count} incident{'s' if peak_count != 1 else ''} were "
                        f"reported in {peak_period}, well above the period average."
                    ),
                )
            )

    if performance_change is not None:
        if performance_change < -1:
            insights.append(
                AnalyticsInsight(
                    key="trend",
                    kind="watch",
                    title="Average performance declining",
                    detail=(
                        f"Average performance dropped {abs(performance_change)} point"
                        f"{'s' if abs(performance_change) != 1 else ''} since {change_label}."
                    ),
                )
            )
        elif performance_change > 1:
            insights.append(
                AnalyticsInsight(
                    key="trend",
                    kind="positive",
                    title="Average performance improving",
                    detail=(
                        f"Average performance improved {performance_change} point"
                        f"{'s' if performance_change != 1 else ''} since {change_label}."
                    ),
                )
            )

    if total_vendors > 0:
        coverage = _round1(vendors_with_score / total_vendors * 100)
        insights.append(
            AnalyticsInsight(
                key="coverage",
                kind="info" if coverage < 100 else "positive",
                title="Performance data coverage",
                detail=(
                    f"{coverage}% of vendors in scope have a computable performance score."
                ),
            )
        )

    if limited_count > 0:
        insights.append(
            AnalyticsInsight(
                key="limited",
                kind="info",
                title="Limited data vendors",
                detail=(
                    f"{limited_count} vendor{'s' if limited_count != 1 else ''} in scope "
                    "have limited data (confidence below 66.67%) — record more "
                    "delivery, quality, or incident data to improve accuracy."
                ),
            )
        )

    return insights[:7]


def build_overview(
    db: Session,
    vendors: list[Vendor],
    start: date,
    end: date,
) -> AnalyticsOverview:
    vendor_ids = {vendor.id for vendor in vendors}
    total_vendors = db.query(func.count(Vendor.id)).scalar() or 0
    items = [build_performance_list_item(db, vendor) for vendor in vendors]
    records_set = _vendor_ids_with_records(db, vendor_ids)
    scored = [
        item
        for item in items
        if item.overall_score is not None and item.vendor_id in records_set
    ]
    average_score = (
        _round2(sum(item.overall_score or 0.0 for item in scored) / len(scored))
        if scored
        else None
    )

    unresolved_map = _current_unresolved_map(db, vendor_ids)
    limited_count = 0
    attention = 0
    for item in items:
        if item.limited_data:
            limited_count += 1
        unresolved = unresolved_map.get(item.vendor_id, 0)
        if item.classification in DISTRIBUTION_ATTENTION_CLASSIFICATIONS:
            attention += 1
        elif unresolved >= 3 or (item.limited_data and unresolved >= 1):
            attention += 1

    delivery = build_delivery_analytics(db, vendor_ids, start, end)
    quality = build_quality_analytics(db, vendor_ids, start, end)
    incidents = build_incident_analytics(db, vendor_ids, start, end)
    distribution = _build_distribution(items, records_set)

    d_query = db.query(
        PurchaseOrder.vendor_id,
        PurchaseOrder.order_date,
        PurchaseOrder.actual_delivery_date,
        PurchaseOrder.expected_delivery_date,
    ).filter(
        PurchaseOrder.order_date >= start,
        PurchaseOrder.order_date <= end,
    )
    if vendor_ids is not None:
        d_query = d_query.filter(PurchaseOrder.vendor_id.in_(vendor_ids))
    delivery_by_vendor: dict[int, list] = {}
    for vendor_id, order_date, actual, expected in d_query.all():
        delivery_by_vendor.setdefault(vendor_id, []).append((order_date, actual, expected))

    q_query = db.query(
        QualityEvaluation.vendor_id,
        QualityEvaluation.evaluation_date,
        QualityEvaluation.quality_score,
    ).filter(
        QualityEvaluation.evaluation_date >= start,
        QualityEvaluation.evaluation_date <= end,
    )
    if vendor_ids is not None:
        q_query = q_query.filter(QualityEvaluation.vendor_id.in_(vendor_ids))
    quality_by_vendor: dict[int, list] = {}
    for vendor_id, evaluation_date, quality_score in q_query.all():
        quality_by_vendor.setdefault(vendor_id, []).append((evaluation_date, quality_score))

    i_query = db.query(Incident).filter(
        Incident.reported_date >= start,
        Incident.reported_date <= end,
    )
    if vendor_ids is not None:
        i_query = i_query.filter(Incident.vendor_id.in_(vendor_ids))
    incidents_by_vendor: dict[int, list[Incident]] = {}
    monthly_counts: dict[str, int] = {}
    for incident in i_query.all():
        incidents_by_vendor.setdefault(incident.vendor_id, []).append(incident)
        month_key = f"{incident.reported_date.year:04d}-{incident.reported_date.month:02d}"
        monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1

    performance_change, change_label = _performance_change(
        vendors,
        delivery_by_vendor,
        quality_by_vendor,
        incidents_by_vendor,
        start,
        end,
    )
    insights = _build_insights(
        total_vendors=len(vendors),
        vendors_with_score=len(scored),
        limited_count=limited_count,
        attention=attention,
        delivery=delivery,
        quality=quality,
        incidents=incidents,
        monthly_incident_counts=monthly_counts,
        performance_change=performance_change,
        change_label=change_label,
    )

    return AnalyticsOverview(
        start_date=start,
        end_date=end,
        total_vendors=total_vendors,
        vendors_in_scope=len(vendors),
        vendors_with_score=len(scored),
        average_performance_score=average_score,
        performance_change=performance_change,
        performance_change_period_label=change_label,
        vendors_requiring_attention=attention,
        distribution=distribution,
        delivery=delivery,
        quality=quality,
        incidents=incidents,
        insights=insights,
    )