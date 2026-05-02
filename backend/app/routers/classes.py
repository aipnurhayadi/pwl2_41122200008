from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_dataset_for_user, require_any_role, WRITE_ALLOWED_ROLES

router = APIRouter(prefix="/api/datasets/{dataset_id}/classes", tags=["classes"])


def _generate_class_code(dataset_id: int, db: Session) -> str:
    """Auto-generate a sequential class code like KLS001.
    Counts ALL rows (including soft-deleted) to avoid reuse.
    """
    count = db.query(models.Class).filter(
        models.Class.dataset_id == dataset_id
    ).count()
    return f"KLS{count + 1:03d}"


def _get_active_class(class_id: int, dataset: models.Dataset, db: Session) -> models.Class:
    obj = (
        db.query(models.Class)
        .filter(
            models.Class.id == class_id,
            models.Class.dataset_id == dataset.id,
            models.Class.deleted_at.is_(None),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return obj


@router.get("/", response_model=list[schemas.ClassRead] | schemas.PaginatedClassRead)
def list_classes(
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
):
    query = db.query(models.Class).filter(
        models.Class.dataset_id == dataset.id,
        models.Class.deleted_at.is_(None),
    )

    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Class.code.ilike(keyword),
                models.Class.name.ilike(keyword),
                models.Class.study_program.ilike(keyword),
            )
        )

    query = query.order_by(models.Class.code.asc())

    if limit is None:
        return query.all()

    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=schemas.ClassRead, status_code=status.HTTP_201_CREATED)
def create_class(
    payload: schemas.ClassCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    data["code"] = _generate_class_code(dataset.id, db)
    obj = models.Class(dataset_id=dataset.id, **data)
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A class with this code already exists in the dataset")
    db.refresh(obj)
    return obj


@router.get("/{class_id}", response_model=schemas.ClassRead)
def get_class(
    class_id: int,
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    return _get_active_class(class_id, dataset, db)


@router.put("/{class_id}", response_model=schemas.ClassRead)
def update_class(
    class_id: int,
    payload: schemas.ClassUpdate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    obj = _get_active_class(class_id, dataset, db)
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("code", None)
    for k, v in updates.items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A class with this code already exists in the dataset")
    db.refresh(obj)
    return obj


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(
    class_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    obj = _get_active_class(class_id, dataset, db)
    obj.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.patch("/{class_id}/restore", response_model=schemas.ClassRead)
def restore_class(
    class_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    dataset: models.Dataset = Depends(get_dataset_for_user),
    db: Session = Depends(get_db),
):
    obj = (
        db.query(models.Class)
        .filter(
            models.Class.id == class_id,
            models.Class.dataset_id == dataset.id,
            models.Class.deleted_at.isnot(None),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Deleted class not found")
    obj.deleted_at = None
    db.commit()
    db.refresh(obj)
    return obj
