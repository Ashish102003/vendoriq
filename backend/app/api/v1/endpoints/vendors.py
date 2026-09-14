import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from ....core.database import get_db
from ....db.repository import (
    attach_categories,
    cis,
    contains,
    count_docs,
    find_doc,
    find_docs,
    insert_doc,
    update_doc,
)
from ....dependencies.auth import get_current_user, require_roles
from ....models import User, Vendor, VendorCategory
from ....models.enums import VendorStatus
from ....schemas.vendor import (
    PaginatedVendors,
    VendorCreate,
    VendorDetailResponse,
    VendorStatistics,
    VendorStatusUpdate,
    VendorUpdate,
)

router = APIRouter()

VENDOR_EDITOR_ROLES = ("Admin", "Vendor Manager", "Procurement Manager")
STATUS_MANAGER_ROLES = ("Admin", "Vendor Manager")

SORT_FIELDS: dict[str, str] = {
    "company_name": "company_name",
    "vendor_code": "vendor_code",
    "status": "status",
    "created_at": "created_at",
    "updated_at": "updated_at",
}
SORT_ORDER = Literal["asc", "desc"]


async def _get_vendor_or_404(db: AsyncIOMotorDatabase, vendor_id: int) -> Vendor:
    vendor = await find_doc(db, "vendors", Vendor, {"id": vendor_id})
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )
    await attach_categories(db, [vendor])
    return vendor


async def _vendor_code_exists(
    db: AsyncIOMotorDatabase, vendor_code: str, exclude_id: int | None = None
):
    criteria: dict = {"vendor_code": cis(vendor_code)}
    if exclude_id is not None:
        criteria["id"] = {"$ne": exclude_id}
    return await find_doc(db, "vendors", Vendor, criteria) is not None


@router.get("/statistics", response_model=VendorStatistics)
async def get_vendor_statistics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = await count_docs(db, "vendors", {})
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    docs = await db["vendors"].aggregate(pipeline).to_list(None)
    status_counts = {doc["_id"]: doc["count"] for doc in docs}
    inactive = await count_docs(db, "vendors", {"is_active": False})
    return VendorStatistics(
        total_vendors=total,
        active_vendors=status_counts.get(VendorStatus.ACTIVE.value, 0),
        pending_vendors=status_counts.get(VendorStatus.PENDING.value, 0),
        under_review_vendors=status_counts.get(VendorStatus.UNDER_REVIEW.value, 0),
        suspended_vendors=status_counts.get(VendorStatus.SUSPENDED.value, 0),
        terminated_vendors=status_counts.get(VendorStatus.TERMINATED.value, 0),
        inactive_vendors=inactive,
    )


@router.get("", response_model=PaginatedVendors)
async def list_vendors(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    category_id: int | None = None,
    status_filter: VendorStatus | None = Query(default=None, alias="status"),
    is_active: bool | None = None,
    sort_by: Literal["company_name", "vendor_code", "status", "created_at", "updated_at"] = "company_name",
    sort_order: SORT_ORDER = "asc",
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
                {"contact_person": pattern},
                {"email": pattern},
            ]
    if category_id is not None:
        criteria["category_id"] = category_id
    if status_filter is not None:
        criteria["status"] = status_filter.value
    if is_active is not None:
        criteria["is_active"] = is_active

    total = await count_docs(db, "vendors", criteria)

    sort = [(SORT_FIELDS[sort_by], 1 if sort_order == "asc" else -1)]
    vendors = await find_docs(
        db,
        "vendors",
        Vendor,
        criteria,
        sort=sort,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    await attach_categories(db, vendors)

    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": vendors,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post(
    "",
    response_model=VendorDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vendor(
    payload: VendorCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*VENDOR_EDITOR_ROLES)),
):
    category = await find_doc(db, "vendor_categories", VendorCategory, {"id": payload.category_id})
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor category not found",
        )

    vendor_code = payload.vendor_code.strip().upper()
    if await _vendor_code_exists(db, vendor_code):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vendor code already exists",
        )

    vendor = Vendor(
        vendor_code=vendor_code,
        company_name=payload.company_name.strip(),
        contact_person=payload.contact_person,
        email=(payload.email.lower() if payload.email else None),
        phone=payload.phone,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        country=payload.country,
        postal_code=payload.postal_code,
        website=payload.website,
        category_id=category.id,
        status=payload.status,
        vendor_since=payload.vendor_since,
        is_active=payload.is_active,
    )
    try:
        await insert_doc(db, "vendors", vendor)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vendor code already exists",
        )
    await attach_categories(db, [vendor])
    return vendor


@router.get("/{vendor_id}", response_model=VendorDetailResponse)
async def get_vendor(
    vendor_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_vendor_or_404(db, vendor_id)


@router.patch("/{vendor_id}", response_model=VendorDetailResponse)
async def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*VENDOR_EDITOR_ROLES)),
):
    vendor = await _get_vendor_or_404(db, vendor_id)

    data = payload.model_dump(exclude_unset=True)

    if "category_id" in data:
        if data["category_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vendor category is required",
            )
        category = await find_doc(db, "vendor_categories", VendorCategory, {"id": data["category_id"]})
        if category is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor category not found",
            )
        data["category_id"] = category.id

    if "vendor_code" in data:
        new_code = (data["vendor_code"] or "").strip().upper()
        if not new_code:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vendor code is required",
            )
        if await _vendor_code_exists(db, new_code, exclude_id=vendor.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vendor code already exists",
            )
        data["vendor_code"] = new_code

    if "company_name" in data:
        company_name = (data["company_name"] or "").strip()
        if not company_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Company name is required",
            )
        data["company_name"] = company_name

    if "email" in data and data["email"] is not None:
        data["email"] = data["email"].lower()

    update_fields = {
        "vendor_code",
        "company_name",
        "email",
        "contact_person",
        "phone",
        "address",
        "city",
        "state",
        "country",
        "postal_code",
        "website",
        "category_id",
        "status",
        "vendor_since",
        "is_active",
    }
    values = {field: data[field] for field in update_fields & set(data)}

    try:
        await update_doc(db, "vendors", {"id": vendor.id}, values)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vendor code already exists",
        )
    return await _get_vendor_or_404(db, vendor_id)


@router.patch("/{vendor_id}/status", response_model=VendorDetailResponse)
async def update_vendor_status(
    vendor_id: int,
    payload: VendorStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*STATUS_MANAGER_ROLES)),
):
    await _get_vendor_or_404(db, vendor_id)
    values: dict = {"status": payload.status.value}
    if payload.is_active is not None:
        values["is_active"] = payload.is_active
    try:
        await update_doc(db, "vendors", {"id": vendor_id}, values)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vendor code already exists",
        )
    return await _get_vendor_or_404(db, vendor_id)