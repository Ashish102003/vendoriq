from datetime import date, datetime
from typing import ClassVar, Optional

from .base import DocumentModel
from .contract import Contract
from .enums import IncidentSeverity, IncidentStatus, IncidentType
from .purchase_order import PurchaseOrder
from .user import User
from .vendor import Vendor


class Incident(DocumentModel):
    """Backs the former ``incidents`` table."""

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = (
        "id",
        "incident_number",
        "vendor_id",
        "contract_id",
        "purchase_order_id",
        "title",
        "description",
        "incident_type",
        "severity",
        "status",
        "reported_date",
        "due_date",
        "resolved_date",
        "impact_score",
        "reported_by",
        "assigned_to",
        "resolution_notes",
        "created_at",
        "updated_at",
    )
    ENUM_FIELDS: ClassVar[dict[str, type]] = {
        "incident_type": IncidentType,
        "severity": IncidentSeverity,
        "status": IncidentStatus,
    }
    DATE_FIELDS: ClassVar[set[str]] = {"reported_date", "due_date", "resolved_date"}

    id: Optional[int] = None
    incident_number: Optional[str] = None
    vendor_id: Optional[int] = None
    contract_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    incident_type: Optional[IncidentType] = None
    severity: Optional[IncidentSeverity] = None
    status: Optional[IncidentStatus] = IncidentStatus.OPEN
    reported_date: Optional[date] = None
    due_date: Optional[date] = None
    resolved_date: Optional[date] = None
    impact_score: Optional[int] = None
    reported_by: Optional[int] = None
    assigned_to: Optional[int] = None
    resolution_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    vendor: Optional[Vendor] = None
    contract: Optional[Contract] = None
    purchase_order: Optional[PurchaseOrder] = None
    reported_by_user: Optional[User] = None
    assigned_to_user: Optional[User] = None