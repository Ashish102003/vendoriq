"""MongoDB (Atlas) access layer built on Motor + PyMongo.

The application keeps the original numeric, auto-increment style IDs on every
document (allocated from the ``counters`` collection) so the public API and the
frontend keep working unchanged. The native ``_id`` (ObjectId) is internal and
never exposed.

Date-only columns are stored as ``YYYY-MM-DD`` ISO strings so all range and
ordering semantics survive without BSON datetime/timezone surprises. Decimals
are stored as MongoDB ``Decimal128`` and enums as their string value.
"""

from typing import AsyncGenerator

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorCollection,
    AsyncIOMotorDatabase,
)
from pymongo import ASCENDING, DESCENDING
from pymongo.collation import Collation
from pymongo import ReturnDocument

from .config import settings

# Collections backed by the former MySQL tables.
ROLES = "roles"
USERS = "users"
VENDOR_CATEGORIES = "vendor_categories"
VENDORS = "vendors"
CONTRACTS = "contracts"
PURCHASE_ORDERS = "purchase_orders"
QUALITY_EVALUATIONS = "quality_evaluations"
INCIDENTS = "incidents"

# Internal sequence counter collection (numeric id allocation).
COUNTERS = "counters"

# Case-insensitive collation mirrors the MySQL unique / lower() checks.
CI_COLLATION = Collation(locale="en", strength=2)

_COLLECTION_NAMES = (
    ROLES,
    USERS,
    VENDOR_CATEGORIES,
    VENDORS,
    CONTRACTS,
    PURCHASE_ORDERS,
    QUALITY_EVALUATIONS,
    INCIDENTS,
)

# name -> (keys, unique, collation)
_INDEX_SPECS: list[tuple[str, object, bool, bool]] = [
    (ROLES, ("name", ASCENDING), True, True),
    (USERS, ("email", ASCENDING), True, True),
    (USERS, ("role_id", ASCENDING), False, False),
    (VENDOR_CATEGORIES, ("name", ASCENDING), True, True),
    (VENDOR_CATEGORIES, ("is_active", ASCENDING), False, False),
    (VENDORS, ("vendor_code", ASCENDING), True, True),
    (VENDORS, ("category_id", ASCENDING), False, False),
    (VENDORS, ("status", ASCENDING), False, False),
    (VENDORS, ("is_active", ASCENDING), False, False),
    (VENDORS, ("created_at", DESCENDING), False, False),
    (CONTRACTS, ("contract_number", ASCENDING), True, True),
    (CONTRACTS, ("vendor_id", ASCENDING), False, False),
    (CONTRACTS, ("status", ASCENDING), False, False),
    (CONTRACTS, ("start_date", ASCENDING), False, False),
    (CONTRACTS, ("end_date", ASCENDING), False, False),
    (PURCHASE_ORDERS, ("order_number", ASCENDING), True, True),
    (PURCHASE_ORDERS, ("vendor_id", ASCENDING), False, False),
    (PURCHASE_ORDERS, ("contract_id", ASCENDING), False, False),
    (PURCHASE_ORDERS, ("status", ASCENDING), False, False),
    (PURCHASE_ORDERS, ("order_date", ASCENDING), False, False),
    (PURCHASE_ORDERS, ("vendor_id", ASCENDING, "order_date", ASCENDING), False, False),
    (PURCHASE_ORDERS, ("expected_delivery_date", ASCENDING), False, False),
    (PURCHASE_ORDERS, ("actual_delivery_date", ASCENDING), False, False),
    (QUALITY_EVALUATIONS, ("vendor_id", ASCENDING), False, False),
    (QUALITY_EVALUATIONS, ("contract_id", ASCENDING), False, False),
    (QUALITY_EVALUATIONS, ("purchase_order_id", ASCENDING), False, False),
    (QUALITY_EVALUATIONS, ("evaluation_date", ASCENDING), False, False),
    (QUALITY_EVALUATIONS, ("quality_status", ASCENDING), False, False),
    (QUALITY_EVALUATIONS, ("vendor_id", ASCENDING, "evaluation_date", ASCENDING), False, False),
    (INCIDENTS, ("incident_number", ASCENDING), True, True),
    (INCIDENTS, ("vendor_id", ASCENDING), False, False),
    (INCIDENTS, ("contract_id", ASCENDING), False, False),
    (INCIDENTS, ("purchase_order_id", ASCENDING), False, False),
    (INCIDENTS, ("status", ASCENDING), False, False),
    (INCIDENTS, ("severity", ASCENDING), False, False),
    (INCIDENTS, ("reported_date", ASCENDING), False, False),
    (INCIDENTS, ("vendor_id", ASCENDING, "reported_date", ASCENDING), False, False),
]

_client: AsyncIOMotorClient | None = None


def _connect() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        if not settings.MONGODB_URI:
            raise RuntimeError(
                "Database not configured. Please set MONGODB_URI in backend/.env "
                "to your MongoDB Atlas connection string."
            )
        _client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
        )
    return _client


def _database_name() -> str:
    """Database name from the connection string (falls back to ``vendoriq``)."""
    uri = settings.MONGODB_URI.split("?", 1)[0]
    if "/" in uri:
        name = uri.rsplit("/", 1)[1].strip()
        if name:
            return name
    return "vendoriq"


async def get_database() -> AsyncIOMotorDatabase:
    client = _connect()
    try:
        return client.get_default_database()
    except Exception:
        return client[_database_name()]


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    db = await get_database()
    yield db


def get_collection(db: AsyncIOMotorDatabase, name: str) -> AsyncIOMotorCollection:
    return db[name]


# ---------------------------------------------------------------------------
# Indexes, id allocation and connectivity helpers
# ---------------------------------------------------------------------------


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create the indexes that replace the MySQL unique/FK indexes."""
    for collection_name, keys, unique, collation in _INDEX_SPECS:
        kwargs = {}
        if unique:
            kwargs["unique"] = True
        if collation:
            kwargs["collation"] = CI_COLLATION
        await db[collection_name].create_index(keys, **kwargs)


async def next_id(db: AsyncIOMotorDatabase, sequence: str) -> int:
    """Allocate the next numeric id for ``sequence`` (table name)."""
    result = await db[COUNTERS].find_one_and_update(
        {"_id": sequence},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(result["value"])


async def reset_counters(db: AsyncIOMotorDatabase) -> None:
    """Reset sequence counters (used by demo-data scripts)."""
    await db[COUNTERS].delete_many({})


async def ping(db: AsyncIOMotorDatabase) -> bool:
    """Confirm the cluster is reachable."""
    result = await db.command("ping")
    return result.get("ok") == 1.0