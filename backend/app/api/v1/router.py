from fastapi import APIRouter
from .endpoints import (
    analytics,
    auth,
    contracts,
    health,
    incidents,
    purchase_orders,
    quality_evaluations,
    users,
    vendor_categories,
    vendor_incidents,
    vendor_operations,
    vendor_performance,
    vendor_quality,
    vendor_risk,
    vendors,
)


api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(
    vendor_performance.router,
    prefix="/vendors",
    tags=["vendor-performance"],
)
api_router.include_router(vendors.router, prefix="/vendors", tags=["vendors"])
api_router.include_router(
    vendor_operations.router,
    prefix="/vendors",
    tags=["vendor-operations"],
)
api_router.include_router(
    vendor_quality.router,
    prefix="/vendors",
    tags=["vendor-quality"],
)
api_router.include_router(
    vendor_incidents.router,
    prefix="/vendors",
    tags=["vendor-incidents"],
)
api_router.include_router(
    vendor_categories.router,
    prefix="/vendor-categories",
    tags=["vendor-categories"],
)
api_router.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
api_router.include_router(
    purchase_orders.router,
    prefix="/purchase-orders",
    tags=["purchase-orders"],
)
api_router.include_router(
    quality_evaluations.router,
    prefix="/quality-evaluations",
    tags=["quality-evaluations"],
)
api_router.include_router(
    incidents.router,
    prefix="/incidents",
    tags=["incidents"],
)
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["analytics"],
)
api_router.include_router(
    vendor_risk.router,
    prefix="",
    tags=["vendor-risk"],
)
api_router.include_router(
    vendor_risk.vendor_router,
    prefix="/vendors",
    tags=["vendor-risk"],
)