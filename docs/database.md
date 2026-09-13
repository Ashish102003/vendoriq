# VendorIQ — Database Design

## Overview

VendorIQ uses MySQL as its relational database, managed through SQLAlchemy ORM
with Alembic migrations. The Phase 2 schema establishes the core entities that
future modules will build upon:

- **Roles** — job functions a user can hold
- **Users** — people who access the platform
- **Vendor Categories** — industry/typology groups for vendors
- **Vendors** — organizations that provide products or services

Database name: `vendoriq`
Encoding: `utf8mb4`, collation `utf8mb4_unicode_ci`

## Relationship Diagram

```text
roles                    vendor_categories
  │                            │
  │ 1                          │ 1
  │                            │
  │ many                       │ many
  ▼                            ▼
users                      vendors
```

There is currently **no** direct relationship between `users` and `vendors`.

## Core Tables

### roles

Stores the roles (job functions) that users can hold.

| Column      | Type        | Constraints                 |
| ----------- | ----------- | --------------------------- |
| id          | INT         | PRIMARY KEY, AUTO_INCREMENT |
| name        | VARCHAR(50) | NOT NULL, UNIQUE            |
| description | VARCHAR(255)| NULL                        |
| created_at  | DATETIME    | NOT NULL, default now()     |
| updated_at  | DATETIME    | NOT NULL, default now()     |

Relationships:

- one Role → many Users (`roles.id` → `users.role_id`)

Future: permissions will be introduced together with role-based access control.

### users

Stores platform users.

| Column        | Type          | Constraints                 |
| ------------- | ------------- | --------------------------- |
| id            | INT           | PRIMARY KEY, AUTO_INCREMENT |
| first_name    | VARCHAR(100)  | NOT NULL                    |
| last_name     | VARCHAR(100)  | NOT NULL                    |
| email         | VARCHAR(255)  | NOT NULL, UNIQUE            |
| password_hash | VARCHAR(255)  | NOT NULL (Phase 3 auth)     |
| role_id       | INT           | NOT NULL, FK → roles.id, ON DELETE RESTRICT |
| is_active     | BOOLEAN       | NOT NULL, default 1         |
| created_at    | DATETIME      | NOT NULL, default now()     |
| updated_at    | DATETIME      | NOT NULL, default now()     |

Relationships:

- one User belongs to one Role (`users.role_id` → `roles.id`)

Notes:

- `password_hash` is stored at the database level only. It is never exposed in
  response schemas and hashing is implemented in Phase 3.

### vendor_categories

Stores the categories vendors belong to (e.g. Software, Logistics).

| Column      | Type        | Constraints                 |
| ----------- | ----------- | --------------------------- |
| id          | INT         | PRIMARY KEY, AUTO_INCREMENT |
| name        | VARCHAR(100)| NOT NULL, UNIQUE            |
| description | VARCHAR(255)| NULL                        |
| is_active   | BOOLEAN     | NOT NULL, default 1         |
| created_at  | DATETIME    | NOT NULL, default now()     |
| updated_at  | DATETIME    | NOT NULL, default now()     |

Relationships:

- one VendorCategory → many Vendors (`vendor_categories.id` → `vendors.category_id`)

### vendors

Stores vendor organizations.

| Column         | Type         | Constraints                 |
| -------------- | ------------ | --------------------------- |
| id             | INT          | PRIMARY KEY, AUTO_INCREMENT |
| vendor_code    | VARCHAR(20)  | NOT NULL, UNIQUE            |
| company_name   | VARCHAR(255) | NOT NULL, indexed           |
| contact_person | VARCHAR(100) | NULL                        |
| email          | VARCHAR(255) | NULL                        |
| phone          | VARCHAR(30)  | NULL                        |
| address        | VARCHAR(255) | NULL                        |
| city           | VARCHAR(100) | NULL                        |
| state          | VARCHAR(100) | NULL                        |
| country        | VARCHAR(100) | NULL                        |
| postal_code    | VARCHAR(20)  | NULL                        |
| website        | VARCHAR(255) | NULL                        |
| category_id    | INT          | NOT NULL, FK → vendor_categories.id, ON DELETE RESTRICT |
| status         | VARCHAR(32)  | NOT NULL, default 'PENDING' |
| vendor_since   | DATE         | NULL                        |
| is_active      | BOOLEAN      | NOT NULL, default 1         |
| created_at     | DATETIME     | NOT NULL, default now()     |
| updated_at     | DATETIME     | NOT NULL, default now()     |

Relationships:

- one Vendor belongs to one VendorCategory
  (`vendors.category_id` → `vendor_categories.id`)

## Design Decisions

### Vendor status

`vendors.status` uses the values `PENDING`, `ACTIVE`, `UNDER_REVIEW`,
`SUSPENDED`, `TERMINATED`, defined by the `VendorStatus` enum in
`app/models/enums.py`.

It is implemented as a SQLAlchemy `Enum` with `native_enum=False`, which stores
the value as `VARCHAR(32)` rather than a MySQL `ENUM` type. This keeps schema
evolution simple (adding future statuses does not require `ALTER TABLE`) while
still providing validation at the application/Pydantic layer. MySQL 8.0 and 8.4
behave identically for this storage type.

### Indexes

- `vendor_code`, `email`, and the two `name` columns are `UNIQUE`; in MySQL the
  unique constraint itself creates the lookup index.
- Explicit secondary indexes are created for `users.role_id`,
  `vendors.category_id`, and `vendors.company_name` to support joins and
  company-name searches.

### Foreign key behavior

Foreign keys use `ON DELETE RESTRICT` so the database prevents a Role with
assigned users (or a Category with assigned vendors) from being deleted
silently. Orphaned rows are never possible.

### Timestamps

`created_at` and `updated_at` are populated automatically with UTC wall-clock
time via the shared `TimestampMixin` in `app/models/base.py`. `created_at` is
set on insert; `updated_at` is refreshed on every ORM update.

## Future Database Expansion

Planned (not implemented) tables and their anchor: each will reference
`vendors.id` through a `vendor_id` foreign key.

| Module                        | Future tables                                   |
| ----------------------------- | ----------------------------------------------- |
| Vendor Management             | vendor contacts, vendor documents               |
| Orders                        | orders, order items                             |
| Contracts                     | contracts, contract line items                  |
| Incidents                     | incidents                                       |
| Complaints & Reviews          | complaints, reviews                             |
| Performance                   | performance evaluations, performance history    |
| Risk                          | risk assessments, improvement plans             |
| Platform                      | notifications, audit logs                       |

These tables do not exist yet and are not part of Phase 2.