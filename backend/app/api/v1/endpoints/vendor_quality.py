from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....dependencies.auth import get_current_user
from ....models import QualityEvaluation, User, Vendor
from ....models.enums import QualityStatus
from ....schemas.quality_evaluation import VendorQualitySummary

router = APIRouter()


@router.get("/{vendor_id}/quality-summary", response_model=VendorQualitySummary)
def get_vendor_quality_summary(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    base = db.query(QualityEvaluation).filter(
        QualityEvaluation.vendor_id == vendor_id
    )
    total = base.count() or 0
    status_counts = {
        row_status: count
        for row_status, count in base.with_entities(
            QualityEvaluation.quality_status,
            func.count(QualityEvaluation.id),
        )
        .group_by(QualityEvaluation.quality_status)
        .all()
    }
    raw_average = base.with_entities(
        func.avg(QualityEvaluation.quality_score)
    ).scalar()
    average = round(float(raw_average), 2) if raw_average is not None else None
    total_defects = (
        base.with_entities(func.sum(QualityEvaluation.defect_count)).scalar() or 0
    )

    return VendorQualitySummary(
        vendor_id=vendor_id,
        total_evaluations=total,
        average_quality_score=average,
        excellent_evaluations=status_counts.get(QualityStatus.EXCELLENT, 0),
        good_evaluations=status_counts.get(QualityStatus.GOOD, 0),
        acceptable_evaluations=status_counts.get(QualityStatus.ACCEPTABLE, 0),
        poor_evaluations=status_counts.get(QualityStatus.POOR, 0),
        critical_evaluations=status_counts.get(QualityStatus.CRITICAL, 0),
        total_defects=total_defects,
    )