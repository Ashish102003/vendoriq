# VendorIQ — Frontend

React + TypeScript + Vite + Tailwind v4 SPA for the VendorIQ platform.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend URL
(e.g. `http://localhost:8000`).

## Scripts

| Command             | Description                   |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start the development server  |
| `npm run build`     | Type-check (`tsc -b`) and build for production |
| `npm run lint`      | Run the linter (oxlint)       |
| `npm run preview`   | Preview the production build  |

## Routes

| Path           | Page                                |
| -------------- | ----------------------------------- |
| `/`            | Landing / welcome page              |
| `/login`       | Sign in                             |
| `/dashboard`   | Vendor intelligence overview        |
| `/vendors` … `/vendor-categories` | Vendor management         |
| `/contracts`   | Contract management                 |
| `/purchase-orders` | Purchase orders & delivery       |
| `/quality-evaluations` | Quality evaluations            |
| `/incidents`   | Incident management                 |
| `/vendor-performance` | Performance directory            |
| `/vendor-risk` | Predictive risk center              |
| `/analytics`   | Advanced analytics                  |
| `/coming-soon/:module` | Reusable module placeholder     |
| `/not-found`   | 404 page (unknown routes redirect here) |

See the root `README.md` for full project documentation.