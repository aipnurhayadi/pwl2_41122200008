from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import (
    WRITE_ALLOWED_ROLES,
    get_current_user,
    get_current_user_optional,
    require_any_role,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _generate_dataset_code(db: Session) -> str:
    count = db.query(models.Dataset).count()
    return f"DS{count + 1:03d}"


def _query_dataset_accessible_by_user(
    dataset_id: int,
    current_user: models.User,
    db: Session,
):
    query = db.query(models.Dataset).filter(models.Dataset.id == dataset_id, models.Dataset.deleted_at.is_(None))
    if current_user.role in WRITE_ALLOWED_ROLES:
        if current_user.employee_profile:
            query = query.filter(
                (models.Dataset.user_id == current_user.id)
                | (
                    db.query(models.Lecturer.id)
                    .filter(
                        models.Lecturer.dataset_id == models.Dataset.id,
                        models.Lecturer.employee_id == current_user.employee_profile.id,
                        models.Lecturer.deleted_at.is_(None),
                    )
                    .exists()
                )
            )
        else:
            query = query.filter(models.Dataset.user_id == current_user.id)
    elif current_user.role == models.UserRoleEnum.LECTURER.value:
        if not current_user.employee_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        query = query.filter(
            db.query(models.Lecturer.id)
            .filter(
                models.Lecturer.dataset_id == models.Dataset.id,
                models.Lecturer.employee_id == current_user.employee_profile.id,
                models.Lecturer.deleted_at.is_(None),
            )
            .exists()
        )
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    return query


# Endpoint for employees/lecturers to list datasets they are assigned to.
@router.get("/my", response_model=list[schemas.DatasetRead])
def list_my_datasets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.employee_profile:
        return []
    return (
        db.query(models.Dataset)
        .filter(
            models.Dataset.deleted_at.is_(None),
            db.query(models.Lecturer.id)
            .filter(
                models.Lecturer.dataset_id == models.Dataset.id,
                models.Lecturer.employee_id == current_user.employee_profile.id,
                models.Lecturer.deleted_at.is_(None),
            )
            .exists(),
        )
        .all()
    )


@router.get("/", response_model=list[schemas.DatasetRead] | schemas.PaginatedDatasetRead)
def list_datasets(
    current_user: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
):
    query = db.query(models.Dataset).filter(
        models.Dataset.user_id == current_user.id,
        models.Dataset.deleted_at.is_(None),
    )

    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Dataset.code.ilike(keyword),
                models.Dataset.name.ilike(keyword),
                models.Dataset.description.ilike(keyword),
                cast(models.Dataset.visibility, String).ilike(keyword),
            )
        )

    query = query.order_by(models.Dataset.updated_at.desc())

    if limit is None:
        return query.all()

    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/public", response_model=list[schemas.DatasetRead])
def list_public_datasets(db: Session = Depends(get_db)):
    return (
        db.query(models.Dataset)
        .filter(
            models.Dataset.visibility == models.DatasetVisibilityEnum.PUBLIC,
            models.Dataset.deleted_at.is_(None),
        )
        .order_by(models.Dataset.updated_at.desc())
        .all()
    )


@router.post("/", response_model=schemas.DatasetRead, status_code=status.HTTP_201_CREATED)
def create_dataset(
    payload: schemas.DatasetCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = models.Dataset(user_id=current_user.id, code=_generate_dataset_code(db), **payload.model_dump())
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/{dataset_id}", response_model=schemas.DatasetRead)
def get_dataset(
    dataset_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _query_dataset_accessible_by_user(dataset_id, current_user, db)

    dataset = query.first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


@router.get("/{dataset_id}/tree", response_model=schemas.DatasetTreeRead)
def get_dataset_tree(
    dataset_id: int,
    current_user: models.User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.id == dataset_id, models.Dataset.deleted_at.is_(None))
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    if dataset.visibility != models.DatasetVisibilityEnum.PUBLIC:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        allowed = _query_dataset_accessible_by_user(dataset_id, current_user, db).first()
        if not allowed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    rooms = (
        db.query(models.Room)
        .filter(models.Room.dataset_id == dataset.id, models.Room.deleted_at.is_(None))
        .order_by(models.Room.code.asc())
        .all()
    )
    lecturers = (
        db.query(models.Lecturer, models.Employee)
        .join(models.Employee, models.Employee.id == models.Lecturer.employee_id)
        .filter(models.Lecturer.dataset_id == dataset.id, models.Lecturer.deleted_at.is_(None))
        .order_by(models.Lecturer.code.asc())
        .all()
    )
    courses = (
        db.query(models.Course)
        .filter(models.Course.dataset_id == dataset.id, models.Course.deleted_at.is_(None))
        .order_by(models.Course.code.asc())
        .all()
    )
    time_slots = (
        db.query(models.TimeSlot)
        .filter(models.TimeSlot.dataset_id == dataset.id, models.TimeSlot.deleted_at.is_(None))
        .order_by(models.TimeSlot.day.asc(), models.TimeSlot.start_time.asc(), models.TimeSlot.code.asc())
        .all()
    )
    classes = (
        db.query(models.Class)
        .filter(models.Class.dataset_id == dataset.id, models.Class.deleted_at.is_(None))
        .order_by(models.Class.code.asc())
        .all()
    )

    return {
        "dataset": dataset,
        "rooms": rooms,
        "lecturers": [
            {
                "id": lecturer.id,
                "code": lecturer.code,
                "employee_code": employee.employee_code,
                "name": employee.name,
            }
            for lecturer, employee in lecturers
        ],
        "courses": courses,
        "time_slots": time_slots,
        "classes": classes,
    }


@router.put("/{dataset_id}", response_model=schemas.DatasetRead)
def update_dataset(
    dataset_id: int,
    payload: schemas.DatasetUpdate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = (
        db.query(models.Dataset)
        .filter(
            models.Dataset.id == dataset_id,
            models.Dataset.user_id == current_user.id,
            models.Dataset.deleted_at.is_(None),
        )
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(dataset, k, v)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = (
        db.query(models.Dataset)
        .filter(
            models.Dataset.id == dataset_id,
            models.Dataset.user_id == current_user.id,
            models.Dataset.deleted_at.is_(None),
        )
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    dataset.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.patch("/{dataset_id}/restore", response_model=schemas.DatasetRead)
def restore_dataset(
    dataset_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = (
        db.query(models.Dataset)
        .filter(
            models.Dataset.id == dataset_id,
            models.Dataset.user_id == current_user.id,
            models.Dataset.deleted_at.isnot(None),
        )
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted dataset not found")
    dataset.deleted_at = None
    db.commit()
    db.refresh(dataset)
    return dataset
