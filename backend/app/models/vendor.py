from datetime import date, datetime
from typing import ClassVar, Optional

from .base import DocumentModel
from .enums import VendorStatus
from .vendor_category import VendorCategory


class Vendor(DocumentModel):
    """Backs the former ``vendors`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "vendor_code",
        "company_name",
        "contact_person",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "country",
        "postal_code",
        "website",
        "category_id",
        "status",
        "vendor_since",
        "is_active",
        "created_at",
        "updated_at",
    )
    ENUM_FIELDS: ClassVar[dict[str, type]] = {"status": VendorStatus}
    DATE_FIELDS: ClassVar[set[str]] = {"vendor_since"}

    id: Optional[int] = None
    vendor_code: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    website: Optional[str] = None
    category_id: Optional[int] = None
    status: Optional[VendorStatus] = VendorStatus.PENDING
    vendor_since: Optional[date] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    category: Optional[VendorCategory] = None