import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ....core.database import get_db
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

SORT_FIELDS: dict[str, object] = {
    "company_name": Vendor.company_name,
    "vendor_code": Vendor.vendor_code,
    "status": Vendor.status,
    "created_at": Vendor.created_at,
    "updated_at": Vendor.updated_at,
}
SORT_ORDER = Literal["asc", "desc"]


def _get_vendor_or_404(db: Session, vendor_id: int) -> Vendor:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )
    return vendor


def _vendor_code_exists(db: Session, vendor_code: str, exclude_id: int | None = None):
    query = db.query(Vendor).filter(
        func.lower(Vendor.vendor_code) == vendor_code.lower()
    )
    if exclude_id is not None:
        query = query.filter(Vendor.id != exclude_id)
    return query.first() is not None


@router.get("/statistics", response_model=VendorStatistics)
def get_vendor_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(func.count(Vendor.id)).scalar() or 0
    status_counts = {
        row_status: count
        for row_status, count in db.query(
            Vendor.status, func.count(Vendor.id)
        )
        .group_by(Vendor.status)
        .all()
    }
    inactive = (
        db.query(func.count(Vendor.id))
        .filter(Vendor.is_active.is_(False))
        .scalar()
        or 0
    )
    return VendorStatistics(
        total_vendors=total,
        active_vendors=status_counts.get(VendorStatus.ACTIVE, 0),
        pending_vendors=status_counts.get(VendorStatus.PENDING, 0),
        under_review_vendors=status_counts.get(VendorStatus.UNDER_REVIEW, 0),
        suspended_vendors=status_counts.get(VendorStatus.SUSPENDED, 0),
        terminated_vendors=status_counts.get(VendorStatus.TERMINATED, 0),
        inactive_vendors=inactive,
    )


@router.get("", response_model=PaginatedVendors)
def list_vendors(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    category_id: int | None = None,
    status_filter: VendorStatus | None = Query(default=None, alias="status"),
    is_active: bool | None = None,
    sort_by: Literal["company_name", "vendor_code", "status", "created_at", "updated_at"] = "company_name",
    sort_order: SORT_ORDER = "asc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = []
    if search:
        term = search.strip()
        if term:
            like = f"%{term}%"
            conditions.append(
                or_(
                    Vendor.company_name.ilike(like),
                    Vendor.vendor_code.ilike(like),
                    Vendor.contact_person.ilike(like),
                    Vendor.email.ilike(like),
                )
            )
    if category_id is not None:
        conditions.append(Vendor.category_id == category_id)
    if status_filter is not None:
        conditions.append(Vendor.status == status_filter)
    if is_active is not None:
        conditions.append(Vendor.is_active.is_(is_active))

    base = db.query(Vendor)
    if conditions:
        base = base.filter(*conditions)

    total = base.count() or 0

    items_query = db.query(Vendor).options(joinedload(Vendor.category))
    if conditions:
        items_query = items_query.filter(*conditions)

    order_column = SORT_FIELDS[sort_by]
    if sort_order == "desc":
        order_column = order_column.desc()
    items = (
        items_query.order_by(order_column)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": items,
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
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*VENDOR_EDITOR_ROLES)),
):
    category = db.get(VendorCategory, payload.category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor category not found",
        )

    vendor_code = payload.vendor_code.strip().upper()
    if _vendor_code_exists(db, vendor_code):
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
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vendor code already exists",
        )
    return vendor


@router.get("/{vendor_id}", response_model=VendorDetailResponse)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_vendor_or_404(db, vendor_id)


@router.patch("/{vendor_id}", response_model=VendorDetailResponse)
def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*VENDOR_EDITOR_ROLES)),
):
    vendor = _get_vendor_or_404(db, vendor_id)

    data = payload.model_dump(exclude_unset=True)

    if "category_id" in data:
        if data["category_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vendor category is required",
            )
        category = db.get(VendorCategory, data["category_id"])
        if category is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor category not found",
            )
        vendor.category_id = data["category_id"]

    if "vendor_code" in data:
        new_code = (data["vendor_code"] or "").strip().upper()
        if not new_code:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vendor code is required",
            )
        if _vendor_code_exists(db, new_code, exclude_id=vendor.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vendor code already exists",
            )
        vendor.vendor_code = new_code

    if "company_name" in data:
        company_name = (data["company_name"] or "").strip()
        if not company_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Company name is required",
            )
        vendor.company_name = company_name

    if "email" in data:
        vendor.email = data["email"].lower() if data["email"] else None

    for field in (
        "contact_person",
        "phone",
        "address",
        "city",
        "state",
        "country",
        "postal_code",
        "website",
        "status",
        "vendor_since",
        "is_active",
    ):
        if field in data:
            setattr(vendor, field, data[field])

    try:
        db.commit()
        db.refresh(vendor)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vendor code already exists",
        )
    return vendor


@router.patch("/{vendor_id}/status", response_model=VendorDetailResponse)
def update_vendor_status(
    vendor_id: int,
    payload: VendorStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*STATUS_MANAGER_ROLES)),
):
    vendor = _get_vendor_or_404(db, vendor_id)
    vendor.status = payload.status
    if payload.is_active is not None:
        vendor.is_active = payload.is_active
    try:
        db.commit()
        db.refresh(vendor)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vendor code already exists",
        )
    return vendor