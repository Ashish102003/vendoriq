from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....db.repository import count_docs, find_doc, find_docs
from ....dependencies.auth import get_current_user
from ....models import User, Vendor
from ....models.enums import ContractStatus, PurchaseOrderStatus
from ....schemas.purchase_order import VendorOperationsSummary

router = APIRouter()

_ACTIVE_ORDER_STATUSES = [
    PurchaseOrderStatus.ISSUED.value,
    PurchaseOrderStatus.IN_PROGRESS.value,
]
_DELIVERED_ORDER_STATUSES = [
    PurchaseOrderStatus.DELIVERED.value,
    PurchaseOrderStatus.PARTIALLY_DELIVERED.value,
]


@router.get("/{vendor_id}/operations-summary", response_model=VendorOperationsSummary)
async def get_vendor_operations_summary(
    vendor_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = await find_doc(db, "vendors", Vendor, {"id": vendor_id})
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    total_contracts = await count_docs(db, "contracts", {"vendor_id": vendor_id})
    active_contracts = await count_docs(
        db,
        "contracts",
        {"vendor_id": vendor_id, "status": ContractStatus.ACTIVE.value},
    )

    order_criteria = {"vendor_id": vendor_id}
    total_orders = await count_docs(db, "purchase_orders", order_criteria)
    active_orders = await count_docs(
        db,
        "purchase_orders",
        {"vendor_id": vendor_id, "status": {"$in": _ACTIVE_ORDER_STATUSES}},
    )
    delivered_orders = await count_docs(
        db,
        "purchase_orders",
        {"vendor_id": vendor_id, "status": {"$in": _DELIVERED_ORDER_STATUSES}},
    )

    delivered_rows = await find_docs(
        db,
        "purchase_orders",
        None,
        {"vendor_id": vendor_id, "actual_delivery_date": {"$ne": None}},
        project={"actual_delivery_date": 1, "expected_delivery_date": 1},
    )
    delayed_orders = sum(
        1
        for row in delivered_rows
        if row["actual_delivery_date"] > row["expected_delivery_date"]
    )

    value_rows = await db["purchase_orders"].aggregate(
        [
            {"$match": {"vendor_id": vendor_id}},
            {"$group": {"_id": None, "total": {"$sum": "$order_value"}}},
        ]
    ).to_list(None)
    total_order_value = value_rows[0]["total"] if value_rows else Decimal("0")
    if hasattr(total_order_value, "to_decimal"):
        total_order_value = total_order_value.to_decimal()

    return VendorOperationsSummary(
        vendor_id=vendor_id,
        total_contracts=total_contracts,
        active_contracts=active_contracts,
        total_orders=total_orders,
        active_orders=active_orders,
        delivered_orders=delivered_orders,
        delayed_orders=delayed_orders,
        total_order_value=total_order_value,
    )