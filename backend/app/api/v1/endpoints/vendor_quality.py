from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....db.repository import count_docs, find_doc
from ....dependencies.auth import get_current_user
from ....models import QualityEvaluation, User, Vendor
from ....models.enums import QualityStatus
from ....schemas.quality_evaluation import VendorQualitySummary

router = APIRouter()


@router.get("/{vendor_id}/quality-summary", response_model=VendorQualitySummary)
async def get_vendor_quality_summary(
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
    total = await count_docs(db, "quality_evaluations", base_criteria)
    status_rows = await db["quality_evaluations"].aggregate(
        [
            {"$match": base_criteria},
            {"$group": {"_id": "$quality_status", "count": {"$sum": 1}}},
        ]
    ).to_list(None)
    status_counts = {row["_id"]: row["count"] for row in status_rows}
    agg = await db["quality_evaluations"].aggregate(
        [
            {"$match": base_criteria},
            {
                "$group": {
                    "_id": None,
                    "average": {"$avg": "$quality_score"},
                    "total_defects": {"$sum": "$defect_count"},
                }
            },
        ]
    ).to_list(None)
    if agg:
        average = round(float(agg[0]["average"]), 2)
        total_defects = agg[0]["total_defects"] or 0
    else:
        average = None
        total_defects = 0

    return VendorQualitySummary(
        vendor_id=vendor_id,
        total_evaluations=total,
        average_quality_score=average,
        excellent_evaluations=status_counts.get(QualityStatus.EXCELLENT.value, 0),
        good_evaluations=status_counts.get(QualityStatus.GOOD.value, 0),
        acceptable_evaluations=status_counts.get(QualityStatus.ACCEPTABLE.value, 0),
        poor_evaluations=status_counts.get(QualityStatus.POOR.value, 0),
        critical_evaluations=status_counts.get(QualityStatus.CRITICAL.value, 0),
        total_defects=total_defects,
    )