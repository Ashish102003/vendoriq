from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....dependencies.auth import get_current_user
from ....models import Incident, User, Vendor
from ....models.enums import IncidentSeverity, IncidentStatus
from ....schemas.incident import VendorIncidentSummary

router = APIRouter()


@router.get("/{vendor_id}/incident-summary", response_model=VendorIncidentSummary)
def get_vendor_incident_summary(
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

    base = db.query(Incident).filter(Incident.vendor_id == vendor_id)
    total = base.count() or 0
    status_counts = {
        row_status: count
        for row_status, count in base.with_entities(
            Incident.status,
            func.count(Incident.id),
        )
        .group_by(Incident.status)
        .all()
    }
    severity_counts = {
        row_severity: count
        for row_severity, count in base.with_entities(
            Incident.severity,
            func.count(Incident.id),
        )
        .group_by(Incident.severity)
        .all()
    }
    raw_average = base.with_entities(
        func.avg(Incident.impact_score)
    ).scalar()
    average = round(float(raw_average), 2) if raw_average is not None else None

    return VendorIncidentSummary(
        vendor_id=vendor_id,
        total_incidents=total,
        open_incidents=status_counts.get(IncidentStatus.OPEN, 0),
        in_progress_incidents=status_counts.get(IncidentStatus.IN_PROGRESS, 0),
        resolved_incidents=status_counts.get(IncidentStatus.RESOLVED, 0),
        closed_incidents=status_counts.get(IncidentStatus.CLOSED, 0),
        critical_incidents=severity_counts.get(IncidentSeverity.CRITICAL, 0),
        high_incidents=severity_counts.get(IncidentSeverity.HIGH, 0),
        medium_incidents=severity_counts.get(IncidentSeverity.MEDIUM, 0),
        low_incidents=severity_counts.get(IncidentSeverity.LOW, 0),
        average_impact_score=average,
    )