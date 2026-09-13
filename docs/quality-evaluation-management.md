# Quality Evaluation Management — Phase 6A

This document describes the Phase 6A **Quality Evaluation Management** module
for VendorIQ. It builds on the vendor, contract, and purchase order modules
and introduces a new `quality_evaluations` table for recording the quality of
products and services delivered by vendors.

---

## Scope

**In scope**

- A `quality_evaluations` table with strict data integrity rules
- CRUD API (create / read / update — no delete) plus statistics
- A vendor-level quality summary endpoint
- Professional frontend module (directory, add/edit form, detail page)
- Vendor profile integration via a Quality Summary section
- Strict validation: quality score / status consistency, defect counts,
  and contract / purchase order relationship integrity
- Role-based access control

**Out of scope (by design)**

- Incident management, complaints, and reviews
- Vendor performance scores, rankings, or risk scores
- Analytics dashboards, charts, and recommendations
- Machine learning and AI features
- Deleting quality evaluations (records are never deleted)

---

## Data Model

### Table: `quality_evaluations`

| Column              | Type            | Nullable | Default | Notes                                        |
| ------------------- | --------------- | -------- | ------- | -------------------------------------------- |
| `id`                | BigInteger      | No       | PK      | Auto-increment primary key                   |
| `vendor_id`         | BigInteger (FK) | No       | —       | `vendors.id`, `RESTRICT`, indexed            |
| `contract_id`       | BigInteger (FK) | Yes      | —       | `contracts.id`, `RESTRICT`, indexed          |
| `purchase_order_id` | BigInteger (FK) | Yes      | —       | `purchase_orders.id`, `RESTRICT`, indexed    |
| `evaluation_date`   | Date            | No       | —       | Date the evaluation was performed            |
| `quality_score`     | Integer         | No       | —       | 0–100 (checked)                              |
| `defect_count`      | Integer         | No       | 0       | Non-negative (checked)                       |
| `total_items`       | Integer         | No       | 0       | Non-negative (checked)                       |
| `quality_status`    | Enum/String     | No       | —       | `EXCELLENT`, `GOOD`, `ACCEPTABLE`, `POOR`, `CRITICAL` |
| `comments`          | Text            | Yes      | —       | Free-form observations                       |
| `created_by`        | BigInteger (FK) | No       | —       | `users.id`, `RESTRICT`, indexed, always the authenticated user |
| `created_at`        | DateTime        | No       | `now()` | Timestamp mixin                              |
| `updated_at`        | DateTime        | No       | `now()` | Timestamp mixin                              |

### Relationships

- `vendor` → the vendor being evaluated (required)
- `contract` → optional linked contract
- `purchase_order` → optional linked purchase order
- `created_by_user` → the user who recorded the evaluation (exposed as
  `evaluator` in API responses)
- Back-references added to `Vendor`, `Contract`, `PurchaseOrder`, and `User`

### Check constraints

- `ck_quality_evaluations_score_range`: `quality_score BETWEEN 0 AND 100`
- `ck_quality_evaluations_defect_count_non_negative`: `defect_count >= 0`
- `ck_quality_evaluations_total_items_non_negative`: `total_items >= 0`
- `ck_quality_evaluations_defects_within_items`:
  `total_items = 0 OR total_items >= defect_count`

### Migration

- Revision `160ca8129b1f` — create quality evaluations table
- Down-revision: `c5fd64a31ba7` (Phase 5B)

---

## Quality Score & Status

The quality status is **explicitly selected by the user** (never computed) but
must be consistent with the recorded score:

| Status      | Score range |
| ----------- | ----------- |
| `EXCELLENT` | 90–100      |
| `GOOD`      | 75–89       |
| `ACCEPTABLE`| 60–74       |
| `POOR`      | 40–59       |
| `CRITICAL`  | 0–39        |

A status/score pair that does not match is rejected with HTTP 422 and the
message **"The selected quality status does not match the quality score."**

The helper `expected_quality_status(score)` in
`app/schemas/quality_evaluation.py` documents the mapping and is used by the
frontend form hints.

---

## Validation Rules

1. **Vendor is required** (422 `"Vendor is required"`); a missing vendor is 404
   `"Vendor not found"`.
