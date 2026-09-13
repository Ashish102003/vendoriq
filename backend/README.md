# VendorIQ — Backend

FastAPI backend for the VendorIQ platform: SQLAlchemy models, Pydantic
schemas, Alembic migrations, role-based access control, the vendor performance
engine, predictive risk & ML, and the `/api/v1` REST API. For installation,
the full API reference, and the optional demo dataset, see the root
[`../README.md`](../README.md) and [`../docs/`](../docs/).

## Setup

```bash
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then edit with your MySQL credentials
```

## Database

Create the database (see root `README.md`):

```sql
CREATE DATABASE vendoriq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Apply migrations and (optionally) seed roles / demo data:

```bash
python -m app.db.check_db       # verify the database connection
alembic upgrade head            # create the tables
python -m app.db.seed           # seed the 5 essential system roles
python -m app.scripts.seed_demo_data       # optional dev demo dataset
python -m app.scripts.seed_demo_data --clean  # remove demo records
```

## Run

```bash
uvicorn app.main:app --reload
```

## Endpoints

| Method | Path             | Description             |
| ------ | ---------------- | ----------------------- |
| GET    | `/`              | Root message            |
| GET    | `/api/v1/health` | Application health check|

Interactive API documentation is available at `http://localhost:8000/docs`.

## Migrations

```bash
alembic upgrade head              # apply pending migrations
alembic revision --autogenerate -m "describe change"
alembic downgrade -1
alembic current
```