import sys

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.database import get_database
from ..db.repository import find_doc, insert_doc
from ..models import Role

DEFAULT_ROLES = [
    {"name": "Admin", "description": "Full system access and administration."},
    {
        "name": "Vendor Manager",
        "description": "Manages vendor information and relationships.",
    },
    {
        "name": "Procurement Manager",
        "description": "Oversees procurement and purchasing activities.",
    },
    {
        "name": "Project Manager",
        "description": "Coordinates projects that involve vendors.",
    },
    {
        "name": "Analyst",
        "description": "Analyzes vendor performance and risk data.",
    },
]


async def seed_roles(db: AsyncIOMotorDatabase | None = None) -> int:
    """Insert any missing default roles. Idempotent."""
    owns_session = db is None
    if owns_session:
        db = await get_database()

    try:
        created = 0
        for item in DEFAULT_ROLES:
            exists = await find_doc(db, "roles", Role, {"name": item["name"]})
            if exists is None:
                await insert_doc(db, "roles", Role(**item))
                created += 1
        return created
    finally:
        if owns_session:
            db.client.close()


def _run() -> None:
    import asyncio

    async def _seed() -> None:
        created = await seed_roles()
        total = len(DEFAULT_ROLES)
        print(f"Role seeding complete: {created} created, {total - created} already present.")

    asyncio.run(_seed())


def main() -> None:
    try:
        _run()
    except Exception:
        print(
            "Role seeding FAILED. "
            "Verify that MongoDB Atlas is reachable and MONGODB_URI in backend/.env is correct."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()