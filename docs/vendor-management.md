# Vendor Management — Module Documentation (Phase 4)

This document describes the Vendor Management module built in Phase 4. It is
part of the VendorIQ monorepo (`frontend/`, `backend/`, `docs/`).

---

## Overview

The module manages an organization's vendor base through its complete
lifecycle — from initial onboarding (`PENDING`) through active use to
termination. Vendors are grouped into *vendor categories* for organization and
filtering.

Implementation principles:

- **Backend is authoritative.** Every route enforces authentication
  (`get_current_user`) and role checks (`require_roles`) from
  `backend/app/dependencies/auth.py`.
- **No destructive deletes.** Vendors and categories are deactivated via
  `is_active = false`. Categories also have an active/inactive state.
- **Existing schema only.** The module uses the Phase 2 `vendors` and
  `vendor_categories` tables. No new tables and no new migrations were
  required (`alembic check` reports no pending changes).

---

## Vendor lifecycle

A vendor moves through these statuses (`backend/app/models/enums.py`):

| Status         | Meaning                                                     |
| -------------- | ----------------------------------------------------------- |
| `PENDING`      | Onboarding; the default when a vendor is created.           |
| `ACTIVE`       | Approved and currently doing business.                      |
| `UNDER_REVIEW` | Being evaluated (e.g. due diligence or re-review).          |
| `SUSPENDED`    | Temporarily stopped from transacting.                       |
| `TERMINATED`   | Permanently ended.                                          |

`is_active` is an additional soft-deactivation flag. An inactive vendor keeps
its status but is marked "Inactive" in the UI and can be filtered out via
`is_active=false`.

> Vendors are never deleted. To remove them from active use, either set
> `is_active=false` (for a vendor you may bring back) or move the status to
> `TERMINATED`.

---

## API endpoints

Base path: `/api/v1`. All endpoints except `POST /auth/login` require a valid
`Authorization: Bearer <token>` header.

### Vendors

| Method | Path                        | Roles                       | Notes                                                        |
| ------ | --------------------------- | --------------------------- | ------------------------------------------------------------ |
| GET    | `/vendors`                  | Any user                    | Paginated list; see query params below.                      |
| POST   | `/vendors`                  | Admin, Vendor Manager, Procurement Manager | Creates a vendor; defaults `status=PENDING`.       |
| GET    | `/vendors/statistics`       | Any user                    | Per-status counts + `inactive_vendors`.                      |
| GET    | `/vendors/{id}`             | Any user                    | Full detail. 404 `Vendor not found`.                         |
| PATCH  | `/vendors/{id}`             | Admin, Vendor Manager, Procurement Manager | Partial update (any allowed field, incl. status). |
| PATCH  | `/vendors/{id}/status`      | Admin, Vendor Manager       | Status change + optional `is_active`.                        |

`GET /vendors` query parameters:

| Parameter     | Values                                                | Default             |
| ------------- | ----------------------------------------------------- | ------------------- |
| `page`        | `>= 1`                                                | `1`                 |
| `page_size`   | `1–100`                                               | `10`                |
| `search`      | free text matched against `company_name`, `vendor_code`, `contact_person`, `email` (case-insensitive) | — |
| `category_id` | category id                                           | —                   |
| `status`      | one of `PENDING/ACTIVE/UNDER_REVIEW/SUSPENDED/TERMINATED` | —               |
| `is_active`   | `true` / `false`                                      | —                   |
| `sort_by`     | `company_name`, `vendor_code`, `status`, `created_at`, `updated_at` | `company_name` |
| `sort_order`  | `asc` / `desc`                                        | `asc`               |

Response shape: `{ items: [vendor], total, page, page_size, total_pages }`.
Unknown `sort_by` values or invalid literals return `422`.

### Vendor categories

