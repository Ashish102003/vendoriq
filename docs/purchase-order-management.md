# Purchase Orders & Delivery Tracking (Phase 5B)

This document describes the Purchase Order and Delivery Tracking module delivered
in Phase 5B of VendorIQ.

## Overview

Purchase Orders represent formal procurement commitments made to a vendor with a
defined order value and a committed delivery date. VendorIQ records the order
facts and **computes** two delivery views on top of them:

- `delivery_status` — `PENDING`, `ON_TIME`, or `DELAYED`
- `delay_days` — calendar days of lateness (0 for on-time, absent while pending)

These values are **never stored**; they are derived live from
`actual_delivery_date` and `expected_delivery_date` on every response, so
correcting a mis-recorded delivery date immediately recomputes the status.

Phase 5B deliberately delivers only the purchase order + delivery lifecycle.
Quality Evaluations, Incidents, Complaints, Reviews, Performance Scoring,
Analytics, ML, and Risk Prediction remain separate future phases.

## Data model

The `purchase_orders` table (`backend/app/models/purchase_order.py`):

| Column                 | Type           | Constraints                                          |
| ---------------------- | -------------- | ---------------------------------------------------- |
| `id`                   | `int`          | Primary key, auto-increment                          |
| `vendor_id`            | `int`          | FK → `vendors.id` (RESTRICT), indexed, required      |
| `contract_id`          | `int`          | FK → `contracts.id` (RESTRICT), indexed, nullable    |
| `order_number`         | `varchar(30)`  | Unique (case-insensitive), required                  |
| `title`                | `varchar(255)` | Required                                             |
| `description`          | `text`         | Optional                                             |
| `order_value`          | `decimal(18,2)`| Required, `>= 0` (DB check constraint)              |
| `order_date`           | `date`         | Required                                             |
| `expected_delivery_date` | `date`       | Required, `>= order_date` (DB check constraint)      |
| `actual_delivery_date` | `date`         | Optional, `>= order_date` when present (DB check)    |
| `status`               | `enum`         | Server default `DRAFT`                               |
| `created_at`           | `datetime`     | Server default `now()`                               |
| `updated_at`           | `datetime`     | Server default `now()`, auto-updated                 |

