# VendorIQ — Project Overview

**AI-Powered Vendor Performance and Risk Management System**

VendorIQ is a full-stack vendor management platform that lets organizations
register vendors, manage contracts, purchase orders, quality evaluations and
incidents, and — crucially — turns that operational data into a live,
explainable **vendor performance score** and a **predictive risk score** using a
combination of rule-based scoring and a trained machine-learning model.

It was built incrementally across 11 phases; every phase is documented in the
[`docs/README.md`](README.md) index.

---

## Problem

Procurement and vendor-management teams typically rely on spreadsheets,
subjective reviews, and gut feel. When operational records (deliveries, quality
evaluations, incidents) do exist, they tend to sit in disconnected systems and
are never converted into actionable intelligence. Teams cannot answer simple
questions like:

- Who are my strongest and weakest vendors, and *why*?
- Which vendors are trending toward failure before it happens?
- What is the story behind any single score — is it trustworthy?

## Solution

VendorIQ records the operational reality (orders, deliveries, quality scores,
incidents, contracts) as **the single source of truth**, then computes two
things live from that data — never stored, never estimated:

1. **Vendor Performance Score (0–100)** — a rule-based, fully explainable score
   from Delivery (40%), Quality (35%), and Incidents (25%) components.
2. **Predictive Risk Score (0–100)** — higher = riskier; a hybrid of the same
   operational signals plus a trained RandomForest ML model, reported as
   deterministic risk levels (VERY_LOW → CRITICAL).

Both scores come with data-confidence and "limited data" indicators, so a score
is never presented without a statement of how trustworthy it is.

## Architecture

```text
 React + TypeScript + Vite + Tailwind 4 + Recharts   (frontend)
        │  JWT (Bearer) over HTTP/REST
 FastAPI + SQLAlchemy 2 + Pydantic v2 + Alembic      (backend)
        │  MySQL (PyMySQL)
 MySQL 8 (UTF-8mb4)                                   (database)
        │
 Predictive risk: rule-based engine + scikit-learn   (ML, optional artifact)
```

- **Backend** (`backend/`) — FastAPI application under `/api/v1`, organized as
  `api/v1/endpoints/*`, `services/*`, `schemas/*`, `models/*`,
  `dependencies/*` (auth/RBAC), `scripts/*` (seed utilities), and `ml/*`
  (risk model training/inference).
- **Frontend** (`frontend/`) — React 19 SPA with protected routes, an
  `AuthContext`, a typed API client layer (`src/services/api/`), reusable
  design-system components (`src/components/common/`), and per-module pages in
  `src/pages/`.
- **ML** — an optional, deterministic training pipeline builds a
  `RandomForestClassifier` over a 28-feature vendor-month matrix. Prediction is
  a hybrid: **70% rule-based + 30% ML probability** when a trained model exists,
  otherwise 100% rule-based (no false dependence on ML).

## Modules

| Module | Backend API | Frontend page | Write roles |
| ------ | ----------- | ------------- | ----------- |
| Vendor management | `/api/v1/vendors`, `/vendor-categories` | `/vendors`, `/vendor-categories` | Admin, Vendor Manager, Procurement Manager |
| Contract management | `/api/v1/contracts` | `/contracts` | Admin, Vendor Manager, Procurement Manager |
| Purchase orders & delivery | `/api/v1/purchase-orders` | `/purchase-orders` | Admin, Vendor Manager, Procurement Manager |
| Quality evaluations | `/api/v1/quality-evaluations` | `/quality-evaluations` | Admin, Vendor Manager, Procurement Manager, Project Manager |
| Incidents | `/api/v1/incidents` | `/incidents` | Admin, Vendor Manager, Procurement Manager, Project Manager |
| Performance engine | `/api/v1/vendors/performance`, `/vendors/{id}/performance` | `/vendor-performance` | read-only for all roles |
| Risk intelligence | `/api/v1/vendor-risk` | `/vendor-risk` | read-only for all roles; `POST /vendor-risk/train` Admin only |
| Analytics | `/api/v1/analytics/*` | `/analytics` | read-only for all roles |
| Users | `/api/v1/users` | — | read (assignment picker) |

