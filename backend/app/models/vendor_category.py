from datetime import datetime
from typing import ClassVar, Optional

from .base import DocumentModel


class VendorCategory(DocumentModel):
    """Backs the former ``vendor_categories`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "name",
        "description",
        "is_active",
        "created_at",
        "updated_at",
    )

    id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None