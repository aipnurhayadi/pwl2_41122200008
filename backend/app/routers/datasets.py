from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("/", response_model=list[schemas.DatasetRead])
def list_datasets(
    current_user: models.User = Depends(get_current_user),
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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset = models.Dataset(user_id=current_user.id, **payload.model_dump())
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
    return dataset


@router.put("/{dataset_id}", response_model=schemas.DatasetRead)
def update_dataset(
    dataset_id: int,
    payload: schemas.DatasetUpdate,
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
