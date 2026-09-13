from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .enums import QualityStatus

if TYPE_CHECKING:
    from .contract import Contract
    from .purchase_order import PurchaseOrder
    from .user import User
    from .vendor import Vendor


class QualityEvaluation(Base, TimestampMixin):
    __tablename__ = "quality_evaluations"
    __table_args__ = (
        CheckConstraint(
            "quality_score >= 0 AND quality_score <= 100",
            name="ck_quality_evaluations_score_range",
        ),
        CheckConstraint(
            "defect_count >= 0",
            name="ck_quality_evaluations_defect_count_non_negative",
        ),
        CheckConstraint(
            "total_items >= 0",
            name="ck_quality_evaluations_total_items_non_negative",
        ),
        CheckConstraint(
            "total_items = 0 OR total_items >= defect_count",
            name="ck_quality_evaluations_defects_within_items",
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
    purchase_order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    evaluation_date: Mapped[date] = mapped_column(Date, nullable=False)
    quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    defect_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    total_items: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    quality_status: Mapped[QualityStatus] = mapped_column(
        Enum(QualityStatus, native_enum=False, length=32),
        nullable=False,
    )
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    vendor: Mapped["Vendor"] = relationship(back_populates="quality_evaluations")
    contract: Mapped[Optional["Contract"]] = relationship(
        back_populates="quality_evaluations"
    )
    purchase_order: Mapped[Optional["PurchaseOrder"]] = relationship(
        back_populates="quality_evaluations"
    )
    created_by_user: Mapped["User"] = relationship(
        back_populates="quality_evaluations_created"
    )

    @property
    def evaluator(self) -> "User":
        return self.created_by_user