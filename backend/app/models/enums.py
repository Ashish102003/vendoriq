import enum


class VendorStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    UNDER_REVIEW = "UNDER_REVIEW"
    SUSPENDED = "SUSPENDED"
    TERMINATED = "TERMINATED"


class ContractStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ON_HOLD = "ON_HOLD"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    IN_PROGRESS = "IN_PROGRESS"
    DELIVERED = "DELIVERED"
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED"
    CANCELLED = "CANCELLED"
    CLOSED = "CLOSED"


class DeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    ON_TIME = "ON_TIME"
    DELAYED = "DELAYED"


class QualityStatus(str, enum.Enum):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    ACCEPTABLE = "ACCEPTABLE"
    POOR = "POOR"
    CRITICAL = "CRITICAL"


class IncidentType(str, enum.Enum):
    DELIVERY = "DELIVERY"
    QUALITY = "QUALITY"
    SERVICE = "SERVICE"
    CONTRACT = "CONTRACT"
    COMPLIANCE = "COMPLIANCE"
    COMMUNICATION = "COMMUNICATION"
    DOCUMENTATION = "DOCUMENTATION"
    PAYMENT = "PAYMENT"
    OTHER = "OTHER"


class IncidentSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class VendorPerformanceClassification(str, enum.Enum):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    AVERAGE = "AVERAGE"
    POOR = "POOR"
    CRITICAL = "CRITICAL"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class RiskLevel(str, enum.Enum):
    VERY_LOW = "VERY_LOW"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskConfidence(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class PredictionMethod(str, enum.Enum):
    RULE_BASED = "RULE_BASED"
    ML_BASED = "ML_BASED"
    HYBRID = "HYBRID"


class RiskTrend(str, enum.Enum):
    IMPROVING = "IMPROVING"
    STABLE = "STABLE"
    WORSENING = "WORSENING"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"