import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....db.repository import contains, find_doc, find_docs
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

PERFORMANCE_SORT_FIELDS: dict[str, str] = {
    "vendor_name": "vendor_name",
    "overall_score": "overall_score",
    "delivery_score": "delivery_score",
    "quality_score": "quality_score",
    "incident_score": "incident_score",
    "data_confidence": "data_confidence",
}
PERFORMANCE_SORT_ORDER = Literal["asc", "desc"]


@router.get("/performance/statistics", response_model=VendorPerformanceStatistics)
async def get_vendor_performance_statistics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await compute_performance_statistics(db)


@router.get("/performance", response_model=PaginatedVendorPerformance)
async def list_vendor_performance(
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
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    criteria: dict = {}
    if search:
        term = search.strip()
        if term:
            pattern = contains(term)
            criteria["$or"] = [
                {"company_name": pattern},
                {"vendor_code": pattern},
            ]

    vendors = await find_docs(db, "vendors", Vendor, criteria)
    items = [await build_performance_list_item(db, vendor) for vendor in vendors]

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
async def get_vendor_performance(
    vendor_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = await find_doc(db, "vendors", Vendor, {"id": vendor_id})
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    return await build_vendor_performance(db, vendor)