# Vendor Performance Engine (Phase 7)

## 1. Purpose

The Vendor Performance Engine produces a single, explainable **Vendor
Performance Score** (0–100) for every vendor, computed in real time from the
delivery, quality, and incident records already stored in the database. It is
rule-based and deterministic — the same data always produces the same score
and the same explanation. No predictive, ML, or statistical components are
involved.

## 2. Design goals

- **Real data only** — every score is derived from actual purchase order
  deliveries, quality evaluations, and operational incidents.
- **Never estimated** — absent delivery or quality data means "no data for
  this component", not a fabricated or extrapolated value.
- **Fair to partial data** — component weights are renormalized when a
  component has no data so a new or sparsely tracked vendor is not penalized.
- **Transparent** — every change in score is attributable to recorded facts.
- **Read-only** — the engine never writes to the database and never triggers
  automated decisions or notifications.

## 3. Data sources

| Component | Source table  | Contribution |
| --------- | ------------- | ------------ |
| Delivery  | `purchase_orders` | Actual vs. expected delivery dates |
| Quality   | `quality_evaluations` | `quality_score` per evaluation |
| Incidents | `incidents`        | Severity, status, impact, due dates |

All sources live in the existing schema; Phase 7 adds **no tables and no
migration** (alembic head remains `d4a7d31923b9`).

## 4. Component weights

| Component | Weight |
| --------- | ------ |
| Delivery  | 0.40 |
| Quality   | 0.35 |
| Incident  | 0.25 |

Weights apply only to components with available data; the sum of the available
weights becomes the denominator (renormalization). Example — quality missing:
`(Delivery×0.40 + Incident×0.25) ÷ (0.40 + 0.25)`.

## 5. Delivery score

- Completed deliveries = purchase orders with a recorded
  `actual_delivery_date` (any status). Orders without an actual date are
  counted in `total_orders` but contribute nothing to the score.
- On-time rate = on-time ÷ completed × 100, where on-time is determined by the
  existing `compute_delivery` business logic (actual ≤ expected).
- Delay penalty = total delay days (actual − expected, summed over delayed
  orders), **capped at 20 points**.
- Score = clamp(on-time rate − delay penalty, 0–100), rounded to 2 decimals.
- No completed deliveries → `score: null`, `data_available: false`.

Worked example — 10 completed deliveries, 8 on-time, 2 delayed by 3 and 5
days: on-time rate 80 − penalty min(8, 20) = **72.0**.

## 6. Quality score

- Average of all `quality_score` values (0–100) for the vendor.
- No evaluations → `score: null`, `data_available: false`.
- Example: 80, 90, 70 → **80.0**.

## 7. Incident score

Per-incident penalty:

```
penalty = SEVERITY_WEIGHT × (impact_score ÷ 10) × STATUS_FACTOR
```

| Severity | Weight | Status        | Factor |
| -------- | ------ | ------------- | ------ |
| Low      | 1      | Open          | 1.0    |
| Medium   | 3      | In Progress   | 1.0    |
| High     | 6      | Resolved      | 0.5    |
| Critical | 10     | Closed        | 0.25   |

- Overdue incidents (Open or In Progress and `due_date < today`) add 2 points
  each; the total overdue penalty is **capped at 10**.
- Score = clamp(100 − Σ penalties − overdue penalty, 0–100).
- **Zero incidents → 100 and data is considered available** (a clean record is
  a perfect record; the resulting low confidence is surfaced separately).

Worked examples:
- Closed High, impact 7: 6 × 0.7 × 0.25 = 1.05 → **98.95**.
- Open Critical, impact 10: 10 × 1.0 × 1.0 = 10 → **90.0**.
- Five open Criticals (impact 10) + overdue: 50 + min(10, 10) → **40.0**.

## 8. Overall score

```
overall = Σ (component_score × weight) ÷ Σ available_weights
```

Rounded to 2 decimals. If no component is available (defensive branch),
overall is `null` and the classification is `INSUFFICIENT_DATA`.

## 9. Data confidence

`confidence = available_components ÷ 3 × 100`. A vendor is **limited data**
when confidence < 66.67 (i.e. only one of three components is available:
33.33% — or none: 0%).

## 10. Classification bands

| Band | Range |
| ---- | ----- |
| EXCELLENT | ≥ 85 |
| GOOD | 70–84.99 |
| AVERAGE | 50–69.99 |
| POOR | 30–49.99 |
| CRITICAL | < 30 |
| INSUFFICIENT_DATA | overall is null (no available data) |

Note: because zero incidents always count as available data, in practice every
real vendor has at least an incident component; `INSUFFICIENT_DATA` remains a
defensive branch for the no-data case.

## 11. Insights (strengths, weaknesses, attention areas)

Generated deterministically from facts only:

- **Strengths**: Delivery ≥ 85, Quality ≥ 85, Incident score ≥ 85 — each with
  the supporting counts (e.g. "8 of 10 deliveries were on time").
- **Weaknesses**: component < 60, plus unresolved (open + in-progress)
  incidents, critical incidents, and overdue incidents with exact counts.
