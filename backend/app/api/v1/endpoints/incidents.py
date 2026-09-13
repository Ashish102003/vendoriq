import math
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Integer, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ....core.database import get_db
from ....dependencies.auth import get_current_user, require_roles
from ....models import (
    Contract,
    Incident,
    PurchaseOrder,
    User,
    Vendor,
)
from ....models.enums import IncidentSeverity, IncidentStatus, IncidentType
from ....schemas.incident import (
    IncidentCreate,
    IncidentDetailResponse,
    IncidentStatistics,
    IncidentUpdate,
    PaginatedIncidents,
)

router = APIRouter()

INCIDENT_EDITOR_ROLES = (
    "Admin",
    "Vendor Manager",
    "Procurement Manager",
    "Project Manager",
)

SORT_FIELDS: dict[str, object] = {
    "incident_number": Incident.incident_number,
    "reported_date": Incident.reported_date,
    "due_date": Incident.due_date,
    "impact_score": Incident.impact_score,
    "incident_type": Incident.incident_type,
    "severity": Incident.severity,
    "status": Incident.status,
    "created_at": Incident.created_at,
    "updated_at": Incident.updated_at,
}
SORT_ORDER = Literal["asc", "desc"]

ALLOWED_TRANSITIONS: dict[IncidentStatus, set[IncidentStatus]] = {
    IncidentStatus.OPEN: {
        IncidentStatus.OPEN,
        IncidentStatus.IN_PROGRESS,
        IncidentStatus.RESOLVED,
    },
    IncidentStatus.IN_PROGRESS: {
        IncidentStatus.IN_PROGRESS,
        IncidentStatus.RESOLVED,
    },
    IncidentStatus.RESOLVED: {
        IncidentStatus.RESOLVED,
        IncidentStatus.CLOSED,
    },
    IncidentStatus.CLOSED: set(),
}


def _incident_query(db: Session):
    return db.query(Incident).options(
        joinedload(Incident.vendor),
        joinedload(Incident.contract),
        joinedload(Incident.purchase_order),
        joinedload(Incident.reported_by_user),
        joinedload(Incident.assigned_to_user),
    )


def _get_incident_or_404(db: Session, incident_id: int) -> Incident:
    incident = (
        _incident_query(db)
        .filter(Incident.id == incident_id)
        .first()
    )
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return incident


def _validate_vendor(db: Session, vendor_id: int) -> None:
    if db.get(Vendor, vendor_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )


def _validate_contract(
    db: Session, vendor_id: int, contract_id: int | None
) -> None:
    if contract_id is None:
        return
    contract = db.get(Contract, contract_id)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )
    if contract.vendor_id != vendor_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected contract does not belong to the selected vendor.",
        )


def _validate_purchase_order(
    db: Session,
    vendor_id: int,
    purchase_order_id: int | None,
    contract_id: int | None,
) -> None:
    if purchase_order_id is None:
        return
    po = db.get(PurchaseOrder, purchase_order_id)
    if po is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )
    if po.vendor_id != vendor_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected purchase order does not belong to the selected vendor.",
        )
    if contract_id is not None and po.contract_id != contract_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected purchase order is linked to a different contract.",
        )


def _validate_assigned_user(db: Session, user_id: int | None) -> None:
    if user_id is None:
        return
    if db.get(User, user_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned user not found",
        )


def _validate_incident_status(
    current: IncidentStatus, desired: IncidentStatus
) -> None:
    if desired not in ALLOWED_TRANSITIONS[current]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Cannot transition incident status from "
                f"{current.value} to {desired.value}."
            ),
        )


def _validate_resolution(incident: Incident) -> None:
    """Ensure resolved incidents carry resolution notes and a resolved date."""
    if incident.status not in (
        IncidentStatus.RESOLVED,
        IncidentStatus.CLOSED,
    ):
        return
    if not (incident.resolution_notes or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="resolution_notes are required when an incident is RESOLVED or CLOSED.",
        )
    if incident.resolved_date is None:
        incident.resolved_date = date.today()


def _validate_dates(incident: Incident) -> None:
    if incident.due_date is not None and incident.due_date < incident.reported_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="due_date must not be before the reported date.",
        )
    if (
        incident.resolved_date is not None
        and incident.resolved_date < incident.reported_date
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="resolved_date must not be before the reported date.",
        )


def _generate_incident_number(db: Session) -> str:
    max_sequence = db.query(
        func.max(
            func.cast(func.substring(Incident.incident_number, 5), Integer)
        )
    ).scalar()
    next_sequence = (max_sequence or 0) + 1
    return f"INC-{next_sequence:06d}"


@router.get("/statistics", response_model=IncidentStatistics)
def get_incident_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(func.count(Incident.id)).scalar() or 0
    status_counts = {
        row_status: count
        for row_status, count in db.query(
            Incident.status,
            func.count(Incident.id),
        )
        .group_by(Incident.status)
        .all()
    }
    severity_counts = {
        row_severity: count
        for row_severity, count in db.query(
            Incident.severity,
            func.count(Incident.id),
        )
        .group_by(Incident.severity)
        .all()
    }
    overdue = (
        db.query(func.count(Incident.id))
        .filter(
            Incident.status.in_(
                [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS]
            ),
            Incident.due_date.isnot(None),
            Incident.due_date < date.today(),
        )
        .scalar()
        or 0
    )
    raw_average = db.query(func.avg(Incident.impact_score)).scalar()
    average = round(float(raw_average), 2) if raw_average is not None else None

    return IncidentStatistics(
        total_incidents=total,
        open=status_counts.get(IncidentStatus.OPEN, 0),
        in_progress=status_counts.get(IncidentStatus.IN_PROGRESS, 0),
        resolved=status_counts.get(IncidentStatus.RESOLVED, 0),
        closed=status_counts.get(IncidentStatus.CLOSED, 0),
        critical=severity_counts.get(IncidentSeverity.CRITICAL, 0),
        high=severity_counts.get(IncidentSeverity.HIGH, 0),
        medium=severity_counts.get(IncidentSeverity.MEDIUM, 0),
        low=severity_counts.get(IncidentSeverity.LOW, 0),
        overdue=overdue,
        average_impact_score=average,
    )


