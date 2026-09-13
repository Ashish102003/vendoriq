import sys
from typing import Optional

from ..core.database import SessionLocal
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


def seed_roles(db=None) -> int:
    """Insert any missing default roles. Idempotent."""
    if SessionLocal is None:
        raise RuntimeError("Database not configured. Please set DATABASE_URL.")

    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    try:
        created = 0
        for item in DEFAULT_ROLES:
            exists = db.query(Role).filter(Role.name == item["name"]).first()
            if exists is None:
                db.add(Role(**item))
                created += 1
        db.commit()
        return created
    finally:
        if owns_session:
            db.close()


def main() -> None:
    try:
        created = seed_roles()
        total = len(DEFAULT_ROLES)
        print(f"Role seeding complete: {created} created, {total - created} already present.")
    except Exception:
        print(
            "Role seeding FAILED. "
            "Verify that MySQL is running and DATABASE_URL in backend/.env is correct."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()