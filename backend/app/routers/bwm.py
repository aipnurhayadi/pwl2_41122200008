from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pulp import LpMinimize, LpProblem, LpStatus, LpVariable, PULP_CBC_CMD, lpSum, value
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import (
    WRITE_ALLOWED_ROLES,
    get_current_user,
    get_dataset_for_user,
    require_any_role,
)

router = APIRouter(tags=["bwm"])

BWM_CI_BY_A_BW = {
    1: 0.0,
    2: 0.44,
    3: 1.0,
    4: 1.63,
    5: 2.3,
    6: 3.0,
    7: 3.73,
    8: 4.47,
    9: 5.23,
}


def _criterion_code_prefix(criterion_type: models.ConstraintTypeEnum) -> str:
    return "SFT" if criterion_type == models.ConstraintTypeEnum.SOFT else "HRD"


def _normalize_criterion_code(code: str) -> str:
    return code.strip().upper()


def _next_criterion_code(db: Session, criterion_type: models.ConstraintTypeEnum) -> str:
    prefix = _criterion_code_prefix(criterion_type)
    rows = (
        db.query(models.Criterion.code)
        .filter(models.Criterion.type == criterion_type)
        .all()
    )

    max_n = 0
    for (code,) in rows:
        value = (code or "").strip().upper()
        if value.startswith(f"{prefix}_"):
            suffix = value[len(prefix) + 1 :]
            if suffix.isdigit():
                max_n = max(max_n, int(suffix))

    return f"{prefix}_{max_n + 1:03d}"


def _get_dataset_lecturer(dataset_id: int, lecturer_id: int, db: Session) -> models.Lecturer:
    lecturer = (
        db.query(models.Lecturer)
        .filter(
            models.Lecturer.id == lecturer_id,
            models.Lecturer.dataset_id == dataset_id,
            models.Lecturer.deleted_at.is_(None),
        )
        .first()
    )
    if not lecturer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecturer not found")
    return lecturer


def _resolve_target_lecturer(
    dataset_id: int,
    current_user: models.User,
    db: Session,
    lecturer_id: int | None = None,
) -> models.Lecturer:
    if current_user.role == models.UserRoleEnum.LECTURER.value:
        if not current_user.employee_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee profile not available")
        lecturer = (
            db.query(models.Lecturer)
            .filter(
                models.Lecturer.dataset_id == dataset_id,
                models.Lecturer.employee_id == current_user.employee_profile.id,
                models.Lecturer.deleted_at.is_(None),
            )
            .first()
        )
        if not lecturer:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Lecturer assignment not found")
        return lecturer

    if current_user.role in WRITE_ALLOWED_ROLES:
        if lecturer_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lecturer_id query param is required")
        return _get_dataset_lecturer(dataset_id, lecturer_id, db)

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _load_soft_criteria(db: Session) -> list[models.Criterion]:
    rows = (
        db.query(models.Criterion)
        .filter(models.Criterion.type == models.ConstraintTypeEnum.SOFT)
        .order_by(models.Criterion.id.asc())
        .all()
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Soft criteria is empty")
    return rows


def _vector_to_map(
    vector: list[schemas.BwmVectorInput],
    expected_ids: set[int],
    field_name: str,
) -> dict[int, int]:
    out: dict[int, int] = {}
    for item in vector:
        if item.value < 1 or item.value > 9:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} value must be between 1 and 9",
            )
        out[item.criterion_id] = item.value

    if set(out.keys()) != expected_ids:
        missing = sorted(expected_ids - set(out.keys()))
        extra = sorted(set(out.keys()) - expected_ids)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"{field_name} must include exactly all SOFT criterion IDs",
                "missing": missing,
                "extra": extra,
            },
        )

    return out


def _to_response_read(response: models.BwmResponse) -> schemas.BwmResponseRead:
    return schemas.BwmResponseRead(
        lecturer_id=response.lecturer_id,
        best_criteria_id=response.best_criteria_id,
        worst_criteria_id=response.worst_criteria_id,
        scale_max=response.scale_max,
        ksi=response.ksi,
        consistency_ratio=response.consistency_ratio,
        best_to_others=[
            schemas.BwmVectorRead(criterion_id=row.criterion_id, value=row.value)
            for row in sorted(response.best_to_others, key=lambda x: x.criterion_id)
        ],
        others_to_worst=[
            schemas.BwmVectorRead(criterion_id=row.criterion_id, value=row.value)
            for row in sorted(response.others_to_worst, key=lambda x: x.criterion_id)
        ],
        weights=[
            schemas.BwmWeightRead(criterion_id=row.criterion_id, weight=row.weight)
            for row in sorted(response.weights, key=lambda x: x.criterion_id)
        ],
    )


