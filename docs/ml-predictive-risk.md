# ML-Based Predictive Risk Intelligence (Phase 9)

## 1. Overview

Phase 9 adds a predictive risk scoring system to VendorIQ. Every vendor
receives a risk score (0–100, higher = riskier), a risk level, a confidence
rating, a prediction method, a risk trend, and explainable risk/positive
factors. The system is dual-mode: a deterministic rule-based engine runs
without any ML training, and an optional RandomForestClassifier can be trained
via an Admin-only endpoint to produce ML-based or hybrid predictions.

## 2. Architecture

```
services/predictive_risk_engine.py   ← rule-based component computation + factors
services/predictive_risk.py          ← orchestrator (list, statistics, detail)
services/ml/risk_config.py           ← all thresholds, weights, paths
services/ml/feature_builder.py       ← 28-column feature matrix
services/ml/training_data.py         ← vendor-month training rows
services/ml/risk_model.py            ← train / load / predict / clear
schemas/predictive_risk.py           ← Pydantic response models
endpoints/vendor_risk.py             ← 5 FastAPI routes
```

## 3. Risk Score

The risk score is a float in the range 0–100. A score of 0 means minimal
risk; 100 means critical risk. `None` is returned when the vendor has no
operational records at all (record-gating).

## 4. Risk Levels & Bands

| Band       | Threshold range     |
|------------|---------------------|
| VERY_LOW   | 0.0 – 20.0         |
| LOW        | 20.1 – 40.0        |
| MEDIUM     | 40.1 – 60.0        |
| HIGH       | 60.1 – 80.0        |
| CRITICAL   | 80.1 – 100.0       |

Classification is via the first band where `score ≤ threshold`, tested in
order: 20, 40, 60, 80, 100.

## 5. Risk Confidence

Confidence reflects the volume and span of real data behind the score:

| Level   | Condition                                          |
|---------|----------------------------------------------------|
| LOW     | < 3 records **or** < 30 days of history            |
| MEDIUM  | 3–19 records and 30–179 days of history            |
| HIGH    | ≥ 20 records **and** ≥ 180 days of history         |

No records → confidence LOW and risk_score `None`.

## 6. Risk Trend

Trend is computed by comparing rule-based risk over two recent 90-day windows.
A change of ≥ 4 points (risk decreasing) is IMPROVING, ≤ −4 points is
WORSENING; otherwise STABLE. When either window has no data the trend is
INSUFFICIENT_DATA.

## 7. Prediction Methods

| Method      | Behaviour                                              |
|-------------|--------------------------------------------------------|
| RULE_BASED  | No trained model; pure rule-based calculation           |
| ML_BASED    | RandomForest trained on 28 features, month-T → T+1     |
| HYBRID      | Weighted blend: 70 % rule-based + 30 % ML              |

When no trained model is available, all predictions are RULE_BASED regardless
of any stored model artifact.

## 8. Rule-Based Engine

`build_rule_based_risk()` computes individual component risks, combines them
with dynamic weight renormalization, classifies the level, resolves
confidence, and derives explainable factors.

## 9. Component Weights

| Component   | Weight |
|-------------|--------|
| Delivery    | 0.30   |
| Incident    | 0.25   |
| Performance | 0.20   |
| Quality     | 0.15   |
| Workload    | 0.10   |

Missing components are excluded and remaining weights re-normalized to 1.0.

## 10. Dynamic Weight Renormalization

When only a subset of components has data, available component weights are
summed and each risk is multiplied by `(weight / weight_sum)`. This prevents
a vendor with one component from being rated at the component's weight fraction
of maximum risk.

Example: delivery only (weight 0.30) → combined = delivery_risk × 0.30 / 0.30.

## 11. Delivery Component

Score = on-time delivery rate (Phase 7). Risk = 100 − score. Available when
the vendor has at least one completed delivery with a delivery status.

## 12. Quality Component

Score = average quality evaluation score. Risk = 100 − score. Available when
the vendor has at least one quality evaluation record.

## 13. Incident Component

Score = incident score from Phase 7 (0–100, 100 = no incidents). Risk =
100 − score. Available when the vendor has any PO, quality evaluation, or
incident record (`has_records` gate).

## 14. Performance Component

Score = Phase 7 overall performance (delivery 40% / quality 35% / incident
25% with renormalization). Risk = 100 − score. Available when at least one
of delivery, quality, or incident has data.

## 15. Workload Component

`load = outstanding + recent_30d` where outstanding = active POs (ISSUED,
IN_PROGRESS, PARTIALLY_DELIVERED) with `order_date ≤ today`, and recent =
all POs with `order_date` in the last 30 days.

`risk = (load / WORKLOAD_SATURATION) × 100`, clamped to 0–100.
`WORKLOAD_SATURATION = 15`. Available when any PO record exists.

## 16. Record Gating

When no component has data (no POs, no evaluations, no incidents), the risk
score is `None`, risk level is `None`, and confidence is `LOW`. The vendor
appears in the list as "No data" rather than receiving a fabricated score.

## 17. Data Confidence

Confidence is resolved deterministically from `total_records` (sum of
delivery total_orders, quality total_evaluations, incident total_incidents)
and `history_days` (days from the earliest record or `vendor_since` to today).

