import math
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from ....core.database import get_db
from ....db.repository import (
    attach_vendors,
    cis,
    contains,
    count_docs,
    find_doc,
    find_docs,
    insert_doc,
    update_doc,
)
from ....dependencies.auth import get_current_user, require_roles
from ....models import Contract, User, Vendor
from ....models.enums import ContractStatus
from ....schemas.contract import (
    ContractCreate,
    ContractDetailResponse,
    ContractStatistics,
    ContractStatusUpdate,
    ContractUpdate,
    PaginatedContracts,
)

router = APIRouter()

CONTRACT_EDITOR_ROLES = ("Admin", "Vendor Manager", "Procurement Manager")

SORT_FIELDS: dict[str, str] = {
    "contract_number": "contract_number",
    "title": "title",
    "contract_value": "contract_value",
    "start_date": "start_date",
    "end_date": "end_date",
    "status": "status",
    "created_at": "created_at",
    "updated_at": "updated_at",
}
SORT_ORDER = Literal["asc", "desc"]


async def _get_contract_or_404(
    db: AsyncIOMotorDatabase, contract_id: int
) -> Contract:
    contract = await find_doc(db, "contracts", Contract, {"id": contract_id})
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    await attach_vendors(db, [contract])
    return contract


async def _contract_number_exists(
    db: AsyncIOMotorDatabase, contract_number: str, exclude_id: int | None = None
) -> bool:
    criteria: dict = {"contract_number": cis(contract_number)}
    if exclude_id is not None:
        criteria["id"] = {"$ne": exclude_id}
    return await find_doc(db, "contracts", Contract, criteria) is not None


def _validate_contract_dates(start_date, end_date) -> None:
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )


@router.get("/statistics", response_model=ContractStatistics)
async def get_contract_statistics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = await count_docs(db, "contracts", {})
    status_rows = await db["contracts"].aggregate(
        [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    ).to_list(None)
    status_counts = {row["_id"]: row["count"] for row in status_rows}
    value_rows = await db["contracts"].aggregate(
        [
            {"$group": {"_id": None, "total": {"$sum": "$contract_value"}}},
        ]
    ).to_list(None)
    total_value = value_rows[0]["total"] if value_rows else Decimal("0")
    if total_value != Decimal("0"):
        total_value = total_value.to_decimal() if hasattr(total_value, "to_decimal") else Decimal(str(total_value))
    return ContractStatistics(
        total_contracts=total,
        active_contracts=status_counts.get(ContractStatus.ACTIVE.value, 0),
        draft_contracts=status_counts.get(ContractStatus.DRAFT.value, 0),
        completed_contracts=status_counts.get(ContractStatus.COMPLETED.value, 0),
        on_hold_contracts=status_counts.get(ContractStatus.ON_HOLD.value, 0),
        cancelled_contracts=status_counts.get(ContractStatus.CANCELLED.value, 0),
        expired_contracts=status_counts.get(ContractStatus.EXPIRED.value, 0),
        total_contract_value=total_value,
    )


@router.get("", response_model=PaginatedContracts)
async def list_contracts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    vendor_id: int | None = None,
    status_filter: ContractStatus | None = Query(default=None, alias="status"),
    is_active: bool | None = None,
    sort_by: Literal[
        "contract_number",
        "title",
        "contract_value",
        "start_date",
        "end_date",
        "status",
        "created_at",
        "updated_at",
    ] = "created_at",
    sort_order: SORT_ORDER = "desc",
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    criteria: dict = {}
    if search:
        term = search.strip()
        if term:
            pattern = contains(term)
            criteria["$or"] = [
                {"contract_number": pattern},
                {"title": pattern},
            ]
    if vendor_id is not None:
        criteria["vendor_id"] = vendor_id
    if status_filter is not None:
        criteria["status"] = status_filter.value
    if is_active is not None:
        criteria["is_active"] = is_active

    total = await count_docs(db, "contracts", criteria)

    sort = [(SORT_FIELDS[sort_by], 1 if sort_order == "asc" else -1)]
    contracts = await find_docs(
        db,
        "contracts",
        Contract,
        criteria,
        sort=sort,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    await attach_vendors(db, contracts)

    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": contracts,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post(
    "",
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contract(
    payload: ContractCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*CONTRACT_EDITOR_ROLES)),
):
    vendor = await find_doc(db, "vendors", Vendor, {"id": payload.vendor_id})
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    contract_number = payload.contract_number.strip().upper()
    if await _contract_number_exists(db, contract_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )

    _validate_contract_dates(payload.start_date, payload.end_date)

    contract = Contract(
        vendor_id=vendor.id,
        contract_number=contract_number,
        title=payload.title.strip(),
        description=payload.description,
        contract_value=payload.contract_value,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        is_active=payload.is_active,
    )
    try:
        await insert_doc(db, "contracts", contract)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )
    await attach_vendors(db, [contract])
    return contract


@router.get("/{contract_id}", response_model=ContractDetailResponse)
async def get_contract(
    contract_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_contract_or_404(db, contract_id)


@router.patch("/{contract_id}", response_model=ContractDetailResponse)
async def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*CONTRACT_EDITOR_ROLES)),
):
    await _get_contract_or_404(db, contract_id)

    data = payload.model_dump(exclude_unset=True)

    if "vendor_id" in data:
        if data["vendor_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vendor is required",
            )
        vendor = await find_doc(db, "vendors", Vendor, {"id": data["vendor_id"]})
        if vendor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found",
            )

    if "contract_number" in data:
        new_number = (data["contract_number"] or "").strip().upper()
        if not new_number:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Contract number is required",
            )
        if await _contract_number_exists(db, new_number, exclude_id=contract_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Contract number already exists",
            )
        data["contract_number"] = new_number

    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title is required",
            )
        data["title"] = title

    if "contract_value" in data:
        if data["contract_value"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Contract value is required",
            )

    if "end_date" in data and data["end_date"] is not None:
        _validate_contract_dates(data.get("start_date"), data["end_date"])

    update_fields = {
        "vendor_id",
        "contract_number",
        "title",
        "description",
        "contract_value",
        "start_date",
        "end_date",
        "status",
        "is_active",
    }
    values = {field: data[field] for field in update_fields & set(data)}

    try:
        await update_doc(db, "contracts", {"id": contract_id}, values)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )
    return await _get_contract_or_404(db, contract_id)


@router.patch("/{contract_id}/status", response_model=ContractDetailResponse)
async def update_contract_status(
    contract_id: int,
    payload: ContractStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*CONTRACT_EDITOR_ROLES)),
):
    await _get_contract_or_404(db, contract_id)
    try:
        await update_doc(
            db,
            "contracts",
            {"id": contract_id},
            {"status": payload.status.value},
        )
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )
    return await _get_contract_or_404(db, contract_id)