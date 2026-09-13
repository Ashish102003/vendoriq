from datetime import date
from typing import Literal

from pydantic import BaseModel

from ..models.enums import IncidentSeverity, VendorPerformanceClassification

CLASSIFICATION_ORDER: list[VendorPerformanceClassification] = [
    VendorPerformanceClassification.EXCELLENT,
    VendorPerformanceClassification.GOOD,
    VendorPerformanceClassification.AVERAGE,
    VendorPerformanceClassification.POOR,
    VendorPerformanceClassification.CRITICAL,
    VendorPerformanceClassification.INSUFFICIENT_DATA,
]

CLASSIFICATION_LABELS: dict[VendorPerformanceClassification, str] = {
    VendorPerformanceClassification.EXCELLENT: "Excellent",
    VendorPerformanceClassification.GOOD: "Good",
    VendorPerformanceClassification.AVERAGE: "Average",
    VendorPerformanceClassification.POOR: "Poor",
    VendorPerformanceClassification.CRITICAL: "Critical",
    VendorPerformanceClassification.INSUFFICIENT_DATA: "Insufficient data",
}


class PerformanceDistributionItem(BaseModel):
    classification: VendorPerformanceClassification
    label: str
    count: int = 0
    percentage: float = 0.0


class PerformanceDistribution(BaseModel):
    total_vendors: int
    items: list[PerformanceDistributionItem]


class VendorRankingItem(BaseModel):
    rank: int
    vendor_id: int
    vendor_name: str
    vendor_code: str
    overall_score: float
    classification: VendorPerformanceClassification
    limited_data: bool
    data_confidence: float
    delivery_score: float | None = None
    quality_score: float | None = None
    incident_score: float | None = None


class VendorRanking(BaseModel):
    total_vendors: int
    vendors_with_score: int
    items: list[VendorRankingItem]


class DeliveryAnalytics(BaseModel):
    total_orders: int = 0
    completed_orders: int = 0
    pending_orders: int = 0
    on_time_deliveries: int = 0
    delayed_deliveries: int = 0
    on_time_rate: float | None = None
    total_delay_days: int = 0
    average_delay_days: float | None = None


class QualityAnalytics(BaseModel):
    total_evaluations: int = 0
    average_quality_score: float | None = None


class IncidentAnalytics(BaseModel):
    total_incidents: int = 0
    open: int = 0
    in_progress: int = 0
    resolved: int = 0
    closed: int = 0
    unresolved: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    overdue: int = 0
    resolution_rate: float | None = None


class AnalyticsInsight(BaseModel):
    key: str
    kind: Literal["positive", "watch", "warning", "info"]
    title: str
    detail: str


class AnalyticsOverview(BaseModel):
    start_date: date
    end_date: date
    total_vendors: int
    vendors_in_scope: int
    vendors_with_score: int
    average_performance_score: float | None = None
    performance_change: float | None = None
    performance_change_period_label: str | None = None
    vendors_requiring_attention: int = 0
    distribution: list[PerformanceDistributionItem] = []
    delivery: DeliveryAnalytics
    quality: QualityAnalytics
    incidents: IncidentAnalytics
    insights: list[AnalyticsInsight] = []


class TrendPoint(BaseModel):
    period: str
    start_date: date
    end_date: date
    has_data: bool


class DeliveryTrendPoint(TrendPoint):
    completed_deliveries: int = 0
    on_time_rate: float | None = None
    delivery_score: float | None = None


class DeliveryTrend(BaseModel):
    granularity: str
    has_sufficient_data: bool
    summary: DeliveryAnalytics
    items: list[DeliveryTrendPoint]


class QualityTrendPoint(TrendPoint):
    evaluations: int = 0
    average_score: float | None = None


class QualityTrend(BaseModel):
    granularity: str
    has_sufficient_data: bool
    summary: QualityAnalytics
    items: list[QualityTrendPoint]


class IncidentTrendPoint(TrendPoint):
    incidents: int = 0
    unresolved: int = 0
    critical: int = 0
    incident_score: float | None = None


class IncidentTrend(BaseModel):
    granularity: str
    has_sufficient_data: bool
    summary: IncidentAnalytics
    items: list[IncidentTrendPoint]


class PerformanceTrendPoint(TrendPoint):
    average_overall_score: float | None = None
    vendors_contributing: int = 0


class PerformanceTrend(BaseModel):
    granularity: str
    has_sufficient_data: bool
    items: list[PerformanceTrendPoint]


class IncidentSeverityItem(BaseModel):
    severity: IncidentSeverity
    count: int = 0
    percentage: float = 0.0


class IncidentSeverityDistribution(BaseModel):
    total_incidents: int
    items: list[IncidentSeverityItem]


class CategoryPerformanceItem(BaseModel):
    category_id: int
    category_name: str
    vendor_count: int
    vendors_with_score: int
    average_overall_score: float | None = None
    average_delivery_score: float | None = None
    average_quality_score: float | None = None
    average_incident_score: float | None = None
    best_vendor_name: str | None = None
    best_overall_score: float | None = None


class CategoryPerformance(BaseModel):
    total_categories: int
    items: list[CategoryPerformanceItem]


class VendorComparisonMetric(BaseModel):
    vendor_id: int
    vendor_name: str
    vendor_code: str
    overall_score: float | None = None
    classification: VendorPerformanceClassification
    limited_data: bool
    data_confidence: float
    delivery_score: float | None = None
    quality_score: float | None = None
    incident_score: float | None = None
    delivery: DeliveryAnalytics
    quality: QualityAnalytics
    incidents: IncidentAnalytics


class VendorComparison(BaseModel):
    vendors: list[VendorComparisonMetric]