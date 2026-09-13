# Advanced Analytics & Decision Intelligence (Phase 8)

## 1. Purpose

Phase 8 adds the **Advanced Analytics** layer on top of the Phase 7 Vendor
Performance Engine. It turns raw delivery, quality, and incident records into
aggregate metrics, historical trends, distributions, rankings, category
breakdowns, and side-by-side vendor comparisons — all served by a new
`/api/v1/analytics` API and presented on a new `/analytics` frontend page with
Recharts visualizations.

Analytics are **descriptive, read-only decision support**. Everything is
computed on demand from the live source data; nothing is persisted, predicted,
or recommended.

## 2. Design goals

- **Real data only** — every metric derives from actual purchase orders,
  quality evaluations, and incidents.
- **Never fabricated** — periods without records produce `null` (`has_data:
  false`) and are omitted from averages; trends show gaps instead of invented
  values.
- **Consistent with the Phase 7 engine** — classification bands, component
  weights, and confidence logic are reused unchanged.
- **Scoped and filterable** — global date range, vendor, and category filters
  apply consistently.
- **Deterministic and explainable** — insights are rule-based; the same data
  always yields the same insights.

## 3. Endpoints

All endpoints live under `/api/v1/analytics` and require authentication. They
are **read-only** for every authenticated role.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/overview` | Executive summary + key insights |
| GET | `/performance-distribution` | Count/percentage of vendors per classification |
| GET | `/vendor-ranking` | Vendors ranked by current overall score |
| GET | `/delivery-overview` | Delivery KPIs (on-time rate, delay days) |
| GET | `/delivery-trend` | Delivery score + on-time rate over time |
| GET | `/quality-overview` | Quality KPIs (avg score, evaluations) |
| GET | `/quality-trend` | Average quality score over time |
| GET | `/incident-overview` | Incident KPIs (open, unresolved, overdue, severity) |
| GET | `/incident-trend` | Incident score over time |
| GET | `/incident-severity-distribution` | Incidents by severity |
| GET | `/category-performance` | Average component scores per category |
| GET | `/performance-trend` | Average overall performance score over time |
| GET | `/vendor-comparison` | Compare 2–5 vendors across all components |
| GET | `/delivery/quality/incident-overview` | Standalone analogs of the above KPIs |

### Query parameters

| Parameter | Type | Applies to | Notes |
| --------- | ---- | ---------- | ----- |
| `start_date`, `end_date` | ISO date | Overviews, trends, severity, change, comparison | Default: last 180 days; invalid range → 422 |
| `granularity` | `monthly` \| `daily` | Trends | Monthly default; daily rejected when the range exceeds 62 days (422) |
| `vendor_id` | int ≥ 1 | All | Single-vendor scoping; unknown vendor → 404 |
| `category_id` | int ≥ 1 | All | Category scoping; unknown category → 404 |
| `vendor_ids` | repeated int ≥ 1 | Comparison only | Requires 2–5 unique positive IDs; duplicates, <2, >5 → 422; unknown → 404 |

## 4. Scoping model

- **Current-state views** (distribution, ranking, category performance) have no
  date dimension — they always describe the live classification of vendors.
- **Date-scoped views** (trends, overviews, severity, performance change)
  compute component scores **within the window** using the same per-component
  rules as Phase 7 (`compute_delivery_score`, `compute_quality_score`,
  `compute_incident_score` with `start_date`/`end_date`).
- A single vendor and a category can be combined; the vendor/category 404
  checks run first.

## 5. Record-gating rule

A vendor (or a single period) is treated as **`INSUFFICIENT_DATA`** when it has
no operational records at all — no purchase orders, no quality evaluations, and
no incidents. This is an intentional, documented divergence from Phase 7's
"vacuously 100" incident-only rule:

- Distribution counts such vendors under **Insufficient data**.
- Ranking excludes them (`vendors_with_score` never counts a vendor as 0).
- Category and aggregate averages exclude them.
- A trend period with zero records produces `has_data: false`, `null` scores,
  and no contribution to the period average — history is never fabricated.
- The working average across categories therefore reflects only vendors that
  actually have operational data.

## 6. Performance change

`overview.performance_change` compares the **recent half** of the selected
range against the **earlier half** (per-vendor in-memory overall scores, then
an average of deltas). It is `null` — never `0` — when either half cannot be
derived (e.g. too short a range, or no records in a half). The
`performance_change_period_label` (e.g. "First 90 days vs last 90 days")
explains the comparison window.

## 7. Vendors requiring attention

A vendor counts as **requiring attention** when any of the following is true:

- Classification is `POOR` or `CRITICAL`
- At least 3 **unresolved** (Open + In Progress) incidents
- `limited_data` **and** at least 1 unresolved incident

## 8. Insights

`overview.insights` returns up to 7 rule-based insights with a `kind` of
`positive`, `watch`, `warning`, or `info`. They are deterministic explanations
of the aggregate numbers (top performer, attention drivers, overdue incidents,
data gaps, comparison scope), never model output or recommendations.

## 9. Frontend

The `/analytics` page (sidebar **Analytics**, now `ready`) provides:

- Global filters: date range, granularity (monthly/daily), category, vendor,
  plus Apply / Reset
- Executive stat cards (avg performance score, requiring attention,
  performance change with up/down indicator, open incidents)
- Insights panel with per-kind styling
- Performance distribution bar + top-vendor ranking (links to vendor detail)
- Delivery, quality, and incident trend charts with **summary counts** in each
  card header
- Incident severity donut chart
- Historical performance trend (average overall score over time)
- Category performance table (avg component scores + best vendor)
- Vendor comparison: multi-select (up to 5) with a grouped bar chart and a
  classification table

Every chart shows a dedicated empty state —
*"Not enough historical data to display a trend."* — when
`has_sufficient_data` is false, so sparse histories never render misleading
lines. The vendor detail page gains a **Trends & Analytics** section with
per-vendor delivery/quality/incident mini-trends and a deep link into the
analytics page scoped to that vendor (`/analytics?vendor_id=…`).

Charting uses **Recharts**; all visuals are static snapshots of the computed
data (no predictive or animated scoring).

## 10. Database

Phase 8 adds **no schema and no migration** — metrics are computed on demand
from `purchase_orders`, `quality_evaluations`, and `incidents`. Alembic head
remains `d4a7d31923b9`.

## 11. Not implemented (by design)

- Machine learning, predictive/probabilistic scoring, anomaly detection
- Recommendations and automated decisions
- Notifications, reports, and audit logs
- Persisted history tables (scores are always computed live)