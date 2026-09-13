import sys
from sqlalchemy import text
from ..core.database import engine


def check_connection() -> bool:
    if engine is None:
        print(
            "Database connection not checked: DATABASE_URL is not set. "
            "Configure it in backend/.env"
        )
        return False

    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            value = result.scalar()
        if value == 1:
            print("Database connection OK: SELECT 1 returned 1")
            return True
        print("Unexpected result from database connection check")
        return False
    except Exception:
        print(
            "Database connection FAILED. "
            "Verify that MySQL is running and DATABASE_URL in backend/.env is correct."
        )
        return False


def main() -> None:
    success = check_connection()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()