- **Attention areas**: components below their targets (Delivery 85, Quality
  80, Incident 80), missing components ("No quality evaluations are recorded
  yet…"), the limited-data confidence note, and the no-data note.

The engine never suggests actions such as terminating a vendor, renegotiating,
or predicting outcomes.

## 12. Scores are never stored

Scores are computed on demand from the real tables each time an endpoint is
called. There is no `performance_scores` table, no background recomputation,
and no historical score persistence.

## 13. Endpoints

All endpoints are read-only, require any authenticated user, and live at
`/api/v1/vendors` — registered **before** the vendors router so the
`performance` and `performance/statistics` paths are not shadowed by
`/api/v1/vendors/{vendor_id}`.

### GET /api/v1/vendors/performance

Query parameters:

| Parameter        | Values                                                      |
| ---------------- | ----------------------------------------------------------- |
| `page` / `page_size` | Pagination (default page 1, page_size 10)               |
| `search`         | Ilike on `company_name` and `vendor_code`                   |
| `classification` | One of the classification enum values                        |
| `sort_by`        | `vendor_name`, `overall_score`, `delivery_score`, `quality_score`, `incident_score`, `data_confidence` |
| `sort_order`     | `asc` / `desc` (default `desc`)                             |

Score columns sort with **nulls last** in both directions. Unsupported sort
fields return 422. Response items: `vendor_id`, `vendor_name`, `vendor_code`,
`overall_score`, `classification`, `limited_data`, `data_confidence`,
`delivery_score`, `quality_score`, `incident_score`, `available_components`,
`missing_components`.

### GET /api/v1/vendors/performance/statistics

Return: `total_vendors`, `excellent`, `good`, `average`, `poor`, `critical`,
`insufficient_data`, `requiring_attention` (poor + critical), `limited_data`.

### GET /api/v1/vendors/{vendor_id}/performance

Detail form with component sub-objects and insights:

- `delivery`: score, total/completed/on-time/delayed counts, `data_available`
- `quality`: score, total evaluations, average, `data_available`
- `incidents`: score, total, open/in-progress/resolved/closed,
  critical/high/medium/low, overdue, `data_available`
- `strengths`, `weaknesses`, `attention_areas`
- 404 `"Vendor not found."` for unknown vendors.

## 14. RBAC

Read access for every authenticated role (Admin, Vendor Manager, Procurement
Manager, Project Manager, Analyst). No mutation endpoints exist.

## 15. Security & integrity checks

- Scores are derived only from records already validated by the CRUD layers
  (delivery dates, score consistency, incident rules).
- Clamping at 0–100 for every component and the overall score.
- Sorting uses an explicit allowlist of sortable columns (injection-safe).

## 16. Frontend

Page **Vendor Performance** at `/vendor-performance`, subtitle *"Analyze vendor
performance using delivery, quality, and operational incident data."*:

- Stat cards: Total Vendors, Excellent Vendors, Vendors Requiring Attention,
  Limited Data Vendors.
- Filter bar: search (name or code) and classification dropdown.
- Sortable table: Vendor, Overall Score, Delivery, Quality, Incidents,
  Classification (badge), Data Confidence (+ "Limited data" tag), Actions.
- Default sort `overall_score desc`. Row click navigates to the vendor detail
  page.
- Empty state: *"No vendors available"* / *"Add vendors to begin tracking
  performance."*, plus error state with retry and pagination.
- Vendor detail page gains a **Performance Score** section: overall score,
  classification badge, confidence, component breakdown, and the
  strengths / weaknesses / attention-area lists, with a link back to the
  performance directory.

## 17. Tests

`test_phase7.py` (41 tests) covers: classification band boundaries (unit),
auth enforcement (401), unknown vendor (404), delivery scoring (on-time rate,
penalty cap, clamp, no-data), quality averaging, the incident penalty matrix
including status factors and overdue cap, never-negative / never-above-100
guards, overall scoring for all-three and renormalized (quality missing,
incident only) cases, the empty-vendor limited-data profile, insight text,
list search by name and code, classification filter (valid + rejected 422),
sorting by name / score / confidence (including invalid field 422),
pagination, list/detail agreement, statistics relationships, the fixed alembic
head, and the absence of a `performance_scores` table. Full regression:
**225 tests green** across all suites, `alembic check` reports no pending
operations.

## 18. Worked examples

**Example 1 — all three components.** 9 of 10 deliveries on time (score 90),
average quality 80, zero incidents (100):

```
overall = (90 × 0.40 + 80 × 0.35 + 100 × 0.25) / 1.00 = 36 + 28 + 25 = 89.0
→ EXCELLENT, confidence 100%, not limited
```

**Example 2 — missing quality (renormalized).** Delivery 72 (8 of 10 on
time, 8 delay days), incidents 100, no evaluations:

```
overall = (72 × 0.40 + 100 × 0.25) / 0.65 = 53.8 / 0.65 = 82.77
→ GOOD, confidence 66.67%, not limited
```

**Example 3 — incident-only.** No deliveries and no evaluations:

```
overall = 100 × (0.25 / 0.25) = 100.0
→ EXCELLENT, confidence 33.33%, limited data
```

## 19. Out of scope (explicitly not implemented)

- Performance analytics, dashboards, charts, trends, comparisons, rankings.
- Machine learning, predictive score, risk prediction, anomaly detection,
  recommendations, automated decisions, notifications, reports, audit logs.
- Persisted / historical score snapshots.