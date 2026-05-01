from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db
from app.dependencies import require_any_role, WRITE_ALLOWED_ROLES

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


@router.get("/", response_model=list[schemas.EmployeeRead])
def list_employees(
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    return db.query(models.Employee).order_by(models.Employee.id.asc()).all()


@router.post("/", response_model=schemas.EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: schemas.EmployeeCreate,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    employee_code = _generate_employee_code(db)
    user = models.User(
        name=payload.name,
        email=_unique_user_email(db, payload.email, employee_code),
        password_hash=auth.hash_password(DEFAULT_EMPLOYEE_PASSWORD),
        role=models.UserRoleEnum.LECTURER.value,
    )
    db.add(user)
    db.flush()

    employee = models.Employee(
        user_id=user.id,
        employee_code=employee_code,
        **payload.model_dump(),
    )
    db.add(employee)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee code conflict")
    db.refresh(employee)
    return employee


@router.get("/{employee_id}", response_model=schemas.EmployeeRead)
def get_employee(
    employee_id: int,
    _: models.User = Depends(require_any_role(*WRITE_ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return employee


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

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(employee, k, v)

    # Keep linked login profile aligned with employee identity fields.
    if employee.user:
        if payload.name is not None:
            employee.user.name = employee.name

        if payload.email is not None:
            new_email = payload.email.strip().lower() if payload.email else None
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
    return employee


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
