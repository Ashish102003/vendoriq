import asyncio
import sys

from motor.motor_asyncio import AsyncIOMotorClient

from ..core.config import settings
from ..core.database import get_database, ping


async def check_connection_async() -> bool:
    if not settings.MONGODB_URI:
        print(
            "Database connection not checked: MONGODB_URI is not set. "
            "Configure it in backend/.env"
        )
        return False
    try:
        db = await get_database()
        ok = await ping(db)
        if ok:
            print("Database connection OK: MongoDB ping returned ok=1.0")
        else:
            print("Unexpected result from database connection check")
        return bool(ok)
    except Exception:
        print(
            "Database connection FAILED. "
            "Verify the cluster is reachable and MONGODB_URI in backend/.env is correct."
        )
        return False


async def check_connection() -> bool:
    """Async entry point used by the FastAPI lifespan."""
    return await check_connection_async()


async def _main() -> None:
    success = await check_connection_async()
    sys.exit(0 if success else 1)


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()