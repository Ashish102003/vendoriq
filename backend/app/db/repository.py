"""Shared Mongo read/write helpers for endpoints and services.

These replace the SQLAlchemy query idioms used across the codebase while
keeping the calling code readable:

- ``db.get(Model, id)``      -> ``await find_doc(db, COL, Model, {"id": id})``
- ``db.query(Model).filter()``-> ``await find_docs(db, COL, Model, criteria)``
- ``db.query(...).count()``  -> ``await count_docs(db, COL, criteria)``
- relationship loading       -> the ``attach_*_relations`` helpers
"""

from datetime import datetime
import re
from typing import Any, Iterable, Optional, Sequence, Type, TypeVar

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_collection, next_id
from app.models import (
    Contract,
    DocumentModel,
    Incident,
    PurchaseOrder,
    QualityEvaluation,
    Role,
    User,
    Vendor,
    VendorCategory,
    utcnow,
)

_M = TypeVar("_M", bound=DocumentModel)

# --- Generic reads -----------------------------------------------------------


async def find_doc(
    db: AsyncIOMotorDatabase,
    collection: str,
    model_cls: Type[_M],
    criteria: dict,
) -> Optional[_M]:
    raw = await get_collection(db, collection).find_one(criteria)
    return model_cls.from_doc(raw) if raw else None


async def find_docs(
    db: AsyncIOMotorDatabase,
    collection: str,
    model_cls: Optional[Type[_M]] = None,
    criteria: Optional[dict] = None,
    *,
    sort: Optional[list] = None,
    skip: Optional[int] = None,
    limit: Optional[int] = None,
    project: Optional[dict] = None,
) -> list[Any]:
    cursor = get_collection(db, collection).find(criteria or {}, project or None)
    if sort:
        cursor = cursor.sort(sort)
    if skip is not None:
        cursor = cursor.skip(skip)
    if limit is not None:
        cursor = cursor.limit(limit)
    rows = await cursor.to_list(None)
    if project or model_cls is None:
        return rows
    return [model_cls.from_doc(row) for row in rows]


async def _rows(
    db: AsyncIOMotorDatabase, collection: str, criteria: Optional[dict] = None
) -> list[dict]:
    return await get_collection(db, collection).find(criteria or {}).to_list(None)


async def count_docs(
    db: AsyncIOMotorDatabase, collection: str, criteria: Optional[dict] = None
) -> int:
    return await get_collection(db, collection).count_documents(criteria or {})


# --- Generic writes ----------------------------------------------------------


async def insert_doc(
    db: AsyncIOMotorDatabase, collection: str, obj: DocumentModel
) -> DocumentModel:
    if obj.id is None:
        obj.id = await next_id(db, collection)
    obj.ensure_timestamps()
    doc = obj.to_doc()
    await get_collection(db, collection).insert_one(doc)
    return obj


async def update_doc(
    db: AsyncIOMotorDatabase,
    collection: str,
    criteria: dict,
    values: dict[str, Any],
) -> None:
    values = dict(values)
    values["updated_at"] = utcnow()
    await get_collection(db, collection).update_one(criteria, {"$set": values})


async def delete_doc(
    db: AsyncIOMotorDatabase, collection: str, obj_id: int
) -> None:
    await get_collection(db, collection).delete_one({"id": obj_id})


async def scalar_field(
    db: AsyncIOMotorDatabase,
    collection: str,
    field: str,
    criteria: Optional[dict] = None,
) -> Optional[Any]:
    raw = await get_collection(db, collection).find_one(
        criteria or {}, {field: 1, "_id": 0}
    )
    return raw.get(field) if raw else None


# --- Batch relation loading (replaces SQLAlchemy ``joinedload``) --------------


async def _map_by_ids(
    db: AsyncIOMotorDatabase,
    collection: str,
    model_cls: Type[_M],
    ids: Iterable[Optional[int]],
) -> dict[int, _M]:
    wanted = sorted({i for i in ids if i is not None})
    if not wanted:
        return {}
    rows = await get_collection(db, collection).find({"id": {"$in": wanted}}).to_list(None)
    return {row["id"]: model_cls.from_doc(row) for row in rows}


