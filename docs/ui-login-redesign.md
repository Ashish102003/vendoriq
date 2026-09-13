# VendorIQ — UI Redesign Part 1: Premium Animated Login with Live Laptop Preview

**Scope:** Login page only. Left half shows a **CSS-built premium laptop mockup**
running a continuously animated VendorIQ intelligence dashboard *inside its
screen*; right half is a clean sign-in panel. No backend, database, or
authentication-API changes — the existing auth flow (token issuance,
`/api/v1/auth/login`, `/api/v1/auth/me`, route guards, RBAC, redirects) is
preserved untouched.

## 1. Design direction

| Aspect | Decision |
| --- | --- |
| Base | Deep navy (`#0b1220` / `#0d1526`), dark slate surfaces |
| Accent | Indigo / electric blue, subtle teal positives, amber warnings, coral risk |
| Layout (desktop) | Split screen — left ≈ 62% visual area, right ≈ 38% sign-in |
| Left composition | Headline block (upper-middle/central-left) + laptop centerpiece shifted rightward, insight below |
| Layout (tablet) | Laptop + headline kept, reduced; sits above the form |
| Layout (mobile) | Stacked: brand → headline → smaller laptop → form |
| Hero device | HTML/CSS laptop with thin bezels, rounded corners, angled base, float |
| Motion | Continuous bars, travelling data dots, rotating donut ring, fading insight |
| Accessibility | `prefers-reduced-motion` freezes all motion; focus rings; `aria-live` |

## 2. Left side — laptop mockup (`LaptopPreview.tsx`)

Built entirely with HTML/CSS (no images, no canvas):

- Metal-look screen bezel (metallic gradient), thin inner recess with rounded
  corners, webcam dot, and a lowercase bottom-bezel wordmark.
- Hinge seam + angled base using `clip-path` trapezoid + soft grounding shadow.
- Gentle perspective: `transform: perspective(1600px) rotateX(2.5deg)`.
- Very slow float: `iq-float` keyframe (`translateY(0 → -6px → 0)` over 7 s).
- Soft indigo product glow behind the device (subtle, drifting).

## 3. Dashboard inside the screen (`IntelligenceDashboard.tsx`)

A compact, real-software-looking interface (aspect 16:10):

- **Mini app header** — `[Shield] VendorIQ` + pulsing `LIVE INTELLIGENCE`.
- **Performance tile** — `AnimatedBarChart`: 8 bars that continuously breathe
  between their base height and a shorter height via CSS keyframes using a
  `--bar-h` custom property, each with different duration/delay (no abrupt jumps).
- **Risk tile** — `AnimatedRiskDonut`: slowly rotating dashed outer ring, a
  score arc, pulsing halo, and a center score that changes slowly within the
  message cycle (e.g. 28 → 35 → 29 → 31 → 36).
- **Delivery tile** — `AnimatedDeliveryLine`: node line with a data particle
  travelling along it (`iq-travel`, ~4.6 s loop), 82% read-out.
- **Live activity strip** — PERF / DELIVERY / RISK nodes with a dot slowly
  travelling through the connections; the active node colours up.

## 4. Rotating live-intelligence message (`RotatingInsight.tsx`, `insights.ts`)

- Five messages rotate every ~5 s, each mapped to a dashboard focus so the
  message and the chart it describes move together:

  | Focus → highlighted visual | Message |
  | --- | --- |
  | Performance | 🟢 3 vendors exceeding expectations |
  | Delivery | 🟠 Delivery performance requires attention |
  | Performance | 🔵 Vendor analysis updated |
  | Delivery | 🟢 Operational health remains stable |
  | Risk | 🔴 1 vendor identified with elevated risk |

- Transition: `iq-insight-cycle` keyframe — fade in → hold → fade out (≈4.7 s),
  one message at a time, static "LIVE INTELLIGENCE" label always visible.
