# Contract Management (Phase 5A)

This document describes the Contract Management module delivered in Phase 5A of
VendorIQ.

## Overview

Contracts represent formal, time-bound commercial agreements between the
organization and a vendor. Every contract links back to exactly one vendor and
carries an overall contract value plus a validity period (`start_date` →
`end_date`). VendorIQ treats contracts as immutable records in the sense that
they are **never deleted** — they are deactivated through `is_active` just like
vendors and categories.

Phase 5A deliberately delivers only the contract lifecycle itself. Purchase
Orders, Delivery Tracking, Quality Evaluations, Incidents, Complaints, and
Reviews remain separate future phases.

## Data model

The `contracts` table (`backend/app/models/contract.py`):

| Column            | Type              | Constraints                                            |
| ----------------- | ----------------- | ------------------------------------------------------ |
| `id`              | `int`             | Primary key, auto-increment                            |
| `vendor_id`       | `int`             | FK → `vendors.id` (RESTRICT), indexed, required        |
| `contract_number` | `varchar(30)`     | Unique (case-insensitive), required                    |
| `title`           | `varchar(255)`    | Required                                               |
| `description`     | `text`            | Optional                                               |
| `contract_value`  | `decimal(18,2)`   | Required, `>= 0` (DB check constraint)                 |
| `start_date`      | `date`            | Required                                               |
| `end_date`        | `date`            | Required, `>= start_date` (DB check constraint)        |
| `status`          | `enum`            | Server default `DRAFT`                                 |
| `is_active`       | `boolean`         | Default `true` (soft deactivation)                     |
| `created_at`      | `datetime`        | Server default `now()`                                 |
| `updated_at`      | `datetime`        | Server default `now()`, auto-updated                   |

The enum is stored as a string-backed Python value (`native_enum=False`,
`length=32`), mirroring the `vendors.status` design.

### Vendor relationship

- `Contract.vendor` — many-to-one; every contract references one vendor.
- `Vendor.contracts` — one-to-many back-reference.
- `ON DELETE RESTRICT` at the database level, so a vendor with contracts cannot
  be removed while contracts reference it (VendorIQ never deletes vendors
  anyway — it deactivates them).

### Migration

- Revision `2094b0b9e149` — `create contracts table`
- Chains from Phase 2 head `a90fb159e9aa`
- Includes server defaults, the two check constraints, the unique
  `contract_number`, and the `ix_contracts_vendor_id` index.

## Contract statuses

| Enum value | Label     | Meaning                                                    |
| ---------- | --------- | ---------------------------------------------------------- |
| `DRAFT`    | Draft     | Being prepared; not yet in force (server default)          |
| `ACTIVE`   | Active    | In force                                                   |
| `COMPLETED`| Completed | Fulfilled / closed out successfully                        |
| `ON_HOLD`  | On Hold   | Execution suspended temporarily                            |
| `CANCELLED`| Cancelled | Terminated before completion                               |
| `EXPIRED`  | Expired   | Past or voided end date                                    |

Status transitions are **manual only**. The backend never applies automatic
status changes (for example, it does not auto-move records to `EXPIRED` when
`end_date` passes). A status can be set to any of the six values by an
authorized role.

## Validation rules

| Rule                                   | HTTP code | Enforcement point                   |
| -------------------------------------- | --------- | ----------------------------------- |
| `contract_value` negative              | 422       | Schema (`ge=0`) + DB check          |
| `end_date < start_date` (create)       | 422       | Schema model validator + DB check   |
| `end_date < start_date` (partial patch)| 422       | Endpoint (validates merged result)  |
| Duplicate `contract_number`            | 409       | Pre-check + `IntegrityError`        |
| Invalid `vendor_id`                    | 404       | Endpoint lookup                     |
| Empty `title` / `contract_number`      | 422       | Endpoint + DB `NOT NULL`            |
| `contract_number` normalization        | —         | Stripped and uppercased before save |
| Unknown sort field                     | 422       | `Literal` type on the query param   |

`contract_value` and `total_contract_value` are serialized as exact decimal
strings (e.g. `"250000.00"`) to avoid floating-point precision loss.

## API endpoints

All endpoints live under `/api/v1/contracts` and require a valid Bearer token.

| Method | Path                            | Roles (mutation)  | Notes                                   |
| ------ | ------------------------------- | ----------------- | --------------------------------------- |
| GET    | `/api/v1/contracts`             | all authenticated | Paginated list with query params        |
| POST   | `/api/v1/contracts`             | Admin, VM, PM     | Create (default status `DRAFT`, `201`)  |
| GET    | `/api/v1/contracts/statistics`  | all authenticated | Counts per status + total contract value|
| GET    | `/api/v1/contracts/{id}`        | all authenticated | Detail incl. nested vendor summary      |
| PATCH  | `/api/v1/contracts/{id}`        | Admin, VM, PM     | Partial update                          |
| PATCH  | `/api/v1/contracts/{id}/status` | Admin, VM, PM     | Change status only                      |
| DELETE | *(not implemented)*             | —                 | Returns `405`                           |

### List query parameters

