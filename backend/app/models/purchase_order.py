from datetime import date, datetime
from decimal import Decimal
from typing import ClassVar, Optional

from .base import DocumentModel
from .contract import Contract
from .enums import PurchaseOrderStatus
from .vendor import Vendor


def compute_delivery(
    actual_delivery_date: date | None, expected_delivery_date: date
) -> tuple[str, int | None]:
    """Compute delivery status and delay days from source facts.

    Returns (delivery_status, delay_days).
    delay_days is null while delivery is pending and 0 for on-time deliveries.
    """
    if actual_delivery_date is None:
        return "PENDING", None
    if actual_delivery_date <= expected_delivery_date:
        return "ON_TIME", 0
    return "DELAYED", (actual_delivery_date - expected_delivery_date).days


class PurchaseOrder(DocumentModel):
    """Backs the former ``purchase_orders`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "vendor_id",
        "contract_id",
        "order_number",
        "title",
        "description",
        "order_value",
        "order_date",
        "expected_delivery_date",
        "actual_delivery_date",
        "status",
        "created_at",
        "updated_at",
    )
    ENUM_FIELDS: ClassVar[dict[str, type]] = {"status": PurchaseOrderStatus}
    DATE_FIELDS: ClassVar[set[str]] = {"order_date", "expected_delivery_date", "actual_delivery_date"}

    id: Optional[int] = None
    vendor_id: Optional[int] = None
    contract_id: Optional[int] = None
    order_number: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    order_value: Optional[Decimal] = None
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    status: Optional[PurchaseOrderStatus] = PurchaseOrderStatus.DRAFT
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    vendor: Optional[Vendor] = None
    contract: Optional[Contract] = None

    @property
    def delivery_status(self) -> str:
        status, _ = compute_delivery(self.actual_delivery_date, self.expected_delivery_date)
        return status

    @property
    def delay_days(self) -> int | None:
        _, delay = compute_delivery(self.actual_delivery_date, self.expected_delivery_date)
        return delay