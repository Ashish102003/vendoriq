from datetime import date, datetime
from typing import TYPE_CHECKING, ClassVar, Optional

from .base import DocumentModel
from .contract import Contract
from .enums import QualityStatus
from .purchase_order import PurchaseOrder
from .user import User
from .vendor import Vendor


class QualityEvaluation(DocumentModel):
    """Backs the former ``quality_evaluations`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "vendor_id",
        "contract_id",
        "purchase_order_id",
        "evaluation_date",
        "quality_score",
        "defect_count",
        "total_items",
        "quality_status",
        "comments",
        "created_by",
        "created_at",
        "updated_at",
    )
    ENUM_FIELDS: ClassVar[dict[str, type]] = {"quality_status": QualityStatus}
    DATE_FIELDS: ClassVar[set[str]] = {"evaluation_date"}

    id: Optional[int] = None
    vendor_id: Optional[int] = None
    contract_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    evaluation_date: Optional[date] = None
    quality_score: Optional[int] = None
    defect_count: Optional[int] = 0
    total_items: Optional[int] = 0
    quality_status: Optional[QualityStatus] = None
    comments: Optional[str] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    vendor: Optional[Vendor] = None
    contract: Optional[Contract] = None
    purchase_order: Optional[PurchaseOrder] = None
    created_by_user: Optional[User] = None

    @property
    def evaluator(self) -> Optional[User]:
        return self.created_by_user