- `role="status"` / `aria-live="polite"` for screen readers.

## 5. State drive (`LoginVisual.tsx`)

- A single `setInterval` (~5.1 s) advances the insight index; cleaned up on
  unmount and paused entirely when `prefers-reduced-motion` is set (static frame).
- The current insight's `focus` highlights the matching dashboard tile, and
  `RISK_SCORES` drives the slow donut movement — the preview reads as if
  VendorIQ is actively processing data.
- No backend/API calls: all data is local.

## 6. Right side — login panel (`LoginForm.tsx`)

- Auth logic is byte-for-byte unchanged: `login()` → `navigate(from ?? '/dashboard', { replace: true })`,
  `isSubmitting` guard, `err.message` inline error panel, show/hide password.
- Dark integrated inputs (no white card), indigo focus ring + soft glow,
  subtle-gradient "Sign in →" button with smooth hover, loading spinner state,
  and a "Secure enterprise access" footnote.

## 7. Files

- **New** (`frontend/src/components/auth/`): `insights.ts`, `usePrefersReducedMotion.ts`,
  `AnimatedBarChart.tsx`, `AnimatedDeliveryLine.tsx`, `AnimatedRiskDonut.tsx`,
  `LaptopPreview.tsx`, `IntelligenceDashboard.tsx`, `RotatingInsight.tsx`,
  `LoginVisual.tsx`, `LoginForm.tsx`.
- **Modified**: `frontend/src/pages/LoginPage.tsx` (split-screen shell,
  page-level brand, mobile strip), `frontend/src/index.css` (laptop/bar/travel/
  risk-pulse/insight-cycle keyframes + device styles).
- **Removed**: the previous `frontend/src/components/login/` directory (floating-card design).

## 8. Verification

- `npm run build` (tsc + vite) — passes.
- `npm run lint` (oxlint) — 0 warnings, 0 errors.
- Auth still works end-to-end: valid demo login returns a token, `/auth/me`
  resolves, invalid credentials are rejected with 401.
- Visual checks listed in the task were reviewed against the CSS implementation;
  a final in-browser pass at `http://127.0.0.1:5173` was not automated.

## 9. Layout refinement (part 1 follow-up)

Rebalanced the left area without redesigning anything:

- **Headline restored** — "Vendor intelligence, simplified." with an
  "Realtime vendor insights" eyebrow and a one-line supporting paragraph now sit
  on the upper-middle / central-left, balancing the visual.
- **Laptop repositioned** — the centerpiece is now pushed significantly
  toward the center-right of the left section instead of hugging it, so the
  screen reads as a composed product landing layout rather than a squeezed
  preview. Added delicate vertical "PERFORMANCE" / "DELIVERY · RISK" micro-labels
  flanking the device (extra-large screens only; `aria-hidden`).
- **Background** — kept the low-opacity grid and laptop glow; added a faint
  indigo top-left wash and a soft bottom fade for depth.
- **Right side** — added the compact VendorIQ / Enterprise Suite brand above
  "Welcome back" (tablet/desktop; on mobile it lives in the stacked header).
- **Mobile** — now stacks the *actual* laptop (smaller, centred) under the
  headline instead of the previous bars strip, so the animation demonstrably
  continues on phones; the form follows below.
- **Insights copy** — softened to a calm set ("Delivery performance improving",
  "Vendor risk under control", etc.) with a gentle risk-score cycle
  (31 → 30 → 29 → 32 → 34). One message at a time, fade transition, 5.1 s cadence.

## 10. Complete laptop dashboard (part 1 follow-up)

Made the laptop read as a real VendorIQ application instead of a floating panel:

- **Heading strengthened** — left headline is now the larger, bolder
  "Vendor intelligence" (removed "simplified."), positioned above-left of the
  laptop with the "Realtime vendor insights" eyebrow and supporting copy.
