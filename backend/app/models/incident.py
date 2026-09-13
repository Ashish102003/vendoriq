from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .enums import IncidentSeverity, IncidentStatus, IncidentType

if TYPE_CHECKING:
    from .contract import Contract
    from .purchase_order import PurchaseOrder
    from .user import User
    from .vendor import Vendor


class Incident(Base, TimestampMixin):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint(
            "impact_score >= 1 AND impact_score <= 10",
            name="ck_incidents_impact_score_range",
        ),
        CheckConstraint(
            "due_date IS NULL OR due_date >= reported_date",
            name="ck_incidents_due_date_not_before_reported_date",
        ),
        CheckConstraint(
            "resolved_date IS NULL OR resolved_date >= reported_date",
            name="ck_incidents_resolved_date_not_before_reported_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    incident_number: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )
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
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    incident_type: Mapped[IncidentType] = mapped_column(
        Enum(IncidentType, native_enum=False, length=32),
        nullable=False,
    )
    severity: Mapped[IncidentSeverity] = mapped_column(
        Enum(IncidentSeverity, native_enum=False, length=32),
        nullable=False,
        index=True,
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, native_enum=False, length=32),
        nullable=False,
        default=IncidentStatus.OPEN,
        server_default="OPEN",
        index=True,
    )
    reported_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    resolved_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    impact_score: Mapped[int] = mapped_column(Integer, nullable=False)
    reported_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assigned_to: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    vendor: Mapped["Vendor"] = relationship(back_populates="incidents")
    contract: Mapped[Optional["Contract"]] = relationship(
        back_populates="incidents"
    )
    purchase_order: Mapped[Optional["PurchaseOrder"]] = relationship(
        back_populates="incidents"
    )
    reported_by_user: Mapped["User"] = relationship(
        foreign_keys=[reported_by],
        back_populates="incidents_reported",
    )
    assigned_to_user: Mapped[Optional["User"]] = relationship(
        foreign_keys=[assigned_to],
        back_populates="incidents_assigned",
    )