from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....dependencies.auth import get_current_user, require_roles
from ....models import User, Vendor, VendorCategory
from ....schemas.vendor_category import (
    VendorCategoryCreate,
    VendorCategoryUpdate,
    VendorCategoryWithCount,
)

router = APIRouter()

CATEGORY_MANAGER_ROLES = ("Admin", "Vendor Manager")


def _build_category_response(row) -> VendorCategoryWithCount:
    return VendorCategoryWithCount(
        id=row.id,
        name=row.name,
        description=row.description,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
        vendor_count=row.vendor_count,
    )


@router.get("", response_model=list[VendorCategoryWithCount])
def list_categories(
    include_inactive: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(
            VendorCategory.id,
            VendorCategory.name,
            VendorCategory.description,
            VendorCategory.is_active,
            VendorCategory.created_at,
            VendorCategory.updated_at,
            func.count(Vendor.id).label("vendor_count"),
        )
        .outerjoin(Vendor, Vendor.category_id == VendorCategory.id)
        .group_by(VendorCategory.id)
    )

    if not include_inactive:
        query = query.filter(VendorCategory.is_active.is_(True))
    if search:
        term = search.strip()
        if term:
            query = query.filter(VendorCategory.name.ilike(f"%{term}%"))

    rows = query.order_by(VendorCategory.name.asc()).all()
    return [_build_category_response(row) for row in rows]


@router.post(
    "",
    response_model=VendorCategoryWithCount,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    payload: VendorCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CATEGORY_MANAGER_ROLES)),
):
    name = payload.name.strip()
    duplicate = (
        db.query(VendorCategory)
        .filter(func.lower(VendorCategory.name) == name.lower())
        .first()
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )

    category = VendorCategory(name=name, description=payload.description)
    try:
        db.add(category)
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )

    return VendorCategoryWithCount(
        id=category.id,
        name=category.name,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
        vendor_count=0,
    )


@router.patch("/{category_id}", response_model=VendorCategoryWithCount)
def update_category(
    category_id: int,
    payload: VendorCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CATEGORY_MANAGER_ROLES)),
):
    category = db.get(VendorCategory, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor category not found",
        )

    data = payload.model_dump(exclude_unset=True)

    if "name" in data:
        new_name = (data["name"] or "").strip()
        duplicate = (
            db.query(VendorCategory)
            .filter(
                func.lower(VendorCategory.name) == new_name.lower(),
                VendorCategory.id != category_id,
            )
            .first()
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Category name already exists",
            )
        data["name"] = new_name

    for key, value in data.items():
        setattr(category, key, value)

    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )

    vendor_count = (
        db.query(func.count(Vendor.id))
        .filter(Vendor.category_id == category_id)
        .scalar()
        or 0
    )
    return VendorCategoryWithCount(
        id=category.id,
        name=category.name,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
        vendor_count=vendor_count,
    )