- **Laptop realism** — darker metallic bezel with a visible top-bezel strip +
  webcam dot, thin bright display frame around the screen, thicker bottom screen
  edge with the engraved VENDORIQ wordmark, and an angled base with a subtle
  trackpad hint and grounding shadow. Perspective/float preserved.
- **Complete miniature app** (`IntelligenceDashboard`) —
  - compact app header (`[Shield] VendorIQ` + pulsing `LIVE DATA` dot),
  - narrow sidebar (Overview / Vendors / Performance / Risk / Analytics + Settings),
  - greeting row ("Good morning, Admin" + clock), three small KPI cards
    (127 Vendors +4 · 87% On-time +2% · 31 Risk / Low risk),
  - the three primary animated visuals: performance bars, risk donut with a slowly
    drifting score, and the delivery trend line with moving data points,
  - a mostly-static "Recent Activity" panel (3 timestamped entries), micro
    deltas like `+12%`, and a subtle indigo/cyan palette (amber only for the
    risk focus, no red).
- **Animated elements are exactly the three primary visuals**; KPIs, activity,
  sidebar, and header stay static so the screen never feels like a casino.
- **Responsive dashboard** — below `sm`, the sidebar, greeting, KPI cards and
  activity panel collapse, leaving the app header + the three main visuals so
  the scaled-down laptop stays readable on mobile.
- The stage is `aria-hidden` (fully decorative); the `aria-live` insight message
  below the laptop remains the only announced content.

## 11. Final UI refinement & animation enhancement (part 1 follow-up)

Polish pass over the existing design — no layout/theme/visual-direction change
(three-part split, dark navy + grid, laptop as hero, form right):

- **Branding block** — eyebrow unchanged (`REAL-TIME VENDOR INSIGHTS`), headline
  reworded to **"Vendor Intelligence"** (no "simplified"), description got the
  Oxford comma ("delivery, and risk"); the block gained width (`w-64` base,
  `xl:w-72`, `2xl:w-80`) and the left inner container widened to
  `max-w-[1280px]`. Whole block stays vertically centered.
- **Laptop made the hero** — outer wrapper bumped `max-w-[600px] → 680px`
  (~13% larger), minimum width eased to `230px` so tablets only gently shrink
  it, and a second soft **violet** ambient glow (`violet-600/10`) layers under
  the existing indigo one for restrained depth. Bezel/webcam/base realism
  unchanged from section 10.
- **Animations — 2 primary + 1 supporting (still 3 total), all CSS keyframes**:
  - *Performance bars*: two-phase animation — each bar **rises from the bottom
    once on load** (`iq-bar-rise`, staggered via `--bar-delay`), then breathes
    between base height and −13% (`iq-bar-loop`, mildly varied durations). No
    bouncing, no repeated entrances.
  - *Risk donut*: outer dashed ring is now **static** (dash rotation removed —
    no continuous spin); the progress arc **draws in on load**
    (`iq-ring-draw` + `.iq-donut-arc`), then smoothly transitions between
    nearby scores (30 → 31 → 29) via `stroke-dasharray` transition.
  - *Delivery trend*: track **draws left-to-right on load** (`iq-line-draw`),
    the latest node pulses gently (`iq-node-pulse`), and the travelling data
    particle stays; value 87%.
  - Recent Activity stays static except the newest row's dot micro-pulse; the
    panel gained a 4th entry ("Incident acknowledged — 38m") to reach 4 rows.
- **Form** — only subtle polish: submit button gains a soft blue/indigo glow
  on hover (`hover:shadow-[0_12px_30px_-8px_rgba(99,102,241,0.55)]`); focus
  rings, borders, spacing, and the icon already matched the direction.
- **CSS cleanup** — consolidated a duplicated login keyframe block into one;
  only new keyframes are `iq-bar-rise`, `iq-bar-loop`, `iq-ring-draw`,
  `iq-line-draw`, `iq-node-pulse` (all covered by the existing
  `prefers-reduced-motion` override — bars hold base height, arc/line snap to
  full, pulse ends static).
