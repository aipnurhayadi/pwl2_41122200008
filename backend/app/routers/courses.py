from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user, require_any_role, WRITE_ALLOWED_ROLES

router = APIRouter(prefix="/api/datasets/{dataset_id}/courses", tags=["courses"])


def _generate_course_code(dataset_id: int, db: Session) -> str:
    """Auto-generate a sequential course code like MK001.
    Counts ALL rows (including soft-deleted) to avoid reuse.
    """
    count = db.query(models.Course).filter(
        models.Course.dataset_id == dataset_id
    ).count()
    return f"MK{count + 1:03d}"


def _get_active_course(course_id: int, dataset: models.Dataset, db: Session) -> models.Course:
    course = (
        db.query(models.Course)
        .filter(
            models.Course.id == course_id,
            models.Course.dataset_id == dataset.id,
            models.Course.deleted_at.is_(None),
        )
        .first()
    )
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.get("/", response_model=list[schemas.CourseRead])
def list_courses(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Course)
        .filter(models.Course.dataset_id == dataset.id, models.Course.deleted_at.is_(None))
        .all()
    )


@router.post("/", response_model=schemas.CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: schemas.CourseCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    data["code"] = _generate_course_code(dataset.id, db)
    course = models.Course(dataset_id=dataset.id, **data)
    db.add(course)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A course with this code already exists in the dataset")
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=schemas.CourseRead)
def get_course(
    course_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return _get_active_course(course_id, dataset, db)


@router.put("/{course_id}", response_model=schemas.CourseRead)
def update_course(
    course_id: int,
    payload: schemas.CourseUpdate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    course = _get_active_course(course_id, dataset, db)
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("code", None)  # code is auto-generated, never updatable
    for k, v in updates.items():
        setattr(course, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A course with this code already exists in the dataset")
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    course = _get_active_course(course_id, dataset, db)
    course.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.patch("/{course_id}/restore", response_model=schemas.CourseRead)
def restore_course(
    course_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    course = (
        db.query(models.Course)
        .filter(
            models.Course.id == course_id,
            models.Course.dataset_id == dataset.id,
            models.Course.deleted_at.isnot(None),
        )
        .first()
    )
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted course not found")
    course.deleted_at = None
    db.commit()
    db.refresh(course)
    return course