There is intentionally **no `delivery_status` / `delay_days` column** — they are
computed (see [Delivery tracking](#delivery-tracking)).

### Relationships

- `PurchaseOrder.vendor` — many-to-one (required); `Vendor.purchase_orders`
  back-reference.
- `PurchaseOrder.contract` — many-to-one (optional); `Contract.purchase_orders`
  back-reference.
- Both FKs use `ON DELETE RESTRICT`. VendorIQ never deletes vendors, contracts,
  or purchase orders anyway.

A purchase order's `vendor_id` and `contract_id` (when present) must agree: the
selected contract must belong to the selected vendor. The backend rejects a
mismatch with a `422`.

### Migration

- Revision `c5fd64a31ba7` — `create purchase_orders table`
- Chains from the Phase 5A head `2094b0b9e149`
- Includes server defaults, check constraints, the unique `order_number`, and
  the `ix_purchase_orders_vendor_id` / `ix_purchase_orders_contract_id`
  indexes.

## Purchase order statuses

| Enum value             | Label             | Meaning                                       |
| ---------------------- | ----------------- | --------------------------------------------- |
| `DRAFT`                | Draft             | Being prepared (server default)               |
| `ISSUED`               | Issued            | Sent to the vendor                            |
| `IN_PROGRESS`          | In Progress       | Vendor working on the order                   |
| `DELIVERED`            | Delivered         | Fully received                                |
| `PARTIALLY_DELIVERED`  | Partially Delivered | Received in part                            |
| `CANCELLED`            | Cancelled         | Terminated before delivery                    |
| `CLOSED`               | Closed            | Order closed out                              |

Status transitions are **manual only**. The backend never applies automatic
workflows — e.g. it does not auto-transition to `DELIVERED` when a delivery is
recorded (the delivery endpoint may update the status, but only when the caller
explicitly sends a `status` value).

## Validation rules

| Rule                                    | HTTP code | Enforcement point                  |
| --------------------------------------- | --------- | ---------------------------------- |
| `order_value` negative                  | 422       | Schema (`ge=0`) + DB check         |
| `expected_delivery_date < order_date`   | 422       | Schema validator + DB check        |
| `actual_delivery_date < order_date`     | 422       | Endpoint (merged result) + DB check|
| Duplicate `order_number`                | 409       | Pre-check + `IntegrityError`       |
| Invalid `vendor_id`                     | 404       | Endpoint lookup                    |
| Invalid `contract_id`                   | 404       | Endpoint lookup                    |
| Contract/vendor mismatch                | 422       | Endpoint `_validate_contract_vendor` |
| Empty `title` / `order_number`          | 422       | Endpoint + DB `NOT NULL`           |
| `order_number` normalization            | —         | Stripped and uppercased before save|
| Unknown sort field                      | 422       | `Literal` type on the query param  |
| DELETE                                  | 405       | Not implemented (by design)        |

Date validation on **partial updates** validates the full merged record, so
changing only `order_date` can still trigger `expected < order` or
`actual < order`. `order_value` is serialized as an exact decimal string (e.g.
`"15000.00"`), matching the contracts convention.

## Delivery tracking

`delivery_status` and `delay_days` are computed from the date facts:

| Case                                  | `delivery_status` | `delay_days` |
| ------------------------------------- | ----------------- | ------------ |
| `actual_delivery_date` is `NULL`      | `PENDING`         | `null`       |
| `actual <= expected`                  | `ON_TIME`         | `0`          |
| `actual > expected`                   | `DELAYED`         | `(actual - expected).days` |

The computation lives in `compute_delivery` in
`backend/app/models/purchase_order.py` and is exposed as `delivery_status` /
`delay_days` properties on the model, so every list/detail/delivery response
includes the live values without any stored columns.

## API endpoints

All endpoints require a valid Bearer token.

### Purchase orders — `/api/v1/purchase-orders`

| Method | Path                                | Roles (mutation) | Notes                                    |
| ------ | ----------------------------------- | ---------------- | ---------------------------------------- |
| GET    | `/api/v1/purchase-orders`           | all authenticated| Paginated list with query params         |
| POST   | `/api/v1/purchase-orders`           | Admin, VM, PM    | Create (default `DRAFT`, `201`)          |
| GET    | `/api/v1/purchase-orders/statistics`| all authenticated| Counts per status + delivery tallies     |
| GET    | `/api/v1/purchase-orders/{id}`      | all authenticated| Detail incl. nested vendor/contract summary |
| PATCH  | `/api/v1/purchase-orders/{id}`      | Admin, VM, PM    | Partial update                           |
| PATCH  | `/api/v1/purchase-orders/{id}/status` | Admin, VM, PM  | Change status only                       |
| PATCH  | `/api/v1/purchase-orders/{id}/delivery` | Admin, VM, PM | Record actual delivery (+ optional status) |
| DELETE | *(not implemented)*                 | —                | Returns `405`                            |

### List query parameters

`page` (≥1), `page_size` (1–100), `search` (case-insensitive `order_number` and
`title`), `vendor_id`, `contract_id`, `status`, `sort_by`, `sort_order`.

Sort fields: `order_number`, `title`, `order_value`, `order_date`,
`expected_delivery_date`, `actual_delivery_date`, `status`, `created_at`,
`updated_at`. Default: `created_at DESC`.

Response shape is the pagination convention used since Phase 4:

```json
{
  "items": [...],
  "total": 10,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

### Purchase order statistics response

```json
{
  "total_orders": 10,
  "draft_orders": 2,
  "issued_orders": 2,
  "in_progress_orders": 1,
  "delivered_orders": 3,
  "partially_delivered_orders": 1,
  "cancelled_orders": 1,
  "closed_orders": 0,
  "total_order_value": "150000.00",
  "on_time_deliveries": 2,
  "delayed_deliveries": 1,
  "pending_deliveries": 4
}
```

`on_time_deliveries` / `delayed_deliveries` are counted only where an actual
delivery has been recorded; `pending_deliveries` is `total_orders` minus recorded
deliveries.

### Delivery recording

`PATCH /api/v1/purchase-orders/{id}/delivery` with:

```json
{
  "actual_delivery_date": "2026-03-06",
  "status": "DELIVERED"
}
```

- `actual_delivery_date` is required; `status` is optional (leave status
  unchanged by omitting it).
- Overwrites any previously recorded date — the computed `delivery_status` /
  `delay_days` react immediately.
- The response includes the freshly computed delivery result.

### Vendor operations summary — `/api/v1/vendors`

| Method | Path                                  | Roles | Notes |
| ------ | ------------------------------------- | ----- | ----- |
| GET    | `/api/v1/vendors/{vendor_id}/operations-summary` | all authenticated | Real counts for one vendor |

Response:

```json
{
  "vendor_id": 44,
  "total_contracts": 3,
  "active_contracts": 2,
  "total_orders": 8,
  "active_orders": 3,
  "delivered_orders": 2,
  "delayed_orders": 1,
  "total_order_value": "150000.00"
}
```

Definitions (all real database counts; zeros for a vendor with no data):

| Field                 | Definition                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `total_contracts`     | All contracts linked to the vendor                                |
| `active_contracts`    | Contracts with status `ACTIVE`                                    |
| `total_orders`        | All purchase orders for the vendor                                |
| `active_orders`       | Orders with status `ISSUED` or `IN_PROGRESS`                      |
| `delivered_orders`    | Orders with status `DELIVERED` or `PARTIALLY_DELIVERED`           |
| `delayed_orders`      | Orders with a recorded delivery later than `expected_delivery_date` |
| `total_order_value`   | Sum of `order_value` for the vendor                               |

This is an operational summary, **not** a performance or risk score. A missing
vendor returns `404`.

## RBAC matrix

| Role                   | List/Detail/Stats/Summary | Create | Edit | Status change | Record delivery |
| ---------------------- | ------------------------- | ------ | ---- | ------------- | --------------- |
| Admin                  | ✓                         | ✓      | ✓    | ✓             | ✓               |
| Vendor Manager         | ✓                         | ✓      | ✓    | ✓             | ✓               |
| Procurement Manager    | ✓                         | ✓      | ✓    | ✓             | ✓               |
| Project Manager        | ✓                         | ✗      | ✗    | ✗             | ✗               |
| Analyst                | ✓                         | ✗      | ✗    | ✗             | ✗               |

Access restricted via
`require_roles("Admin", "Vendor Manager", "Procurement Manager")`; the 403
response is `"You do not have permission to perform this action"`, consistent
with earlier phases. Read-only roles can view everything, including delivery
status and delay days.

## Frontend

New routes:

- `/purchase-orders` — directory (stats strip, search, vendor/status filters,
  sortable table with delivery + delay badges, pagination, empty/error states)
- `/purchase-orders/new` — create form
- `/purchase-orders/:purchaseOrderId` — detail page
- `/purchase-orders/:purchaseOrderId/edit` — edit form

New files:

- `src/pages/purchase-orders/{PurchaseOrdersPage,PurchaseOrderFormPage,PurchaseOrderDetailPage}.tsx`
- `src/components/purchase-orders/{PurchaseOrderForm,PurchaseOrderStatusBadge,DeliveryStatusBadge}.tsx`
- `src/services/api/purchaseOrders.ts` (`purchaseOrdersApi`, `vendorOperationsApi`)

Changed files:

- `src/types/index.ts` — purchase order + delivery + operations-summary types
- `src/utils/permissions.ts` — `PURCHASE_ORDER_STATUSES/LABELS`,
  `DELIVERY_STATUS_LABELS`, `canManagePurchaseOrders`,
  `canManagePurchaseOrderStatus`, `canRecordDelivery`
- `src/components/layout/navigation.ts` — **Operations** group now contains
  **Contracts** and **Purchase Orders** (the standalone `Orders` placeholder was
  moved into the Operations group)
- `src/components/layout/Sidebar.tsx` — phase footer updated
- `src/routes/index.tsx` — purchase order routes
- `src/pages/contracts/ContractsPage.tsx` — accepts `?vendor_id=` (quick link
  from the vendor detail page)
- `src/pages/vendors/VendorDetailPage.tsx` — **Operations Summary** section with
  real counts and quick links to the vendor's contracts and purchase orders

UX notes:

- Search placeholder: “Search by order number or title…”, subtitle “Track vendor
  orders and delivery commitments.”
- Empty state: “No purchase orders found” / “Create a purchase order to begin
  tracking vendor delivery commitments.”
- The form has two sections — **Order Information** (vendor, optional contract,
  number, value, title, description, status) and **Order Timeline** (order date,
  expected delivery date). The contract dropdown is disabled until a vendor is
  selected, then loads only that vendor's contracts via
  `GET /api/v1/contracts?vendor_id=N`.
- `actual_delivery_date` is **not** part of the create/edit form — it is captured
  through the **Record Delivery** modal on the detail page.
- The delivery result is rendered explicitly (e.g. “Delivered On Time”,
  “Delayed · Delay: 5 Days”), and the `+Nd` delay hint appears in list rows.
- Create/edit/status/delivery controls are hidden for read-only roles and the
  backend enforces the same rules.

## Commands

```powershell
# Backend (from backend/)
.\venv\Scripts\alembic.exe upgrade head        # apply migrations
.\venv\Scripts\alembic.exe current             # verify head revision
.\venv\Scripts\alembic.exe check               # verify no model drift
.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev
npm run build
npx tsc -b --noEmit
npx oxlint src
```

## Test results

The Phase 5B backend suite (`test_phase5b.py`) covers:

- DB layer: `purchase_orders` table + columns, FKs to `vendors`/`contracts`,
  unique `order_number`, no stored delivery columns, `compute_delivery` cases,
  Alembic head `c5fd64a31ba7`
- API: auth requirements, list/search/filter/sort (+`422` on unknown sort),
  pagination, create/detail/update/status, duplicate `409`, vendor/contract
  `404`, contract/vendor mismatch `422`, date-range `422`s, `405` on DELETE
- Delivery: PENDING/ON_TIME/DELAYED incl. day-boundary and delay-days, status
  updates through the delivery endpoint, live recompute on correction
- Statistics and Operations Summary correctness (including zeros and 404)
- RBAC: Project Manager + Analyst read-only; Admin/VM/PM can create/edit/status/
  delivery

Result: **47/47 passed**, `alembic check` clean, suite self-cleans (purchase
orders, contracts, vendors, test users). Frontend checks: `npx oxlint src` →
0 warnings / 0 errors, `npx tsc -b --noEmit` clean, `npm run build` clean.
Live HTTP smoke tests verified create → record delivery (DELAYED, +5d) →
statistics → operations summary on the running dev servers.

## Known limitations

- No automatic status workflows (delivery must be recorded manually).
- No bulk delivery recording or partial-delivery quantities.
- The contract dropdown loads the vendor's first 100 contracts.
- The vendor filter dropdown loads the first 100 vendors.
- `delayed_orders` counts only deliveries that have actually been recorded as
  late — an outstanding (not yet delivered) order past its expected date is not
  counted until a delivery is recorded.
- No way to physically delete purchase orders (by design).

## Issues encountered

- FastAPI 0.141's lazy router defers route registration until the app starts, so
  tests exercise the app through `TestClient` (same approach as Phases 4 & 5A).
- `Decimal` serializes as a string in Pydantic v2 JSON mode; the frontend formats
  it with `formatCurrency` (en-IN INR), keeping money exact.
- The `actual_delivery_date >= order_date` invariant needs a "when present"
  check, written as `actual_delivery_date IS NULL OR actual_delivery_date >=
  order_date` (NULLs pass MySQL check constraints by definition).
- MySQL50/email-validator rejected `.local` test-domains (the part after `@` is a
  reserved name); the test suite uses `example.com` addresses instead.
- The Phase B test suite initially leaked rows when the entire `tearDown`
  aborted on one entity's FK failure; `tearDown` now deletes per-entity with
  error isolation and the RBAC test tracks its created orders for cleanup.

## Future integration

The `purchase_orders` table is designed to anchor future operational phases:

- **Quality Evaluations** will reference delivered purchase orders.
- **Delivery/Incident tracking** can build on the recorded `actual_delivery_date`.
- **Performance scoring** will aggregate on-time vs delayed deliverates and
  `order_value` volumes per vendor.
- The vendor **Operations Summary** will merge into broader analytics/reporting
  as those modules land.