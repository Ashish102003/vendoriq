"""Shared document-model helpers (replaces the SQLAlchemy DeclarativeBase).

Domain models are Pydantic v2 models that carry the same attributes the
endpoints and services used on the ORM rows (including relationship attributes
and computed properties), plus helpers to convert to/from a MongoDB document.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, ClassVar

from bson.decimal128 import Decimal128
from pydantic import BaseModel, ConfigDict


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_stored(value: Any) -> Any:
    """Convert a Python value to its MongoDB-storable representation.

    - enums -> ``.value`` string
    - ``date`` (not datetime) -> ``YYYY-MM-DD`` ISO string
    - ``Decimal`` -> Decimal128
    - everything else passes through unchanged
    """
    if value is None:
        return None
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return Decimal128(value)
    return value


def from_stored(value: Any, *, field_type: Any = None, enum_type: Any = None) -> Any:
    """Convert a raw MongoDB value back to its Python representation."""
    if value is None:
        return None
    if enum_type is not None:
        return enum_type(value)
    if isinstance(value, Decimal128):
        return value.to_decimal()
    if field_type is date and isinstance(value, str):
        return date.fromisoformat(value)
    return value


class DocumentModel(BaseModel):
    """Base for every Mongo-backed domain model.

    Concrete models declare the stored/scalar fields via ``SCALAR_FIELDS`` and
    map enum/date columns via ``ENUM_FIELDS``/``DATE_FIELDS``. Relationship
    attributes are declared as optional fields so loaded references can be
    attached after a query (mirroring SQLAlchemy ``joinedload``).
    """

    model_config = ConfigDict(extra="allow", validate_assignment=False)

    SCALAR_FIELDS: ClassVar[tuple[str, ...]] = ()
    ENUM_FIELDS: ClassVar[dict[str, type[Enum]]] = {}
    DATE_FIELDS: ClassVar[set[str]] = set()

    def ensure_timestamps(self) -> None:
        """Set naive-UTC ``created_at``/``updated_at`` before a first insert."""
        now = utcnow()
        if self.created_at is None:
            self.created_at = now
        self.updated_at = now

    def to_doc(self) -> dict[str, Any]:
        """Serialize scalar fields into a MongoDB-storable document."""
        return {name: to_stored(getattr(self, name, None)) for name in self.SCALAR_FIELDS}

    def scalar_updates(self, *names: str) -> dict[str, Any]:
        """Return ``$set``-ready values for the given scalar field names."""
        updates: dict[str, Any] = {}
        for name in names:
            if name not in self.SCALAR_FIELDS:
                raise ValueError(f"{name} is not a stored field")
            updates[name] = to_stored(getattr(self, name, None))
        return updates

    @classmethod
    def from_doc(cls, raw: dict[str, Any]) -> "DocumentModel":
        """Build a domain model from a raw Mongo document (``_id`` ignored)."""
        data: dict[str, Any] = {}
        for name in cls.SCALAR_FIELDS:
            value = raw.get(name)
            if value is None:
                data[name] = None
            elif name in cls.ENUM_FIELDS:
                data[name] = cls.ENUM_FIELDS[name](value)
            elif name in cls.DATE_FIELDS:
                data[name] = value if isinstance(value, date) else date.fromisoformat(value)
            else:
                data[name] = from_stored(value)
        return cls(**data)