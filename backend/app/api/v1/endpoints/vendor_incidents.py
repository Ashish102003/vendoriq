from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....db.repository import count_docs, find_doc
from ....dependencies.auth import get_current_user
from ....models import Incident, User, Vendor
from ....models.enums import IncidentSeverity, IncidentStatus
from ....schemas.incident import VendorIncidentSummary

router = APIRouter()


@router.get("/{vendor_id}/incident-summary", response_model=VendorIncidentSummary)
async def get_vendor_incident_summary(
    vendor_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = await find_doc(db, "vendors", Vendor, {"id": vendor_id})
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    base_criteria = {"vendor_id": vendor_id}
    total = await count_docs(db, "incidents", base_criteria)
    status_rows = await db["incidents"].aggregate(
        [
            {"$match": base_criteria},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
    ).to_list(None)
    status_counts = {row["_id"]: row["count"] for row in status_rows}
    severity_rows = await db["incidents"].aggregate(
        [
            {"$match": base_criteria},
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
        ]
    ).to_list(None)
    severity_counts = {row["_id"]: row["count"] for row in severity_rows}
    agg = await db["incidents"].aggregate(
        [
            {"$match": base_criteria},
            {"$group": {"_id": None, "average": {"$avg": "$impact_score"}}},
        ]
    ).to_list(None)
    raw_average = agg[0]["average"] if agg else None
    average = round(float(raw_average), 2) if raw_average is not None else None

    return VendorIncidentSummary(
        vendor_id=vendor_id,
        total_incidents=total,
        open_incidents=status_counts.get(IncidentStatus.OPEN.value, 0),
        in_progress_incidents=status_counts.get(IncidentStatus.IN_PROGRESS.value, 0),
        resolved_incidents=status_counts.get(IncidentStatus.RESOLVED.value, 0),
        closed_incidents=status_counts.get(IncidentStatus.CLOSED.value, 0),
        critical_incidents=severity_counts.get(IncidentSeverity.CRITICAL.value, 0),
        high_incidents=severity_counts.get(IncidentSeverity.HIGH.value, 0),
        medium_incidents=severity_counts.get(IncidentSeverity.MEDIUM.value, 0),
        low_incidents=severity_counts.get(IncidentSeverity.LOW.value, 0),
        average_impact_score=average,
    )