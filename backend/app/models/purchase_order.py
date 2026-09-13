from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text
)
from .base import Base, TimestampMixin
from .enums import PurchaseOrderStatus

from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from .contract import Contract
    from .incident import Incident
    from .quality_evaluation import QualityEvaluation
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


class PurchaseOrder(Base, TimestampMixin):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint("order_value >= 0", name="ck_purchase_orders_order_value_non_negative"),
        CheckConstraint(
            "expected_delivery_date >= order_date",
            name="ck_purchase_orders_expected_delivery_after_order",
        ),
        CheckConstraint(
            "actual_delivery_date IS NULL OR actual_delivery_date >= order_date",
            name="ck_purchase_orders_actual_delivery_after_order",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    contract_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    order_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus, native_enum=False, length=32),
        nullable=False,
        default=PurchaseOrderStatus.DRAFT,
        server_default=PurchaseOrderStatus.DRAFT.value,
    )

    vendor: Mapped["Vendor"] = relationship(back_populates="purchase_orders")
    contract: Mapped[Optional["Contract"]] = relationship(
        back_populates="purchase_orders"
    )
    quality_evaluations: Mapped[list["QualityEvaluation"]] = relationship(
        back_populates="purchase_order"
    )
    incidents: Mapped[list["Incident"]] = relationship(back_populates="purchase_order")

    @property
    def delivery_status(self) -> str:
        status, _ = compute_delivery(self.actual_delivery_date, self.expected_delivery_date)
        return status

    @property
    def delay_days(self) -> int | None:
        _, delay = compute_delivery(self.actual_delivery_date, self.expected_delivery_date)
        return delay