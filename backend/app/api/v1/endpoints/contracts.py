import math
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ....core.database import get_db
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

SORT_FIELDS: dict[str, object] = {
    "contract_number": Contract.contract_number,
    "title": Contract.title,
    "contract_value": Contract.contract_value,
    "start_date": Contract.start_date,
    "end_date": Contract.end_date,
    "status": Contract.status,
    "created_at": Contract.created_at,
    "updated_at": Contract.updated_at,
}
SORT_ORDER = Literal["asc", "desc"]


def _get_contract_or_404(db: Session, contract_id: int) -> Contract:
    contract = (
        db.query(Contract)
        .options(joinedload(Contract.vendor))
        .filter(Contract.id == contract_id)
        .first()
    )
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    return contract


def _contract_number_exists(
    db: Session, contract_number: str, exclude_id: int | None = None
) -> bool:
    query = db.query(Contract).filter(
        func.lower(Contract.contract_number) == contract_number.lower()
    )
    if exclude_id is not None:
        query = query.filter(Contract.id != exclude_id)
    return query.first() is not None


def _validate_contract_dates(start_date, end_date) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )


@router.get("/statistics", response_model=ContractStatistics)
def get_contract_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(func.count(Contract.id)).scalar() or 0
    status_counts = {
        row_status: count
        for row_status, count in db.query(
            Contract.status, func.count(Contract.id)
        )
        .group_by(Contract.status)
        .all()
    }
    total_value = db.query(func.sum(Contract.contract_value)).scalar()
    return ContractStatistics(
        total_contracts=total,
        active_contracts=status_counts.get(ContractStatus.ACTIVE, 0),
        draft_contracts=status_counts.get(ContractStatus.DRAFT, 0),
        completed_contracts=status_counts.get(ContractStatus.COMPLETED, 0),
        on_hold_contracts=status_counts.get(ContractStatus.ON_HOLD, 0),
        cancelled_contracts=status_counts.get(ContractStatus.CANCELLED, 0),
        expired_contracts=status_counts.get(ContractStatus.EXPIRED, 0),
        total_contract_value=total_value or Decimal("0"),
    )


@router.get("", response_model=PaginatedContracts)
def list_contracts(
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
                    Contract.contract_number.ilike(like),
                    Contract.title.ilike(like),
                )
            )
    if vendor_id is not None:
        conditions.append(Contract.vendor_id == vendor_id)
    if status_filter is not None:
        conditions.append(Contract.status == status_filter)
    if is_active is not None:
        conditions.append(Contract.is_active.is_(is_active))

    base = db.query(Contract)
    if conditions:
        base = base.filter(*conditions)
    total = base.count() or 0

    items_query = db.query(Contract).options(joinedload(Contract.vendor))
    if conditions:
        items_query = items_query.filter(*conditions)

    order_column: object = SORT_FIELDS[sort_by]
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
    response_model=ContractDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CONTRACT_EDITOR_ROLES)),
):
    vendor = db.get(Vendor, payload.vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    contract_number = payload.contract_number.strip().upper()
    if _contract_number_exists(db, contract_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )

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
        db.add(contract)
        db.commit()
        db.refresh(contract)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )
    return contract


@router.get("/{contract_id}", response_model=ContractDetailResponse)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_contract_or_404(db, contract_id)


@router.patch("/{contract_id}", response_model=ContractDetailResponse)
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CONTRACT_EDITOR_ROLES)),
):
    contract = _get_contract_or_404(db, contract_id)

    data = payload.model_dump(exclude_unset=True)

    if "vendor_id" in data:
        if data["vendor_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vendor is required",
            )
        vendor = db.get(Vendor, data["vendor_id"])
        if vendor is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found",
            )
        contract.vendor_id = data["vendor_id"]

    if "contract_number" in data:
        new_number = (data["contract_number"] or "").strip().upper()
        if not new_number:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Contract number is required",
            )
        if _contract_number_exists(db, new_number, exclude_id=contract.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Contract number already exists",
            )
        contract.contract_number = new_number

    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title is required",
            )
        contract.title = title

    if "contract_value" in data:
        if data["contract_value"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Contract value is required",
            )
        contract.contract_value = data["contract_value"]

    if "start_date" in data:
        contract.start_date = data["start_date"]
    if "end_date" in data:
        contract.end_date = data["end_date"]
    if contract.end_date < contract.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )

    for field in ("description", "status", "is_active"):
        if field in data:
            setattr(contract, field, data[field])

    try:
        db.commit()
        db.refresh(contract)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )
    return contract


@router.patch("/{contract_id}/status", response_model=ContractDetailResponse)
def update_contract_status(
    contract_id: int,
    payload: ContractStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CONTRACT_EDITOR_ROLES)),
):
    contract = _get_contract_or_404(db, contract_id)
    contract.status = payload.status
    try:
        db.commit()
        db.refresh(contract)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contract number already exists",
        )
    return contract