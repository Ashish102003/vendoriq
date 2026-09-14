import math
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from ....core.database import get_db
from ....db.repository import (
    attach_incident_relations,
    contains,
    count_docs,
    find_doc,
    find_docs,
    insert_doc,
    update_doc,
)
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

SORT_FIELDS: dict[str, str] = {
    "incident_number": "incident_number",
    "reported_date": "reported_date",
    "due_date": "due_date",
    "impact_score": "impact_score",
    "incident_type": "incident_type",
    "severity": "severity",
    "status": "status",
    "created_at": "created_at",
    "updated_at": "updated_at",
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


async def _get_incident_or_404(
    db: AsyncIOMotorDatabase, incident_id: int
) -> Incident:
    incident = await find_doc(db, "incidents", Incident, {"id": incident_id})
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    await attach_incident_relations(db, [incident])
    return incident


async def _validate_vendor(db: AsyncIOMotorDatabase, vendor_id: int) -> None:
    if await find_doc(db, "vendors", Vendor, {"id": vendor_id}) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )


async def _validate_contract(
    db: AsyncIOMotorDatabase, vendor_id: int, contract_id: int | None
) -> None:
    if contract_id is None:
        return
    contract = await find_doc(db, "contracts", Contract, {"id": contract_id})
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


async def _validate_purchase_order(
    db: AsyncIOMotorDatabase,
    vendor_id: int,
    purchase_order_id: int | None,
    contract_id: int | None,
) -> None:
    if purchase_order_id is None:
        return
    po = await find_doc(db, "purchase_orders", PurchaseOrder, {"id": purchase_order_id})
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


async def _validate_assigned_user(db: AsyncIOMotorDatabase, user_id: int | None) -> None:
    if user_id is None:
        return
    if await find_doc(db, "users", User, {"id": user_id}) is None:
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


async def _generate_incident_number(db: AsyncIOMotorDatabase) -> str:
    rows = await db["incidents"].aggregate(
        [
            {"$match": {"incident_number": {"$regex": "^INC-"}}},
            {
                "$project": {
                    "sequence": {
                        "$toInt": {"$substrCP": ["$incident_number", 4, -1]}
                    }
                }
            },
            {"$group": {"_id": None, "max": {"$max": "$sequence"}}},
        ]
    ).to_list(None)
    max_sequence = rows[0]["max"] if rows else 0
    next_sequence = (max_sequence or 0) + 1
    return f"INC-{next_sequence:06d}"