> **Analyst** is read-only across every module. Every write is enforced on the
> backend with `require_roles(...)` returning a 403 — the backend is the
> authorization source of truth; the frontend only mirrors role gates for UX.

## Performance engine (Phase 7)

- **Delivery 40%** — on-time rate of completed orders minus a delay penalty
  (total delay days, capped at 20 points). No completed deliveries ⇒ no
  delivery data — never estimated.
- **Quality 35%** — average quality evaluation score (0–100).
- **Incident 25%** — 100 minus per-incident penalties (severity weight ×
  impact ÷ 10 × status factor) plus an overdue penalty capped at 10. Zero
  incidents score 100 only when the vendor has other recorded operations.
- **Renormalization** — unavailable components are excluded and the remaining
  weights renormalized, so a partially-scored vendor is not unfairly penalized.
- **Confidence** — available components ÷ 3; < 66.67% is flagged **limited
  data**.
- **Classification bands** — EXCELLENT ≥ 85, GOOD ≥ 70, AVERAGE ≥ 50, POOR ≥ 30,
  CRITICAL < 30, INSUFFICIENT_DATA (no usable data).
- **Anti-fabrication guarantee** — a vendor with **zero operational records**
  (no orders, evaluations, or incidents) is always reported as
  `INSUFFICIENT_DATA` with no overall score, everywhere (performance list,
  detail, statistics, analytics distribution/ranking). Scores are only ever
  computed from real records.

## Predictive risk & ML (Phase 9)

- Components: Delivery 30%, Incident 25%, Performance 20%, Quality 15%,
  Workload 10%, renormalized; workload saturation at 15 orders.
- Levels: VERY_LOW < 20, LOW < 40, MEDIUM < 60, HIGH < 80, CRITICAL ≤ 100.
- Confidence: LOW / MEDIUM / HIGH resolved from real record count + history span.
- Trend: IMPROVING / WORSENING / STABLE from two 90-day rule-based windows.
- Explainable risk factors (risk ≥ 40) and positive factors (risk ≤ 20).
- `POST /api/v1/vendor-risk/train` (Admin) runs the deterministic pipeline; a
  trained model is optional and prediction degrades gracefully to rule-based.

## Key design principles

- **Records are never deleted** — entities are deactivated via `is_active`
  (vendors, categories, contracts) or are immutable once closed (incidents).
  MySQL enforces check constraints, FKs, and indexes (alembic head
  `d4a7d31923b9`).
- **Computed live** — scores, delivery status, trends, and analytics are
  derived on demand from source data; correcting a date immediately
  recalculates everything. No persisted score tables.
- **No fabricated history** — periods/vendors without data are
  `INSUFFICIENT_DATA`, never shown as 0 or a made-up score.
- **Deterministic and explainable** — rules are documented constants; every
  score surfaces strengths, weaknesses, attention areas, and risk factors.

## Verification (Phase 11)

- `alembic check` — "No new upgrade operations detected." (schema is final)
- Backend smoke suite — 47 API health/contract checks (login, RBAC 403s,
  module list/statistics endpoints, analytics endpoints)
- End-to-end RBAC + demo-data flow — 33 checks: every role login, Analyst /
  Project Manager read-only enforcement, Vendor Manager positive create/patch,
  status-change gating, performance + risk + analytics queries, probe cleanup
- Frontend gates — `npx tsc -b`, `npm run lint` (oxlint, 0 warnings), `npm run
  build` all clean

## Run it

Follow the setup in the root [`../README.md`](../README.md): create the MySQL
database, migrate (`alembic upgrade head`), seed roles and the initial admin,
then run backend and frontend. Optional: `python -m app.scripts.seed_demo_data`
for a complete demo dataset (dev environments only).

## Known limitations

See [`../README.md`](../README.md) (Future Improvements). Highlights:
no automated notifications/reports, no audit-log UI, no persisted score
history, no public registration/password reset, ML model is trained offline
(no online learning), and the 942 kB frontend bundle is a single chunk (no
code splitting yet).