- **Verification** — `npm run lint` 0/0; `npm run build` green
  (CSS 64.30 kB, JS 957.99 kB; the >500 kB chunk warning is pre-existing).
  Auth, routing, and backend untouched.

## 12. Login page is now the entry experience

The legacy landing / welcome page ("ENTERPRISE PLATFORM … Enter Platform") was
removed entirely:

- The `/` route now redirects to `/login`
  (`<Navigate to="/login" replace />` in `routes/index.tsx`), so a browser
  refresh at `/` lands on the redesigned login page.
- `/login` is wrapped in `GuestRoute`, which forwards already-authenticated
  users straight to `/dashboard`; successful sign-in still navigates to
  `/dashboard` (unchanged `LoginForm` logic and JWT flow).
- `src/pages/LandingPage.tsx` deleted and its import/route removed.
- Auth logic, backend APIs, and the DB/schema were untouched.

## 13. Phase: unify the authenticated workspace on the dark system

Whole-application follow-up so every authenticated page and shared component
speaks one dark "enterprise intelligence" design (the login's palette extended
inward). No functionality changed: logic, handlers, form fields, API calls,
calculations and ML/risk behaviour are byte-for-byte the same as before.

- **Design tokens** live in `src/index.css` (dark body default `#0b1120`,
  `@layer components` with `.iq-card`, `.iq-table-*`, form/input tokens) and
  `src/styles/classes.ts` (shared JS class strings: `card`, `formSection`,
  `formInput`, `th`, `td`, …). Charts get dark constants in
  `src/components/analytics/chartTheme.ts`.
- **New unified badge** — `components/common/StatusBadge.tsx` (tone maps for
  vendor status, PO status, delivery, quality, incident status/severity,
  contract status, performance classification). The 10 previously separate
  badge components in `components/{vendors,quality-evaluations,purchase-orders,
  incidents,contracts,performance,risk}` now delegate to it while keeping their
  prop signatures identical.
- **Shell** rebuilt dark: `layout/navigation.ts` (groups + `/ai-insights` and
  `/settings`), `Sidebar`, `Topbar` (Breadcrumbs + avatar/role menu + logout),
  `AppLayout`.
- **Re-themed shared components**: Button, PageHeader, StatCard, TableSkeleton,
  PageLoader, EmptyState, ErrorState, Breadcrumbs, Pagination, Modal,
  ToastProvider, ChartCard, TrendChart, SeverityPieChart, ComparisonChart,
  EmptyChart, DistributionBar, Card.
- **Pages re-themed** (light→dark only): Dashboard, Analytics, Risk Center,
  Vendor List, Vendor Categories, Vendor Detail, Vendor Form*, Vendor
  Performance, Contracts (list/detail/form*), Purchase Orders (list/detail/
  form*), Quality Evaluations (list/detail/form*), Incidents (list/detail/
  form*), NotFound, and all four form-component wrappers. `*FormPage` wrapper
  states (access-restricted / loading / no-data) now use `iq-card`.
- **New real pages** (not placeholders): `pages/AiInsightsPage.tsx` — data-fed
  AI signals (overview insights with tone chips), prediction-model card
  (type/version/training/eval metrics), risk watchlist (top 5 by risk), and
  top-performer leaderboard; `pages/SettingsPage.tsx` — read-only profile,
  appearance, role/permissions (from `utils/permissions`), platform/about.
- Both pages are wired into `src/routes/index.tsx` (`/ai-insights`,
  `/settings`) and the sidebar navigation.
- **Verification** — `npm run lint` 0 warnings / 0 errors; `npm run build`
  green (`tsc -b && vite build`; only the pre-existing >500 kB chunk warning
  remains). Backend at `http://127.0.0.1:8000` healthy, Vite dev server
  serving `/login`.

