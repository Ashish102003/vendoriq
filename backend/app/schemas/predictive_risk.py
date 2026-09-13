from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ..models.enums import (
    PredictionMethod,
    RiskConfidence,
    RiskLevel,
    RiskTrend,
)


class RiskFactor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    impact: str
    description: str


class PositiveFactor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: str


class ModelInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    available: bool = False
    model_type: str | None = None
    training_date: str | None = None
    training_records: int | None = None
    features: list[str] | None = None
    evaluation_metrics: dict[str, float | int] | None = None
    model_version: str | None = None
    message: str | None = None


class PredictiveRisk(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vendor_id: int
    vendor_name: str
    vendor_code: str
    risk_score: float | None = None
    risk_level: RiskLevel | None = None
    confidence: RiskConfidence = RiskConfidence.LOW
    prediction_method: PredictionMethod = PredictionMethod.RULE_BASED
    risk_trend: RiskTrend = RiskTrend.INSUFFICIENT_DATA
    risk_factors: list[RiskFactor] = []
    positive_factors: list[PositiveFactor] = []
    feature_summary: list[str] = []
    model_information: ModelInfo | None = None
    detail: str | None = None
    generated_at: datetime


class VendorRiskListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vendor_id: int
    vendor_name: str
    vendor_code: str
    category_name: str | None = None
    performance_score: float | None = None
    risk_score: float | None = None
    risk_level: RiskLevel | None = None
    confidence: RiskConfidence
    prediction_method: PredictionMethod


class PaginatedVendorRiskList(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[VendorRiskListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class RiskStatistics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_vendors: int = 0
    average_risk_score: float | None = None
    very_low_risk: int = 0
    low_risk: int = 0
    medium_risk: int = 0
    high_risk: int = 0
    critical_risk: int = 0
    high_confidence_predictions: int = 0
    low_confidence_predictions: int = 0
    no_data: int = 0


class TrainingResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trained: bool = False
    status: str
    message: str | None = None
    model_type: str | None = None
    training_records: int | None = None
    evaluation_metrics: dict[str, float | int] | None = None
    model_version: str | None = None
    timestamp: str | None = None