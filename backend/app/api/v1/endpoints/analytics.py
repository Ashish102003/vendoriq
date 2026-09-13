from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....dependencies.auth import get_current_user
from ....models import User, Vendor, VendorCategory
from ....schemas.analytics import (
    AnalyticsOverview,
    CategoryPerformance,
    DeliveryAnalytics,
    DeliveryTrend,
    IncidentAnalytics,
    IncidentSeverityDistribution,
    IncidentTrend,
    PerformanceDistribution,
    PerformanceTrend,
    QualityAnalytics,
    QualityTrend,
    VendorComparison,
    VendorRanking,
)
from ....services import analytics as analytics_service

router = APIRouter()

TREND_GRANULARITY = Literal["monthly", "daily"]


def _resolve_range(
    start_date: date | None,
    end_date: date | None,
    granularity: str = "monthly",
) -> tuple[date, date]:
    try:
        start, end = analytics_service.resolve_date_range(start_date, end_date)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    if (
        granularity == "daily"
        and (end - start).days > analytics_service.MAX_DAILY_RANGE_DAYS
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Daily granularity supports ranges up to "
                f"{analytics_service.MAX_DAILY_RANGE_DAYS} days; use monthly instead."
            ),
        )
    return start, end


def _resolve_scope(
    db: Session,
    vendor_id: int | None,
    category_id: int | None,
) -> list[Vendor]:
    if vendor_id is not None:
        if db.get(Vendor, vendor_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found.",
            )
    if category_id is not None:
        if db.get(VendorCategory, category_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor category not found.",
            )
    return analytics_service.scoped_vendors(db, vendor_id, category_id)


@router.get("/overview", response_model=AnalyticsOverview)
def get_analytics_overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date)
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_overview(db, vendors, start, end)


@router.get("/performance-distribution", response_model=PerformanceDistribution)
def get_performance_distribution(
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_distribution(db, vendors)


@router.get("/vendor-ranking", response_model=VendorRanking)
def get_vendor_ranking(
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_vendor_ranking(db, vendors)


@router.get("/delivery-overview", response_model=DeliveryAnalytics)
def get_delivery_overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date)
    vendors = _resolve_scope(db, vendor_id, category_id)
    vendor_ids = {vendor.id for vendor in vendors}
    return analytics_service.build_delivery_analytics(db, vendor_ids, start, end)


@router.get("/delivery-trend", response_model=DeliveryTrend)
def get_delivery_trend(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    granularity: TREND_GRANULARITY = "monthly",
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date, granularity)
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_delivery_trend(db, vendors, start, end, granularity)


@router.get("/quality-overview", response_model=QualityAnalytics)
def get_quality_overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date)
    vendors = _resolve_scope(db, vendor_id, category_id)
    vendor_ids = {vendor.id for vendor in vendors}
    return analytics_service.build_quality_analytics(db, vendor_ids, start, end)


@router.get("/quality-trend", response_model=QualityTrend)
def get_quality_trend(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    granularity: TREND_GRANULARITY = "monthly",
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date, granularity)
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_quality_trend(db, vendors, start, end, granularity)


@router.get("/incident-overview", response_model=IncidentAnalytics)
def get_incident_overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date)
    vendors = _resolve_scope(db, vendor_id, category_id)
    vendor_ids = {vendor.id for vendor in vendors}
    return analytics_service.build_incident_analytics(db, vendor_ids, start, end)


@router.get("/incident-trend", response_model=IncidentTrend)
def get_incident_trend(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    granularity: TREND_GRANULARITY = "monthly",
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date, granularity)
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_incident_trend(db, vendors, start, end, granularity)


@router.get(
    "/incident-severity-distribution", response_model=IncidentSeverityDistribution
)
def get_incident_severity_distribution(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date)
    vendors = _resolve_scope(db, vendor_id, category_id)
    vendor_ids = {vendor.id for vendor in vendors}
    return analytics_service.build_incident_severity_distribution(
        db, vendor_ids, start, end
    )


@router.get("/category-performance", response_model=CategoryPerformance)
def get_category_performance(
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_category_performance(db, vendors)


@router.get("/performance-trend", response_model=PerformanceTrend)
def get_performance_trend(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    granularity: TREND_GRANULARITY = "monthly",
    vendor_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _resolve_range(start_date, end_date, granularity)
    vendors = _resolve_scope(db, vendor_id, category_id)
    return analytics_service.build_performance_trend(
        db, vendors, start, end, granularity
    )


@router.get("/vendor-comparison", response_model=VendorComparison)
def get_vendor_comparison(
    vendor_ids: list[int] = Query(default=[]),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if any(vendor_id < 1 for vendor_id in vendor_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Vendor IDs must be positive integers.",
        )
    unique_ids = list(dict.fromkeys(vendor_ids))
    if len(unique_ids) != len(vendor_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Vendor comparison must not contain duplicate vendor IDs.",
        )
    if len(vendor_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Select at least 2 vendors to compare.",
        )
    if len(vendor_ids) > 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Compare at most 5 vendors at a time.",
        )
    vendors = []
    for vendor_id in vendor_ids:
        vendor = db.get(Vendor, vendor_id)
        if vendor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found.",
            )
        vendors.append(vendor)
    start, end = _resolve_range(start_date, end_date)
    return analytics_service.build_vendor_comparison(db, vendors, start, end)