## 14. Phase: spacious enterprise layout & shell interactions

Follow-up that keeps the dark theme but de-densifies the workspace and adds
premium interaction polish. The login page was not touched.

- **Global spacing** — main content area widened to `max-w-[1440px]` with
  `pt-8 pb-16` breathing room; pages use `space-y-6` (24px) between major
  sections; KPI rows use `gap-4`/`gap-5`.
- **Interactive-card hover language** — new opt-in `.iq-card-hover` utility in
  `index.css`: 1.5% scale, thin indigo border (`rgb(99 102 241 / 0.55)`),
  soft 1px blue glow + drop shadow, 0.25s ease. Applied only to KPI cards
  (Dashboard); large charts, tables, forms, and static panels stay still.
- **Dashboard rebuilt to the brief**:
  - Header: greeting + "Here's what's happening with your vendor ecosystem
    today." + a real **date-range selector** (7/30/90 days, drives the
    overview/ranking/trend queries) + "Open Analytics" primary button.
  - **4 KPI cards** on desktop (Total Vendors, Active Contracts, On-Time
    Delivery, Average Risk Score) with icon/label/large metric/supporting line.
  - Spacious analytics grid (12-col): large **Vendor Performance Trend** chart
    (col-span 6), **Risk Distribution donut** with center total + legend
    (col-span 3), **Intelligence Feed** as one clean card with dividers and a
    live-signal footer (col-span 3).
  - Bottom row (3 cards): **Top Performing Vendors** ranked list with rank,
    initials avatar, code, classification dot and score; **Delivery Snapshot**
    with four inline metrics + a green/orange on-time vs delayed trend chart;
    **Quick Access** vertical action rows with arrow nudge on hover.
  - Data wired to existing APIs (`performanceTrend`, `deliveryTrend`,
    `ranking`, `overview`, risk stats) — no new endpoints, no logic changes.
- **Top navigation** — remains minimal (breadcrumb left), now with:
  - **Global search** (`Ctrl+K`, or click): cmd-palette overlay that searches
    the vendor directory live (debounced `vendorsApi.list({ search })`) and
    deep-links to vendor profiles; Esc/backdrop closes.
  - **Notifications** bell with live badge: pulls `analytics.overview()`
    insights, lists the latest signals with tone icons, links to AI Insights.
  - User avatar + name/role/dropdown (unchanged behaviour).
- **Verification** — `npm run lint` 0/0; `npm run build` green (chunk-size
  warning unchanged). Login page files untouched.

## 15. Phase: spacing system & density refinement (whole app)

Third layout pass working toward a consistent, spacious, premium enterprise
feel. Verified no functional changes — every edit is a Tailwind class-string
tweak. Login page still untouched.

- **Spacing system (targets)**: page horizontal padding ~28–40px, vertical
  ~24–32px; major section gap 24–32px; card-grid gaps 20–24px; internal card
  padding 20–28px; small gaps 8–12px; tighter on smaller screens.
- **Page frame** — `AppLayout` main now `max-w-[1500px] px-4 pt-10 pb-20
  sm:px-6 lg:px-9 xl:px-12`.
- **Global card/table/forms tokens**:
  - `index.css` → `.iq-th`/`.iq-td`/`.iq-td-muted` padding enlarged to
    `px-5 py-3.5` / `px-5 py-4`; `.iq-card-hover` upgraded to
    `translateY(-2px) scale(1.01)`, border `rgb(129 140 248 / 0.65)` and a
    blue-indigo glow (`0 0 0 1px rgb(99 142 255 / 0.2)`,
    `0 10px 28px -14px rgb(40 100 255 / 0.18)`), 0.2s ease — applied only to
    interactive cards.
  - `styles/classes.ts` → `cardHeader` px-6 py-5, `cardBody` px-6 py-6,
    `formSection` p-7 + gap-6, `formInput`/`formInputArea` mt-2 + roomier
    padding, `formDivider` pt-6, `th`/`td`/`tdMuted` aligned with the CSS
    tokens, `sectionSubtitle` mt-1.
