from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....dependencies.auth import get_current_user
from ....models import Contract, PurchaseOrder, User, Vendor
from ....models.enums import ContractStatus, PurchaseOrderStatus
from ....schemas.purchase_order import VendorOperationsSummary

router = APIRouter()


@router.get("/{vendor_id}/operations-summary", response_model=VendorOperationsSummary)
def get_vendor_operations_summary(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    total_contracts = (
        db.query(func.count(Contract.id))
        .filter(Contract.vendor_id == vendor_id)
        .scalar()
        or 0
    )
    active_contracts = (
        db.query(func.count(Contract.id))
        .filter(
            Contract.vendor_id == vendor_id,
            Contract.status == ContractStatus.ACTIVE,
        )
        .scalar()
        or 0
    )

    orders_query = db.query(PurchaseOrder).filter(
        PurchaseOrder.vendor_id == vendor_id
    )
    total_orders = orders_query.count() or 0

    active_orders = (
        orders_query.filter(
            PurchaseOrder.status.in_(
                [PurchaseOrderStatus.ISSUED, PurchaseOrderStatus.IN_PROGRESS]
            )
        ).count()
        or 0
    )

    delivered_orders = (
        orders_query.filter(
            PurchaseOrder.status.in_(
                [PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.PARTIALLY_DELIVERED]
            )
        ).count()
        or 0
    )

    delivered_rows = (
        db.query(
            PurchaseOrder.actual_delivery_date,
            PurchaseOrder.expected_delivery_date,
        )
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.actual_delivery_date.isnot(None),
        )
        .all()
    )
    delayed_orders = sum(1 for act, exp in delivered_rows if act > exp)

    total_order_value = (
        db.query(func.sum(PurchaseOrder.order_value))
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .scalar()
        or 0
    )

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