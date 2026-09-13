# Phase 10 — Enterprise UI/UX Polish

Phase 10 is a **frontend-only** phase. No backend endpoints, schemas, or
migrations changed — the design polish is served entirely by the existing
Phase 7/8/9 APIs.

## Goals

- Replace the developer-placeholder **Dashboard** with a real,
  data-driven **Vendor Intelligence Overview**.
- Introduce a lightweight **design system** of reusable common components so
  every screen shares consistent cards, KPIs, loaders, and empty states.
- Restructure **navigation** into capability groups and add **route-aware
  breadcrumbs** to the topbar.
- Surface **decision intelligence** where it matters most: the vendor
  directory and the vendor profile.

## What changed

### Dashboard rebuild (`/dashboard`)

The old "Module Status + Roadmap" placeholder was removed. The dashboard now
aggregates the analytics overview, risk statistics, vendor statistics, contract
statistics, and purchase-order statistics into a single view:

- **8 KPI cards** — Total Vendors (active count), Active Contracts (total
  value), Avg Performance Score (period change), Requiring Attention, Open
  Incidents (overdue), On-Time Delivery % (delayed count), Delayed Deliveries,
  Average Risk Score (high/critical counts). Each KPI deep-links to its module.
- **Vendor Health** — stacked performance-classification distribution bar.
- **Predictive Risk Distribution** — stacked risk-level bar (Very Low →
  Critical).
- **At a Glance** — the rule-based insights from the analytics overview with
  kind-based icons (positive / watch / warning / info).
- **Top Performing Vendors** — top 5 from the vendor ranking with
  classification glyphs and score.
- **Delivery Snapshot** — on-time / delayed / pending / avg delay plus average
  quality score bar.
- **Quick Access** — tiled links into vendors, risk center, performance engine,
  and analytics.
- Time-aware greeting (`Good morning/afternoon/evening, <first name>`) and a
  full loading skeleton + error retry state.

### Design system (`components/common`)

New reusable components (each typed, self-contained, Tailwind 4):

| Component | Purpose |
| --- | --- |
| `Card` | Cards with optional header/subtitle/actions |
| `StatCard` | KPI card with label, value, icon accent, hint |
| `PageLoader` | Centered full-page loading spinner |
| `TableSkeleton` | Animated skeleton rows for list tables |
| `ConfirmDialog` | Modal confirm wrapper (danger/primary) |
| `Breadcrumbs` | Route-aware breadcrumb navigation |

`index.css` was extended with:

- Custom scrollbars, refined `::selection`, antialiasing.
- Skeleton pulse keyframes + `animate-skeleton`.
- `@layer components` utilities: `iq-card`, `iq-card-elevated`,
  `iq-table-header`, `iq-row-hover`.
- Tailwind 4 `@theme` brand tokens (`brand-*` indigo family).

### Layout

- **Navigation** — restructured into 5 capability groups: Overview /
  Vendor Management / Procurement / Performance Data / System, with planned
  items visibly flagged "Soon".
- **Sidebar** — grouped nav, gradient logo tile, "Soon" chips for planned
  items, updated footer with version + value statement.
- **Topbar** — the non-functional global search input was removed and replaced
  with **route-aware breadcrumbs** (e.g. *Vendors › Vendor Profile*); the user
  menu gained a "Go to Dashboard" action and improved styling.
- **AppLayout** — content now sits in a centered `max-w-7xl` container so
  screens no longer stretch edge-to-edge on wide displays.

### Vendor directory (`/vendors`)

- New **Performance** and **Risk** columns: each vendor now shows its
  performance classification badge and predictive risk-level badge, fetched
  via the Phase 7/9 list APIs and cross-referenced by `vendor_id`.
- Loading state upgraded from spinner to `TableSkeleton`.

### Vendor profile (`/vendors/:id`)

A new **intelligence strip** sits directly under the page header and shows, at
a glance, without scrolling:

- **Performance** — overall score + classification badge + score bar.
- **Predictive Risk** — risk score (color-graded), level badge, trend.
- **Contracts & Orders** — active contracts, active orders, delayed
  deliveries.
- **Decision** — a rule-derived verdict with tone:
  - `CRITICAL` risk or classification → **Critical review** (red)
  - `HIGH` risk or `POOR` classification → **Priority review** (orange)
  - `MEDIUM` risk or `AVERAGE` classification → **Monitor** (amber)
  - otherwise (enough data) → **Healthy partner** (green)
  - insufficient data → **Insufficient data** (neutral)

### Risk Center (`/vendor-risk`)

- Stat cards upgraded to the shared `StatCard` component with icons and
  semantic accents.
- High-risk / critical-risk rows now carry a red left border + tint so at-risk
  vendors leap out.
- Loading state upgraded to `TableSkeleton`.

### Consistency pass (all stack pages)

- `TableSkeleton` loader on vendor, contract, purchase-order, quality
  evaluation, incident, performance, risk, and category list tables.
- Analytics KPI grid gained a "How to read this" guidance line that explains
  how to combine score, attention count, and change direction.
- All previously bespoke HTML tables now share the `iq-table-header` /
  `iq-row-hover` styling tokens for a uniform look.

## Frontend quality gates

```bash
cd frontend
npx tsc -b          # type-check
npm run lint        # oxlint (0 warnings / 0 errors)
npm run build       # tsc -b && vite build
```

## Backend

Unchanged. Alembic head remains `d4a7d31923b9`. This phase touches no Python
code, no schema, and no API contracts.