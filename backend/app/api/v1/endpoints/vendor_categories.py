from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from ....core.database import get_db
from ....db.repository import (
    cis,
    contains,
    count_docs,
    find_doc,
    find_docs,
    insert_doc,
    update_doc,
)
from ....dependencies.auth import get_current_user, require_roles
from ....models import User, VendorCategory
from ....schemas.vendor_category import (
    VendorCategoryCreate,
    VendorCategoryUpdate,
    VendorCategoryWithCount,
)

router = APIRouter()

CATEGORY_MANAGER_ROLES = ("Admin", "Vendor Manager")


def _build_category_response(
    row: VendorCategory, vendor_count: int
) -> VendorCategoryWithCount:
    return VendorCategoryWithCount(
        id=row.id,
        name=row.name,
        description=row.description,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
        vendor_count=vendor_count,
    )


async def _vendor_counts_by_category(
    db: AsyncIOMotorDatabase,
) -> dict[int, int]:
    pipeline = [
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}},
    ]
    docs = await db["vendors"].aggregate(pipeline).to_list(None)
    return {doc["_id"]: doc["count"] for doc in docs if doc["_id"] is not None}


@router.get("", response_model=list[VendorCategoryWithCount])
async def list_categories(
    include_inactive: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    criteria: dict = {}
    if not include_inactive:
        criteria["is_active"] = True
    if search:
        term = search.strip()
        if term:
            criteria["name"] = contains(term)

    categories = await find_docs(db, "vendor_categories", VendorCategory, criteria)
    categories.sort(key=lambda c: (c.name or "").lower())
    counts = await _vendor_counts_by_category(db)
    return [
        _build_category_response(category, counts.get(category.id, 0))
        for category in categories
    ]


@router.post(
    "",
    response_model=VendorCategoryWithCount,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    payload: VendorCategoryCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*CATEGORY_MANAGER_ROLES)),
):
    name = payload.name.strip()
    duplicate = await find_doc(db, "vendor_categories", VendorCategory, {"name": cis(name)})
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )

    category = VendorCategory(name=name, description=payload.description)
    try:
        await insert_doc(db, "vendor_categories", category)
    except DuplicateKeyError:
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
async def update_category(
    category_id: int,
    payload: VendorCategoryUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*CATEGORY_MANAGER_ROLES)),
):
    category = await find_doc(db, "vendor_categories", VendorCategory, {"id": category_id})
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor category not found",
        )

    data = payload.model_dump(exclude_unset=True)

    if "name" in data:
        new_name = (data["name"] or "").strip()
        duplicate = await find_doc(
            db,
            "vendor_categories",
            VendorCategory,
            {"name": cis(new_name), "id": {"$ne": category_id}},
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Category name already exists",
            )
        data["name"] = new_name

    try:
        await update_doc(db, "vendor_categories", {"id": category_id}, data)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )

    vendor_count = await count_docs(
        db, "vendors", {"category_id": category_id}
    )
    updated = await find_doc(db, "vendor_categories", VendorCategory, {"id": category_id})
    return _build_category_response(updated, vendor_count)