@router.get("", response_model=PaginatedIncidents)
def list_incidents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    vendor_id: int | None = None,
    contract_id: int | None = None,
    purchase_order_id: int | None = None,
    incident_type: IncidentType | None = None,
    severity: IncidentSeverity | None = None,
    incident_status: IncidentStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: Literal[
        "incident_number",
        "reported_date",
        "due_date",
        "impact_score",
        "incident_type",
        "severity",
        "status",
        "created_at",
        "updated_at",
    ] = "created_at",
    sort_order: SORT_ORDER = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must not be after date_to.",
        )

    conditions = []
    if search:
        term = search.strip()
        if term:
            like = f"%{term}%"
            conditions.append(
                Incident.incident_number.ilike(like)
                | Incident.title.ilike(like)
                | Incident.description.ilike(like)
            )
    if vendor_id is not None:
        conditions.append(Incident.vendor_id == vendor_id)
    if contract_id is not None:
        conditions.append(Incident.contract_id == contract_id)
    if purchase_order_id is not None:
        conditions.append(Incident.purchase_order_id == purchase_order_id)
    if incident_type is not None:
        conditions.append(Incident.incident_type == incident_type)
    if severity is not None:
        conditions.append(Incident.severity == severity)
    if incident_status is not None:
        conditions.append(Incident.status == incident_status)
    if date_from is not None:
        conditions.append(Incident.reported_date >= date_from)
    if date_to is not None:
        conditions.append(Incident.reported_date <= date_to)

    base = db.query(Incident)
    if conditions:
        base = base.filter(*conditions)
    total = base.count() or 0

    items_query = _incident_query(db)
    if conditions:
        items_query = items_query.filter(*conditions)

    order_column: object = SORT_FIELDS[sort_by]
    if sort_order == "desc":
        order_column = order_column.desc()
    items = (
        items_query.order_by(order_column)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post(
    "",
    response_model=IncidentDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*INCIDENT_EDITOR_ROLES)),
):
    if payload.status is not None and payload.status != IncidentStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A new incident must be created with a status of OPEN.",
        )

    _validate_vendor(db, payload.vendor_id)
    _validate_contract(db, payload.vendor_id, payload.contract_id)
    _validate_purchase_order(
        db,
        payload.vendor_id,
        payload.purchase_order_id,
        payload.contract_id,
    )
    _validate_assigned_user(db, payload.assigned_to)

    for _ in range(5):
        candidate_number = _generate_incident_number(db)
        incident = Incident(
            incident_number=candidate_number,
            vendor_id=payload.vendor_id,
            contract_id=payload.contract_id,
            purchase_order_id=payload.purchase_order_id,
            title=payload.title,
            description=payload.description,
            incident_type=payload.incident_type,
            severity=payload.severity,
            status=IncidentStatus.OPEN,
            reported_date=payload.reported_date,
            due_date=payload.due_date,
            impact_score=payload.impact_score,
            reported_by=current_user.id,
            assigned_to=payload.assigned_to,
        )
        _validate_dates(incident)
        db.add(incident)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            continue
        db.refresh(incident)
        return (
            _incident_query(db)
            .filter(Incident.id == incident.id)
            .first()
        )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Unable to generate a unique incident number. Please retry.",
    )


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_incident_or_404(db, incident_id)


@router.patch("/{incident_id}", response_model=IncidentDetailResponse)
def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*INCIDENT_EDITOR_ROLES)),
):
    incident = _get_incident_or_404(db, incident_id)

    if incident.status == IncidentStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The incident is closed and can no longer be modified.",
        )

    data = payload.model_dump(exclude_unset=True)
    previous_status = incident.status

    for field in (
        "title",
        "description",
        "incident_type",
        "severity",
        "impact_score",
        "resolution_notes",
    ):
        if field in data:
            setattr(incident, field, data[field])

    if "status" in data and data["status"] is not None:
        desired = data["status"]
        _validate_incident_status(previous_status, desired)
        incident.status = desired
    elif "status" in data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status must not be null.",
        )

    if "contract_id" in data:
        incident.contract_id = data["contract_id"]
    if "purchase_order_id" in data:
        incident.purchase_order_id = data["purchase_order_id"]
    if "assigned_to" in data:
        incident.assigned_to = data["assigned_to"]
    if "due_date" in data:
        incident.due_date = data["due_date"]
    if "resolved_date" in data:
        incident.resolved_date = data["resolved_date"]

    _validate_contract(db, incident.vendor_id, incident.contract_id)
    _validate_purchase_order(
        db,
        incident.vendor_id,
        incident.purchase_order_id,
        incident.contract_id,
    )
    _validate_assigned_user(db, incident.assigned_to)
    _validate_dates(incident)
    _validate_resolution(incident)

    db.commit()
    db.refresh(incident)
    return (
        _incident_query(db)
        .filter(Incident.id == incident.id)
        .first()
    )