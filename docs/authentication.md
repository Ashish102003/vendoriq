# VendorIQ — Authentication & RBAC

## Overview

Phase 3 adds secure authentication and role-based access control (RBAC) to
VendorIQ:

- Passwords are hashed with **bcrypt** (`app/core/security.py`).
- Sessions are delivered as short-lived **JWTs** signed with `HS256`
  (`app/core/jwt.py`).
- Protected API routes resolve the current user from the `Authorization`
  header via the `get_current_user` dependency.
- Role-based access is enforced with the `require_roles(...)` dependency.
- The frontend stores the access token in `localStorage` and restores the
  session on page load through `GET /api/v1/auth/me`.

## How Authentication Works

1. The user submits their email + password to `POST /api/v1/auth/login`.
2. The backend hashes the submitted password with bcrypt and compares it
   against the stored hash (constant-ish cost; only the hash is compared, the
   plaintext is never logged or stored).
3. On success the API returns a signed JWT (`access_token`) plus a compact user
   object. Failures return a **generic** `401` — `{"detail": "Invalid email or
   password"}` — so it gives nothing away about whether an account exists.
4. The client sends the token as `Authorization: Bearer <token>` on every
   request.
5. `get_current_user` decodes + validates the token, loads the user from the
   database, and rejects invalid/expired tokens (`401`) and inactive users
   (`403`).

## JWT Design

- Algorithm: `HS256` (configurable via `ALGORITHM`).
- Expiry: `ACCESS_TOKEN_EXPIRE_MINUTES` (default `60`).
- Claims: `sub` (user id — the only claim the server trusts for identity),
  `email`, `role` (informational only, never trusted for authorization),
  `iat`, `exp`.
- **No** secrets, hashes, or passwords are ever placed in the token payload.
- Decoding is done with the `SECRET_KEY` and the expected algorithm; PyJWT
  validates the `exp` claim.

## RBAC Design

Authorization is role-based using the seeded `roles` table (`Admin`, `Vendor
Manager`, `Procurement Manager`, `Project Manager`, `Analyst`).

- `get_current_user` — resolves the authenticated user (authentication).
- `require_roles("Admin", ...)` — returns a FastAPI dependency that allows only
  listed roles; anything else gets:

  ```json
  {"detail": "You do not have permission to perform this action"}
  ```

- There is no permissions table; access is decided in code by role name. To
  guard an endpoint:

  ```python
  from ....dependencies.auth import get_current_user, require_roles

  @router.get("/admin-only")
  def admin_only(current_user: User = Depends(require_roles("Admin"))):
      ...
  ```

## API Endpoints

| Method | Path                          | Auth            | Description                            |
| ------ | ----------------------------- | --------------- | -------------------------------------- |
| POST   | `/api/v1/auth/login`          | Public          | Exchange email + password for a token  |
| GET    | `/api/v1/auth/me`             | User            | Current user (includes `role`)         |
| GET    | `/api/v1/auth/protected-test` | User            | Dev-check: confirms a valid token      |
| GET    | `/api/v1/auth/admin-test`     | Admin only      | RBAC check: rejects non-Admin with 403 |

### Login request

```json
{
  "email": "admin@vendoriq.com",
  "password": "your-password"
}
```

### Login response (200)

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@vendoriq.com",
    "role": "Admin"
  }
}
```

### Current user response (200)

```json
{
  "id": 1,
  "first_name": "Admin",
  "last_name": "User",
  "email": "admin@vendoriq.com",
  "role": { "id": 1, "name": "Admin" }
}
```

Responses **never** include `password_hash` or any credential material.

## Swagger / OpenAPI

Protected endpoints are guarded with FastAPI's `HTTPBearer` scheme, so they
expose an **Authorize** button in the interactive docs
(`http://localhost:8000/docs`). Paste a token from `POST /api/v1/auth/login`
into the Authorize dialog to test protected endpoints.

## Frontend

- Token storage: `localStorage` key `vendoriq_access_token`, managed centrally
  in `frontend/src/services/auth/token.ts`.
- `frontend/src/services/api/client.ts` automatically attaches
  `Authorization: Bearer <token>` and clears the token on `401`.
- `frontend/src/context/auth-context.ts` + `AuthProvider.tsx` expose `user`,
  `login`, `logout`, and restore the session on app load via `/auth/me`.
- `frontend/src/routes/guards.tsx` provides `ProtectedRoute` (redirects to
  `/login` when signed out, preserving the intended destination) and
  `GuestRoute` (redirects signed-in users away from `/login`).
- Logout is client-side only (token removed, state cleared) — the API is
  stateless and keeps no session server-side.

> **Design note:** `localStorage` is used so the app works out of the box with
> the current FastAPI/JWT setup. In a production deployment prefer **HttpOnly,
> Secure, SameSite cookies** (or a secure token store) to keep the token out of
> JavaScript memory. No refresh tokens are implemented; when a token expires the
> user re-authenticates.

## Seeding

Scripts run from the `backend/` directory with the venv activated:

```bash
python -m app.scripts.seed_roles               # idempotent; the 5 system roles
python -m app.scripts.create_initial_admin     # idempotent; reads backend/.env
```

`create_initial_admin` uses:

| Variable                   | Meaning                          |
| -------------------------- | -------------------------------- |
| `INITIAL_ADMIN_EMAIL`      | Admin email (must be a valid email) |
| `INITIAL_ADMIN_PASSWORD`   | Admin password (from `.env` only)  |
| `INITIAL_ADMIN_FIRST_NAME` | First name (default `Admin`)     |
| `INITIAL_ADMIN_LAST_NAME`  | Last name (default `User`)       |

The password is hashed before storage and is never printed or logged. The
script exits safely if the variables are missing and refuses to create a
duplicate.

### Add a new user (e.g. for testing RBAC)

```python
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Role, User

db = SessionLocal()
analyst = db.query(Role).filter(Role.name == "Analyst").first()
db.add(User(
    first_name="Jane", last_name="Doe",
    email="jane@vendoriq.com",
    password_hash=hash_password("change-me"),
    role_id=analyst.id, is_active=True,
))
db.commit()
```

## Security Notes

- `SECRET_KEY` must be a long random value and **never** committed. The local
  `.env` (gitignored) holds the working value; `.env.example` documents the
  variables with placeholders.
- Always use `verify_password` against the stored hash — never compare
  plaintext.
- Bearer tokens are the current transport; HTTPS is required in any real
  deployment.
- The health endpoint (`GET /api/v1/health`) stays public; everything under the
  app shell requires authentication.

## Excluded from Phase 3

- Public self-registration (users are created by admins)
- Refresh tokens, password reset, email verification
- Permissions matrix / per-action authorization (only role-level RBAC)
- New database tables or migrations (existing `roles`/`users` tables suffice)