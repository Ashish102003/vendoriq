from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....db.repository import find_doc
from ....dependencies.auth import get_current_user, require_roles
from ....models import User, Vendor, VendorCategory
from ....models.enums import RiskLevel
from ....schemas.predictive_risk import (
    ModelInfo,
    PaginatedVendorRiskList,
    PredictiveRisk,
    RiskStatistics,
    TrainingResult,
)
from ....services.ml.risk_model import get_model_info, train_model
from ....services import predictive_risk as risk_service

router = APIRouter()
vendor_router = APIRouter()

RISK_SORT_BY = Literal["risk_score", "vendor_name", "performance_score"]
RISK_SORT_ORDER = Literal["asc", "desc"]


async def _resolve_vendor(db: AsyncIOMotorDatabase, vendor_id: int) -> Vendor:
    vendor = await find_doc(db, "vendors", Vendor, {"id": vendor_id})
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found.",
        )
    return vendor


@router.get("/vendor-risk", response_model=PaginatedVendorRiskList)
async def get_vendor_risk_list(
    search: str | None = Query(default=None, max_length=100),
    category_id: int | None = Query(default=None, ge=1),
    risk_level: RiskLevel | None = Query(default=None),
    sort_by: RISK_SORT_BY = Query(default="risk_score"),
    sort_order: RISK_SORT_ORDER = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if category_id is not None:
        if await find_doc(db, "vendor_categories", VendorCategory, {"id": category_id}) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor category not found.",
            )
    return await risk_service.build_risk_list(
        db,
        search=search,
        category_id=category_id,
        risk_level=risk_level,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@router.get("/vendor-risk/statistics", response_model=RiskStatistics)
async def get_vendor_risk_statistics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await risk_service.build_risk_statistics(db)


@router.post("/vendor-risk/train", response_model=TrainingResult)
async def train_risk_model(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles("Admin")),
):
    """Train (or retrain) the predictive risk model from real vendor data.

    Admin only. Returns an ``insufficient_data`` result instead of an exception
    when the historical dataset does not meet the documented minimums.
    """
    return await train_model(db)


@router.get("/vendor-risk/model-info", response_model=ModelInfo)
async def get_risk_model_info(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_model_info()


@vendor_router.get("/{vendor_id}/predictive-risk", response_model=PredictiveRisk)
async def get_vendor_predictive_risk(
    vendor_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = await _resolve_vendor(db, vendor_id)
    return await risk_service.build_predictive_risk(db, vendor)