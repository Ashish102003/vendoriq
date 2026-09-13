from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models.enums import IncidentSeverity, IncidentStatus, IncidentType


class IncidentVendorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_code: str
    company_name: str


class IncidentContractSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_number: str
    title: str


class IncidentPurchaseOrderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    title: str


class IncidentUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    email: str


class IncidentCreate(BaseModel):
    vendor_id: int
    contract_id: int | None = None
    purchase_order_id: int | None = None
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=3)
    incident_type: IncidentType
    severity: IncidentSeverity
    reported_date: date
    due_date: date | None = None
    impact_score: int = Field(ge=1, le=10)
    assigned_to: int | None = None
    status: IncidentStatus | None = None


class IncidentUpdate(BaseModel):
    contract_id: int | None = None
    purchase_order_id: int | None = None
    title: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = Field(default=None, min_length=3)
    incident_type: IncidentType | None = None
    severity: IncidentSeverity | None = None
    status: IncidentStatus | None = None
    due_date: date | None = None
    resolved_date: date | None = None
    impact_score: int | None = Field(default=None, ge=1, le=10)
    assigned_to: int | None = None
    resolution_notes: str | None = None


class IncidentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_number: str
    vendor: IncidentVendorSummary
    contract: IncidentContractSummary | None
    purchase_order: IncidentPurchaseOrderSummary | None
    title: str
    incident_type: IncidentType
    severity: IncidentSeverity
    status: IncidentStatus
    reported_date: date
    due_date: date | None
    resolved_date: date | None
    impact_score: int
    assigned_to_user: IncidentUserSummary | None
    updated_at: datetime


class IncidentDetailResponse(IncidentListItem):
    vendor_id: int
    contract_id: int | None
    purchase_order_id: int | None
    description: str
    reported_by: int
    reported_by_user: IncidentUserSummary
    assigned_to: int | None
    resolution_notes: str | None
    created_at: datetime


class PaginatedIncidents(BaseModel):
    items: list[IncidentListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class IncidentStatistics(BaseModel):
    total_incidents: int
    open: int
    in_progress: int
    resolved: int
    closed: int
    critical: int
    high: int
    medium: int
    low: int
    overdue: int
    average_impact_score: float | None


class VendorIncidentSummary(BaseModel):
    vendor_id: int
    total_incidents: int
    open_incidents: int
    in_progress_incidents: int
    resolved_incidents: int
    closed_incidents: int
    critical_incidents: int
    high_incidents: int
    medium_incidents: int
    low_incidents: int
    average_impact_score: float | None