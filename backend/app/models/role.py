from datetime import datetime
from typing import ClassVar, Optional

from .base import DocumentModel


class Role(DocumentModel):
    """Backs the former ``roles`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "name",
        "description",
        "created_at",
        "updated_at",
    )

    id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None