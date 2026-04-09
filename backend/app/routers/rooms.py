from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user

router = APIRouter(prefix="/api/datasets/{dataset_id}/rooms", tags=["rooms"])


@router.get("/", response_model=list[schemas.RoomRead])
def list_rooms(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Room).filter(models.Room.dataset_id == dataset.id).all()


@router.post("/", response_model=schemas.RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: schemas.RoomCreate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    room = models.Room(dataset_id=dataset.id, **payload.model_dump())
    db.add(room)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A room with this name already exists in the dataset")
    db.refresh(room)
    return room


@router.get("/{room_id}", response_model=schemas.RoomRead)
def get_room(
    room_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    room = db.query(models.Room).filter(models.Room.id == room_id, models.Room.dataset_id == dataset.id).first()
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
    room = db.query(models.Room).filter(models.Room.id == room_id, models.Room.dataset_id == dataset.id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(room, k, v)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    room = db.query(models.Room).filter(models.Room.id == room_id, models.Room.dataset_id == dataset.id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    db.delete(room)
    db.commit()
