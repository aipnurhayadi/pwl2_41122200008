from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user, require_any_role, WRITE_ALLOWED_ROLES

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _generate_dataset_code(db: Session) -> str:
    count = db.query(models.Dataset).count()
    return f"DS{count + 1:03d}"


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


@router.get("/", response_model=list[schemas.DatasetRead])
def list_datasets(
    current_user: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Dataset)
        .filter(models.Dataset.user_id == current_user.id, models.Dataset.deleted_at.is_(None))
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

    dataset = query.first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


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
