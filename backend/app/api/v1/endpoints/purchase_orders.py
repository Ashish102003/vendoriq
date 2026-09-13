import math
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ....core.database import get_db
from ....dependencies.auth import get_current_user, require_roles
from ....models import Contract, PurchaseOrder, User, Vendor
from ....models.enums import PurchaseOrderStatus
from ....schemas.purchase_order import (
    DeliveryRecord,
    PaginatedPurchaseOrders,
    PurchaseOrderCreate,
    PurchaseOrderDetailResponse,
    PurchaseOrderStatusUpdate,
    PurchaseOrderStatistics,
    PurchaseOrderUpdate,
)

router = APIRouter()

PO_EDITOR_ROLES = ("Admin", "Vendor Manager", "Procurement Manager")

SORT_FIELDS: dict[str, object] = {
    "order_number": PurchaseOrder.order_number,
    "title": PurchaseOrder.title,
    "order_value": PurchaseOrder.order_value,
    "order_date": PurchaseOrder.order_date,
    "expected_delivery_date": PurchaseOrder.expected_delivery_date,
    "actual_delivery_date": PurchaseOrder.actual_delivery_date,
    "status": PurchaseOrder.status,
    "created_at": PurchaseOrder.created_at,
    "updated_at": PurchaseOrder.updated_at,
}
SORT_ORDER = Literal["asc", "desc"]


def _get_purchase_order_or_404(db: Session, purchase_order_id: int) -> PurchaseOrder:
    po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.vendor), joinedload(PurchaseOrder.contract))
        .filter(PurchaseOrder.id == purchase_order_id)
        .first()
    )
    if po is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )
    return po


def _order_number_exists(
    db: Session, order_number: str, exclude_id: int | None = None
) -> bool:
    query = db.query(PurchaseOrder).filter(
        func.lower(PurchaseOrder.order_number) == order_number.lower()
    )
    if exclude_id is not None:
        query = query.filter(PurchaseOrder.id != exclude_id)
    return query.first() is not None


def _validate_order_dates(order_date, expected_delivery_date, actual_delivery_date=None):
    if expected_delivery_date < order_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expected_delivery_date must be on or after order_date",
        )
    if actual_delivery_date is not None and actual_delivery_date < order_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="actual_delivery_date must be on or after order_date",
        )


def _validate_contract_vendor(
    db: Session, vendor_id: int, contract_id: int | None
) -> None:
    if contract_id is None:
        return
    contract = db.get(Contract, contract_id)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    if contract.vendor_id != vendor_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected contract does not belong to the selected vendor.",
        )


@router.get("/statistics", response_model=PurchaseOrderStatistics)
def get_purchase_order_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(func.count(PurchaseOrder.id)).scalar() or 0
    status_counts = {
        row_status: count
        for row_status, count in db.query(
            PurchaseOrder.status, func.count(PurchaseOrder.id)
        )
        .group_by(PurchaseOrder.status)
        .all()
    }
    total_value = db.query(func.sum(PurchaseOrder.order_value)).scalar()

    rows_with_delivery = (
        db.query(
            PurchaseOrder.actual_delivery_date,
            PurchaseOrder.expected_delivery_date,
        )
        .filter(PurchaseOrder.actual_delivery_date.isnot(None))
        .all()
    )
    on_time = sum(1 for act, exp in rows_with_delivery if act <= exp)
    delayed = sum(1 for act, exp in rows_with_delivery if act > exp)
    pending = total - len(rows_with_delivery)

    return PurchaseOrderStatistics(
        total_orders=total,
        draft_orders=status_counts.get(PurchaseOrderStatus.DRAFT, 0),
        issued_orders=status_counts.get(PurchaseOrderStatus.ISSUED, 0),
        in_progress_orders=status_counts.get(PurchaseOrderStatus.IN_PROGRESS, 0),
        delivered_orders=status_counts.get(PurchaseOrderStatus.DELIVERED, 0),
        partially_delivered_orders=status_counts.get(
            PurchaseOrderStatus.PARTIALLY_DELIVERED, 0
        ),
        cancelled_orders=status_counts.get(PurchaseOrderStatus.CANCELLED, 0),
        closed_orders=status_counts.get(PurchaseOrderStatus.CLOSED, 0),
        total_order_value=total_value or Decimal("0"),
        on_time_deliveries=on_time,
        delayed_deliveries=delayed,
        pending_deliveries=pending,
    )


