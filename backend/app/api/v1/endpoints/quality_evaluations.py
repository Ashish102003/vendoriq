import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ....core.database import get_db
from ....dependencies.auth import get_current_user, require_roles
from ....models import (
    Contract,
    PurchaseOrder,
    QualityEvaluation,
    User,
    Vendor,
)
from ....models.enums import QualityStatus
from ....schemas.quality_evaluation import (
    PaginatedQualityEvaluations,
    QualityEvaluationCreate,
    QualityEvaluationDetailResponse,
    QualityEvaluationStatistics,
    QualityEvaluationUpdate,
    validate_defects,
    validate_status_score,
)

router = APIRouter()

QUALITY_EDITOR_ROLES = (
    "Admin",
    "Vendor Manager",
    "Procurement Manager",
    "Project Manager",
)

SORT_FIELDS: dict[str, object] = {
    "evaluation_date": QualityEvaluation.evaluation_date,
    "quality_score": QualityEvaluation.quality_score,
    "defect_count": QualityEvaluation.defect_count,
    "total_items": QualityEvaluation.total_items,
    "quality_status": QualityEvaluation.quality_status,
    "created_at": QualityEvaluation.created_at,
    "updated_at": QualityEvaluation.updated_at,
}
SORT_ORDER = Literal["asc", "desc"]


def _evaluation_query(db: Session):
    return db.query(QualityEvaluation).options(
        joinedload(QualityEvaluation.vendor),
        joinedload(QualityEvaluation.contract),
        joinedload(QualityEvaluation.purchase_order),
        joinedload(QualityEvaluation.created_by_user),
    )


def _get_quality_evaluation_or_404(db: Session, evaluation_id: int) -> QualityEvaluation:
    evaluation = (
        _evaluation_query(db)
        .filter(QualityEvaluation.id == evaluation_id)
        .first()
    )
    if evaluation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quality evaluation not found",
        )
    return evaluation


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


def _validate_quality_rules(
    score: int, quality_status: QualityStatus, defect_count: int, total_items: int
) -> None:
    try:
        validate_status_score(quality_status, score)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected quality status does not match the quality score.",
        )
    try:
        validate_defects(defect_count, total_items)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="defect_count must not exceed total_items",
        )


@router.get("/statistics", response_model=QualityEvaluationStatistics)
def get_quality_evaluation_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(func.count(QualityEvaluation.id)).scalar() or 0
    status_counts = {
        row_status: count
        for row_status, count in db.query(
            QualityEvaluation.quality_status,
            func.count(QualityEvaluation.id),
        )
        .group_by(QualityEvaluation.quality_status)
        .all()
    }
    raw_average = db.query(func.avg(QualityEvaluation.quality_score)).scalar()
    average = round(float(raw_average), 2) if raw_average is not None else None
    total_defects = db.query(func.sum(QualityEvaluation.defect_count)).scalar() or 0

    return QualityEvaluationStatistics(
        total_evaluations=total,
        excellent=status_counts.get(QualityStatus.EXCELLENT, 0),
        good=status_counts.get(QualityStatus.GOOD, 0),
        acceptable=status_counts.get(QualityStatus.ACCEPTABLE, 0),
        poor=status_counts.get(QualityStatus.POOR, 0),
        critical=status_counts.get(QualityStatus.CRITICAL, 0),
        average_quality_score=average,
        total_defects=total_defects,
    )


@router.get("", response_model=PaginatedQualityEvaluations)
def list_quality_evaluations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    vendor_id: int | None = None,
    contract_id: int | None = None,
    purchase_order_id: int | None = None,
    quality_status: QualityStatus | None = None,
    sort_by: Literal[
        "evaluation_date",
        "quality_score",
        "defect_count",
        "total_items",
        "quality_status",
        "created_at",
        "updated_at",
    ] = "created_at",
    sort_order: SORT_ORDER = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = []
    if search:
        term = search.strip()
        if term:
            like = f"%{term}%"
            conditions.append(QualityEvaluation.comments.ilike(like))
    if vendor_id is not None:
        conditions.append(QualityEvaluation.vendor_id == vendor_id)
    if contract_id is not None:
        conditions.append(QualityEvaluation.contract_id == contract_id)
    if purchase_order_id is not None:
        conditions.append(QualityEvaluation.purchase_order_id == purchase_order_id)
    if quality_status is not None:
        conditions.append(QualityEvaluation.quality_status == quality_status)

    base = db.query(QualityEvaluation)
    if conditions:
        base = base.filter(*conditions)
    total = base.count() or 0

    items_query = _evaluation_query(db)
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
    response_model=QualityEvaluationDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_quality_evaluation(
    payload: QualityEvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*QUALITY_EDITOR_ROLES)),
):
    _validate_vendor(db, payload.vendor_id)
    _validate_contract(db, payload.vendor_id, payload.contract_id)
    _validate_purchase_order(
        db,
        payload.vendor_id,
        payload.purchase_order_id,
        payload.contract_id,
    )
    _validate_quality_rules(
        payload.quality_score,
        payload.quality_status,
        payload.defect_count,
        payload.total_items,
    )

    evaluation = QualityEvaluation(
        vendor_id=payload.vendor_id,
        contract_id=payload.contract_id,
        purchase_order_id=payload.purchase_order_id,
        evaluation_date=payload.evaluation_date,
        quality_score=payload.quality_score,
        defect_count=payload.defect_count,
        total_items=payload.total_items,
        quality_status=payload.quality_status,
        comments=payload.comments,
        created_by=current_user.id,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return (
        _evaluation_query(db)
        .filter(QualityEvaluation.id == evaluation.id)
        .first()
    )


@router.get("/{evaluation_id}", response_model=QualityEvaluationDetailResponse)
def get_quality_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_quality_evaluation_or_404(db, evaluation_id)


@router.patch("/{evaluation_id}", response_model=QualityEvaluationDetailResponse)
def update_quality_evaluation(
    evaluation_id: int,
    payload: QualityEvaluationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*QUALITY_EDITOR_ROLES)),
):
    evaluation = _get_quality_evaluation_or_404(db, evaluation_id)
    data = payload.model_dump(exclude_unset=True)

    if "vendor_id" in data:
        if data["vendor_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Vendor is required",
            )
        _validate_vendor(db, data["vendor_id"])
        evaluation.vendor_id = data["vendor_id"]

    for field in ("contract_id", "purchase_order_id"):
        if field in data:
            setattr(evaluation, field, data[field])

    for field in (
        "evaluation_date",
        "quality_score",
        "defect_count",
        "total_items",
        "quality_status",
        "comments",
    ):
        if field in data:
            setattr(evaluation, field, data[field])

    _validate_contract(db, evaluation.vendor_id, evaluation.contract_id)
    _validate_purchase_order(
        db,
        evaluation.vendor_id,
        evaluation.purchase_order_id,
        evaluation.contract_id,
    )
    _validate_quality_rules(
        evaluation.quality_score,
        evaluation.quality_status,
        evaluation.defect_count,
        evaluation.total_items,
    )

    db.commit()
    db.refresh(evaluation)
    return (
        _evaluation_query(db)
        .filter(QualityEvaluation.id == evaluation.id)
        .first()
    )