| Method | Path                              | Roles                 | Notes                                          |
| ------ | --------------------------------- | --------------------- | ---------------------------------------------- |
| GET    | `/vendor-categories`              | Any user              | List sorted by name; each row includes `vendor_count`. `include_inactive=true` to include inactive categories. |
| POST   | `/vendor-categories`              | Admin, Vendor Manager | Create; 409 `Category name already exists` on duplicates. |
| PATCH  | `/vendor-categories/{id}`         | Admin, Vendor Manager | Rename / update description / toggle `is_active`. |

Category names are matched case-insensitively for uniqueness. Categories are
soft-deactivated; there is **no delete endpoint**.

### Validation rules

- `vendor_code` is trimmed and uppercased; unique (409 `Vendor code already
  exists`).
- `website` must start with `http://` or `https://` (422 otherwise).
- `category_id` must reference an existing category (404
  `Vendor category not found`).
- `email` is a valid email address; lowercased on write.

---

## RBAC matrix

| Operation                          | Admin | Vendor Manager | Procurement Manager | Project Manager | Analyst |
| ---------------------------------- | :---: | :------------: | :-----------------: | :-------------: | :-----: |
| List / read vendors                |  ✓   |       ✓        |          ✓          |        ✓        |    ✓    |
| Vendor statistics                  |  ✓   |       ✓        |          ✓          |        ✓        |    ✓    |
| List / read categories             |  ✓   |       ✓        |          ✓          |        ✓        |    ✓    |
| Create / edit vendor               |  ✓   |       ✓        |          ✓          |       ✗         |    ✗    |
| Change vendor status / deactivate  |  ✓   |       ✓        |          ✗          |       ✗         |    ✗    |
| Create / edit categories           |  ✓   |       ✓        |          ✗          |       ✗         |    ✗    |

Denied mutations return `403 {"detail": "You do not have permission to perform
this action"}`.

---

## Database changes

No schema changes were made in Phase 4. The module relies on tables created in
Phase 2 (`roles`, `users`, `vendor_categories`, `vendors`). New Pydantic
schemas map directly onto the existing ORM models:

- `backend/app/schemas/vendor.py` — `VendorBase`, `VendorCreate`,
  `VendorUpdate`, `VendorStatusUpdate`, `VendorCategorySummary`,
  `VendorListResponse`, `VendorDetailResponse`, `PaginatedVendors`,
  `VendorStatistics`
- `backend/app/schemas/vendor_category.py` — `VendorCategoryCreate`,
  `VendorCategoryUpdate`, `VendorCategoryResponse`, `VendorCategoryWithCount`

Run `alembic check` from `backend/` to confirm no new migrations are pending.

---

## New backend files

```text
backend/app/
├── api/v1/
│   ├── endpoints/
│   │   ├── vendors.py                # vendor CRUD + list + statistics
│   │   └── vendor_categories.py      # category list / create / update
│   └── router.py                     # registers both routers
└── schemas/
    ├── vendor.py
    └── vendor_category.py
```

`backend/app/main.py` was adjusted so the custom 404 handler preserves the
specific detail of raised `HTTPException(404)` responses (e.g.
`Vendor not found`) while still returning `Resource not found` for unmatched
routes.

---

## New frontend files

```text
frontend/src/
├── types/index.ts                      # Vendor/VendorCategory types added
├── services/api/
│   ├── vendors.ts                      # list/get/create/update/updateStatus/statistics
│   └── vendorCategories.ts             # list/create/update
├── components/common/
│   ├── toast-context.ts                # useToast hook + context
│   ├── ToastProvider.tsx               # toast host (success/error/info)
│   ├── Pagination.tsx
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   └── Modal.tsx
├── components/vendors/
│   ├── VendorStatusBadge.tsx           # status pill incl. inactive state
│   └── VendorForm.tsx                  # shared create/edit form
├── utils/permissions.ts                # role checks + status constants
└── pages/vendors/
    ├── VendorListPage.tsx              # stats strip, search/filters, table, pagination
    ├── VendorFormPage.tsx              # add + edit routes
    ├── VendorDetailPage.tsx            # overview/contact/address/system + status modal
    └── VendorCategoriesPage.tsx        # list/create/edit categories
```