`page` (≥1), `page_size` (1–100), `search` (case-insensitive `contract_number`
and `title`), `vendor_id`, `status`, `is_active`, `sort_by`, `sort_order`.

Sort fields: `contract_number`, `title`, `contract_value`, `start_date`,
`end_date`, `status`, `created_at`, `updated_at`. Default: `created_at DESC`.

Response shape (matches the vendor list convention):

```json
{
  "items": [...],
  "total": 10,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

### Statistics response

```json
{
  "total_contracts": 10,
  "active_contracts": 4,
  "draft_contracts": 2,
  "completed_contracts": 1,
  "on_hold_contracts": 1,
  "cancelled_contracts": 1,
  "expired_contracts": 1,
  "total_contract_value": "2500000.00"
}
```

## RBAC matrix

| Role                   | List/Detail/Stats | Create | Edit | Status change |
| ---------------------- | ----------------- | ------ | ---- | ------------- |
| Admin                  | ✓                 | ✓      | ✓    | ✓             |
| Vendor Manager         | ✓                 | ✓      | ✓    | ✓             |
| Procurement Manager    | ✓                 | ✓      | ✓    | ✓             |
| Project Manager        | ✓                 | ✗      | ✗    | ✗             |
| Analyst                | ✓                 | ✗      | ✗    | ✗             |

Access restricted via `require_roles("Admin", "Vendor Manager", "Procurement
Manager")`; the 403 response is `"You do not have permission to perform this
action"`, consistent with earlier phases.

## Frontend

New routes:

- `/contracts` — directory (stats strip, search, vendor/status/activity filters,
  sortable table, pagination, empty/error states)
- `/contracts/new` — create form
- `/contracts/:contractId` — detail page
- `/contracts/:contractId/edit` — edit form

New files:

- `src/pages/contracts/{ContractsPage,ContractFormPage,ContractDetailPage}.tsx`
- `src/components/contracts/{ContractForm,ContractStatusBadge}.tsx`
- `src/services/api/contracts.ts`
- `src/utils/format.ts` (`formatCurrency`, `formatDate`)

Changed files:

- `src/types/index.ts` — contract types
- `src/utils/permissions.ts` — `CONTRACT_STATUSES`, `CONTRACT_STATUS_LABELS`,
  `canManageContracts`, `canManageContractStatus`
- `src/components/layout/navigation.ts` + `Sidebar.tsx` — new **Operations**
  group containing **Contracts**
- `src/routes/index.tsx` — contract routes
- `src/components/common/Pagination.tsx` — optional `label` prop
  (`Showing X–Y of Z {label}`)

UX notes:

- The stats strip is intentionally compact: Total, Active, Completed, On Hold,
  and Total Contract Value (formatted with `en-IN` INR currency formatting).
- Search placeholder: “Search by contract number or title…”.
- Empty state message: “Create your first vendor contract to begin tracking
  contractual engagements.”
- The form has two sections — **Contract Information** (vendor dropdown, number,
  title, description, value, status) and **Contract Period** (start/end dates)
  — with client-side guards for non-negative value and `end >= start`.
- If no vendors exist, the create form shows “No vendors are available. Create a
  vendor before creating a contract.” and links to add one.
- Contract controls (create/edit/status) are hidden for roles that lack
  permission, and the backend enforces the same rules.

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
```

## Test results

The Phase 5A backend suite (`test_phase5a.py`) covers auth requirements,
RBAC matrix per role, create/list/detail/update/status, pagination, search,
all filters, sort order (including `422` on unknown sort fields), statistics
correctness, Decimal serialization, duplicate-number `409`, invalid-vendor
`404`, negative-value `422`, end/start date-range `422` (partial patches
included), and DELETE `405`.

Result: **55/55 passed**. `alembic check` reports no schema drift, and the
suite cleans up after itself (contracts, vendors, categories, test users).

Frontend checks: `npx oxlint src` → **0 warnings / 0 errors**,
`npx tsc -b --noEmit` → clean, `npm run build` → clean.

## Known limitations

- No contract documents/attachments, renewal dates, or auto-numbering.
- `EXPIRED` is not set automatically when `end_date` passes.
- The vendor filter dropdown loads the first 100 vendors; larger directories
  would need server-side searchable selects (future).
- Contract value does not aggregate any purchase orders (none exist yet).
- No way to physically delete contracts (by design).

## Issues encountered

- FastAPI 0.141's lazy router defers route registration until the app starts,
  so module-level route inspection shows nothing — tests therefore exercise the
  app through `TestClient` (the same approach as Phase 4).
- Pydantic v2 serializes `Decimal` as a string in JSON mode; the frontend
  formats values with `formatCurrency`, keeping money exact rather than
  rounding through floats.
- A DB `CheckConstraint` for `end_date >= start_date` was added to the model and
  is present in the migration to keep the invariant at the database level too.

## Future integration

The `contracts` table is designed to anchor future operational phases:
- **Purchase Orders** will link to contracts (`contract_id` FK) and will also
  face the same status/statistics conventions.
- Delivery tracking and quality evaluations will reference the purchase order
  and vendor as they land.
- Performance scoring, reporting, and analytics will be able to aggregate
  `contract_value` and status history.