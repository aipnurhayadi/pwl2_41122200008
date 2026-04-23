from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user

router = APIRouter(prefix="/api/datasets/{dataset_id}/lecturers", tags=["lecturers"])


def _generate_lecturer_code(dataset_id: int, db: Session) -> str:
    """Auto-generate a sequential lecturer code like DSN001.
    Counts ALL rows (including soft-deleted) to avoid reuse.
    """
    count = db.query(models.Lecturer).filter(
        models.Lecturer.dataset_id == dataset_id
    ).count()
    return f"DSN{count + 1:03d}"


def _get_active_lecturer(lecturer_id: int, dataset: models.Dataset, db: Session) -> models.Lecturer:
    lecturer = (
        db.query(models.Lecturer)
        .filter(
            models.Lecturer.id == lecturer_id,
            models.Lecturer.dataset_id == dataset.id,
            models.Lecturer.deleted_at.is_(None),
        )
        .first()
    )
    if not lecturer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecturer not found")
    return lecturer


@router.get("/", response_model=list[schemas.LecturerRead])
def list_lecturers(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Lecturer)
        .filter(models.Lecturer.dataset_id == dataset.id, models.Lecturer.deleted_at.is_(None))
        .all()
    )


@router.post("/", response_model=schemas.LecturerRead, status_code=status.HTTP_201_CREATED)
def create_lecturer(
    payload: schemas.LecturerCreate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    data["code"] = _generate_lecturer_code(dataset.id, db)
    lecturer = models.Lecturer(dataset_id=dataset.id, **data)
    db.add(lecturer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A lecturer with this code already exists in the dataset")
    db.refresh(lecturer)
    return lecturer


@router.get("/{lecturer_id}", response_model=schemas.LecturerRead)
def get_lecturer(
    lecturer_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return _get_active_lecturer(lecturer_id, dataset, db)


@router.put("/{lecturer_id}", response_model=schemas.LecturerRead)
def update_lecturer(
    lecturer_id: int,
    payload: schemas.LecturerUpdate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    lecturer = _get_active_lecturer(lecturer_id, dataset, db)
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("code", None)  # code is auto-generated, never updatable
    for k, v in updates.items():
        setattr(lecturer, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A lecturer with this code already exists in the dataset")
    db.refresh(lecturer)
    return lecturer


@router.delete("/{lecturer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecturer(
    lecturer_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    lecturer = _get_active_lecturer(lecturer_id, dataset, db)
    lecturer.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.patch("/{lecturer_id}/restore", response_model=schemas.LecturerRead)
def restore_lecturer(
    lecturer_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    lecturer = (
        db.query(models.Lecturer)
        .filter(
            models.Lecturer.id == lecturer_id,
            models.Lecturer.dataset_id == dataset.id,
            models.Lecturer.deleted_at.isnot(None),
        )
        .first()
    )
    if not lecturer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted lecturer not found")
    lecturer.deleted_at = None
    db.commit()
    db.refresh(lecturer)
    return lecturer


# ---------------------------------------------------------------------------
# Assign / unassign courses to a lecturer
# ---------------------------------------------------------------------------
@router.post("/{lecturer_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def assign_course(
    lecturer_id: int,
    course_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    lecturer = _get_active_lecturer(lecturer_id, dataset, db)
    course = (
        db.query(models.Course)
        .filter(models.Course.id == course_id, models.Course.dataset_id == dataset.id, models.Course.deleted_at.is_(None))
        .first()
    )
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course not in lecturer.courses:
        lecturer.courses.append(course)
        db.commit()


@router.delete("/{lecturer_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_course(
    lecturer_id: int,
    course_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    lecturer = _get_active_lecturer(lecturer_id, dataset, db)
    course = (
        db.query(models.Course)
        .filter(models.Course.id == course_id, models.Course.dataset_id == dataset.id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course in lecturer.courses:
        lecturer.courses.remove(course)
        db.commit()
