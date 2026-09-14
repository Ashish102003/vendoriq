from datetime import date, datetime
from decimal import Decimal
from typing import ClassVar, Optional

from .base import DocumentModel
from .enums import ContractStatus
from .vendor import Vendor


class Contract(DocumentModel):
    """Backs the former ``contracts`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "vendor_id",
        "contract_number",
        "title",
        "description",
        "contract_value",
        "start_date",
        "end_date",
        "status",
        "is_active",
        "created_at",
        "updated_at",
    )
    ENUM_FIELDS: ClassVar[dict[str, type]] = {"status": ContractStatus}
    DATE_FIELDS: ClassVar[set[str]] = {"start_date", "end_date"}

    id: Optional[int] = None
    vendor_id: Optional[int] = None
    contract_number: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    contract_value: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[ContractStatus] = ContractStatus.DRAFT
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    vendor: Optional[Vendor] = None