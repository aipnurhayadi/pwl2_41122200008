from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user

router = APIRouter(prefix="/api/datasets/{dataset_id}/courses", tags=["courses"])


@router.get("/", response_model=list[schemas.CourseRead])
def list_courses(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Course).filter(models.Course.dataset_id == dataset.id).all()


@router.post("/", response_model=schemas.CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: schemas.CourseCreate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    course = models.Course(dataset_id=dataset.id, **payload.model_dump())
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
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.dataset_id == dataset.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.put("/{course_id}", response_model=schemas.CourseRead)
def update_course(
    course_id: int,
    payload: schemas.CourseUpdate,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.dataset_id == dataset.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.dataset_id == dataset.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    db.delete(course)
    db.commit()