@router.get("/statistics", response_model=IncidentStatistics)
async def get_incident_statistics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = await count_docs(db, "incidents", {})
    status_rows = await db["incidents"].aggregate(
        [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    ).to_list(None)
    status_counts = {row["_id"]: row["count"] for row in status_rows}
    severity_rows = await db["incidents"].aggregate(
        [{"$group": {"_id": "$severity", "count": {"$sum": 1}}}]
    ).to_list(None)
    severity_counts = {row["_id"]: row["count"] for row in severity_rows}
    overdue = await count_docs(
        db,
        "incidents",
        {
            "status": {
                "$in": [IncidentStatus.OPEN.value, IncidentStatus.IN_PROGRESS.value]
            },
            "due_date": {"$ne": None, "$lt": date.today().isoformat()},
        },
    )
    agg = await db["incidents"].aggregate(
        [{"$group": {"_id": None, "average": {"$avg": "$impact_score"}}}]
    ).to_list(None)
    raw_average = agg[0]["average"] if agg else None
    average = round(float(raw_average), 2) if raw_average is not None else None

    return IncidentStatistics(
        total_incidents=total,
        open=status_counts.get(IncidentStatus.OPEN.value, 0),
        in_progress=status_counts.get(IncidentStatus.IN_PROGRESS.value, 0),
        resolved=status_counts.get(IncidentStatus.RESOLVED.value, 0),
        closed=status_counts.get(IncidentStatus.CLOSED.value, 0),
        critical=severity_counts.get(IncidentSeverity.CRITICAL.value, 0),
        high=severity_counts.get(IncidentSeverity.HIGH.value, 0),
        medium=severity_counts.get(IncidentSeverity.MEDIUM.value, 0),
        low=severity_counts.get(IncidentSeverity.LOW.value, 0),
        overdue=overdue,
        average_impact_score=average,
    )


@router.get("", response_model=PaginatedIncidents)
async def list_incidents(
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
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must not be after date_to.",
        )

    criteria: dict = {}
    if search:
        term = search.strip()
        if term:
            pattern = contains(term)
            criteria["$or"] = [
                {"incident_number": pattern},
                {"title": pattern},
                {"description": pattern},
            ]
    if vendor_id is not None:
        criteria["vendor_id"] = vendor_id
    if contract_id is not None:
        criteria["contract_id"] = contract_id
    if purchase_order_id is not None:
        criteria["purchase_order_id"] = purchase_order_id
    if incident_type is not None:
        criteria["incident_type"] = incident_type.value
    if severity is not None:
        criteria["severity"] = severity.value
    if incident_status is not None:
        criteria["status"] = incident_status.value
    if date_from is not None:
        criteria["reported_date"] = {"$gte": date_from.isoformat()}
        if date_to is not None:
            criteria["reported_date"]["$lte"] = date_to.isoformat()
    elif date_to is not None:
        criteria["reported_date"] = {"$lte": date_to.isoformat()}

    total = await count_docs(db, "incidents", criteria)

    sort = [(SORT_FIELDS[sort_by], 1 if sort_order == "asc" else -1)]
    incidents = await find_docs(
        db,
        "incidents",
        Incident,
        criteria,
        sort=sort,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    await attach_incident_relations(db, incidents)

    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": incidents,
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
async def create_incident(
    payload: IncidentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*INCIDENT_EDITOR_ROLES)),
):
    if payload.status is not None and payload.status != IncidentStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A new incident must be created with a status of OPEN.",
        )

    await _validate_vendor(db, payload.vendor_id)
    await _validate_contract(db, payload.vendor_id, payload.contract_id)
    await _validate_purchase_order(
        db,
        payload.vendor_id,
        payload.purchase_order_id,
        payload.contract_id,
    )
    await _validate_assigned_user(db, payload.assigned_to)

    for _ in range(5):
        candidate_number = await _generate_incident_number(db)
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
        try:
            await insert_doc(db, "incidents", incident)
        except DuplicateKeyError:
            continue
        await attach_incident_relations(db, [incident])
        return incident
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Unable to generate a unique incident number. Please retry.",
    )


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
async def get_incident(
    incident_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_incident_or_404(db, incident_id)


@router.patch("/{incident_id}", response_model=IncidentDetailResponse)
async def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*INCIDENT_EDITOR_ROLES)),
):
    incident = await find_doc(db, "incidents", Incident, {"id": incident_id})
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    if incident.status == IncidentStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The incident is closed and can no longer be modified.",
        )

    data = payload.model_dump(exclude_unset=True)
    previous_status = incident.status

    values = {field: data[field] for field in data if field in {"title", "description", "incident_type", "severity", "impact_score", "resolution_notes"}}

    if "status" in data and data["status"] is not None:
        desired = data["status"]
        _validate_incident_status(previous_status, desired)
        values["status"] = desired.value
    elif "status" in data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status must not be null.",
        )

    if "contract_id" in data:
        values["contract_id"] = data["contract_id"]
    if "purchase_order_id" in data:
        values["purchase_order_id"] = data["purchase_order_id"]
    if "assigned_to" in data:
        values["assigned_to"] = data["assigned_to"]
    if "due_date" in data:
        values["due_date"] = data["due_date"]
    if "resolved_date" in data:
        values["resolved_date"] = data["resolved_date"]

    merged = incident.model_copy(update=values)
    if "incident_type" in values:
        merged.incident_type = IncidentType(values["incident_type"])
    if "severity" in values:
        merged.severity = IncidentSeverity(values["severity"])
    if "status" in values:
        merged.status = IncidentStatus(values["status"])

    await _validate_contract(db, merged.vendor_id, merged.contract_id)
    await _validate_purchase_order(
        db,
        merged.vendor_id,
        merged.purchase_order_id,
        merged.contract_id,
    )
    await _validate_assigned_user(db, merged.assigned_to)
    _validate_dates(merged)
    _validate_resolution(merged)

    if merged.resolved_date != values.get("resolved_date"):
        values["resolved_date"] = merged.resolved_date

    await update_doc(db, "incidents", {"id": incident_id}, values)
    return await _get_incident_or_404(db, incident_id)