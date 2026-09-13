# VendorIQ — Demo Guide

A 20–30 minute, scripted walkthrough of the full platform. It follows a single
narrative: **"does our data tell us who to trust?"** Each step shows one
capability, states the problem it solves, and points out why the output is
trustworthy.

## Before you start

1. **Backend running** — from `backend/`, run `uvicorn app.main:app --reload`
   (or the already-running instance on `http://127.0.0.1:8000`).
2. **Frontend running** — from `frontend/`, run `npm run dev`
   (`http://localhost:5173`).
3. **Demo data (optional but recommended)** — with the backend **not** in
   production mode, run from `backend/`:

   ```bash
   python -m app.scripts.seed_demo_data
   ```

   This is idempotent and creates 6 demo vendors (coded `DEMO-…`) plus 4 demo
   users. The script prints a dev-only shared demo password — do not reuse it
   for production. To remove all demo records later:

   ```bash
   python -m app.scripts.seed_demo_data --clean
   ```

4. **Accounts** — sign in as the admin (credentials from `backend/.env`;
   `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD`). Demo users:
   `demo.vendor-manager@vendoriq.demo`, `demo.procurement@vendoriq.demo`,
   `demo.project-manager@vendoriq.demo`, `demo.analyst@vendoriq.demo`.

The verified demo dataset (used by the numbers below):

| Vendor | Performance | Predictive risk |
| ------ | ----------- | --------------- |
| DEMO-001 Apex Circuits | **EXCELLENT** 98.0 | VERY_LOW 1.3 |
| DEMO-002 Blue Horizon Logistics | **AVERAGE** 62.5 | LOW 32.1 |
| DEMO-003 Crestline Packaging | **POOR** 45.0 | MEDIUM 47.6 |
| DEMO-004 Vertex Steelworks | **CRITICAL** 22.6 | HIGH 71.2 |
| DEMO-005 Nimbus IT Solutions | **GOOD** 83.1 | VERY_LOW 14.3 |
| DEMO-006 Precision Devices | **INSUFFICIENT_DATA** (no records) | — (no risk) |

---

## Step 1 — Sign in (problem: secure access)

Open `/login`, sign in as **admin**. Show the user menu (name + role + logout)
and the protected-route behavior. *Problem solved: role-aware access control on
every screen.*

## Step 2 — Dashboard (problem: where do I begin?)

Land on the **Vendor Intelligence Overview**: 8 KPI cards (vendors, contracts,
performance, attention, incidents, delivery, risk), the Vendor Health and
Predictive Risk distribution bars, insights panel, top-5 ranking, and
delivery/quality snapshot. *Point out:* "2 vendors require attention" matches
Crestline (POOR) + Vertex (CRITICAL); every number deep-links into its module.

## Step 3 — Vendors directory (problem: too many vendors)

Open `/vendors`. Search, filter, sort; note the **Performance** and **Risk**
columns right in the table; open a vendor to see the **intelligence strip**
(score, risk, contracts/orders, and a rule-derived **decision verdict**).

## Step 4 — Apex Circuits detail (problem: why is this vendor good?)

Open DEMO-001 Apex (EXCELLENT 98.0, risk 1.3). The **Performance Score**
section shows component breakdown (delivery/quality/incident) and
strengths/weaknesses/attention areas; **Predictive Risk** shows level, trend,
and positive factors ("16 of 16 completed deliveries were on time"). *Point
out: every claim has a fact behind it.*

## Step 5 — Precision Devices (problem: can we trust a "100"?)

Open DEMO-006 Precision. It has **no** operational records, so the system
refuses to fabricate a score — it shows **INSUFFICIENT_DATA** / no risk.
*This is the anti-fabrication guarantee: a score only ever comes from real
records.*

## Step 6 — Risk Center (problem: who is most likely to fail?)

Open `/vendor-risk`. The list is sorted by risk score — **Vertex 71.2 HIGH** on
top. Show the stat cards, risk distribution bar, ML model status panel, and the
**Train Model** button (Admin only). Try the button as a non-admin in Step 13.

## Step 7 — Vertex Steelworks risk drill-down (problem: what is driving risk?)

Open Vertex's predictive risk detail: score 71.2 HIGH, confidence, risk
**factors** ("Delivery...", "Quality...", "Incident...") with impact labels —
6 critical incidents and chronically late deliveries are the drivers. *Point
out: this is the "why", not just a number.*

## Step 8 — Analytics (problem: trends and comparisons)

Open `/analytics`. Date-range filter (default last 180 days), distribution bar,
ranking, delivery/quality/incident trend charts, historical performance trend,
category table, and **vendor comparison** — select Apex + Blue Horizon +
Crestline + Vertex and compare side by side. *Point out: charts never show
fabricated history — empty periods are "insufficient data".*

## Step 9 — Incidents (problem: operational issues pile up)

Open `/incidents`. Stats strip (Total, Open, In Progress, Critical, Overdue) —
Crestline and Vertex carry the heavy incident load; open a Vertex incident to
see the lifecycle (Open → In Progress → Resolved → Closed), impact/severity,
and overdue banner.

## Step 10 — Purchase orders & delivery (problem: are deliveries slipping?)

Open `/purchase-orders`. Filter by vendor (Vertex or Apex), show computed
delivery badges **PENDING / ON_TIME / DELAYED** with delay days — derived live
from actual vs expected dates, never stored. Open an order → **Record Delivery**
modal proves you can correct data and everything recomputes instantly.

## Step 11 — Quality evaluations (problem: quality is often lip service)

Open `/quality-evaluations`. Average score stats + per-status consistency
(EXCELLENT must match a 90–100 score — the form enforces and explains this).
Check Apex's strong scores vs Crestline's poor ones.

## Step 12 — Contracts (problem: relationships have terms)

Open `/contracts`. Stats strip with active/completed and **total contract
value**; see validations (end ≥ start, non-negative value) and status changes
(Draft/Active/Completed/On Hold/Cancelled/Expired).

## Step 13 — Roles & permissions (problem: least privilege)

Open a new incognito/private window and sign in as **demo.analyst@vendoriq.demo**.
Navigate everywhere (read access), then try to create a vendor or open the
Vendor form — blocked, and in Risk Center the **Train Model** button is hidden.
Then sign in as **demo.vendor-manager@vendoriq.demo** — the "New Vendor" button
is back and a normal create works, but the status-change modal (Admin + Vendor
Manager only is allowed; note the Manager *can* change status, the Analyst
cannot even see the controls). Close the loop: admins see everything. *Point
out: authorization is enforced on the backend, the UI just mirrors it.*

---

## Wrap-up

Summarize the three proof points of the product:

1. **One source of truth** — operational records drive everything.
2. **Explainable intelligence** — every score lists its reasons and its
   confidence.
3. **No fabrication** — no data means INSUFFICIENT_DATA, never a made-up score.

## Cleanup

Run `python -m app.scripts.seed_demo_data --clean` from `backend/` to remove
the demo vendors and demo users. Other records created during the walkthrough
can be deactivated or closed in the UI (records are never hard-deleted by
design).