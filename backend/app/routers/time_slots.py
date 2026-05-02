from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user, require_any_role, WRITE_ALLOWED_ROLES

router = APIRouter(prefix="/api/datasets/{dataset_id}/time-slots", tags=["time_slots"])


def _get_active_slot(slot_id: int, dataset: models.Dataset, db: Session) -> models.TimeSlot:
    slot = (
        db.query(models.TimeSlot)
        .filter(
            models.TimeSlot.id == slot_id,
            models.TimeSlot.dataset_id == dataset.id,
            models.TimeSlot.deleted_at.is_(None),
        )
        .first()
    )
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time slot not found")
    return slot


@router.get("/", response_model=list[schemas.TimeSlotRead] | schemas.PaginatedTimeSlotRead)
def list_time_slots(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
):
    query = db.query(models.TimeSlot).filter(
        models.TimeSlot.dataset_id == dataset.id,
        models.TimeSlot.deleted_at.is_(None),
    )

    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter(cast(models.TimeSlot.day, String).ilike(keyword))

    query = query.order_by(models.TimeSlot.day.asc(), models.TimeSlot.start_time.asc())

    if limit is None:
        return query.all()

    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=schemas.TimeSlotRead, status_code=status.HTTP_201_CREATED)
def create_time_slot(
    payload: schemas.TimeSlotCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
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
    return _get_active_slot(slot_id, dataset, db)


@router.put("/{slot_id}", response_model=schemas.TimeSlotRead)
def update_time_slot(
    slot_id: int,
    payload: schemas.TimeSlotUpdate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    slot = _get_active_slot(slot_id, dataset, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(slot, k, v)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_slot(
    slot_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    slot = _get_active_slot(slot_id, dataset, db)
    slot.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.patch("/{slot_id}/restore", response_model=schemas.TimeSlotRead)
def restore_time_slot(
    slot_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    slot = (
        db.query(models.TimeSlot)
        .filter(
            models.TimeSlot.id == slot_id,
            models.TimeSlot.dataset_id == dataset.id,
            models.TimeSlot.deleted_at.isnot(None),
        )
        .first()
    )
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted time slot not found")
    slot.deleted_at = None
    db.commit()
    db.refresh(slot)
    return slot