2. **Contract exists and belongs to the vendor** — 404 `"Contract not found"`
   or 422 `"The selected contract does not belong to the selected vendor."`
3. **Purchase order exists and belongs to the vendor** — 404
   `"Purchase order not found"` or 422
   `"The selected purchase order does not belong to the selected vendor."`
4. **Purchase order contract match** — if a purchase order has a linked
   contract, it must match the selected contract; otherwise 422
   `"The selected purchase order is linked to a different contract."`
5. **Score range** — `quality_score` must be an integer 0–100.
6. **Defect/total counts** — non-negative integers; when `total_items > 0`,
   `defect_count` must not exceed `total_items` (422
   `"defect_count must not exceed total_items"`).
7. **Status consistency** — see the score table above.
8. **`created_by` is never client-supplied** — always set to the authenticated
   user's id by the backend.

For updates, the full **merged state** (existing fields + provided fields) is
validated, so partial updates cannot introduce an inconsistent record (e.g.
changing only the vendor while keeping a contract of the old vendor).

---

## API Endpoints

| Method | Path                                        | Roles                                  | Description |
| ------ | ------------------------------------------- | -------------------------------------- | ----------- |
| GET    | `/api/v1/quality-evaluations`               | Any authenticated user                 | Paginated list with search/filter/sort |
| GET    | `/api/v1/quality-evaluations/statistics`    | Any authenticated user                 | Per-status counts, average score, total defects |
| GET    | `/api/v1/quality-evaluations/{evaluation_id}` | Any authenticated user               | Evaluation detail |
| POST   | `/api/v1/quality-evaluations`               | Admin, Vendor Manager, Procurement Manager, Project Manager | Create |
| PATCH  | `/api/v1/quality-evaluations/{evaluation_id}` | Admin, Vendor Manager, Procurement Manager, Project Manager | Update (partial) |
| DELETE | `/api/v1/quality-evaluations/{evaluation_id}` | —                                    | Not allowed (405) |
| GET    | `/api/v1/vendors/{vendor_id}/quality-summary` | Any authenticated user              | Vendor-level quality summary |

### Query parameters (list endpoint)

- `page`, `page_size`
- `search` — searches the `comments` text
- `vendor_id`, `contract_id`, `purchase_order_id`, `quality_status` — filters
- `sort_by` — one of `evaluation_date`, `quality_score`, `defect_count`,
  `total_items`, `quality_status`, `created_at`, `updated_at`
- `sort_order` — `asc` or `desc`

### Statistics payload

```json
{
  "total_evaluations": 5,
  "excellent": 1,
  "good": 1,
  "acceptable": 1,
  "poor": 1,
  "critical": 1,
  "average_quality_score": 62.0,
  "total_defects": 7
}
```

### Vendor quality summary payload

```json
{
  "vendor_id": 44,
  "total_evaluations": 5,
  "average_quality_score": 67.4,
  "excellent_evaluations": 2,
  "good_evaluations": 1,
  "acceptable_evaluations": 0,
  "poor_evaluations": 1,
  "critical_evaluations": 1,
  "total_defects": 12
}
```

When a vendor has no evaluations, `average_quality_score` is `null` and all
counts are zero.

---

## Role-Based Access Control

| Capability            | Admin | Vendor Manager | Procurement Manager | Project Manager | Analyst |
| --------------------- | :---: | :------------: | :-----------------: | :-------------: | :-----: |
| View evaluations      | Yes   | Yes            | Yes                 | Yes             | Yes     |
| View statistics       | Yes   | Yes            | Yes                 | Yes             | Yes     |
| View quality summary  | Yes   | Yes            | Yes                 | Yes             | Yes     |
| Create evaluation     | Yes   | Yes            | Yes                 | Yes             | No      |
| Edit evaluation       | Yes   | Yes            | Yes                 | Yes             | No      |

Unlike contracts and purchase orders, the **Project Manager** may create and
edit quality evaluations. Unauthorized mutations return HTTP 403 with the
standard message **"You do not have permission to perform this action."**

---

## Frontend

### Pages

