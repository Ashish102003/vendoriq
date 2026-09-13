from datetime import date
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin
from .enums import VendorStatus

if TYPE_CHECKING:
    from .contract import Contract
    from .incident import Incident
    from .purchase_order import PurchaseOrder
    from .quality_evaluation import QualityEvaluation
    from .vendor_category import VendorCategory


class Vendor(Base, TimestampMixin):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vendor_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("vendor_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[VendorStatus] = mapped_column(
        Enum(VendorStatus, native_enum=False, length=32),
        nullable=False,
        default=VendorStatus.PENDING,
        server_default=VendorStatus.PENDING.value,
    )
    vendor_since: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    category: Mapped["VendorCategory"] = relationship(back_populates="vendors")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="vendor")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
        back_populates="vendor"
    )
    quality_evaluations: Mapped[list["QualityEvaluation"]] = relationship(
        back_populates="vendor"
    )
    incidents: Mapped[list["Incident"]] = relationship(back_populates="vendor")