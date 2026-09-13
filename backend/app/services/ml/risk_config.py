"""Central configuration for Phase 9 predictive risk analytics.

All rule weights, risk bands, confidence thresholds and ML training knobs live
here so the system behaves deterministically and the numbers are documented in
``docs/ml-predictive-risk.md``.
"""

from pathlib import Path

from ...models.enums import RiskConfidence, RiskLevel

# ---------------------------------------------------------------------------
# Risk-level bands (risk_score increases with risk; 0-100).
# ---------------------------------------------------------------------------
RISK_LEVEL_BANDS: tuple[tuple[float, RiskLevel], ...] = (
    (20.0, RiskLevel.VERY_LOW),
    (40.0, RiskLevel.LOW),
    (60.0, RiskLevel.MEDIUM),
    (80.0, RiskLevel.HIGH),
    (100.0, RiskLevel.CRITICAL),
)

# ---------------------------------------------------------------------------
# Rule-based component weights. Available components are re-normalized so a
# vendor with partial data is never treated as though the missing components
# carry zero risk.
# ---------------------------------------------------------------------------
RISK_COMPONENT_WEIGHTS: dict[str, float] = {
    "delivery": 0.30,
    "incident": 0.25,
    "performance": 0.20,
    "quality": 0.15,
    "workload": 0.10,
}
RISK_COMPONENT_NAMES: tuple[str, ...] = (
    "delivery",
    "incident",
    "performance",
    "quality",
    "workload",
)

# ---------------------------------------------------------------------------
# Workload component mapping. A load (outstanding + recent orders) above
# WORKLOAD_SATURATION maps to workload risk 100 on a linear scale.
# ---------------------------------------------------------------------------
WORKLOAD_SATURATION = 15

# ---------------------------------------------------------------------------
# Confidence thresholds (deterministic, data-driven only).
# ---------------------------------------------------------------------------
CONFIDENCE_LOW_RECORDS = 3
CONFIDENCE_LOW_HISTORY_DAYS = 30
CONFIDENCE_HIGH_RECORDS = 20
CONFIDENCE_HIGH_HISTORY_DAYS = 180

# ---------------------------------------------------------------------------
# Rule-based risk factor / positive factor thresholds.
# ---------------------------------------------------------------------------
FACTOR_RISK_THRESHOLD = 40.0
POSITIVE_RISK_THRESHOLD = 20.0

# ---------------------------------------------------------------------------
# Risk trend (two-period comparison). Absolute point difference on the
# rule-based risk scale; smaller differences are STABLE.
# ---------------------------------------------------------------------------
TREND_WINDOW_DAYS = 90
TREND_CHANGE_THRESHOLD = 4.0

# ---------------------------------------------------------------------------
# ML training.
# ---------------------------------------------------------------------------
MIN_TRAINING_RECORDS = 50
MIN_CLASS_RECORDS = 5
RANDOM_STATE = 42
TEST_RATIO = 0.20
TRAINING_LOOKBACK_MONTHS = 4
MIN_PERIOD_RECORDS = 2
HIGH_RISK_MIN_DELAYED = 2
HIGH_RISK_MIN_CRITICAL_INCIDENTS = 1
HIGH_RISK_MIN_INCIDENTS = 3
HIGH_RISK_QUALITY_BELOW = 70.0

# ---------------------------------------------------------------------------
# Hybrid prediction blend (rule 70% / ML 30%). Only used when a trained model
# is available; otherwise the prediction is purely rule-based.
# ---------------------------------------------------------------------------
HYBRID_RULE_WEIGHT = 0.70
HYBRID_ML_WEIGHT = 0.30

# ---------------------------------------------------------------------------
# Artifact storage. Runtime artifacts never live inside MySQL and are ignored
# by git. The directory is read at call time so tests can redirect it.
# ---------------------------------------------------------------------------
_MODEL_DIR = Path(__file__).resolve().parents[3] / "model_artifacts"

ARTIFACT_DIR: Path = _MODEL_DIR
MODEL_ARTIFACT_FILE = "vendor_risk_model.joblib"
MODEL_METADATA_FILE = "vendor_risk_model_metadata.json"
MODEL_TYPE = "RandomForestClassifier"
MODEL_VERSION = "1.0.0"


def classify_risk_level(risk_score: float | None) -> RiskLevel | None:
    """Map a risk score (0-100, higher = riskier) to a risk level band."""
    if risk_score is None:
        return None
    for threshold, level in RISK_LEVEL_BANDS:
        if risk_score <= threshold:
            return level
    return RiskLevel.CRITICAL


def resolve_confidence(total_records: int, history_days: int) -> RiskConfidence:
    """Deterministic confidence from the volume and span of real records.

    LOW when there are fewer than ``CONFIDENCE_LOW_RECORDS`` records or less
    than ``CONFIDENCE_LOW_HISTORY_DAYS`` days of history; HIGH with at least
    ``CONFIDENCE_HIGH_RECORDS`` records and ``CONFIDENCE_HIGH_HISTORY_DAYS``
    days of history; MEDIUM in between.
    """
    if total_records < CONFIDENCE_LOW_RECORDS or history_days < CONFIDENCE_LOW_HISTORY_DAYS:
        return RiskConfidence.LOW
    if (
        total_records >= CONFIDENCE_HIGH_RECORDS
        and history_days >= CONFIDENCE_HIGH_HISTORY_DAYS
    ):
        return RiskConfidence.HIGH
    return RiskConfidence.MEDIUM