- `/quality-evaluations` — quality evaluations directory
- `/quality-evaluations/new` — record a new evaluation
- `/quality-evaluations/:evaluationId` — evaluation detail
- `/quality-evaluations/:evaluationId/edit` — edit an evaluation

### Directory page

- Stats strip: **Total Evaluations**, **Average Quality Score**, **Excellent**,
  **Poor + Critical**, **Total Defects**
- Search box (placeholder: `Search quality evaluations...`), vendor filter,
  and quality status filter
- Sortable table columns: quality score, quality status, evaluation date,
  plus reference, vendor, defect/total, and actions
- **Reference** column: purchase order number → contract number →
  `General Evaluation`
- Empty state: title `No quality evaluations found`, message `Record a
  quality evaluation to begin monitoring vendor quality performance.`
- Add/Edit buttons shown only to authorized roles
- Responsive layout and pagination consistent with other modules

### Add/Edit form

Three sections:

1. **Evaluation Context** — vendor (required), optional contract and purchase
   order. The contract and purchase order dropdowns are disabled until a vendor
   is selected; both are loaded vendor-scoped, and purchase orders are further
   filtered to the selected contract, so submissions never trip backend
   relationship validation.
2. **Quality Assessment** — evaluation date, quality score (`92 / 100`
   display with score range hint 0–100), explicit quality status select with
   its score band hint, defect count, and total items.
3. **Observations** — free-form comments.

Client-side validation mirrors the backend: score 0–100, non-negative defect
and total counts, `defect_count <= total_items` when items are counted, and
status/score consistency.

### Detail page

- Summary card (score, status, date, recorded by, defects)
- Observations
- Vendor card with link to the vendor profile
- Purchase order or contract card when linked
- System information and assessment/reference side cards
- Edit button gated by role

### Vendor detail page

A **Quality Summary** section displays real data from
`/api/v1/vendors/{id}/quality-summary`: total evaluations, average quality
score, defect count, Excellent / Good / Poor + Critical tallies, and a quick
link to the vendor-scoped evaluations directory. This is data (not a
calculated performance score).

---

## Files

### Backend

- `app/models/enums.py` — `QualityStatus` enum
- `app/models/quality_evaluation.py` — ORM model + relationships/constraints
- `app/models/__init__.py` — exports
- `app/models/vendor.py`, `contract.py`, `purchase_order.py`, `user.py` —
  back-reference relationships
- `app/schemas/quality_evaluation.py` — schemas + validation helpers
- `app/schemas/__init__.py` — exports
- `app/api/v1/endpoints/quality_evaluations.py` — quality evaluations API
- `app/api/v1/endpoints/vendor_quality.py` — vendor quality summary API
- `app/api/v1/router.py` — router registration
- `alembic/versions/160ca8129b1f_create_quality_evaluations_table.py`

### Frontend

- `src/types/index.ts` — module types
- `src/services/api/qualityEvaluations.ts` — API service
- `src/services/api/index.ts` — service exports
- `src/utils/permissions.ts` — status lists/labels + `canManageQualityEvaluations`
- `src/utils/quality.ts` — `expectedQualityStatus` helper
- `src/components/quality-evaluations/QualityStatusBadge.tsx`
- `src/components/quality-evaluations/QualityEvaluationForm.tsx`
- `src/pages/quality-evaluations/QualityEvaluationsPage.tsx`
- `src/pages/quality-evaluations/QualityEvaluationFormPage.tsx`
- `src/pages/quality-evaluations/QualityEvaluationDetailPage.tsx`
- `src/routes/index.tsx` — routes
- `src/components/layout/navigation.ts` — `Performance Data` nav group
- `src/components/layout/Sidebar.tsx` — phase footer
- `src/pages/vendors/VendorDetailPage.tsx` — Quality Summary section

---

## Testing

- `test_phase6a.py` — 49 tests covering schema/foreign keys/constraints/
  indexes, alembic head, status-consistency valid and invalid pairs, defect
  validation, relationship validation, filters/search/sorting/pagination,
  statistics, vendor quality summary (empty and populated), RBAC (Analyst
  read-only, Project Manager and all editor roles allowed), and update merge
  semantics.
- Phase 6A + Phase 5B + Phase 4/5A regression suites all pass (the Phase 6A
  suite is additive; existing suites remain intact).