def _solve_bwm(
    criterion_ids: list[int],
    best_criterion_id: int,
    worst_criterion_id: int,
    best_to_others: dict[int, int],
    others_to_worst: dict[int, int],
) -> tuple[dict[int, float], float, float]:
    model = LpProblem("bwm_solver", LpMinimize)
    weights = {cid: LpVariable(f"w_{cid}", lowBound=0) for cid in criterion_ids}
    ksi = LpVariable("ksi", lowBound=0)

    model += ksi

    for cid in criterion_ids:
        a_bj = float(best_to_others[cid])
        a_jw = float(others_to_worst[cid])

        model += weights[best_criterion_id] - a_bj * weights[cid] <= ksi
        model += a_bj * weights[cid] - weights[best_criterion_id] <= ksi

        model += weights[cid] - a_jw * weights[worst_criterion_id] <= ksi
        model += a_jw * weights[worst_criterion_id] - weights[cid] <= ksi

    model += lpSum(weights[cid] for cid in criterion_ids) == 1

    status_code = model.solve(PULP_CBC_CMD(msg=False))
    status_name = LpStatus.get(status_code, "Unknown")
    if status_name != "Optimal":
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="BWM solver failed")

    solved_weights = {cid: float(value(weights[cid])) for cid in criterion_ids}
    solved_ksi = float(value(ksi))

    a_bw = int(best_to_others[worst_criterion_id])
    ci = BWM_CI_BY_A_BW.get(a_bw, 0.0)
    consistency_ratio = (solved_ksi / ci) if ci > 0 else 0.0

    return solved_weights, solved_ksi, float(consistency_ratio)


@router.get("/api/bwm/criteria", response_model=list[schemas.CriterionRead])
def list_bwm_criteria(db: Session = Depends(get_db)):
    return (
        db.query(models.Criterion)
        .filter(models.Criterion.type == models.ConstraintTypeEnum.SOFT)
        .order_by(models.Criterion.id.asc())
        .all()
    )


