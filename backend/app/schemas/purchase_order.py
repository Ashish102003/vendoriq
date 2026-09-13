from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..models.enums import DeliveryStatus, PurchaseOrderStatus


class PurchaseOrderStatusUpdate(BaseModel):
    status: PurchaseOrderStatus


class DeliveryRecord(BaseModel):
    actual_delivery_date: date
    status: PurchaseOrderStatus | None = None


class PurchaseOrderVendorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_code: str
    company_name: str


class PurchaseOrderContractSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_number: str
    title: str


class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    contract_id: int | None = None
    order_number: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    order_value: Decimal = Field(ge=0)
    order_date: date
    expected_delivery_date: date
    status: PurchaseOrderStatus = PurchaseOrderStatus.DRAFT

    @model_validator(mode="after")
    def _validate_dates(self) -> "PurchaseOrderCreate":
        if self.expected_delivery_date < self.order_date:
            raise ValueError("expected_delivery_date must be on or after order_date")
        return self


class PurchaseOrderUpdate(BaseModel):
    vendor_id: int | None = None
    contract_id: int | None = None
    order_number: str | None = Field(default=None, min_length=1, max_length=30)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    order_value: Decimal | None = Field(default=None, ge=0)
    order_date: date | None = None
    expected_delivery_date: date | None = None
    actual_delivery_date: date | None = None
    status: PurchaseOrderStatus | None = None


class PurchaseOrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    title: str
    vendor: PurchaseOrderVendorSummary
    contract: PurchaseOrderContractSummary | None
    order_value: Decimal
    order_date: date
    expected_delivery_date: date
    actual_delivery_date: date | None
    delivery_status: DeliveryStatus
    delay_days: int | None
    status: PurchaseOrderStatus
    created_at: datetime


class PurchaseOrderDetailResponse(PurchaseOrderListItem):
    vendor_id: int
    contract_id: int | None
    description: str | None
    updated_at: datetime


class PaginatedPurchaseOrders(BaseModel):
    items: list[PurchaseOrderListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class PurchaseOrderStatistics(BaseModel):
    total_orders: int
    draft_orders: int
    issued_orders: int
    in_progress_orders: int
    delivered_orders: int
    partially_delivered_orders: int
    cancelled_orders: int
    closed_orders: int
    total_order_value: Decimal = Decimal("0")
    on_time_deliveries: int
    delayed_deliveries: int
    pending_deliveries: int


class VendorOperationsSummary(BaseModel):
    vendor_id: int
    total_contracts: int
    active_contracts: int
    total_orders: int
    active_orders: int
    delivered_orders: int
    delayed_orders: int
    total_order_value: Decimal = Decimal("0")