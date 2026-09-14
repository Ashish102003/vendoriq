import math
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from ....core.database import get_db
from ....db.repository import (
    attach_order_relations,
    cis,
    contains,
    count_docs,
    find_doc,
    find_docs,
    insert_doc,
    update_doc,
)
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

SORT_FIELDS: dict[str, str] = {
    "order_number": "order_number",
    "title": "title",
    "order_value": "order_value",
    "order_date": "order_date",
    "expected_delivery_date": "expected_delivery_date",
    "actual_delivery_date": "actual_delivery_date",
    "status": "status",
    "created_at": "created_at",
    "updated_at": "updated_at",
}
SORT_ORDER = Literal["asc", "desc"]


async def _get_purchase_order_or_404(
    db: AsyncIOMotorDatabase, purchase_order_id: int
) -> PurchaseOrder:
    po = await find_doc(db, "purchase_orders", PurchaseOrder, {"id": purchase_order_id})
    if po is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )
    await attach_order_relations(db, [po])
    return po


async def _order_number_exists(
    db: AsyncIOMotorDatabase, order_number: str, exclude_id: int | None = None
) -> bool:
    criteria: dict = {"order_number": cis(order_number)}
    if exclude_id is not None:
        criteria["id"] = {"$ne": exclude_id}
    return await find_doc(db, "purchase_orders", PurchaseOrder, criteria) is not None


def _validate_order_dates(order_date, expected_delivery_date, actual_delivery_date=None):
    if order_date and expected_delivery_date and expected_delivery_date < order_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expected_delivery_date must be on or after order_date",
        )
    if actual_delivery_date is not None and order_date and actual_delivery_date < order_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="actual_delivery_date must be on or after order_date",
        )