@router.get("", response_model=PaginatedPurchaseOrders)
def list_purchase_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    vendor_id: int | None = None,
    contract_id: int | None = None,
    status_filter: PurchaseOrderStatus | None = Query(default=None, alias="status"),
    sort_by: Literal[
        "order_number",
        "title",
        "order_value",
        "order_date",
        "expected_delivery_date",
        "actual_delivery_date",
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
                    PurchaseOrder.order_number.ilike(like),
                    PurchaseOrder.title.ilike(like),
                )
            )
    if vendor_id is not None:
        conditions.append(PurchaseOrder.vendor_id == vendor_id)
    if contract_id is not None:
        conditions.append(PurchaseOrder.contract_id == contract_id)
    if status_filter is not None:
        conditions.append(PurchaseOrder.status == status_filter)

    base = db.query(PurchaseOrder)
    if conditions:
        base = base.filter(*conditions)
    total = base.count() or 0

    items_query = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor), joinedload(PurchaseOrder.contract)
    )
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
    response_model=PurchaseOrderDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    vendor = db.get(Vendor, payload.vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    _validate_contract_vendor(db, payload.vendor_id, payload.contract_id)
    _validate_order_dates(payload.order_date, payload.expected_delivery_date)

    order_number = payload.order_number.strip().upper()
    if _order_number_exists(db, order_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )

    po = PurchaseOrder(
        vendor_id=vendor.id,
        contract_id=payload.contract_id,
        order_number=order_number,
        title=payload.title.strip(),
        description=payload.description,
        order_value=payload.order_value,
        order_date=payload.order_date,
        expected_delivery_date=payload.expected_delivery_date,
        status=payload.status,
    )
    try:
        db.add(po)
        db.commit()
        db.refresh(po)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    return (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor), joinedload(PurchaseOrder.contract)
        )
        .filter(PurchaseOrder.id == po.id)
        .first()
    )


@router.get("/{purchase_order_id}", response_model=PurchaseOrderDetailResponse)
def get_purchase_order(
    purchase_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_purchase_order_or_404(db, purchase_order_id)


@router.patch("/{purchase_order_id}", response_model=PurchaseOrderDetailResponse)
def update_purchase_order(
    purchase_order_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    po = _get_purchase_order_or_404(db, purchase_order_id)
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
        po.vendor_id = data["vendor_id"]

    if "order_number" in data:
        new_number = (data["order_number"] or "").strip().upper()
        if not new_number:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Order number is required",
            )
        if _order_number_exists(db, new_number, exclude_id=po.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order number already exists",
            )
        po.order_number = new_number

    if "contract_id" in data:
        po.contract_id = data["contract_id"]

    _validate_contract_vendor(db, po.vendor_id, po.contract_id)

    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title is required",
            )
        po.title = title

    if "order_value" in data:
        if data["order_value"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Order value is required",
            )
        po.order_value = data["order_value"]

    for field in ("order_date", "expected_delivery_date", "actual_delivery_date"):
        if field in data:
            setattr(po, field, data[field])

    _validate_order_dates(
        po.order_date, po.expected_delivery_date, po.actual_delivery_date
    )

    for field in ("description", "status"):
        if field in data:
            setattr(po, field, data[field])

    try:
        db.commit()
        db.refresh(po)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    return (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor), joinedload(PurchaseOrder.contract)
        )
        .filter(PurchaseOrder.id == po.id)
        .first()
    )


@router.patch(
    "/{purchase_order_id}/status", response_model=PurchaseOrderDetailResponse
)
def update_purchase_order_status(
    purchase_order_id: int,
    payload: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    po = _get_purchase_order_or_404(db, purchase_order_id)
    po.status = payload.status
    try:
        db.commit()
        db.refresh(po)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    return (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor), joinedload(PurchaseOrder.contract)
        )
        .filter(PurchaseOrder.id == po.id)
        .first()
    )


@router.patch(
    "/{purchase_order_id}/delivery", response_model=PurchaseOrderDetailResponse
)
def record_delivery(
    purchase_order_id: int,
    payload: DeliveryRecord,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    po = _get_purchase_order_or_404(db, purchase_order_id)
    po.actual_delivery_date = payload.actual_delivery_date

    if payload.status is not None:
        po.status = payload.status

    _validate_order_dates(po.order_date, po.expected_delivery_date, po.actual_delivery_date)

    try:
        db.commit()
        db.refresh(po)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    return (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor), joinedload(PurchaseOrder.contract)
        )
        .filter(PurchaseOrder.id == po.id)
        .first()
    )