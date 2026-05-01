from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user, require_any_role, WRITE_ALLOWED_ROLES

router = APIRouter(prefix="/api/datasets/{dataset_id}/lecturers", tags=["lecturers"])


def _generate_lecturer_code(dataset: models.Dataset, employee: models.Employee) -> str:
    return f"{dataset.code}-{employee.employee_code}"


def _to_read(lecturer: models.Lecturer) -> schemas.LecturerRead:
    employee = lecturer.employee
    return schemas.LecturerRead(
        id=lecturer.id,
        dataset_id=lecturer.dataset_id,
        employee_id=lecturer.employee_id,
        employee_code=employee.employee_code,
        name=employee.name,
        code=lecturer.code,
        nidn=employee.nidn,
        nip=employee.nip,
        front_title=employee.front_title,
        back_title=employee.back_title,
        email=employee.email,
        phone=employee.phone,
        gender=employee.gender,
        created_at=lecturer.created_at,
        updated_at=lecturer.updated_at,
        deleted_at=lecturer.deleted_at,
    )


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
    rows = (
        db.query(models.Lecturer)
        .filter(models.Lecturer.dataset_id == dataset.id, models.Lecturer.deleted_at.is_(None))
        .all()
    )
    return [_to_read(r) for r in rows]


@router.post("/", response_model=schemas.LecturerRead, status_code=status.HTTP_201_CREATED)
def create_lecturer(
    payload: schemas.LecturerCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.id == payload.employee_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    lecturer = models.Lecturer(
        dataset_id=dataset.id,
        employee_id=employee.id,
        code=_generate_lecturer_code(dataset, employee),
    )
    db.add(lecturer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Employee is already assigned to this dataset")
    db.refresh(lecturer)
    return _to_read(lecturer)


@router.get("/{lecturer_id}", response_model=schemas.LecturerRead)
def get_lecturer(
    lecturer_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return _to_read(_get_active_lecturer(lecturer_id, dataset, db))


@router.put("/{lecturer_id}", response_model=schemas.LecturerRead)
def update_lecturer(
    lecturer_id: int,
    payload: schemas.LecturerUpdate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    lecturer = _get_active_lecturer(lecturer_id, dataset, db)
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.id == payload.employee_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    lecturer.employee_id = employee.id
    lecturer.code = _generate_lecturer_code(dataset, employee)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Employee is already assigned to this dataset")
    db.refresh(lecturer)
    return _to_read(lecturer)


@router.delete("/{lecturer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecturer(
    lecturer_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    lecturer = _get_active_lecturer(lecturer_id, dataset, db)
    lecturer.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.patch("/{lecturer_id}/restore", response_model=schemas.LecturerRead)
def restore_lecturer(
    lecturer_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
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
    return _to_read(lecturer)


# ---------------------------------------------------------------------------
# Assign / unassign courses to a lecturer
# ---------------------------------------------------------------------------
@router.post("/{lecturer_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def assign_course(
    lecturer_id: int,
    course_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
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
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
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
