from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import auth, models
from app.database import get_db

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.User:
    """
    Resolves the current user from either:
    1. A JWT access token
    2. A Personal Access Token (static bearer token)
    """
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise exc

    token = credentials.credentials

    # --- Try JWT first ---
    user_id = auth.decode_access_token(token)
    if user_id is not None:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user:
            return user

    # --- Fallback: Personal Access Token ---
    token_hash = auth.hash_token(token)
    pat = (
        db.query(models.PersonalAccessToken)
        .filter(models.PersonalAccessToken.token_hash == token_hash)
        .first()
    )
    if pat:
        now = datetime.now(timezone.utc)
        if pat.expires_at and pat.expires_at.replace(tzinfo=timezone.utc) < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Personal access token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Update last_used_at
        pat.last_used_at = now
        db.commit()
        return pat.user

    raise exc


def get_dataset_for_user(
    dataset_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.Dataset:
    dataset = (
        db.query(models.Dataset)
        .filter(
            models.Dataset.id == dataset_id,
            models.Dataset.user_id == current_user.id,
        )
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset
