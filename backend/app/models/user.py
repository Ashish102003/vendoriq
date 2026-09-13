from typing import TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .incident import Incident
    from .quality_evaluation import QualityEvaluation
    from .role import Role


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    role: Mapped["Role"] = relationship(back_populates="users")
    quality_evaluations_created: Mapped[list["QualityEvaluation"]] = relationship(
        back_populates="created_by_user"
    )
    incidents_reported: Mapped[list["Incident"]] = relationship(
        foreign_keys="Incident.reported_by",
        back_populates="reported_by_user",
    )
    incidents_assigned: Mapped[list["Incident"]] = relationship(
        foreign_keys="Incident.assigned_to",
        back_populates="assigned_to_user",
    )