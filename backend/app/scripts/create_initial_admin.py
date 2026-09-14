import sys

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import settings
from ..core.database import get_database
from ..core.security import hash_password
from ..db.repository import find_doc, insert_doc
from ..models import Role, User
from .seed_roles import seed_roles


async def create_initial_admin(
    db: AsyncIOMotorDatabase | None = None,
):
    """Create the initial Admin user from env vars. Idempotent."""
    if not settings.INITIAL_ADMIN_EMAIL or not settings.INITIAL_ADMIN_PASSWORD:
        print(
            "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set in backend/.env."
        )
        return None

    owns_session = db is None
    if owns_session:
        db = await get_database()

    try:
        email = settings.INITIAL_ADMIN_EMAIL.lower()

        admin_role = await find_doc(db, "roles", Role, {"name": "Admin"})
        if admin_role is None:
            await seed_roles(db)
            admin_role = await find_doc(db, "roles", Role, {"name": "Admin"})

        if admin_role is None:
            print("Admin role is missing; could not create the initial admin.")
            return None

        existing = await find_doc(db, "users", User, {"email": email})
        if existing is not None:
            print(f"Initial admin already exists for {email}; skipping.")
            return existing

        user = User(
            first_name=settings.INITIAL_ADMIN_FIRST_NAME,
            last_name=settings.INITIAL_ADMIN_LAST_NAME,
            email=email,
            password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
            role_id=admin_role.id,
            is_active=True,
        )
        await insert_doc(db, "users", user)
        print(
            f"Initial admin created: {user.first_name} {user.last_name} "
            f"({user.email}, role={admin_role.name})."
        )
        return user
    finally:
        if owns_session:
            db.client.close()


def main() -> None:
    import asyncio

    try:
        asyncio.run(create_initial_admin())
    except Exception:
        print(
            "Initial admin creation FAILED. "
            "Verify that MongoDB Atlas is reachable and MONGODB_URI in backend/.env is correct."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()