from datetime import datetime
from typing import ClassVar, Optional

from .base import DocumentModel
from .role import Role


class User(DocumentModel):
    """Backs the former ``users`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "first_name",
        "last_name",
        "email",
        "password_hash",
        "role_id",
        "is_active",
        "created_at",
        "updated_at",
    )

    id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    role: Optional["Role"] = None