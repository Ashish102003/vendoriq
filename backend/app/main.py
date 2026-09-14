from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from .core.config import settings
from .core.cors import setup_cors
from .api.v1.router import api_router
from .db.check_db import check_connection_async

APP_VERSION = "0.2.0"


async def _validate_database() -> None:
    if settings.ENVIRONMENT == "development":
        await check_connection_async()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _validate_database()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Vendor Performance and Risk Management System",
    version=APP_VERSION,
    lifespan=lifespan,
)

setup_cors(app)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "VendorIQ API is running"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


@app.exception_handler(404)
async def not_found_handler(request, exc):
    if isinstance(exc, HTTPException) and exc.detail not in (None, "Not Found"):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(
        status_code=404,
        content={"detail": "Resource not found"}
    )