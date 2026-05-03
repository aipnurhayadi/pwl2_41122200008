from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    hash_token,
    refresh_token_expire,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_tokens(user: models.User, db: Session) -> schemas.TokenResponse:
    raw_refresh = create_refresh_token(user.id)
    rt = models.RefreshToken(
        user_id=user.id,
        created_by=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=refresh_token_expire(),
    )
    db.add(rt)
    db.commit()

    return schemas.TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=raw_refresh,
    )


@router.post("/register", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=models.UserRoleEnum.ADMIN.value,
        created_by=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return _issue_tokens(user, db)


@router.post("/refresh", response_model=schemas.AccessTokenResponse)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    user_id = decode_refresh_token(payload.refresh_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    token_hash = hash_token(payload.refresh_token)
    rt = (
        db.query(models.RefreshToken)
        .filter(
            models.RefreshToken.token_hash == token_hash,
            models.RefreshToken.revoked == False,
        )
        .first()
    )
    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or not found")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return schemas.AccessTokenResponse(access_token=create_access_token(user_id, user.role))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: schemas.RefreshRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    token_hash = hash_token(payload.refresh_token)
    rt = (
        db.query(models.RefreshToken)
        .filter(
            models.RefreshToken.token_hash == token_hash,
            models.RefreshToken.user_id == current_user.id,
        )
        .first()
    )
    if rt:
        rt.revoked = True
        db.commit()


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
