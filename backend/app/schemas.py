from __future__ import annotations

from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models import (
    DayEnum,
    GenderEnum,
    RoomTypeEnum,
)


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
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# Rooms
# ===========================================================================
class RoomCreate(BaseModel):
    building_code: str
    floor: int
    room_number: int
    capacity: int
    room_type: Optional[RoomTypeEnum] = None


class RoomUpdate(BaseModel):
    building_code: Optional[str] = None
    floor: Optional[int] = None
    room_number: Optional[int] = None
    capacity: Optional[int] = None
    room_type: Optional[RoomTypeEnum] = None


class RoomRead(BaseModel):
    id: int
    dataset_id: int
    building_name: str
    building_code: str
    floor: int
    room_number: int
    code: str
    capacity: int
    room_type: Optional[RoomTypeEnum]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# Lecturers
# ===========================================================================
class LecturerCreate(BaseModel):
    name: str
    nidn: Optional[str] = None
    nip: Optional[str] = None
    front_title: Optional[str] = None
    back_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[GenderEnum] = None


class LecturerUpdate(BaseModel):
    name: Optional[str] = None
    nidn: Optional[str] = None
    nip: Optional[str] = None
    front_title: Optional[str] = None
    back_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[GenderEnum] = None


class LecturerRead(BaseModel):
    id: int
    dataset_id: int
    name: str
    code: str
    nidn: Optional[str]
    nip: Optional[str]
    front_title: Optional[str]
    back_title: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    gender: Optional[GenderEnum]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# Courses
# ===========================================================================
class CourseCreate(BaseModel):
    name: str
    credits: int
    semester: Optional[int] = None
    curriculum_year: Optional[int] = None
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    credits: Optional[int] = None
    semester: Optional[int] = None
    curriculum_year: Optional[int] = None
    description: Optional[str] = None


class CourseRead(BaseModel):
    id: int
    dataset_id: int
    name: str
    code: str
    credits: int
    semester: Optional[int]
    curriculum_year: Optional[int]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# Time Slots
# ===========================================================================
class TimeSlotCreate(BaseModel):
    day: DayEnum
    start_time: time
    end_time: time


class TimeSlotUpdate(BaseModel):
    day: Optional[DayEnum] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None


class TimeSlotRead(BaseModel):
    id: int
    dataset_id: int
    day: DayEnum
    start_time: time
    end_time: time
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# Classes (Kelas)
# ===========================================================================
class ClassCreate(BaseModel):
    name: str
    academic_year: Optional[int] = None
    semester: Optional[int] = None
    study_program: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    academic_year: Optional[int] = None
    semester: Optional[int] = None
    study_program: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None


class ClassRead(BaseModel):
    id: int
    dataset_id: int
    name: str
    code: str
    academic_year: Optional[int]
    semester: Optional[int]
    study_program: Optional[str]
    capacity: Optional[int]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}



