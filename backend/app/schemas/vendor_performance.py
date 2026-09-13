from pydantic import BaseModel, ConfigDict

from ..models.enums import VendorPerformanceClassification


class DeliveryPerformanceSubscore(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    score: float | None = None
    total_orders: int = 0
    completed_deliveries: int = 0
    on_time_deliveries: int = 0
    delayed_deliveries: int = 0
    data_available: bool = False


class QualityPerformanceSubscore(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    score: float | None = None
    total_evaluations: int = 0
    average_quality_score: float | None = None
    data_available: bool = False


class IncidentPerformanceSubscore(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    score: float = 100.0
    total_incidents: int = 0
    open: int = 0
    in_progress: int = 0
    resolved: int = 0
    closed: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    overdue: int = 0
    data_available: bool = True


class VendorPerformanceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vendor_id: int
    vendor_name: str
    vendor_code: str
    overall_score: float | None = None
    classification: VendorPerformanceClassification
    limited_data: bool
    data_confidence: float
    delivery_score: float | None = None
    quality_score: float | None = None
    incident_score: float = 100.0
    available_components: list[str] = []
    missing_components: list[str] = []


class VendorPerformanceDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vendor_id: int
    vendor_name: str
    vendor_code: str
    overall_score: float | None = None
    classification: VendorPerformanceClassification
    limited_data: bool
    data_confidence: float
    available_components: list[str] = []
    missing_components: list[str] = []
    delivery: DeliveryPerformanceSubscore
    quality: QualityPerformanceSubscore
    incidents: IncidentPerformanceSubscore
    strengths: list[str] = []
    weaknesses: list[str] = []
    attention_areas: list[str] = []


class PaginatedVendorPerformance(BaseModel):
    items: list[VendorPerformanceListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class VendorPerformanceStatistics(BaseModel):
    total_vendors: int
    excellent: int = 0
    good: int = 0
    average: int = 0
    poor: int = 0
    critical: int = 0
    insufficient_data: int = 0
    requiring_attention: int = 0
    limited_data: int = 0