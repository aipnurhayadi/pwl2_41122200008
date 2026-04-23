from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user

router = APIRouter(prefix="/api/datasets/{dataset_id}/rooms", tags=["rooms"])


def _active_room_query(dataset_id: int, db: Session):
    return db.query(models.Room).filter(
        models.Room.dataset_id == dataset_id,
        models.Room.deleted_at.is_(None),
    )


def _compute_code(building_code: str, floor: int, room_number: int) -> str:
    return f"{building_code}{floor}{room_number}"


@router.get("/", response_model=list[schemas.RoomRead])
def list_rooms(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return _active_room_query(dataset.id, db).all()


@router.post("/", response_model=schemas.RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: schemas.RoomCreate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    data["building_name"] = _compute_code(data["building_code"], data["floor"], data["room_number"])
    data["code"] = _compute_code(data["building_code"], data["floor"], data["room_number"])
    room = models.Room(dataset_id=dataset.id, **data)
    db.add(room)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A room with this name already exists in this building and floor")
    db.refresh(room)
    return room


@router.get("/{room_id}", response_model=schemas.RoomRead)
def get_room(
    room_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    room = _active_room_query(dataset.id, db).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


@router.put("/{room_id}", response_model=schemas.RoomRead)
def update_room(
    room_id: int,
    payload: schemas.RoomUpdate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    room = _active_room_query(dataset.id, db).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(room, k, v)
    room.building_name = _compute_code(room.building_code, room.floor, room.room_number)
    room.code = _compute_code(room.building_code, room.floor, room.room_number)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A room with this name already exists in this building and floor")
    db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    room = _active_room_query(dataset.id, db).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    room.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.patch("/{room_id}/restore", response_model=schemas.RoomRead)
def restore_room(
    room_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    room = (
        db.query(models.Room)
        .filter(models.Room.id == room_id, models.Room.dataset_id == dataset.id, models.Room.deleted_at.isnot(None))
        .first()
    )
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deleted room not found")
    room.deleted_at = None
    db.commit()
    db.refresh(room)
    return room