## 18. Feature Engineering

28 numeric features are derived from real vendor records for ML training and
prediction. Features span delivery performance, quality performance, incident
performance, workload, and data-quality indicators. All features are derived
directly from real data — no synthetic or fabricated values.

## 19. Feature Columns

The 28 features are defined in `services/ml/feature_builder.py` as
`FEATURE_COLUMNS` and include: `delivery_score`, `on_time_rate`,
`total_orders`, `delayed_count`, `avg_delay_days`, `quality_score`,
`total_evaluations`, `defect_rate`, `avg_quality_score`, `incident_score`,
`total_incidents`, `open_incidents`, `critical_incidents`, `high_incidents`,
`unresolved_incidents`, `overdue_incidents`, `incident_rate_30d`,
`performance_score`, `workload`, `workload_ratio`, `data_age_days`,
`total_records`, `evaluation_ratio`, `incident_severity_avg`,
`quality_trend_flag`, `delivery_trend_flag`, `vendor_age_days`, `activity`.

## 20. Training Data Pipeline

`build_training_dataset()` generates vendor-month rows from real records.
Each row uses 28 features from month T and a binary target
`is_high_risk` derived from month T+1's delivery/quality/incident state.
A vendor-month qualifies only if month T has ≥ 2 records.

## 21. Time-Based Training

Training data uses a rolling lookback of 4 months. Labels are derived from
the subsequent month (no label leakage). Vendor IDs are not used as features;
all features are operational metrics.

## 22. Chronological Split

The dataset is split chronologically (not randomly): the last 20% of
vendor-month rows by timestamp become the test set. This prevents future
information from leaking into training.

## 23. Random Forest Model

`sklearn.ensemble.RandomForestClassifier(n_estimators=100, random_state=42)`
trained with the 28-feature matrix. Artifacts are saved as
`model_artifacts/vendor_risk_model.joblib` and `_metadata.json`.

## 24. ML Prediction

When a trained model is loaded, `predict_ml()` returns a binary prediction
(0 = low/medium risk, 1 = high risk) and a probability. The probability is
mapped onto a 0–100 risk score: `score = probability × 100`.

## 25. Hybrid Prediction

`prediction_method = "HYBRID"` blends rule-based and ML scores:
`score = HYBRID_RULE_WEIGHT × rule + HYBRID_ML_WEIGHT × ml` where
`HYBRID_RULE_WEIGHT = 0.70` and `HYBRID_ML_WEIGHT = 0.30`.

## 26. Explainable Risk Factors

Components with risk ≥ 40.0 produce a `RiskFactor` (name, impact label,
description) sorted descending by risk. Impact labels: CRITICAL (≥ 80),
HIGH (≥ 60), MEDIUM (≥ 40), LOW (< 40).

## 27. Positive Factors

Components with risk ≤ 20.0 produce a `PositiveFactor` (name, description)
to highlight strengths.

## 28. API Endpoints

| Method | Path                                | Access | Description                         |
|--------|-------------------------------------|--------|-------------------------------------|
| GET    | `/api/v1/vendor-risk`              | Any    | Paginated risk list                 |
| GET    | `/api/v1/vendor-risk/statistics`   | Any    | Risk statistics summary             |
| POST   | `/api/v1/vendor-risk/train`        | Admin  | Train/retrain the ML model          |
| GET    | `/api/v1/vendor-risk/model-info`   | Any    | Model training status               |
| GET    | `/api/v1/vendors/{id}/predictive-risk` | Any | Single-vendor risk detail           |

## 29. Frontend Integration

- **Risk Center** (`/vendor-risk`): stat cards, risk distribution bar, ML
  model status with Admin Train Model button, sortable risk table with risk
  score indicator, level badges, method labels, and confidence indicators.
- **Vendor Detail** (`/vendors/:id`): new "Predictive Risk" section with
  score, level badge, trend, confidence, risk factors, positive factors,
  and a deep link to Risk Center.

## 30. Risk Factor Detail

Each factor includes:
- `name`: Component name (Delivery, Quality, Incident, Performance, Workload)
- `impact`: Severity label (CRITICAL, HIGH, MEDIUM, LOW)
- `description`: Human-readable explanation including the component risk and
  a one-line summary

## 31. Limitations

- The ML model requires ≥ 50 vendor-month training samples and ≥ 5 records
  per class; early deployments will use rule-based predictions until enough
  data accumulates.
- Rule-based predictions are deterministic but cannot capture complex
  interactions that a trained model might learn.
- Risk scores do not account for external market factors, vendor financial
  health, or supply-chain disruptions.
- The 90-day trend window requires at least two complete windows of data;
  new vendors show INSUFFICIENT_DATA until the second window is available.
- ML artifacts are not versioned with the database; retraining overwrites
  the previous model.

## 32. Future Enhancements

- Feature expansion: contract tenure, geographic risk, payment history.
- Anomaly detection (Phase 10 scope — not implemented in Phase 9).
- Automated risk response workflows.
- Risk score history and audit trail.
- Multi-class classification beyond binary high-risk detection.
- External data integration (financial ratings, market indices).
