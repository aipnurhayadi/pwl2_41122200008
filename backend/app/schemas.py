from __future__ import annotations

from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models import (
    ConstraintTypeEnum,
    DatasetVisibilityEnum,
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
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LecturerLoginRequest(BaseModel):
    dataset_id: int
    code: str
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
    visibility: DatasetVisibilityEnum = DatasetVisibilityEnum.PRIVATE


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[DatasetVisibilityEnum] = None


class DatasetRead(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    visibility: DatasetVisibilityEnum
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PaginatedDatasetRead(BaseModel):
    items: list[DatasetRead]
    total: int
    limit: int
    offset: int


class DatasetTreeRoom(BaseModel):
    id: int
    code: str
    building_name: str
    room_type: Optional[RoomTypeEnum] = None

    model_config = {"from_attributes": True}


class DatasetTreeLecturer(BaseModel):
    id: int
    code: str
    employee_code: str
    name: str


class DatasetTreeCourse(BaseModel):
    id: int
    code: str
    name: str
    credits: int

    model_config = {"from_attributes": True}


class DatasetTreeTimeSlot(BaseModel):
    id: int
    day: DayEnum
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class DatasetTreeClass(BaseModel):
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class DatasetTreeRead(BaseModel):
    dataset: DatasetRead
    rooms: list[DatasetTreeRoom]
    lecturers: list[DatasetTreeLecturer]
    courses: list[DatasetTreeCourse]
    time_slots: list[DatasetTreeTimeSlot]
    classes: list[DatasetTreeClass]


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


class PaginatedRoomRead(BaseModel):
    items: list[RoomRead]
    total: int
    limit: int
    offset: int


# ===========================================================================
# Employees
# ===========================================================================
class EmployeeCreate(BaseModel):
    name: str
    nidn: Optional[str] = None
    nip: Optional[str] = None
    front_title: Optional[str] = None
    back_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[GenderEnum] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    nidn: Optional[str] = None
    nip: Optional[str] = None
    front_title: Optional[str] = None
    back_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[GenderEnum] = None


class EmployeeRead(BaseModel):
    id: int
    employee_code: str
    name: str
    nidn: Optional[str]
    nip: Optional[str]
    front_title: Optional[str]
    back_title: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    gender: Optional[GenderEnum]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEmployeeRead(BaseModel):
    items: list[EmployeeRead]
    total: int
    limit: int
    offset: int


# ===========================================================================
# Lecturers (employee assignment to dataset)
# ===========================================================================
class LecturerCreate(BaseModel):
    employee_id: int


class LecturerUpdate(BaseModel):
    employee_id: int


class LecturerRead(BaseModel):
    id: int
    dataset_id: int
    employee_id: int
    employee_code: str
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


class PaginatedLecturerRead(BaseModel):
    items: list[LecturerRead]
    total: int
    limit: int
    offset: int


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


class PaginatedCourseRead(BaseModel):
    items: list[CourseRead]
    total: int
    limit: int
    offset: int


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


class PaginatedTimeSlotRead(BaseModel):
    items: list[TimeSlotRead]
    total: int
    limit: int
    offset: int


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


class PaginatedClassRead(BaseModel):
    items: list[ClassRead]
    total: int
    limit: int
    offset: int


# ===========================================================================
# Solver Criteria
# ===========================================================================
class CriterionCreate(BaseModel):
    type: ConstraintTypeEnum
    code: Optional[str] = None
    name: str
    description: Optional[str] = None


class CriterionRead(BaseModel):
    id: int
    type: ConstraintTypeEnum
    code: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# BWM
# ===========================================================================
class BwmVectorInput(BaseModel):
    criterion_id: int
    value: int


class BwmResponseUpsert(BaseModel):
    best_criteria_id: int
    worst_criteria_id: int
    best_to_others: list[BwmVectorInput]
    others_to_worst: list[BwmVectorInput]


class BwmVectorRead(BaseModel):
    criterion_id: int
    value: int


class BwmWeightRead(BaseModel):
    criterion_id: int
    weight: float


class BwmResponseRead(BaseModel):
    lecturer_id: int
    best_criteria_id: int
    worst_criteria_id: int
    scale_max: int
    ksi: Optional[float] = None
    consistency_ratio: Optional[float] = None
    best_to_others: list[BwmVectorRead]
    others_to_worst: list[BwmVectorRead]
    weights: list[BwmWeightRead] = []



