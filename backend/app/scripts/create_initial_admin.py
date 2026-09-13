import sys
from typing import Optional

from ..core.config import settings
from ..core.database import SessionLocal
from ..core.security import hash_password
from ..models import Role, User
from .seed_roles import seed_roles


def create_initial_admin(db=None) -> Optional[User]:
    """Create the initial Admin user from env vars. Idempotent."""
    if SessionLocal is None:
        raise RuntimeError("Database not configured. Please set DATABASE_URL.")

    if not settings.INITIAL_ADMIN_EMAIL or not settings.INITIAL_ADMIN_PASSWORD:
        print(
            "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set in backend/.env."
        )
        return None

    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    try:
        email = settings.INITIAL_ADMIN_EMAIL.lower()

        admin_role = db.query(Role).filter(Role.name == "Admin").first()
        if admin_role is None:
            seed_roles(db)
            db.commit()
            admin_role = db.query(Role).filter(Role.name == "Admin").first()

        if admin_role is None:
            print("Admin role is missing; could not create the initial admin.")
            return None

        existing = db.query(User).filter(User.email == email).first()
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
        db.add(user)
        db.commit()
        db.refresh(user)
        print(
            f"Initial admin created: {user.first_name} {user.last_name} "
            f"({user.email}, role={admin_role.name})."
        )
        return user
    finally:
        if owns_session:
            db.close()


def main() -> None:
    try:
        create_initial_admin()
    except Exception:
        print(
            "Initial admin creation FAILED. "
            "Verify that MySQL is running and DATABASE_URL in backend/.env is correct."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()