@router.post("/api/bwm/criteria", response_model=schemas.CriterionRead, status_code=status.HTTP_201_CREATED)
def create_criterion(
    payload: schemas.CriterionCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    if db.query(models.Criterion).filter(models.Criterion.name == payload.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Criterion name already exists")

    criterion_code = _normalize_criterion_code(payload.code) if payload.code else _next_criterion_code(db, payload.type)
    if db.query(models.Criterion).filter(models.Criterion.code == criterion_code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Criterion code already exists")

    criterion = models.Criterion(**payload.model_dump(exclude={"code"}), code=criterion_code)
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    return criterion


@router.put("/api/datasets/{dataset_id}/bwm/response", response_model=schemas.BwmResponseRead)
def upsert_bwm_response(
    payload: schemas.BwmResponseUpsert,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lecturer_id: int | None = Query(default=None, ge=1),
):
    soft_criteria = _load_soft_criteria(db)
    criterion_ids = [c.id for c in soft_criteria]
    criterion_id_set = set(criterion_ids)

    if payload.best_criteria_id == payload.worst_criteria_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Best and worst criterion must be different")

    if payload.best_criteria_id not in criterion_id_set or payload.worst_criteria_id not in criterion_id_set:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Best/worst must be SOFT criteria")

    best_to_others = _vector_to_map(payload.best_to_others, criterion_id_set, "best_to_others")
    others_to_worst = _vector_to_map(payload.others_to_worst, criterion_id_set, "others_to_worst")

    if best_to_others[payload.best_criteria_id] != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="best_to_others[best] must be 1")
    if others_to_worst[payload.worst_criteria_id] != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="others_to_worst[worst] must be 1")

    lecturer = _resolve_target_lecturer(dataset.id, current_user, db, lecturer_id=lecturer_id)

    response = (
        db.query(models.BwmResponse)
        .filter(models.BwmResponse.dataset_id == dataset.id, models.BwmResponse.lecturer_id == lecturer.id)
        .first()
    )
    if not response:
        response = models.BwmResponse(
            dataset_id=dataset.id,
            lecturer_id=lecturer.id,
            best_criteria_id=payload.best_criteria_id,
            worst_criteria_id=payload.worst_criteria_id,
            scale_max=9,
        )
        db.add(response)
        db.flush()

    response.best_criteria_id = payload.best_criteria_id
    response.worst_criteria_id = payload.worst_criteria_id
    response.ksi = None
    response.consistency_ratio = None

    db.query(models.BwmBestToOther).filter(models.BwmBestToOther.response_id == response.id).delete(synchronize_session=False)
    db.query(models.BwmOtherToWorst).filter(models.BwmOtherToWorst.response_id == response.id).delete(synchronize_session=False)
    db.query(models.BwmWeight).filter(models.BwmWeight.response_id == response.id).delete(synchronize_session=False)

    for cid in criterion_ids:
        db.add(models.BwmBestToOther(response_id=response.id, criterion_id=cid, value=best_to_others[cid]))
        db.add(models.BwmOtherToWorst(response_id=response.id, criterion_id=cid, value=others_to_worst[cid]))

    db.commit()
    db.refresh(response)
    return _to_response_read(response)


@router.post("/api/datasets/{dataset_id}/bwm/solve", response_model=schemas.BwmResponseRead)
def solve_bwm_response(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lecturer_id: int | None = Query(default=None, ge=1),
):
    lecturer = _resolve_target_lecturer(dataset.id, current_user, db, lecturer_id=lecturer_id)

    response = (
        db.query(models.BwmResponse)
        .filter(models.BwmResponse.dataset_id == dataset.id, models.BwmResponse.lecturer_id == lecturer.id)
        .first()
    )
    if not response:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BWM response not found")

    soft_criteria = _load_soft_criteria(db)
    criterion_ids = [c.id for c in soft_criteria]

    best_to_others = {row.criterion_id: row.value for row in response.best_to_others}
    others_to_worst = {row.criterion_id: row.value for row in response.others_to_worst}

    if set(best_to_others.keys()) != set(criterion_ids) or set(others_to_worst.keys()) != set(criterion_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BWM vectors are incomplete")

    solved_weights, solved_ksi, solved_cr = _solve_bwm(
        criterion_ids=criterion_ids,
        best_criterion_id=response.best_criteria_id,
        worst_criterion_id=response.worst_criteria_id,
        best_to_others=best_to_others,
        others_to_worst=others_to_worst,
    )

    db.query(models.BwmWeight).filter(models.BwmWeight.response_id == response.id).delete(synchronize_session=False)
    for cid in criterion_ids:
        db.add(models.BwmWeight(response_id=response.id, criterion_id=cid, weight=solved_weights[cid]))

    response.ksi = solved_ksi
    response.consistency_ratio = solved_cr

    db.commit()
    db.refresh(response)
    return _to_response_read(response)


@router.get("/api/datasets/{dataset_id}/bwm/response", response_model=schemas.BwmResponseRead)
def get_bwm_response(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lecturer_id: int | None = Query(default=None, ge=1),
):
    lecturer = _resolve_target_lecturer(dataset.id, current_user, db, lecturer_id=lecturer_id)

    response = (
        db.query(models.BwmResponse)
        .filter(models.BwmResponse.dataset_id == dataset.id, models.BwmResponse.lecturer_id == lecturer.id)
        .first()
    )
    if not response:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BWM response not found")

    return _to_response_read(response)


@router.get("/api/datasets/{dataset_id}/bwm/weights", response_model=list[schemas.BwmWeightRead])
def get_bwm_weights(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lecturer_id: int | None = Query(default=None, ge=1),
):
    lecturer = _resolve_target_lecturer(dataset.id, current_user, db, lecturer_id=lecturer_id)

    response = (
        db.query(models.BwmResponse)
        .filter(models.BwmResponse.dataset_id == dataset.id, models.BwmResponse.lecturer_id == lecturer.id)
        .first()
    )
    if not response:
        return []

    rows = (
        db.query(models.BwmWeight)
        .join(models.Criterion, models.Criterion.id == models.BwmWeight.criterion_id)
        .filter(
            models.BwmWeight.response_id == response.id,
            models.Criterion.type == models.ConstraintTypeEnum.SOFT,
        )
        .order_by(models.BwmWeight.criterion_id.asc())
        .all()
    )
    return [schemas.BwmWeightRead(criterion_id=row.criterion_id, weight=row.weight) for row in rows]
