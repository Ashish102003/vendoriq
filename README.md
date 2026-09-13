# VendorIQ

**AI-Powered Vendor Performance and Risk Management System**

VendorIQ helps organizations manage vendors, monitor performance, analyze
operational issues, identify risks, and make data-driven vendor management
decisions. The platform is being developed in phases; this repository currently
contains Phase 1 (foundation), Phase 2 (database foundation), Phase 3
(authentication & RBAC), Phase 4 (vendor management), Phase 5A (contract
management), Phase 5B (purchase orders & delivery tracking), Phase 6A
(quality evaluation management), Phase 6B (incident management),
Phase 7 (vendor performance engine), Phase 8 (advanced analytics & decision
intelligence), Phase 9 (ML predictive risk), Phase 10 (enterprise UI/UX
polish), and Phase 11 (final integration, QA & documentation).

See [`docs/project-overview.md`](docs/project-overview.md) for a full product
overview and [`docs/demo-guide.md`](docs/demo-guide.md) for a walkthrough.

---

## Phase 11 — Final Integration, Quality Assurance & Documentation

Phase 11 closes the project: full-stack verification, consistency fixes,
an optional demo dataset, and final documentation. No schema changes (alembic
head remains `d4a7d31923b9`).

- **Verification** — `alembic check` clean; automated backend smoke suite
  (47 API checks: auth, RBAC 403s, every module's list/statistics endpoints,
  analytics); end-to-end RBAC + demo-data flow (33 checks across all 5 roles);
  frontend gates `npx tsc -b` + `npm run lint` (oxlint, 0 warnings) +
  `npm run build` all clean
