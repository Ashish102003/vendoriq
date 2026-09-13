import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....dependencies.auth import get_current_user
from ....models import User, Vendor
from ....models.enums import VendorPerformanceClassification
from ....schemas.vendor_performance import (
    PaginatedVendorPerformance,
    VendorPerformanceDetail,
    VendorPerformanceStatistics,
)
from ....services.vendor_performance import (
    build_performance_list_item,
    build_vendor_performance,
    compute_performance_statistics,
    paginate_items,
)

router = APIRouter()

PERFORMANCE_SORT_FIELDS: dict[str, object] = {
    "vendor_name": "vendor_name",
    "overall_score": "overall_score",
    "delivery_score": "delivery_score",
    "quality_score": "quality_score",
    "incident_score": "incident_score",
    "data_confidence": "data_confidence",
}
PERFORMANCE_SORT_ORDER = Literal["asc", "desc"]


@router.get("/performance/statistics", response_model=VendorPerformanceStatistics)
def get_vendor_performance_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_performance_statistics(db)


@router.get("/performance", response_model=PaginatedVendorPerformance)
def list_vendor_performance(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    classification: VendorPerformanceClassification | None = None,
    sort_by: Literal[
        "vendor_name",
        "overall_score",
        "delivery_score",
        "quality_score",
        "incident_score",
        "data_confidence",
    ] = "vendor_name",
    sort_order: PERFORMANCE_SORT_ORDER = "asc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Vendor)
    if search:
        term = search.strip()
        if term:
            like = f"%{term}%"
            query = query.filter(
                or_(
                    Vendor.company_name.ilike(like),
                    Vendor.vendor_code.ilike(like),
                )
            )

    items = [build_performance_list_item(db, vendor) for vendor in query.all()]

    if classification is not None:
        items = [item for item in items if item.classification == classification]

    reverse = sort_order == "desc"

    def sort_key(item):
        if sort_by == "vendor_name":
            return (0, item.vendor_name.lower())
        if sort_by == "data_confidence":
            return (0, -item.data_confidence if reverse else item.data_confidence)
        value: float | None = getattr(item, sort_by)
        if value is None:
            return (1, 0)
        return (0, -value if reverse else value)

    if sort_by == "vendor_name":
        items.sort(key=sort_key, reverse=reverse)
    else:
        items.sort(key=sort_key)

    return paginate_items(items, page, page_size)


@router.get("/{vendor_id}/performance", response_model=VendorPerformanceDetail)
def get_vendor_performance(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    return build_vendor_performance(db, vendor)