async def _validate_contract_vendor(
    db: AsyncIOMotorDatabase, vendor_id: int, contract_id: int | None
) -> None:
    if contract_id is None:
        return
    contract = await find_doc(db, "contracts", Contract, {"id": contract_id})
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
async def get_purchase_order_statistics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = await count_docs(db, "purchase_orders", {})
    status_rows = await db["purchase_orders"].aggregate(
        [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    ).to_list(None)
    status_counts = {row["_id"]: row["count"] for row in status_rows}
    value_rows = await db["purchase_orders"].aggregate(
        [{"$group": {"_id": None, "total": {"$sum": "$order_value"}}}]
    ).to_list(None)
    total_value = value_rows[0]["total"] if value_rows else Decimal("0")
    if hasattr(total_value, "to_decimal"):
        total_value = total_value.to_decimal()

    delivery_rows = await find_docs(
        db,
        "purchase_orders",
        None,
        {"actual_delivery_date": {"$ne": None}},
        project={"actual_delivery_date": 1, "expected_delivery_date": 1},
    )
    on_time = sum(1 for row in delivery_rows if row["actual_delivery_date"] <= row["expected_delivery_date"])
    delayed = len(delivery_rows) - on_time
    pending = total - len(delivery_rows)

    return PurchaseOrderStatistics(
        total_orders=total,
        draft_orders=status_counts.get(PurchaseOrderStatus.DRAFT.value, 0),
        issued_orders=status_counts.get(PurchaseOrderStatus.ISSUED.value, 0),
        in_progress_orders=status_counts.get(PurchaseOrderStatus.IN_PROGRESS.value, 0),
        delivered_orders=status_counts.get(PurchaseOrderStatus.DELIVERED.value, 0),
        partially_delivered_orders=status_counts.get(
            PurchaseOrderStatus.PARTIALLY_DELIVERED.value, 0
        ),
        cancelled_orders=status_counts.get(PurchaseOrderStatus.CANCELLED.value, 0),
        closed_orders=status_counts.get(PurchaseOrderStatus.CLOSED.value, 0),
        total_order_value=total_value,
        on_time_deliveries=on_time,
        delayed_deliveries=delayed,
        pending_deliveries=pending,
    )


@router.get("", response_model=PaginatedPurchaseOrders)
async def list_purchase_orders(
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
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    criteria: dict = {}
    if search:
        term = search.strip()
        if term:
            pattern = contains(term)
            criteria["$or"] = [
                {"order_number": pattern},
                {"title": pattern},
            ]
    if vendor_id is not None:
        criteria["vendor_id"] = vendor_id
    if contract_id is not None:
        criteria["contract_id"] = contract_id
    if status_filter is not None:
        criteria["status"] = status_filter.value

    total = await count_docs(db, "purchase_orders", criteria)

    sort = [(SORT_FIELDS[sort_by], 1 if sort_order == "asc" else -1)]
    orders = await find_docs(
        db,
        "purchase_orders",
        PurchaseOrder,
        criteria,
        sort=sort,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    await attach_order_relations(db, orders)

    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": orders,
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
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    vendor = await find_doc(db, "vendors", Vendor, {"id": payload.vendor_id})
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    await _validate_contract_vendor(db, payload.vendor_id, payload.contract_id)
    _validate_order_dates(payload.order_date, payload.expected_delivery_date)

    order_number = payload.order_number.strip().upper()
    if await _order_number_exists(db, order_number):
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
        await insert_doc(db, "purchase_orders", po)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    await attach_order_relations(db, [po])
    return po


@router.get("/{purchase_order_id}", response_model=PurchaseOrderDetailResponse)
async def get_purchase_order(
    purchase_order_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_purchase_order_or_404(db, purchase_order_id)


@router.patch("/{purchase_order_id}", response_model=PurchaseOrderDetailResponse)
async def update_purchase_order(
    purchase_order_id: int,
    payload: PurchaseOrderUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    await _get_purchase_order_or_404(db, purchase_order_id)
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

    if "order_number" in data:
        new_number = (data["order_number"] or "").strip().upper()
        if not new_number:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Order number is required",
            )
        if await _order_number_exists(db, new_number, exclude_id=purchase_order_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order number already exists",
            )
        data["order_number"] = new_number

    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title is required",
            )
        data["title"] = title

    if "order_value" in data:
        if data["order_value"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Order value is required",
            )

    vendor_id = data.get("vendor_id", None)
    if vendor_id is None:
        existing = await find_doc(db, "purchase_orders", PurchaseOrder, {"id": purchase_order_id})
        vendor_id = existing.vendor_id
    contract_id = data.get("contract_id", None)
    if contract_id is None and "contract_id" not in data:
        existing = await find_doc(db, "purchase_orders", PurchaseOrder, {"id": purchase_order_id})
        contract_id = existing.contract_id
    await _validate_contract_vendor(db, vendor_id, contract_id)

    order_date = data.get("order_date", None)
    expected_delivery_date = data.get("expected_delivery_date", None)
    actual_delivery_date = data.get("actual_delivery_date", None)
    if order_date is None or expected_delivery_date is None:
        existing = await find_doc(db, "purchase_orders", PurchaseOrder, {"id": purchase_order_id})
        order_date = order_date or existing.order_date
        expected_delivery_date = expected_delivery_date or existing.expected_delivery_date
        if actual_delivery_date is None:
            actual_delivery_date = existing.actual_delivery_date
    _validate_order_dates(order_date, expected_delivery_date, actual_delivery_date)

    update_fields = {
        "vendor_id",
        "order_number",
        "contract_id",
        "title",
        "description",
        "order_value",
        "order_date",
        "expected_delivery_date",
        "actual_delivery_date",
        "status",
    }
    values = {field: data[field] for field in update_fields & set(data)}

    try:
        await update_doc(db, "purchase_orders", {"id": purchase_order_id}, values)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    return await _get_purchase_order_or_404(db, purchase_order_id)


@router.patch(
    "/{purchase_order_id}/status", response_model=PurchaseOrderDetailResponse
)
async def update_purchase_order_status(
    purchase_order_id: int,
    payload: PurchaseOrderStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    await _get_purchase_order_or_404(db, purchase_order_id)
    try:
        await update_doc(
            db,
            "purchase_orders",
            {"id": purchase_order_id},
            {"status": payload.status.value},
        )
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    return await _get_purchase_order_or_404(db, purchase_order_id)


@router.patch(
    "/{purchase_order_id}/delivery", response_model=PurchaseOrderDetailResponse
)
async def record_delivery(
    purchase_order_id: int,
    payload: DeliveryRecord,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*PO_EDITOR_ROLES)),
):
    po = await _get_purchase_order_or_404(db, purchase_order_id)
    values: dict = {"actual_delivery_date": payload.actual_delivery_date}
    if payload.status is not None:
        values["status"] = payload.status.value

    order_date = po.order_date
    _validate_order_dates(
        order_date, po.expected_delivery_date, payload.actual_delivery_date
    )

    try:
        await update_doc(db, "purchase_orders", {"id": purchase_order_id}, values)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order number already exists",
        )
    return await _get_purchase_order_or_404(db, purchase_order_id)