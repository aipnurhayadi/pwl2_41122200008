from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user

router = APIRouter(prefix="/api/datasets/{dataset_id}/time-slots", tags=["time_slots"])


@router.get("/", response_model=list[schemas.TimeSlotRead])
def list_time_slots(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return db.query(models.TimeSlot).filter(models.TimeSlot.dataset_id == dataset.id).all()


@router.post("/", response_model=schemas.TimeSlotRead, status_code=status.HTTP_201_CREATED)
def create_time_slot(
    payload: schemas.TimeSlotCreate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    slot = models.TimeSlot(dataset_id=dataset.id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/{slot_id}", response_model=schemas.TimeSlotRead)
def get_time_slot(
    slot_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    slot = db.query(models.TimeSlot).filter(models.TimeSlot.id == slot_id, models.TimeSlot.dataset_id == dataset.id).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time slot not found")
    return slot


@router.put("/{slot_id}", response_model=schemas.TimeSlotRead)
def update_time_slot(
    slot_id: int,
    payload: schemas.TimeSlotUpdate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    slot = db.query(models.TimeSlot).filter(models.TimeSlot.id == slot_id, models.TimeSlot.dataset_id == dataset.id).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time slot not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(slot, k, v)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_slot(
    slot_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    slot = db.query(models.TimeSlot).filter(models.TimeSlot.id == slot_id, models.TimeSlot.dataset_id == dataset.id).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time slot not found")
    db.delete(slot)
    db.commit()
