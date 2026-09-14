import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....db.repository import (
    attach_evaluation_relations,
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

SORT_FIELDS: dict[str, str] = {
    "evaluation_date": "evaluation_date",
    "quality_score": "quality_score",
    "defect_count": "defect_count",
    "total_items": "total_items",
    "quality_status": "quality_status",
    "created_at": "created_at",
    "updated_at": "updated_at",
}
SORT_ORDER = Literal["asc", "desc"]


async def _get_quality_evaluation_or_404(
    db: AsyncIOMotorDatabase, evaluation_id: int
) -> QualityEvaluation:
    evaluation = await find_doc(
        db, "quality_evaluations", QualityEvaluation, {"id": evaluation_id}
    )
    if evaluation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quality evaluation not found",
        )
    await attach_evaluation_relations(db, [evaluation])
    return evaluation


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
async def get_quality_evaluation_statistics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = await count_docs(db, "quality_evaluations", {})
    status_rows = await db["quality_evaluations"].aggregate(
        [{"$group": {"_id": "$quality_status", "count": {"$sum": 1}}}]
    ).to_list(None)
    status_counts = {row["_id"]: row["count"] for row in status_rows}
    agg = await db["quality_evaluations"].aggregate(
        [
            {
                "$group": {
                    "_id": None,
                    "average": {"$avg": "$quality_score"},
                    "total_defects": {"$sum": "$defect_count"},
                }
            }
        ]
    ).to_list(None)
    if agg:
        raw_average = agg[0]["average"]
        average = round(float(raw_average), 2)
        total_defects = agg[0]["total_defects"] or 0
    else:
        average = None
        total_defects = 0

    return QualityEvaluationStatistics(
        total_evaluations=total,
        excellent=status_counts.get(QualityStatus.EXCELLENT.value, 0),
        good=status_counts.get(QualityStatus.GOOD.value, 0),
        acceptable=status_counts.get(QualityStatus.ACCEPTABLE.value, 0),
        poor=status_counts.get(QualityStatus.POOR.value, 0),
        critical=status_counts.get(QualityStatus.CRITICAL.value, 0),
        average_quality_score=average,
        total_defects=total_defects,
    )


@router.get("", response_model=PaginatedQualityEvaluations)
async def list_quality_evaluations(
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
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    criteria: dict = {}
    if search:
        term = search.strip()
        if term:
            criteria["comments"] = contains(term)
    if vendor_id is not None:
        criteria["vendor_id"] = vendor_id
    if contract_id is not None:
        criteria["contract_id"] = contract_id
    if purchase_order_id is not None:
        criteria["purchase_order_id"] = purchase_order_id
    if quality_status is not None:
        criteria["quality_status"] = quality_status.value

    total = await count_docs(db, "quality_evaluations", criteria)

    sort = [(SORT_FIELDS[sort_by], 1 if sort_order == "asc" else -1)]
    evaluations = await find_docs(
        db,
        "quality_evaluations",
        QualityEvaluation,
        criteria,
        sort=sort,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    await attach_evaluation_relations(db, evaluations)

    total_pages = math.ceil(total / page_size) if total else 0
    return {
        "items": evaluations,
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
async def create_quality_evaluation(
    payload: QualityEvaluationCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*QUALITY_EDITOR_ROLES)),
):
    await _validate_vendor(db, payload.vendor_id)
    await _validate_contract(db, payload.vendor_id, payload.contract_id)
    await _validate_purchase_order(
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
    await insert_doc(db, "quality_evaluations", evaluation)
    await attach_evaluation_relations(db, [evaluation])
    return evaluation


@router.get("/{evaluation_id}", response_model=QualityEvaluationDetailResponse)
async def get_quality_evaluation(
    evaluation_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_quality_evaluation_or_404(db, evaluation_id)


@router.patch("/{evaluation_id}", response_model=QualityEvaluationDetailResponse)
async def update_quality_evaluation(
    evaluation_id: int,
    payload: QualityEvaluationUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(require_roles(*QUALITY_EDITOR_ROLES)),
):
    existing = await find_doc(
        db, "quality_evaluations", QualityEvaluation, {"id": evaluation_id}
    )
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quality evaluation not found",
        )
    data = payload.model_dump(exclude_unset=True)

    vendor_id = data.get("vendor_id", existing.vendor_id)
    if data.get("vendor_id") is not None:
        await _validate_vendor(db, vendor_id)
    elif "vendor_id" in data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Vendor is required",
        )

    contract_id = data.get("contract_id", existing.contract_id)
    purchase_order_id = data.get("purchase_order_id", existing.purchase_order_id)
    await _validate_contract(db, vendor_id, contract_id)
    await _validate_purchase_order(db, vendor_id, purchase_order_id, contract_id)

    quality_score = data.get("quality_score", existing.quality_score)
    quality_status = data.get("quality_status", existing.quality_status)
    defect_count = data.get("defect_count", existing.defect_count)
    total_items = data.get("total_items", existing.total_items)
    _validate_quality_rules(
        quality_score,
        quality_status,
        defect_count,
        total_items,
    )

    update_fields = {
        "vendor_id",
        "contract_id",
        "purchase_order_id",
        "evaluation_date",
        "quality_score",
        "defect_count",
        "total_items",
        "quality_status",
        "comments",
    }
    values = {field: data[field] for field in update_fields & set(data)}
    await update_doc(db, "quality_evaluations", {"id": evaluation_id}, values)
    return await _get_quality_evaluation_or_404(db, evaluation_id)