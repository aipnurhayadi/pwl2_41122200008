from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import auth, models
from app.database import get_db

bearer = HTTPBearer(auto_error=False)
WRITE_ALLOWED_ROLES = (models.UserRoleEnum.ADMIN.value,)


def _resolve_user_from_token(token: str, db: Session) -> models.User | None:
    user_id = auth.decode_access_token(token)
    if user_id is not None:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user:
            return user

    return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise exc

    token = credentials.credentials

    user = _resolve_user_from_token(token, db)
    if user:
        return user

    raise exc


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.User | None:
    """
    Resolves current user if bearer token is provided.
    Returns None when there is no Authorization header.
    """
    if not credentials:
        return None

    token = credentials.credentials
    user = _resolve_user_from_token(token, db)
    if user:
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_dataset_for_user(
    dataset_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.Dataset:
    query = db.query(models.Dataset).filter(models.Dataset.id == dataset_id)

    if current_user.role in WRITE_ALLOWED_ROLES:
        # Admin may access owned datasets or datasets where their employee profile is assigned.
        if current_user.employee_profile:
            query = query.filter(
                (models.Dataset.user_id == current_user.id)
                | (
                    db.query(models.Lecturer.id)
                    .filter(
                        models.Lecturer.dataset_id == models.Dataset.id,
                        models.Lecturer.employee_id == current_user.employee_profile.id,
                    )
                    .exists()
                )
            )
        else:
            query = query.filter(models.Dataset.user_id == current_user.id)
    elif current_user.role == models.UserRoleEnum.LECTURER.value:
        if not current_user.employee_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee profile not available")
        query = query.filter(
            db.query(models.Lecturer.id)
            .filter(
                models.Lecturer.dataset_id == models.Dataset.id,
                models.Lecturer.employee_id == current_user.employee_profile.id,
            )
            .exists()
        )
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    dataset = query.first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


def require_any_role(*allowed_roles: str):
    """Dependency factory for simple role-based access checks."""

    def _checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return current_user

    return _checker
