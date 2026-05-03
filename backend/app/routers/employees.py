from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db
from app.dependencies import get_current_user, require_any_role, WRITE_ALLOWED_ROLES

router = APIRouter(prefix="/api/employees", tags=["employees"])
DEFAULT_EMPLOYEE_PASSWORD = "Employee123!"


def _generate_employee_code(db: Session) -> str:
    count = db.query(models.Employee).count()
    return f"EMP{count + 1:03d}"


def _unique_user_email(db: Session, preferred: str | None, employee_code: str) -> str:
    base = (preferred or "").strip().lower()
    if not base:
        base = f"{employee_code.lower()}@example.com"

    if "@" not in base:
        base = f"{base}@example.com"

    local, domain = base.split("@", 1)
    if not local:
        local = employee_code.lower()
    if not domain:
        domain = "example.com"

    candidate = f"{local}@{domain}"
    suffix = 1
    while db.query(models.User.id).filter(models.User.email == candidate).first():
        candidate = f"{local}{suffix}@{domain}"
        suffix += 1

    return candidate


def _to_read(employee: models.Employee) -> schemas.EmployeeRead:
    return schemas.EmployeeRead(
        id=employee.id,
        employee_code=employee.employee_code,
        name=employee.name,
        nidn=employee.nidn,
        nip=employee.nip,
        front_title=employee.front_title,
        back_title=employee.back_title,
        user_email=employee.user.email if employee.user else None,
        phone=employee.phone,
        gender=employee.gender,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


@router.get("/", response_model=list[schemas.EmployeeRead] | schemas.PaginatedEmployeeRead)
def list_employees(
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
):
    query = db.query(models.Employee).outerjoin(models.User, models.User.id == models.Employee.user_id)
    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Employee.employee_code.ilike(keyword),
                models.Employee.name.ilike(keyword),
                models.User.email.ilike(keyword),
                models.Employee.nidn.ilike(keyword),
                models.Employee.nip.ilike(keyword),
            )
        )

    query = query.order_by(models.Employee.id.asc())

    if limit is None:
        return [_to_read(item) for item in query.all()]

    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"items": [_to_read(item) for item in items], "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=schemas.EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: schemas.EmployeeCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee_code = _generate_employee_code(db)
    payload_data = payload.model_dump(exclude={"user_email"})
    user = models.User(
        name=payload.name,
        email=_unique_user_email(db, payload.user_email, employee_code),
        password_hash=auth.hash_password(DEFAULT_EMPLOYEE_PASSWORD),
        role=models.UserRoleEnum.LECTURER.value,
        created_by=current_user.id,
    )
    db.add(user)
    db.flush()

    employee = models.Employee(
        user_id=user.id,
        created_by=current_user.id,
        employee_code=employee_code,
        **payload_data,
    )
    db.add(employee)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee code conflict")
    db.refresh(employee)
    return _to_read(employee)


@router.get("/{employee_id}", response_model=schemas.EmployeeRead)
def get_employee(
    employee_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return _to_read(employee)


@router.put("/{employee_id}", response_model=schemas.EmployeeRead)
def update_employee(
    employee_id: int,
    payload: schemas.EmployeeUpdate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    updates = payload.model_dump(exclude_unset=True, exclude={"user_email"})
    for k, v in updates.items():
        setattr(employee, k, v)

    # Keep linked login profile aligned with employee identity fields.
    if employee.user:
        if payload.name is not None:
            employee.user.name = employee.name

        if payload.user_email is not None:
            new_email = payload.user_email.strip().lower()
            if new_email:
                conflict = (
                    db.query(models.User.id)
                    .filter(models.User.email == new_email, models.User.id != employee.user.id)
                    .first()
                )
                if conflict:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User email already exists")
                employee.user.email = new_email

    db.commit()
    db.refresh(employee)
    return _to_read(employee)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    db.delete(employee)
    db.commit()