Routes added (`frontend/src/routes/index.tsx`, all protected):

- `/vendors`
- `/vendors/new`
- `/vendors/:vendorId`
- `/vendors/:vendorId/edit`
- `/vendor-categories`

---

## Frontend UX notes

- The **Vendors** sidebar entry is now a ready module pointing to `/vendors`.
  The sidebar active state highlights the current module for all sub-routes.
- The list page shows a live statistics strip, a debounced search box, and
  category / status / activity filters that reset pagination.
- Add / Edit forms validate required fields and the `website` scheme on the
  client and report backend errors via toasts. `vendor_code` is locked after
  creation.
- The vendor detail page is read-only for Project Managers and Analysts; the
  Edit and Change Status controls only render for allowed roles.
- The status change modal is restricted to Admin and Vendor Manager.
- The **Vendor Performance** section shows the placeholder text
  *"Performance data will be available once vendor transactions and
  evaluations are recorded."* — no fake data is shown.

---

## Commands

Backend (from `backend/`):

```bash
python -m app.db.check_db          # verify DB connection
alembic check                      # confirm no pending migrations
alembic upgrade head               # apply migrations on a fresh setup
python -m app.scripts.seed_roles   # seed roles if not present
python -m app.scripts.create_initial_admin
uvicorn app.main:app --reload      # http://localhost:8000
```

Frontend (from `frontend/`):

```bash
npm install
npm run dev                        # http://localhost:5173
npm run lint                       # oxlint
npm run build                      # typecheck + production build
```

Interactive API docs: `http://localhost:8000/docs`.

---

## Test results

Phase 4 backend suite: **68/68 checks passed** (TestClient against a live
MySQL database), covering:

- 401 for every endpoint without a token
- role gates: create/edit vendors (`Admin`/`VM`/`PM` allowed; `Project
  Manager`/`Analyst` 403), status changes and category management (`Admin`/`VM`
  only)
- pagination bounds (`page >= 1`, `page_size <= 100`), shape, and empty pages
- search by company name / vendor code / contact / email (case-insensitive)
- filters: category, status, `is_active` combos
- sorting asc/desc and `422` for invalid literals
- duplicate vendor code `409`, duplicate category name `409`
- invalid category `404`, missing vendor `404`, `422` validation (email,
  website scheme, status literal)
- statistics totals, nested category payloads, status updates, deactivation

Frontend verification: `oxlint` 0 warnings/errors, `tsc -b` clean, `vite build`
clean, and live smoke tests of the API and dev-server routes (`/vendors`,
`/vendor-categories`).

---

## Known limitations

- No audit trail for who changed a vendor/status (audit logging is a planned
  phase).
- Category deactivation does not cascade to vendors; vendors keep their
  category reference and remain visible.
- `email` and text fields accept multi-byte characters (utf8mb4), but vendor
  contact data is not internationalized or normalized beyond trimming.
- The `useApi` hook exists but is not used by the new pages; data fetching uses
  explicit `.then()` chains to match the project's lint configuration.
- Test credentials (`admin@vendoriq.com`) are development-only.

## Issues encountered

- The app-level `@app.exception_handler(404)` overrode the specific detail of
  `HTTPException(404)` responses (e.g. `Vendor not found`). Fixed in
  `backend/app/main.py` by forwarding the exception detail when it differs from
  Starlette's default `Not Found`.
- MySQL `Lost connection` during a test run was caused by the `MySQL80` service
  being stopped (non-elevated shell cannot start services); restarted by the
  user — not a code issue.
- oxlint's `set-state-in-effect` rule rejects data-fetch helpers that call
  `setState` from within effects. The new pages follow the project's existing
  `.then()`-chain pattern already used by `AuthProvider`.

---

## Future integration

In later phases, vendor operations (orders, contracts, incidents) will
reference vendors by id, and the reserved **Vendor Performance** section on the
detail page will render scoring/analytics once real transaction and evaluation
data exists.