- **Shared components** — `PageHeader` → `mb-8`, larger title
  (`sm:text-[1.7rem]`), roomier action gap; `StatCard` → `px-6 py-5` and now
  carries `.iq-card-hover` itself. `analytics/ChartCard` → header `px-6 py-5`,
  body `px-6 py-6`.
- **Dashboard** — `.iq-card-hover` removed from the KPI `Link` wrappers
  (moved onto StatCard, avoids double-scale); wrappers now `space-y-8`; KPI
  grid `gap-5`, analytics grids add `xl:gap-8`.
- **Vendor profile (priority page)** — 4 metric cards `px-6 py-5`,
  `mb-8 ... gap-5`; body grid `gap-6 lg:grid-cols-3 xl:gap-8` with left rail
  `space-y-8` and right rail `space-y-8`; shared `Section` panel → `p-7`,
  heading `mb-5`.
- **List pages** (Vendors, Contracts, POs, Quality Evaluations, Incidents,
  Vendor Performance) — stat rows `gap-5` with `p-5` stat cards, table section
  gap `mt-8`, table toolbars `p-5`. VendorCategoriesPage needed no changes.
- **Analytics, Risk, AI Insights, Settings + detail pages** — AnalyticsPage
  filter toolbar/stat cards `p-5`, section gaps `mt-6→mt-8`; AiInsightsPage and
  all 4 detail pages use `xl:gap-8` two-rail grids with `space-y-8` rails;
  VendorRiskPage table toolbar `p-5`, section gap `mt-8`. SettingsPage and form
  pages needed no per-page edits (shared tokens cover them).
- **Verification** — `npm run lint` 0 warnings / 0 errors; `npm run build`
  green (`tsc -b && vite build`; only the pre-existing >500 kB chunk warning).
  Backend `/api/v1/health` and Vite `/login` both 200. Login page files
  untouched.

## 16. Phase: layout system & whitespace overhaul (de-densify whole app)

Fourth pass. This one works at the container/grid level rather than piling on
per-card margins. Login page untouched; no functional or palette changes.

- **Spacing tokens** — documented `--space-xs…2xl` (8/12/16/24/32/40px) in the
  `@theme` block of `index.css` as the canonical scale, mapped to the Tailwind
  steps used across the app. Rules: card interiors ≥24px, related-card gaps
  20–24px, major-section breaks 28–40px, page padding ~32/36/48px.
- **Card surface system** — every standard card surface (`border-slate-800/70
  bg-[#121a2b]`, 19 files) migrated to a single token pair:
  `border-[rgb(100,130,180,0.14)] bg-[#162032]`, giving cleaner separation from
  the `#0b1120` canvas without a palette change. Popovers/menus/modals keep the
  deeper `#121a2b` so they still read as floating layers.
- **Hover language** — `.iq-card-hover` retuned to the requested spec:
  `translateY(-3px) scale(1.01)`, border `rgb(96 130 255 / 0.75)`, glow
  `0 0 0 1px rgb(96 130 255 / 0.15), 0 8px 25px rgb(70 100 255 / 0.12)`, 0.2s
  ease. Applied to `StatCard` and analytics `ChartCard` (and reused by
  interactive dashboard/quick-access items); never on page containers, tables,
  forms, nav, static panels or the login page.
- **Dashboard de-densified at the grid level** — the crowded `lg:grid-cols-12`
  row was replaced with explicit, whitespace-first rows (all `gap-6 xl:gap-8`,
  `space-y-8` between sections):
  - Row A: Vendor Performance Trend (`lg:col-span-2`, height 280) + Risk
    Distribution (`lg:col-span-1`).
  - Row B: Top Performing Vendors + Delivery Snapshot (`lg:grid-cols-2`).
  - Row C: Intelligence Feed (`lg:col-span-2`) + Quick Access
    (`lg:col-span-1`).
  - KPI row stays `gap-5 xl:gap-6` (20→24px); feed/top-vendor/quick-access rows
    got roomier padding (`py-4`, `px-2 py-3.5`, `px-3 py-3.5`, `space-y-3`).
