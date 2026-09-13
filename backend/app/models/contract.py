from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, CheckConstraint, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
from .enums import ContractStatus

if TYPE_CHECKING:
    from .incident import Incident
    from .purchase_order import PurchaseOrder
    from .quality_evaluation import QualityEvaluation
    from .vendor import Vendor


class Contract(Base, TimestampMixin):
    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint("contract_value >= 0", name="ck_contracts_contract_value_non_negative"),
        CheckConstraint("end_date >= start_date", name="ck_contracts_end_date_after_start_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    contract_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    contract_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus, native_enum=False, length=32),
        nullable=False,
        default=ContractStatus.DRAFT,
        server_default=ContractStatus.DRAFT.value,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    vendor: Mapped["Vendor"] = relationship(back_populates="contracts")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
        back_populates="contract"
    )
    quality_evaluations: Mapped[list["QualityEvaluation"]] = relationship(
        back_populates="contract"
    )
    incidents: Mapped[list["Incident"]] = relationship(back_populates="contract")