- **Performance consistency fix** — the performance engine, statistics, and
  analytics previously disagreed about vendors with **no operational
  records** (list/detail/statistics reported a vacuous `EXCELLENT 100` from the
  renormalized incident component while analytics showed `INSUFFICIENT_DATA`).
  Unfixed, a "3 Excellent" stat card contradicted a "1 Excellent" chart. The
  rule is now uniform everywhere a zero-record vendor exists: **no records ⇒
  `INSUFFICIENT_DATA`, no overall score** (matching the analytics anti-
  fabrication policy and the risk engine's existing record gating)
- **Error handling** — centralized `resolveErrorMessage` in
  `frontend/src/services/api/client.ts`: FastAPI 422 validation arrays are
  flattened to readable messages and unexpected 401/404/500 responses get
  friendly fallbacks (users never see raw JSON / `[object Object]`)
- **Demo dataset** — opt-in, idempotent `python -m app.scripts.seed_demo_data`
  (refuses to run in production) creates 6 demo vendors spanning the full
  performance/risk spread (EXCELLENT ⭢ CRITICAL), ~50 purchase orders,
  contracts, quality evaluations, incidents, and 4 demo users; `--clean`
  removes everything
- **Frontend hygiene** — removed the dead `useApi` hook and the inert topbar
  notification bell; replaced the stale build-phase footer text on the landing
  page with real product messaging
- **Docs** — added `docs/project-overview.md` and `docs/demo-guide.md`;
  README now covers setup, environment variables, the demo seed, future
  improvements, and the full API surface

---

## Phase 10 — Enterprise UI/UX Polish

Phase 10 is a **frontend-only** polish pass that turns the application shell
into a consistent enterprise experience without any backend or schema changes
(alembic head remains `d4a7d31923b9`):

- **Dashboard rebuild** — the developer placeholder is replaced by a real,
  data-driven **Vendor Intelligence Overview**: 8 KPI cards (vendors,
  contracts, performance, attention, incidents, delivery, risk) that deep-link
  into their modules, Vendor Health + Predictive Risk distribution bars, the
  analytics insights panel, top-5 vendor ranking, delivery/quality snapshot,
  and quick-access tiles. Includes a skeleton loader and error-retry state.
- **Design system** — reusable components in `frontend/src/components/common/`
  (`Card`, `StatCard`, `PageLoader`, `TableSkeleton`, `ConfirmDialog`,
  `Breadcrumbs`) plus Tailwind v4 brand tokens and `.iq-*` component classes in
  `index.css`
- **Layout** — navigation restructured into 5 capability groups (Overview /
  Vendor Management / Procurement / Performance Data / System) with "Soon"
  flags on planned items; topbar loses the fake search and gains
  route-aware breadcrumbs + a smart user menu; content centered in a
  `max-w-7xl` container
- **Decision intelligence** — the vendor directory gains Performance and Risk
  columns; the vendor profile gains an at-a-glance intelligence strip
  (performance, predictive risk, contracts & orders, and a rule-derived
  decision verdict); Risk Center stat cards and high-risk row emphasis are
  upgraded
- **Consistency pass** — every list page uses the shared `TableSkeleton`
  loader and unified `.iq-*` table styling; the analytics KPI grid gained a
  "How to read this" guidance line
- Quality gates: `npx tsc -b`, `npm run lint` (oxlint), `npm run build` all
  clean

See [`docs/ui-ux-phase10.md`](docs/ui-ux-phase10.md) for the full design.

---

## Phase 9 — Predictive Risk Intelligence & Machine Learning

Phase 9 adds a probabilistic risk layer on top of the Phase 7 performance
engine:

- **Predictive risk score** (0–100, higher = riskier) from five weighted
  components: **Delivery 30% / Incident 25% / Performance 20% / Quality 15% /
  Workload 10%**, with dynamic weight renormalization
- Deterministic risk levels: **VERY_LOW < 20, LOW < 40, MEDIUM < 60, HIGH < 80,
  CRITICAL ≤ 100**
- Data confidence **LOW / MEDIUM / HIGH** resolved from real record count and
  history span (LOW: < 3 records or < 30 days; HIGH: ≥ 20 records and ≥ 180
  days)
- Risk trend **IMPROVING / WORSENING / STABLE** from two 90-day rule-based
  windows with a ±4-point threshold
- Explainable **risk factors** (risk ≥ 40) and **positive factors** (risk ≤ 20)
  per vendor with impact labels and human-readable descriptions
- Workload component from outstanding + recent-30-day orders (linear scale,
  saturation at 15 orders)
- **Record gating** — vendors with no operational records have `risk_score:
  null` (never a fabricated zero) and LOW confidence
- **ML infrastructure** — deterministic 28-feature vendor-month matrix,
  time-based training split (no label leakage), RandomForestClassifier(100
  trees), artifacts in `model_artifacts/vendor_risk_model.joblib`
- **Hybrid prediction** — 70% rule-based + 30% ML probability when a model is
  trained; falls back to 100% rule-based otherwise (never a hard dependency)
- Endpoints: `/api/v1/vendor-risk` list (search/category/level/sort),
  `/api/v1/vendor-risk/statistics`, `/api/v1/vendor-risk/train` (Admin),
  `/api/v1/vendor-risk/model-info`, `GET /api/v1/vendors/{id}/predictive-risk`
- Frontend: Risk Center (`/vendor-risk`) with stat cards, risk distribution
  bar, ML model status + Admin-only Train button, sortable risk table; vendor
  detail page Predictive Risk section with factors/positives and a deep link

See [`docs/ml-predictive-risk.md`](docs/ml-predictive-risk.md) for the full
design.

---

## Phase 8 — Advanced Analytics & Decision Intelligence

Phase 8 builds a descriptive analytics layer on top of the Phase 7 Vendor
Performance Engine, served by a new `/api/v1/analytics` API and presented on a
new `/analytics` frontend page with Recharts visualizations:

- **Overview** — executive summary: average performance score, vendors scored,
  performance change (recent half vs earlier half; `null` when underivable,
  never 0), vendors requiring attention, distribution snapshot, and up to 7
  rule-based insights (`positive` / `watch` / `warning` / `info`)
- **Distribution & ranking** — vendors per classification band with a stacked
  distribution bar, plus a vendor ranking by overall score (never ranked as 0)
- **Operational KPIs + trends** — delivery (on-time rate, delay days), quality
  (average score), and incident (open / unresolved / overdue / severity) key
  figures, each with monthly or daily trend charts
- **Incident severity distribution** — counts and percentages per severity
- **Category performance** — average component scores and best vendor per
  category
- **Historical performance trend** — average overall score across periods
- **Vendor comparison** — side-by-side scores and KPIs for 2–5 vendors with a
  grouped bar chart
- **Filters** — global date range (default last 180 days), granularity
  (monthly / daily, daily capped at 62 days), vendor, and category scope
- **Record-gating rule** — vendors/periods with zero operational records are
  `INSUFFICIENT_DATA`, excluded from ranking and averages; trend periods with
  no records show `has_data: false` — history is never fabricated
- **Attention rule** — POOR/CRITICAL, ≥3 unresolved incidents, or
  limited-data with ≥1 unresolved incident
- Read access for every authenticated role; informational only — nothing is
  ever written
- No schema changes (metrics computed live; alembic head remains
  `d4a7d31923b9`)
- Frontend: `/analytics` page with the filter bar, stat cards, insights panel,
  distribution + ranking, delivery/quality/incident trends, severity donut,
  historical performance trend, category table, and vendor comparison;
  dedicated empty-chart states when data is insufficient; vendor detail page
  **Trends & Analytics** section with per-vendor mini-trends linking into the
  scoped analytics view (`/analytics?vendor_id=…`)

See [`docs/advanced-analytics.md`](docs/advanced-analytics.md) for the full
design.

---

## Phase 7 — Vendor Performance Engine

Phase 7 delivers a rule-based, explainable **Vendor Performance Score**
computed in real time from the delivery, quality, and incident data already
recorded in the database:

- Weighted score model: **Delivery 40% / Quality 35% / Incidents 25%**;
  missing components are excluded and the remaining weights are renormalized
  so a partially-scored vendor is never unfairly penalized
- **Delivery score**: on-time rate of completed orders minus a delay penalty
  (total delay days capped at 20 points); no completed deliveries means no
  delivery data (never estimated)
- **Quality score**: average evaluation score across recorded quality
  evaluations (0–100)
- **Incident score**: 100 minus penalties per incident = severity weight
  (Low 1 / Medium 3 / High 6 / Critical 10) × impact factor (impact score
  ÷ 10) × status factor (Open/In-Progress 1.0, Resolved 0.5, Closed 0.25),
plus overdue incidents (+2 each, total overdue penalty capped at 10);
   zero incidents always scores 100 when the vendor has other recorded
   operations; a vendor with **no operational records at all** is
   `INSUFFICIENT_DATA` with no score (never a fabricated 100)
- Deterministic classification bands: EXCELLENT ≥85, GOOD ≥70, AVERAGE ≥50,
  POOR ≥30, CRITICAL <30, INSUFFICIENT_DATA (no available data)
- **Data confidence** = available components ÷ 3; vendors with fewer than
  66.67% confidence are flagged as **limited data**
- Explainable, fact-based insights: strengths (component ≥85), weaknesses
  (component <60 plus unresolved / critical / overdue incident facts), and
  attention areas (components below target — Delivery 85 / Quality 80 /
  Incident 80 — plus missing-data and confidence notes). No predictions, no
  recommendations, no rankings
- Endpoints: vendor performance list with search / classification filter /
  safe sorting (scores sort with nulls last), performance statistics for the
  dashboard cards, and per-vendor performance detail
- Read access for every authenticated role; informational only — nothing is
  ever written
- No schema changes (scores are computed on demand — no `performance_scores`
  table and no new migration; alembic head remains `d4a7d31923b9`)
- Frontend: `/vendor-performance` directory with stat cards (Total Vendors,
  Excellent, Requiring Attention, Limited Data), search + classification
  filters, sortable score table with classification badges and data-confidence
  indicators, pagination, and empty/error states; vendor detail page
  **Performance Score** section with the overall score, classification,
  component breakdown, and strengths/weaknesses/attention areas

Worked examples: Delivery 90/Quality 80/Incidents 100 → **89.0 Excellent**;
Delivery 72 + Incidents 100 (no quality data) → **(72×0.40 + 100×0.25) ÷ 0.65 =
82.77 Good**; incident-only data → score 100 with 33.33% confidence (limited).

**Not implemented yet (by design):**

- Machine learning, predictive scoring, risk prediction, anomaly detection,
  recommendations, automated decisions, notifications, reports, and audit logs
  (performance analytics, dashboards, trends, and comparisons are implemented
  in Phase 8)
- Persisted historical scores or score history (scores are computed live from
  the source data)

See
[`docs/vendor-performance-engine.md`](docs/vendor-performance-engine.md) for
the full design.

---

## Phase 6B — Incident Management

Phase 6B delivers a complete incident management module backed by the new
`incidents` table:

- Incident APIs: paginated list with search / filters (vendor, contract,
  purchase order, type, severity, status, date range) / sorting, detail,
  create, update, and real database statistics
- Automatic reference numbers (`INC-000001`, …) generated transactionally
  with deduplication retries — never client-supplied
- Incident lifecycle statuses: Open → In Progress → Resolved → Closed with an
  explicit transition model (Open may move to In Progress or Resolved,
  In Progress to Resolved, Resolved to Closed) and a hard rule that Closed
  incidents are immutable (409)
- New incidents are always created as Open; `resolved_date` is set
  automatically the day a status becomes Resolved or Closed, and resolution
  notes are required for Resolved/Closed statuses (422)
- Optional contract and purchase order links with relationship integrity:
  the contract and purchase order must belong to the selected vendor, and a
  linked purchase order's contract must match the selected contract
- Impact scoring (1–10), severity (Low / Medium / High / Critical), due dates,
  and overdue detection (open/in progress past due) used across the module
- Automatic assignment validation against real users (`assigned_to` must be an
  active user), `reported_by` always the authenticated user
- Statistics endpoint with per-status and per-severity counts, overdue count,
  and average impact score
- Vendor **Incident Summary** (`/api/v1/vendors/{id}/incident-summary`) — real
  per-status / per-severity tallies and average impact per vendor
- Role-based access: Admin, Vendor Manager, Procurement Manager, and Project
  Manager can create and edit incidents; Analyst is read-only
- Records are never deleted
- Alembic migration `d4a7d31923b9` (create incidents table) with DB-level check
  constraints, foreign keys, and indexes
- Frontend: incidents directory with a stats strip (Total, Open, In Progress,
  Critical, Overdue), search + vendor/severity/status/date filters, sortable
  table with severity/status badges and pagination; add/edit form with Incident
  Context / Incident Details / Assignment / Incident Status sections and a
  vendor-scoped contract + purchase order cascade; detail page with an
  Update Status modal (transition-aware) and overdue banner; vendor detail
  page Incident Summary with quick links

**Not implemented yet (by design):**

- Complaints and Reviews — future phases
- Performance scoring, ranking, analytics/dashboards/charts, ML, risk
  prediction, anomaly detection, recommendations, notifications, reports,
  and audit logs (performance scoring is implemented in Phase 7; the rest
  remain future phases)
- Incident resolution SLA automation and response-time tracking
- Deleting incidents (records are never deleted)

See [`docs/incident-management.md`](docs/incident-management.md) for the full
design.

---

## Phase 6A — Quality Evaluation Management

Phase 6A delivers a complete quality evaluation module backed by the new
`quality_evaluations` table:

- Quality evaluation APIs: paginated list with search / filters / sorting,
  detail, create, update, and real database statistics
- Explicit quality status selection with score-consistency enforcement:
  `EXCELLENT` 90–100, `GOOD` 75–89, `ACCEPTABLE` 60–74, `POOR` 40–59,
  `CRITICAL` 0–39 (a status that does not match the score is rejected)
- Optional contract and purchase order links, with relationship integrity
  enforced: the contract and purchase order must belong to the selected vendor,
  and a linked purchase order's contract must match the selected contract
- Defect tracking: non-negative integers, and `defect_count` must not exceed
  `total_items` when items are counted
- `created_by` is always the authenticated user — never client-supplied
- Statistics endpoint with per-status counts, average quality score, and total
  defects
- Vendor **Quality Summary** (`/api/v1/vendors/{id}/quality-summary`) — real
  evaluation counts, average score, per-status tallies, and total defects per
  vendor
- Role-based access: Admin, Vendor Manager, Procurement Manager, and Project
  Manager can create and edit evaluations; Analyst is read-only
- Records are never deleted
- Alembic migration `160ca8129b1f` (create quality evaluations table) with
  DB-level check constraints
- Frontend: quality evaluations directory with stats strip (Total Evaluations,
  Average Quality Score, Excellent, Poor + Critical, Total Defects),
  search/filter bar, sortable table with quality status badges and pagination;
  add/edit form with Evaluation Context / Quality Assessment / Observations
  sections and a vendor-scoped contract + purchase order cascade; detail page;
  vendor detail page Quality Summary with quick links

**Not implemented yet (by design):**

- Complaints and Reviews — future phases
- Performance scoring, ranking, analytics/dashboards/charts, ML, risk
  prediction, anomaly detection, recommendations, notifications, reports,
  and audit logs (incidents are implemented in Phase 6B)
- Deleting quality evaluations (records are never deleted)

See [`docs/quality-evaluation-management.md`](docs/quality-evaluation-management.md)
for the full design.

---

## Phase 5B — Purchase Orders & Delivery Tracking

Phase 5B delivers a complete purchase order and delivery tracking module backed
by the new `purchase_orders` table:

- Purchase order APIs: paginated list with search / filters / sorting, detail,
  create, update, dedicated status changes, delivery recording, and real
  database statistics
- Computed delivery tracking: `delivery_status` (`PENDING` / `ON_TIME` /
  `DELAYED`) and `delay_days` are derived live from `actual_delivery_date` vs
  `expected_delivery_date` — never stored, so corrections recompute instantly
- Purchase order lifecycle statuses: Draft, Issued, In Progress, Delivered,
  Partially Delivered, Cancelled, Closed (no automatic transitions)
- Optional contract link per order with vendor/contract consistency enforced
- Validation: non-negative `order_value`, `expected_delivery_date` and
  `actual_delivery_date` on/after `order_date`, unique order numbers (409),
  valid vendor/contract enforcement (404)
- Vendor **Operations Summary** (`/api/v1/vendors/{id}/operations-summary`) —
  real contract/order counts, active/delivered/delayed tallies, and total order
  value per vendor
- Role-based access: Admin, Vendor Manager, and Procurement Manager can create,
  edit, change status, and record deliveries; Project Manager and Analyst are
  read-only
- Records are never deleted
- Alembic migration `c5fd64a31ba7` (create purchase orders table) with DB-level
  check constraints
- Frontend: purchase orders directory with stats strip, search/filter bar,
  sortable table, delivery/status badges and pagination; add/edit form with
  vendor + contract cascade; detail page with Record Delivery and Change Status
  modals; vendor detail page Operations Summary with quick links

**Not implemented yet (by design):**

- Incidents, Complaints, and Reviews — future phases
- Vendor performance scoring, ranking, analytics/dashboards/charts, ML, risk
  prediction, anomaly detection, recommendations, notifications, reports,
  and audit logs
- Automated delivery workflows (e.g., auto-`DELIVERED` when a delivery is
  recorded) and bulk delivery recording
- Deleting purchase orders (records are never deleted)

See [`docs/purchase-order-management.md`](docs/purchase-order-management.md) for
the full design.

---

## Phase 5A — Contract Management

Phase 5A delivers a complete contract management module backed by the new
`contracts` table:

- Contract APIs: paginated list with search / filters / sorting, detail,
  create, update, dedicated status changes, and real database statistics
- Contract statistics: counts per lifecycle status plus total contract value
- Nested vendor summary (`id`, `vendor_code`, `company_name`) on every payload
- Contract lifecycle statuses: Draft, Active, Completed, On Hold, Cancelled,
  Expired (no automatic status transitions)
- Validation: non-negative `contract_value`, `end_date >= start_date` enforced
  on create and on the full resulting range after partial updates, unique
  contract numbers (409), valid vendor enforcement (404)
- Role-based access: Admin, Vendor Manager, and Procurement Manager can create,
  edit, and change status; Project Manager and Analyst are read-only
- Records are never deleted; contracts are deactivated via `is_active`
- Alembic migration `2094b0b9e149` (create contracts table) with DB-level check
  constraints
- Frontend: contracts directory with a compact stats strip, search/filter bar,
  sortable table and pagination; add/edit form with vendor dropdown and contract
  period sections; contract detail page with status-change modal

**Not implemented yet (by design):**

- Incidents, Complaints, and Reviews — future phases
- Vendor performance scoring, ranking, analytics/dashboards/charts, ML, risk
  prediction, anomaly detection, recommendations, notifications, reports,
  and audit logs
- Automatic status changes (e.g., auto-EXPIRED when `end_date` passes)
- Deleting contracts (records are deactivated via `is_active`)
- Contract documents/attachments, renewals, and auto-numbering

See [`docs/contract-management.md`](docs/contract-management.md) for the full
design.

---

## Phase 4 — Vendor Management

Phase 4 delivers a complete vendor management module backed by the existing
`vendors` and `vendor_categories` tables:

- Vendor APIs: paginated list with search / filters / sorting, detail, create,
  update, and dedicated status changes
- Vendor statistics (counts per lifecycle status)
- Vendor category APIs with real vendor counts; categories are soft-deactivated,
  never deleted
- Role-based access enforced on the backend for every operation
- Frontend: vendor directory, add/edit forms, vendor detail page, category
  management, status change modal, and a toast notification system
- `vendor_code` normalization (strip + uppercase), unique-code enforcement
  (409), nested category payloads, and strict website URL validation

**Not implemented yet (by design):**

- Incidents, Complaints, and Reviews — future phases
- Vendor performance scoring and transaction-based analytics
- Risk prediction, anomaly detection, ML, reports, notifications, audit logs
- Deleting vendors or categories (records are deactivated via `is_active`)

See [`docs/vendor-management.md`](docs/vendor-management.md) for the full design.

---

## Phase 3 — Authentication & RBAC

Phase 3 adds secure authentication and role-based access control:

- Password hashing with **bcrypt** (Python 3.14 compatible)
- JWT access tokens (`HS256`) for stateless sessions
- Auth endpoints: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`,
  `GET /api/v1/auth/protected-test`, `GET /api/v1/auth/admin-test`
- Reusable `get_current_user` and `require_roles(...)` dependencies
- Idempotent role seeding (`python -m app.scripts.seed_roles`) and initial
  admin creation (`python -m app.scripts.create_initial_admin`)
- Frontend: login page, `AuthContext`, protected routes, token storage
  (`vendoriq_access_token`), user menu with name/role/logout
- Swagger Bearer authorization for testing protected endpoints

**Not implemented yet (by design):**

- Public registration, password reset, refresh tokens
- User management UI
- Vendor performance scoring and analytics (future phases)
- Incidents, Complaints, Reviews, and other operational modules (future phases)

See [`docs/authentication.md`](docs/authentication.md) for the full design.

---

## Phase 2 — Database Foundation

Phase 2 implements the core relational database foundation:

- MySQL database integration
- SQLAlchemy ORM models
- Alembic database migrations
- Core entities: Roles, Users, Vendor Categories, Vendors
- Database relationships, constraints, and indexes
- Pydantic schemas prepared for future API development
- Manual seed utility for essential system roles

**Not implemented yet:**

- Authentication, login, JWT (planned in Phase 3)
- Vendor CRUD APIs (implemented in Phase 4)
- Incidents, Complaints, and other operational modules (future phases)

See [`docs/database.md`](docs/database.md) for the full database design.

---

## Features

### Currently Implemented

- Project foundation and monorepo structure
- Frontend application shell (sidebar, top navigation, responsive layout)
- FastAPI backend
- API versioning (`/api/v1`)
- MySQL database infrastructure (SQLAlchemy + PyMySQL)
- Frontend routing (`/`, `/login`, `/dashboard`, `/vendors`, `/vendors/new`,
  `/vendors/:vendorId`, `/vendors/:vendorId/edit`, `/vendor-categories`,
  `/contracts`, `/contracts/new`, `/contracts/:contractId`,
  `/contracts/:contractId/edit`, `/purchase-orders`, `/purchase-orders/new`,
  `/purchase-orders/:purchaseOrderId`, `/purchase-orders/:purchaseOrderId/edit`,
  `/quality-evaluations`, `/quality-evaluations/new`,
  `/quality-evaluations/:evaluationId`,
  `/quality-evaluations/:evaluationId/edit`,
  `/incidents`, `/incidents/new`, `/incidents/:incidentId`,
`/incidents/:incidentId/edit`,
   `/vendor-performance`, `/vendor-risk`, `/analytics`,
   `/not-found`, `/coming-soon/:module`)
- Reusable Coming Soon page for future modules
- Database models: Roles, Users, Vendor Categories, Vendors, Contracts,
  Purchase Orders, Quality Evaluations, Incidents
- Alembic database migrations
- Pydantic schemas for core entities
- Role seeding utility (`app.scripts.seed_roles`)
- Initial admin account creation (`app.scripts.create_initial_admin`)
- Secure authentication: bcrypt hashing + JWT (`login`, `me`, protected endpoints)
- Role-based access control (`get_current_user`, `require_roles`) with a 403
  "You do not have permission to perform this action" response
- Frontend auth: login page, `AuthContext`, protected routes, token storage
  (`vendoriq_access_token`), user menu with name/role/logout
- Full vendor management API (`/api/v1/vendors`, `/api/v1/vendor-categories`)
  with pagination, search, filters, sorting, statistics, and RBAC
- Vendor directory UI: stats strip, search/filter bar, sortable table,
  pagination, empty/error states with retry
- Vendor create/edit forms with client-side validation and a toast system
- Vendor detail page with overview, contact, address, system information, and a
  performance placeholder for future analytics
- Vendor category management with real vendor counts and soft deactivation
- Status change workflow (modal) restricted to Admin and Vendor Manager roles
- Full contract management API (`/api/v1/contracts`) with pagination, search,
  filters (vendor/status/is_active), sorting, statistics, and RBAC
- Contract directory UI: compact stats strip (Total, Active, Completed, On Hold,
  total contract value), search/filter bar, sortable table, pagination,
  empty/error states with retry
- Contract create/edit form with vendor dropdown, contract information and
  contract period sections, and client-side date/value validation
- Contract detail page with overview, description, vendor card, system
  information, and a status-change modal
- Full purchase order API (`/api/v1/purchase-orders`) with pagination, search,
  filters (vendor/contract/status), sorting, statistics, RBAC, and delivery
  recording
- Computed delivery tracking (`PENDING` / `ON_TIME` / `DELAYED` + `delay_days`)
  derived from recorded vs expected delivery dates
- Purchase order directory UI: stats strip, search/filter bar, sortable table
  with status and delivery badges, pagination, empty/error states with retry
- Purchase order create/edit form with vendor dropdown and a vendor-scoped
  contract cascade, order information + order timeline sections, and
  client-side date/value validation
- Purchase order detail page with overview, vendor/contract cards, system
  information, Record Delivery and Change Status modals, and a live delivery
  result view
- Vendor operations summary (`/api/v1/vendors/{id}/operations-summary`) with
  real contract/order counts and total order value, surfaced on the vendor
  detail page
- Full quality evaluation API (`/api/v1/quality-evaluations`) with pagination,
  search, filters (vendor/contract/purchase order/status), sorting, statistics,
  RBAC, and score-consistency / defect / relationship validation
- Explicit quality status selection (`EXCELLENT` / `GOOD` / `ACCEPTABLE` /
  `POOR` / `CRITICAL`) consistent with the recorded quality score
- Vendor quality summary (`/api/v1/vendors/{id}/quality-summary`) with real
  evaluation counts, average score, per-status tallies, and total defects
- Quality evaluations directory UI: stats strip (Total Evaluations, Average
  Quality Score, Excellent, Poor + Critical, Total Defects), search/filter bar,
  sortable table with status badges, pagination, empty/error states with retry
- Quality evaluation add/edit form with Evaluation Context / Quality
  Assessment / Observations sections, score/status consistency hints, and a
  vendor-scoped contract + purchase order cascade
- Quality evaluation detail page with summary, observations, vendor/contract/
  purchase order cards, and system information
- Vendor detail page Quality Summary with quick links to the evaluations
  directory
- Full incident API (`/api/v1/incidents`) with pagination, search, filters
  (vendor/contract/purchase order/type/severity/status/date range), sorting,
  statistics, RBAC, workflow transitions, and relationship validation
- Automatic incident reference numbers (`INC-000001`, …) with a transactional
  generation retry
- Incident workflow: Open → In Progress → Resolved → Closed with required
  resolution notes, auto `resolved_date`, overdue detection, and immutable
  Closed incidents
- Vendor incident summary (`/api/v1/vendors/{id}/incident-summary`) with real
  per-status / per-severity tallies and average impact
- Incidents directory UI: stats strip (Total, Open, In Progress, Critical,
  Overdue), search/filter bar, sortable table with severity/status badges,
  pagination, empty/error states with retry
- Incident add/edit form with Incident Context / Incident Details / Assignment
  / Incident Status sections, vendor-scoped cascade, and assignment picker
- Incident detail page with description, resolution, vendor/contract/purchase
  order cards, system information, overdue banner, and a transition-aware
  Update Status modal
- Vendor detail page Incident Summary with quick links to the incidents
  directory
- Vendor performance engine: rule-based overall scores (Delivery 40% /
  Quality 35% / Incidents 25%) with weight renormalization, deterministic
  classification bands, data confidence / limited-data flagging, and
  explainable strengths/weaknesses/attention insights
- Vendor performance list API (`/api/v1/vendors/performance`) with search,
  classification filter, and safe sorting (scores sort with nulls last);
  performance statistics; and per-vendor performance detail
- Vendor performance directory UI: stat cards (Total Vendors, Excellent,
  Requiring Attention, Limited Data), search + classification filters,
  sortable score table with classification badges and confidence indicators,
  pagination, empty/error states
- Vendor detail page Performance Score section with overall score,
  classification badge, component breakdown, and insight lists
- Advanced analytics API (`/api/v1/analytics/*`): overview with key insights,
  performance distribution, vendor ranking, delivery/quality/incident overviews
  and trends, incident severity distribution, category performance, historical
  performance trend, and vendor comparison
- Advanced analytics filters: date range (default last 180 days), monthly/daily
  granularity (daily capped at 62 days), vendor and category scope, with 404/422
  validation and read-only access for all roles
- Record-gating and attention rules: vendors/periods without operational data
  are INSUFFICIENT_DATA (excluded from ranking and averages, never fabricated in
  trends); attention flagged for POOR/CRITICAL, ≥3 unresolved incidents, or
  limited-data with unresolved incidents
- `/analytics` page: stat cards, insights panel, distribution bar, ranking,
  delivery/quality/incident trend charts, severity donut, historical performance
  trend, category table, and vendor comparison (2–5 vendors) with empty-chart
  states
- Vendor detail page Trends & Analytics section with per-vendor
  delivery/quality/incident mini-trends and a deep link into the scoped
  analytics view
- Predictive risk score (0–100, higher = riskier) for every vendor using
  five weighted components: Delivery 30%, Incident 25%, Performance 20%,
  Quality 15%, Workload 10% with dynamic weight renormalization
- Risk levels: VERY_LOW / LOW / MEDIUM / HIGH / CRITICAL with deterministic
  band classification from the combined risk score
- Data confidence: LOW (< 3 records or < 30 days), MEDIUM, HIGH (≥ 20 records
  and ≥ 180 days), resolved from real record count and history span
- Risk trend: IMPROVING / WORSENING / STABLE / INSUFFICIENT_DATA from
  two 90-day rule-based windows with a ±4-point threshold
- Explainable risk factors (risk ≥ 40) and positive factors (risk ≤ 20)
  per vendor with impact labels and human-readable descriptions
- Workload component: outstanding + recent-30-day orders on a linear scale
  (saturation at 15 orders) using real PurchaseOrder data
- Record gating: vendors with no operational records return risk_score None
  rather than a fabricated zero; confidence is LOW
- ML infrastructure: 28-feature vendor-month matrix, deterministic time-based
  training pipeline (no label leakage), 80/20 chronological split,
  RandomForestClassifier(n_estimators=100), model artifacts in
  `model_artifacts/vendor_risk_model.joblib`
- Hybrid prediction: 70% rule-based + 30% ML probability when a trained
  model is available; falls back to rule-based otherwise
- Risk API: `/api/v1/vendor-risk` list with search, category, level filter,
  and sorting; `/api/v1/vendor-risk/statistics`; `/api/v1/vendor-risk/train`
  (Admin); `/api/v1/vendor-risk/model-info`; per-vendor predictive risk
- Risk Center frontend (`/vendor-risk`): stat cards, risk distribution bar,
  ML model status with Admin Train Model button, sortable risk table with
  risk score indicators, level badges, method labels, and confidence
- Vendor detail page Predictive Risk section with score, level badge, trend,
  confidence, risk factors, positive factors, and deep link to Risk Center
- Uniform record-gating across the performance engine: vendors with zero
  operational records are INSUFFICIENT_DATA with no score in the performance
  list, detail, statistics, and analytics — a "100" is never fabricated
- Centralized API error handling (`resolveErrorMessage` in the API client)
  that flattens validation detail arrays and maps unexpected 401/404/500
  responses to friendly messages
- Opt-in development demo dataset (`python -m app.scripts.seed_demo_data`)
  with idempotent seeding and a `--clean` removal flag

### Planned

- Reports, Notifications, Audit Logs

Planned features are **not implemented** in Phase 1.

---

## Future Improvements

Natural next steps for the platform (explicitly out of scope during the
current build):

- **Notifications & alerts** — email/webhook alerts when a vendor crosses risk
  thresholds or an incident becomes overdue
- **Reports & exports** — scheduled PDF/CSV report generation and audit-log
  UI; an audit trail of who changed what
- **Authentication hardening** — refresh tokens, password reset, MFA, and
  public self-registration
- **User management UI** — a full admin user/role administration screen
- **Score history** — persist performance and risk snapshots over time to show
  genuine longitudinal trends (today scores are computed live from source
  data)
- **Online / scheduled ML training** — auto-retrain the risk model on a
  schedule with drift monitoring instead of the manual Admin-triggered train
- **Frontend code splitting** — the single 942 kB production chunk can be
  split by route to improve initial load
- **Complaints & reviews** — the two modules referenced as future work since
  Phase 5
- **SMART / automated workflow states** — e.g. auto-EXPIRED contracts and
  auto-DELIVERED orders when dates pass
- **i18n, theming, and accessibility auditing** beyond the current WCAG-friendly
  baseline

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React
- Recharts

### Backend

- Python
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic
- scikit-learn

### Database

- MySQL
- PyMySQL

---

## Project Structure

```text
vendoriq/
├── frontend/        # React + TypeScript + Vite application
├── backend/         # FastAPI application
├── docs/            # Project documentation
├── README.md
└── .gitignore
```

### Frontend

```text
frontend/
├── src/
│   ├── components/   # common/, layout/, ui/ components
│   ├── pages/        # Route-level pages
│   ├── routes/       # Application routing
│   ├── services/     # API communication layer
│   ├── types/        # TypeScript types
│   ├── utils/        # Helper utilities
│   ├── assets/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── .env.example
├── package.json
└── vite.config.ts
```

### Backend

```text
backend/
├── alembic/         # Alembic migration environment
│   └── versions/    # Migration scripts
├── app/
│   ├── api/v1/
│   │   ├── endpoints/   # Endpoint modules (auth, health)
│   │   └── router.py    # API v1 router
│   ├── core/            # Config, database, CORS, security, JWT
│   ├── db/              # Database check utilities
│   ├── dependencies/    # Authentication/RBAC dependencies
│   ├── scripts/         # Seed + admin CLI scripts
│   ├── models/          # SQLAlchemy models (role, user, vendor, ...)
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # Business logic
│   └── main.py          # FastAPI entry point
├── alembic.ini
├── requirements.txt
├── .env.example
└── README.md
```

---

## Setup Instructions

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

### Backend

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Set your MySQL credentials in `.env` (see [Environment Variables](#environment-variables)),
then verify the connection and create the schema:

```bash
python -m app.db.check_db          # test the database connection
alembic upgrade head               # apply migrations (creates the tables)
python -m app.scripts.seed_roles   # seed the essential system roles
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`.

### Create the initial admin

Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in `backend/.env`, then:

```bash
python -m app.scripts.create_initial_admin
```

This is idempotent — safe to re-run. The password is hashed with bcrypt before
storage and is never printed.

### Optional demo dataset

To explore the platform with realistic data, seed the optional demo dataset
(**development only** — the script refuses to run when `ENVIRONMENT` is
`production`):

```bash
python -m app.scripts.seed_demo_data     # create 6 demo vendors + 4 demo users
python -m app.scripts.seed_demo_data --clean   # remove all demo records
```

The seed is idempotent (skips existing `DEMO-…` records) and generates vendors
spanning the full performance/risk spread (EXCELLENT → CRITICAL), contracts,
purchase orders, quality evaluations, incidents, and one demo user per role
(Vendor Manager, Procurement Manager, Project Manager, Analyst) in addition to
the existing admin. See [`docs/demo-guide.md`](docs/demo-guide.md) for the
walkthrough. The demo account password is printed by the script and is
dev-only — never reuse it or the admin password outside `.env`.

### MySQL

1. Install and start MySQL (e.g., via MySQL Installer or `mysql.server start`).
2. Create the VendorIQ database:

   ```sql
   CREATE DATABASE vendoriq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Configure the database connection in `backend/.env`:

   ```text
   DATABASE_URL=mysql+pymysql://USERNAME:PASSWORD@localhost:3306/vendoriq
   ```

   Replace `USERNAME` and `PASSWORD` with your MySQL credentials. If your
   password contains special characters (e.g. `@`), URL-encode them (e.g.
   `@` → `%40`).

### Database migrations (Alembic)

Migrations are managed with Alembic. Run them from the `backend/` directory.

```bash
alembic upgrade head         # apply all pending migrations
alembic revision --autogenerate -m "describe change"   # create a new migration
alembic downgrade -1         # roll back the last migration
alembic current              # show the current migration version
```

The current schema creates the tables: `roles`, `users`, `vendor_categories`,
`vendors`, `contracts`, `purchase_orders`, `quality_evaluations`, `incidents`,
plus Alembic's `alembic_version` tracking table. See
[`docs/database.md`](docs/database.md) for the design.

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable            | Description        | Local example          |
| ------------------- | ------------------ | ---------------------- |
| `VITE_API_BASE_URL` | Backend API URL    | `http://localhost:8000` |

### Backend (`backend/.env`)

| Variable                     | Description                              | Example                                     |
| ---------------------------- | ---------------------------------------- | ------------------------------------------- |
| `APP_NAME`                   | Application name                         | `VendorIQ`                                  |
| `ENVIRONMENT`                | Runtime environment                      | `development`                               |
| `DATABASE_URL`               | MySQL connection string                  | `mysql+pymysql://USER:PASS@localhost:3306/vendoriq` |
| `SECRET_KEY`                 | JWT signing secret (long random value)   | *(generate one)*                            |
| `ALGORITHM`                  | JWT signing algorithm                    | `HS256`                                     |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| Access-token lifetime                    | `60`                                        |
| `INITIAL_ADMIN_EMAIL`        | Initial admin email                      | `admin@vendoriq.com`                        |
| `INITIAL_ADMIN_PASSWORD`     | Initial admin password                   | *(set in `.env` only)*                      |
| `INITIAL_ADMIN_FIRST_NAME`   | Initial admin first name                 | `Admin`                                     |
| `INITIAL_ADMIN_LAST_NAME`    | Initial admin last name                  | `User`                                      |

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`
files. Note: `.env.example` uses placeholder credentials; the real `.env` is
gitignored and contains your actual connection string and `SECRET_KEY`.

---

## API Endpoints

| Method | Path                               | Auth       | Description                    |
| ------ | ---------------------------------- | ---------- | ------------------------------ |
| GET    | `/`                                 | Public     | Root message                   |
| GET    | `/api/v1/health`                    | Public     | Application health check       |
| POST   | `/api/v1/auth/login`                | Public     | Sign in and receive a token    |
| GET    | `/api/v1/auth/me`                   | User       | Current user + role            |
| GET    | `/api/v1/auth/protected-test`       | User       | Dev-check for valid tokens     |
| GET    | `/api/v1/auth/admin-test`           | Admin only | RBAC check (403 for others)    |
| GET    | `/api/v1/vendors`                   | User       | Paginated vendor list w/ search/filter/sort |
| POST   | `/api/v1/vendors`                   | Admin, VM, PM | Create a vendor (default status `PENDING`) |
| GET    | `/api/v1/vendors/statistics`        | User       | Vendor counts per status       |
| GET    | `/api/v1/vendors/{id}`              | User       | Vendor detail                  |
| PATCH  | `/api/v1/vendors/{id}`              | Admin, VM, PM | Update vendor fields        |
| PATCH  | `/api/v1/vendors/{id}/status`       | Admin, VM  | Change status / deactivate     |
| GET    | `/api/v1/vendor-categories`         | User       | Categories with vendor counts  |
| POST   | `/api/v1/vendor-categories`         | Admin, VM  | Create a category              |
| PATCH  | `/api/v1/vendor-categories/{id}`    | Admin, VM  | Rename / deactivate a category |
| GET    | `/api/v1/contracts`                 | User       | Paginated contract list w/ search/filter/sort |
| POST   | `/api/v1/contracts`                 | Admin, VM, PM | Create a contract (default status `DRAFT`) |
| GET    | `/api/v1/contracts/statistics`      | User       | Contract counts per status + total contract value |
| GET    | `/api/v1/contracts/{id}`            | User       | Contract detail                |
| PATCH  | `/api/v1/contracts/{id}`            | Admin, VM, PM | Update contract fields      |
| PATCH  | `/api/v1/contracts/{id}/status`     | Admin, VM, PM | Change contract status      |
| GET    | `/api/v1/purchase-orders`           | User       | Paginated PO list w/ search/filter/sort |
| POST   | `/api/v1/purchase-orders`           | Admin, VM, PM | Create a PO (default status `DRAFT`) |
| GET    | `/api/v1/purchase-orders/statistics`| User       | PO counts per status + delivery tallies |
| GET    | `/api/v1/purchase-orders/{id}`      | User       | PO detail (incl. computed delivery) |
| PATCH  | `/api/v1/purchase-orders/{id}`      | Admin, VM, PM | Update PO fields          |
| PATCH  | `/api/v1/purchase-orders/{id}/status` | Admin, VM, PM | Change PO status       |
| PATCH  | `/api/v1/purchase-orders/{id}/delivery` | Admin, VM, PM | Record actual delivery |
| GET    | `/api/v1/vendors/{id}/operations-summary` | User | Vendor contract/order counts + total value |
| GET    | `/api/v1/quality-evaluations` | User       | Paginated evaluation list w/ search/filter/sort |
| POST   | `/api/v1/quality-evaluations` | Admin, VM, PM, ProjM | Record a quality evaluation |
| GET    | `/api/v1/quality-evaluations/statistics` | User | Per-status counts + avg score + total defects |
| GET    | `/api/v1/quality-evaluations/{id}` | User | Quality evaluation detail |
| PATCH  | `/api/v1/quality-evaluations/{id}` | Admin, VM, PM, ProjM | Update an evaluation |
| GET    | `/api/v1/vendors/{id}/quality-summary` | User | Vendor evaluation counts + avg score + defects |
| GET    | `/api/v1/incidents` | User | Paginated incident list w/ search/filter/sort |
| POST   | `/api/v1/incidents` | Admin, VM, PM, ProjM | Report an incident (default status `OPEN`) |
| GET    | `/api/v1/incidents/statistics` | User | Per-status/severity counts + overdue + avg impact |
| GET    | `/api/v1/incidents/{id}` | User | Incident detail |
| PATCH  | `/api/v1/incidents/{id}` | Admin, VM, PM, ProjM | Update incident / change status |
| GET    | `/api/v1/users` | User | User list (assignment picker) |
| GET    | `/api/v1/vendors/{id}/incident-summary` | User | Vendor incident counts + avg impact |
| GET    | `/api/v1/vendors/performance` | User | Vendor performance list w/ search/classification filter/sort |
| GET    | `/api/v1/vendors/performance/statistics` | User | Performance tallies for dashboard cards |
| GET    | `/api/v1/vendors/{id}/performance` | User | Vendor performance detail + insights |
| GET    | `/api/v1/analytics/overview` | User | Executive analytics summary + key insights |
| GET    | `/api/v1/analytics/performance-distribution` | User | Vendors per classification band |
| GET    | `/api/v1/analytics/vendor-ranking` | User | Vendors ranked by current overall score |
| GET    | `/api/v1/analytics/delivery-overview` | User | Delivery KPIs (on-time rate, delay days) |
| GET    | `/api/v1/analytics/delivery-trend` | User | Delivery score + on-time rate over time |
| GET    | `/api/v1/analytics/quality-overview` | User | Quality KPIs (avg score, evaluations) |
| GET    | `/api/v1/analytics/quality-trend` | User | Average quality score over time |
| GET    | `/api/v1/analytics/incident-overview` | User | Incident KPIs (open, unresolved, overdue) |
| GET    | `/api/v1/analytics/incident-trend` | User | Incident score over time |
| GET    | `/api/v1/analytics/incident-severity-distribution` | User | Incident counts/percentages per severity |
| GET    | `/api/v1/analytics/category-performance` | User | Average component scores per category |
| GET    | `/api/v1/analytics/performance-trend` | User | Average overall score over time |
| GET    | `/api/v1/analytics/vendor-comparison` | User | Compare 2–5 vendors (query: `vendor_ids`) |
| GET    | `/api/v1/vendor-risk` | User | Predictive risk list w/ search/category/level filter/sort |
| GET    | `/api/v1/vendor-risk/statistics` | User | Risk level tallies + coverage |
| POST   | `/api/v1/vendor-risk/train` | Admin only | Train/refresh the ML risk model |
| GET    | `/api/v1/vendor-risk/model-info` | User | Trained model metadata |
| GET    | `/api/v1/vendors/{id}/predictive-risk` | User | Per-vendor risk detail + factors/trend |

> VM = Vendor Manager, PM = Procurement Manager, ProjM = Project Manager.
> Read access is available to every authenticated role; mutation endpoints are
> role-gated (403 otherwise). Contracts, purchase orders, and quality
> evaluations are never deleted (405 on DELETE).

Interactive docs: `http://localhost:8000/docs` (use the **Authorize** button
with a token from `/api/v1/auth/login` to call protected endpoints).