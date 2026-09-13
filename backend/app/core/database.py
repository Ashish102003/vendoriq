from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings
from ..models.base import Base


if settings.DATABASE_URL:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20,
    )
else:
    engine = None

SessionLocal = (
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
    if engine
    else None
)


def get_db() -> Generator:
    if SessionLocal is None:
        raise RuntimeError("Database not configured. Please set DATABASE_URL.")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()