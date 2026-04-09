from __future__ import annotations

from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models import DayEnum


# ===========================================================================
# Users & Auth
# ===========================================================================
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ===========================================================================
# Personal Access Tokens
# ===========================================================================
class PATCreate(BaseModel):
    name: str
    expires_at: Optional[datetime] = None


class PATRead(BaseModel):
    id: int
    name: str
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class PATCreated(PATRead):
    """Returned only once — includes the raw token value."""
    token: str


# ===========================================================================
# Datasets
# ===========================================================================
class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DatasetRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# Rooms
# ===========================================================================
class RoomCreate(BaseModel):
    name: str
    capacity: int


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None


class RoomRead(BaseModel):
    id: int
    dataset_id: int
    name: str
    capacity: int

    model_config = {"from_attributes": True}


# ===========================================================================
# Lecturers
# ===========================================================================
class LecturerCreate(BaseModel):
    name: str
    code: str
    email: Optional[str] = None


class LecturerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    email: Optional[str] = None


class LecturerRead(BaseModel):
    id: int
    dataset_id: int
    name: str
    code: str
    email: Optional[str]

    model_config = {"from_attributes": True}


# ===========================================================================
# Courses
# ===========================================================================
class CourseCreate(BaseModel):
    name: str
    code: str
    num_students: int
    credits: int


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    num_students: Optional[int] = None
    credits: Optional[int] = None


class CourseRead(BaseModel):
    id: int
    dataset_id: int
    name: str
    code: str
    num_students: int
    credits: int

    model_config = {"from_attributes": True}


# ===========================================================================
# Time Slots
# ===========================================================================
class TimeSlotCreate(BaseModel):
    day: DayEnum
    start_time: time
    end_time: time
    is_morning: bool = True


class TimeSlotUpdate(BaseModel):
    day: Optional[DayEnum] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_morning: Optional[bool] = None


class TimeSlotRead(BaseModel):
    id: int
    dataset_id: int
    day: DayEnum
    start_time: time
    end_time: time
    is_morning: bool

    model_config = {"from_attributes": True}



