from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..models.enums import QualityStatus


def expected_quality_status(score: int) -> QualityStatus:
    """Return the quality status that is consistent with a given score."""
    if score >= 90:
        return QualityStatus.EXCELLENT
    if score >= 75:
        return QualityStatus.GOOD
    if score >= 60:
        return QualityStatus.ACCEPTABLE
    if score >= 40:
        return QualityStatus.POOR
    return QualityStatus.CRITICAL


def validate_status_score(status: QualityStatus, score: int) -> None:
    if status != expected_quality_status(score):
        raise ValueError("quality_status is not consistent with quality_score")


def validate_defects(defect_count: int, total_items: int) -> None:
    if total_items > 0 and defect_count > total_items:
        raise ValueError("defect_count must not exceed total_items")


class QualityEvaluationVendorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_code: str
    company_name: str


class QualityEvaluationContractSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_number: str
    title: str


class QualityEvaluationPurchaseOrderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    title: str


class QualityEvaluatorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    email: str


class QualityEvaluationCreate(BaseModel):
    vendor_id: int
    contract_id: int | None = None
    purchase_order_id: int | None = None
    evaluation_date: date
    quality_score: int = Field(ge=0, le=100)
    defect_count: int = Field(default=0, ge=0)
    total_items: int = Field(default=0, ge=0)
    quality_status: QualityStatus
    comments: str | None = None


class QualityEvaluationUpdate(BaseModel):
    vendor_id: int | None = None
    contract_id: int | None = None
    purchase_order_id: int | None = None
    evaluation_date: date | None = None
    quality_score: int | None = Field(default=None, ge=0, le=100)
    defect_count: int | None = Field(default=None, ge=0)
    total_items: int | None = Field(default=None, ge=0)
    quality_status: QualityStatus | None = None
    comments: str | None = None


class QualityEvaluationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor: QualityEvaluationVendorSummary
    contract: QualityEvaluationContractSummary | None
    purchase_order: QualityEvaluationPurchaseOrderSummary | None
    evaluation_date: date
    quality_score: int
    defect_count: int
    total_items: int
    quality_status: QualityStatus
    evaluator: QualityEvaluatorSummary
    created_at: datetime


class QualityEvaluationDetailResponse(QualityEvaluationListItem):
    vendor_id: int
    contract_id: int | None
    purchase_order_id: int | None
    comments: str | None
    updated_at: datetime


class PaginatedQualityEvaluations(BaseModel):
    items: list[QualityEvaluationListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class QualityEvaluationStatistics(BaseModel):
    total_evaluations: int
    excellent: int
    good: int
    acceptable: int
    poor: int
    critical: int
    average_quality_score: float | None
    total_defects: int


class VendorQualitySummary(BaseModel):
    vendor_id: int
    total_evaluations: int
    average_quality_score: float | None
    excellent_evaluations: int
    good_evaluations: int
    acceptable_evaluations: int
    poor_evaluations: int
    critical_evaluations: int
    total_defects: int