- **Every other page normalized** — KPI/stat rows gained `xl:gap-6`; detail
  pages moved the status row to `mb-8` and body grids to `gap-6 xl:gap-8` with
  `space-y-8` rails; Vendor Profile metric row → `mb-8 gap-5 xl:gap-6` and its
  summary grids → `gap-5`; Settings right rail → `space-y-8`; AI Insights chips
  `p-5`, stat grid `gap-5 xl:gap-6`; feed/dropdown rows (Intelligence feed,
  Notifications, Global Search) enlarged to ~14–16px vertical rhythm.
- **No viewport compression** — `AppLayout` stays `min-h-screen` with a
  naturally scrolling `main` (`max-w-[1500px] px-4 pt-10 pb-20 sm:px-6 lg:px-9
  xl:px-12`); no `height: 100vh` / `overflow: hidden` on main content. Sidebar
  `lg:h-screen lg:sticky` is unchanged (navigation only).
- **Conflicting-CSS audit** — scanned for `100vh`, `overflow-hidden`, tiny
  gaps/padding and fixed heights. Only legitimate uses remain (table horizontal
  scroll, progress-bar clipping, popovers, login/sidebar). No global reset or
  page-level style was overriding the new spacing.
- **Verification** — `npm run lint` 0 warnings / 0 errors; `npm run build`
  green (only the pre-existing >500 kB chunk warning). Backend `/api/v1/health`
  and Vite `/login` both 200. Login page files untouched.

## 17. Phase: root-cause fix — reset layer bug (real spacing)

The dashboard's card gaps *were* set correctly (24px+) in the markup, yet cards
still rendered as one merged mass. Investigation found the actual bug.

- **Root cause** — `index.css` opened with an **unlayered** global reset:
  `* { margin: 0; padding: 0; box-sizing: border-box }`. CSS cascade rules:
  unlayered author styles outrank *all* `@layer` styles regardless of order or
  specificity. Tailwind v4 emits its utilities inside `@layer utilities`, so
  every margin/padding utility — `space-y-8`, `mt-8`, `mb-8`, `pt-10`, `py-6`,
  `px-6`, `p-5` … — was silently **zeroed** app-wide. Grid `gap-*` survived
  (not a margin), which is why horizontal separation partially worked while all
  vertical section spacing and card interior padding collapsed: the "cards
  touch" look.
- **Fix** — moved the reset into `@layer base` (layered, after preflight), so
  components/utilities now correctly override it. Verified against compiled
  CSS: the rule now emits as `@layer base{*{box-sizing:border-box;margin:0;
  padding:0}}` and utilities like `.px-6`/`.mb-8`/`.space-y-8` (32px
  margin-block) are emitted in the utilities layer that wins the cascade.
- **Result** — the full spacing system finally renders: page padding
  (`pt-10 pb-20`, 32–48px sides), PageHeader `mb-8`, section rhythm
  `space-y-8`/`mt-8` (32px), KPI/stat grids `gap-5 xl:gap-6` (20–24px), card
  grids `gap-6 xl:gap-8` (24–32px), and real card interior padding. Cards now
  read as separate floating panels with visible `#0b1120` page background
  between them.
- **Audited for other offenders** — no other unlayered rule sets layout
  properties that fight utilities (remaining unlayered rules are presentation:
  `.iq-card-hover`, login animations/grid, scrollbar, `body`).
- **Verification** — `npm run lint` 0/0; `npm run build` green (pre-existing
  chunk warning only). Backend `/api/v1/health` and Vite `/login` both 200.
  Login page untouched.