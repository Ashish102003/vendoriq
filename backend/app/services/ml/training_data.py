"""Time-based training samples for the Phase 9 predictive risk model.

Training data is built entirely from real, historical vendor records. Each
sample is a (vendor, calendar month) row: the feature vector describes the
state during month ``T`` and the target describes the operational outcome in
the immediately following month ``T + 1``. Any month boundary guarantees there
is no leakage, because the target never overlaps the features.

The target is a deterministic, documented proxy for "high-risk outcome":
at least ``HIGH_RISK_MIN_DELAYED`` delayed deliveries, at least one critical
incident, at least ``HIGH_RISK_MIN_INCIDENTS`` incidents, or an average
quality score below ``HIGH_RISK_QUALITY_BELOW`` in the outcome month.
"""

from datetime import date, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from ...db.repository import count_docs, find_doc, find_docs
from ...models import Incident, PurchaseOrder, QualityEvaluation, Vendor
from ...models.enums import IncidentSeverity
from . import risk_config
from .feature_builder import build_period_features, feature_vector


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        next_start = date(year + 1, 1, 1)
    else:
        next_start = date(year, month + 1, 1)
    return start, next_start - timedelta(days=1)


async def _month_records(
    db: AsyncIOMotorDatabase, vendor_id: int, start: date, end: date
) -> int:
    """Count purchase orders, quality evaluations and incidents in a month."""
    po = await count_docs(
        db,
        "purchase_orders",
        {
            "vendor_id": vendor_id,
            "order_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        },
    )
    quality = await count_docs(
        db,
        "quality_evaluations",
        {
            "vendor_id": vendor_id,
            "evaluation_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        },
    )
    incidents = await count_docs(
        db,
        "incidents",
        {
            "vendor_id": vendor_id,
            "reported_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        },
    )
    return po + quality + incidents


async def _outcome_score(
    db: AsyncIOMotorDatabase, vendor_id: int, start: date, end: date
) -> int:
    """1 when the outcome month shows high operational risk, else 0.

    Only real records drive the outcome; a month with no recorded activity is
    treated as low risk (documented in docs/ml-predictive-risk.md).
    """
    delivery_rows = await find_docs(
        db,
        "purchase_orders",
        None,
        {
            "vendor_id": vendor_id,
            "order_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        },
        project={"actual_delivery_date": 1, "expected_delivery_date": 1, "_id": 0},
    )
    delayed = 0
    for row in delivery_rows:
        actual = row.get("actual_delivery_date")
        expected = row["expected_delivery_date"]
        if actual is not None and actual > expected:
            delayed += 1
    critical = await count_docs(
        db,
        "incidents",
        {
            "vendor_id": vendor_id,
            "reported_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
            "severity": IncidentSeverity.CRITICAL.value,
        },
    )
    total_incidents = await count_docs(
        db,
        "incidents",
        {
            "vendor_id": vendor_id,
            "reported_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        },
    )
    quality_rows = await find_docs(
        db,
        "quality_evaluations",
        None,
        {
            "vendor_id": vendor_id,
            "evaluation_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        },
        project={"quality_score": 1, "_id": 0},
    )
    quality_scores = [row["quality_score"] for row in quality_rows]

    if delayed >= risk_config.HIGH_RISK_MIN_DELAYED:
        return 1
    if critical >= risk_config.HIGH_RISK_MIN_CRITICAL_INCIDENTS:
        return 1
    if total_incidents >= risk_config.HIGH_RISK_MIN_INCIDENTS:
        return 1
    if quality_scores:
        average = sum(quality_scores) / len(quality_scores)
        if average < risk_config.HIGH_RISK_QUALITY_BELOW:
            return 1
    return 0


async def build_training_dataset(
    db: AsyncIOMotorDatabase,
) -> tuple[list[list[float]], list[int], list[dict]]:
    """Build (X, y, row_meta) from historical vendor-month data.

    ``row_meta`` entries are dicts with ``vendor_id`` and ``period`` (ISO year-
    month) so diagnostics stay traceable to real data.
    """
    vendors = await find_docs(db, "vendors", Vendor, {})
    today = date.today()

    rows: list[dict] = []
    for vendor in vendors:
        if vendor.vendor_since is None:
            start_year = today.year
            start_month = today.month
        else:
            start_year = vendor.vendor_since.year
            start_month = vendor.vendor_since.month
        cursor_year, cursor_month = start_year, start_month
        while (cursor_year, cursor_month) < (today.year, today.month):
            start, end = _month_bounds(cursor_year, cursor_month)
            # Compute the following month's bounds.
            if cursor_month == 12:
                fut_year, fut_month = cursor_year + 1, 1
            else:
                fut_year, fut_month = cursor_year, cursor_month + 1
            outcome_start, outcome_end = _month_bounds(fut_year, fut_month)
            if outcome_end > today:
                break

            if await _month_records(db, vendor.id, start, end) < risk_config.MIN_PERIOD_RECORDS:
                if cursor_month == 12:
                    cursor_year += 1
                    cursor_month = 1
                else:
                    cursor_month += 1
                continue

            features = await build_period_features(db, vendor.id, start, end)
            target = await _outcome_score(db, vendor.id, outcome_start, outcome_end)
            rows.append(
                {
                    "vendor_id": vendor.id,
                    "period": f"{cursor_year:04d}-{cursor_month:02d}",
                    "features": features,
                    "target": target,
                }
            )
            if cursor_month == 12:
                cursor_year += 1
                cursor_month = 1
            else:
                cursor_month += 1

    X = [feature_vector(row["features"]) for row in rows]
    y = [row["target"] for row in rows]
    meta = [
        {"vendor_id": row["vendor_id"], "period": row["period"]} for row in rows
    ]
    return X, y, meta


async def latest_period_features(
    db: AsyncIOMotorDatabase, vendor_id: int
) -> dict[str, float] | None:
    """Feature vector for the most recent month with sufficient real records.

    Prediction uses the same construction as training rows so the feature
    distribution matches. Returns ``None`` when no month qualifies.
    """
    vendor = await find_doc(db, "vendors", Vendor, {"id": vendor_id})
    if vendor is None:
        return None
    today = date.today()
    if vendor.vendor_since is None:
        year, month = today.year, today.month
    else:
        year, month = vendor.vendor_since.year, vendor.vendor_since.month
    months: list[tuple[int, int]] = []
    cursor_year, cursor_month = year, month
    while (cursor_year, cursor_month) <= (today.year, today.month):
        months.append((cursor_year, cursor_month))
        if cursor_month == 12:
            cursor_year += 1
            cursor_month = 1
        else:
            cursor_month += 1

    for year_i, month_i in reversed(months):
        start, end = _month_bounds(year_i, month_i)
        if await _month_records(db, vendor_id, start, end) < risk_config.MIN_PERIOD_RECORDS:
            continue
        return await build_period_features(db, vendor_id, start, end)
    return None


async def estimate_training_viability(
    db: AsyncIOMotorDatabase | None = None,
    X: list[list[float]] | None = None,
    y: list[int] | None = None,
) -> tuple[bool, int, str]:
    """(viable, row_count, reason) based on the real dataset at hand.

    ``db`` is only required when ``X``/``y`` are not already available.
    """
    if X is None or y is None:
        if db is None:
            raise ValueError("db is required when the dataset is not provided.")
        X, y, _ = await build_training_dataset(db)
    if len(X) < risk_config.MIN_TRAINING_RECORDS:
        return (
            False,
            len(X),
            (
                "Insufficient training data: expected at least "
                f"{risk_config.MIN_TRAINING_RECORDS} vendor-month samples but "
                f"found {len(X)} from real records."
            ),
        )
    positive = sum(y)
    negative = len(y) - positive
    if positive < risk_config.MIN_CLASS_RECORDS or negative < risk_config.MIN_CLASS_RECORDS:
        return (
            False,
            len(X),
            (
                "Insufficient class diversity for training: the real records "
                "do not contain enough high-risk and low-risk outcome months "
                f"(found {positive} high-risk and {negative} low-risk samples)."
            ),
        )
    return True, len(X), "Sufficient training data is available."