async def attach_categories(
    db: AsyncIOMotorDatabase, vendors: Sequence[Vendor]
) -> None:
    by_id = await _map_by_ids(db, "vendor_categories", VendorCategory, (v.category_id for v in vendors))
    for vendor in vendors:
        vendor.category = by_id.get(vendor.category_id)


async def attach_roles(db: AsyncIOMotorDatabase, users: Sequence[User]) -> None:
    by_id = await _map_by_ids(db, "roles", Role, (u.role_id for u in users))
    for user in users:
        user.role = by_id.get(user.role_id)


async def attach_vendors(
    db: AsyncIOMotorDatabase, objs: Sequence[Any]
) -> None:
    """Populate ``.vendor`` on contracts / orders / evaluations / incidents."""
    by_id = await _map_by_ids(db, "vendors", Vendor, (getattr(o, "vendor_id", None) for o in objs))
    for obj in objs:
        obj.vendor = by_id.get(obj.vendor_id)


async def attach_contracts(
    db: AsyncIOMotorDatabase, objs: Sequence[Any]
) -> None:
    """Populate ``.contract`` on orders / evaluations / incidents."""
    by_id = await _map_by_ids(db, "contracts", Contract, (getattr(o, "contract_id", None) for o in objs))
    for obj in objs:
        obj.contract = by_id.get(obj.contract_id)


async def attach_purchase_orders(
    db: AsyncIOMotorDatabase, objs: Sequence[Any]
) -> None:
    """Populate ``.purchase_order`` on evaluations / incidents."""
    by_id = await _map_by_ids(
        db, "purchase_orders", PurchaseOrder, (getattr(o, "purchase_order_id", None) for o in objs)
    )
    for obj in objs:
        obj.purchase_order = by_id.get(obj.purchase_order_id)


async def attach_users(
    db: AsyncIOMotorDatabase,
    objs: Sequence[Any],
    *attr_pairs: tuple[str, str],
) -> None:
    """Populate ``.<attr>`` on objs from documented ``.<fk>`` (e.g. created_by)."""
    for attr, fk in attr_pairs:
        by_id = await _map_by_ids(db, "users", User, (getattr(o, fk, None) for o in objs))
        for obj in objs:
            setattr(obj, attr, by_id.get(getattr(obj, fk)))


async def attach_contract_relations(
    db: AsyncIOMotorDatabase, contracts: Sequence[Contract]
) -> None:
    await attach_vendors(db, contracts)


async def attach_order_relations(
    db: AsyncIOMotorDatabase, orders: Sequence[PurchaseOrder]
) -> None:
    await attach_vendors(db, orders)
    await attach_contracts(db, orders)


async def attach_evaluation_relations(
    db: AsyncIOMotorDatabase, evaluations: Sequence[QualityEvaluation]
) -> None:
    await attach_vendors(db, evaluations)
    await attach_contracts(db, evaluations)
    await attach_purchase_orders(db, evaluations)
    await attach_users(db, evaluations, ("created_by_user", "created_by"))


async def attach_incident_relations(
    db: AsyncIOMotorDatabase, incidents: Sequence[Incident]
) -> None:
    await attach_vendors(db, incidents)
    await attach_contracts(db, incidents)
    await attach_purchase_orders(db, incidents)
    await attach_users(
        db,
        incidents,
        ("reported_by_user", "reported_by"),
        ("assigned_to_user", "assigned_to"),
    )


# --- Query criteria builders (mirror SQLAlchemy filter idioms) ----------------


def cis(value: str) -> dict:
    """Case-insensitive exact match (mirrors ``func.lower(x) == value.lower()``)."""
    return {"$regex": f"^{re.escape(value)}$", "$options": "i"}


def contains(term: str) -> dict:
    """Substring (case-insensitive) search — mirrors ``ilike('%term%')``."""
    return {"$regex": re.escape(term), "$options": "i"}


def to_criteria(**pairs: Any) -> dict:
    """Build a filter dict, skipping ``None`` values (SQLAlchemy ``is_(None)`` free)."""
    return {k: v for k, v in pairs.items() if v is not None}


def date_range(field: str, start_iso, end_iso) -> dict[str, Any]:
    """Range filter for ISO-string date columns, inclusive on both ends."""
    q: dict[str, Any] = {}
    if start_iso:
        q["$gte"] = start_iso
    if end_iso:
        q["$lte"] = end_iso
    return {field: q} if q else {}