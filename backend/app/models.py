import enum

from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, Time, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Users & Auth
# ---------------------------------------------------------------------------
class UserRoleEnum(str, enum.Enum):
    LECTURER = "LECTURER"
    ADMIN = "ADMIN"


class DatasetVisibilityEnum(str, enum.Enum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default=UserRoleEnum.ADMIN.value, server_default=UserRoleEnum.ADMIN.value, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan", foreign_keys="Dataset.user_id")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan", foreign_keys="RefreshToken.user_id")
    employee_profile = relationship("Employee", back_populates="user", uselist=False, foreign_keys="Employee.user_id")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    employee_code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    nidn = Column(String(20), nullable=True)
    nip = Column(String(20), nullable=True)
    front_title = Column(String(50), nullable=True)
    back_title = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    gender = Column(String(1), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="employee_profile", foreign_keys=[user_id])
    lecturer_assignments = relationship("Lecturer", back_populates="employee", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="refresh_tokens", foreign_keys=[user_id])


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------
class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    visibility = Column(
        Enum(DatasetVisibilityEnum),
        nullable=False,
        default=DatasetVisibilityEnum.PRIVATE,
        server_default=DatasetVisibilityEnum.PRIVATE.value,
        index=True,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="datasets", foreign_keys=[user_id])
    rooms = relationship("Room", back_populates="dataset", cascade="all, delete-orphan")
    lecturers = relationship("Lecturer", back_populates="dataset", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="dataset", cascade="all, delete-orphan")
    time_slots = relationship("TimeSlot", back_populates="dataset", cascade="all, delete-orphan")
    classes = relationship("Class", back_populates="dataset", cascade="all, delete-orphan")
    bwm_responses = relationship("BwmResponse", back_populates="dataset", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class RoomTypeEnum(str, enum.Enum):
    TEORI = "TEORI"
    LABORATORIUM = "LABORATORIUM"
    AULA = "AULA"
    SEMINAR = "SEMINAR"


class GenderEnum(str, enum.Enum):
    L = "L"
    P = "P"


class DayEnum(str, enum.Enum):
    MON = "MON"
    TUE = "TUE"
    WED = "WED"
    THU = "THU"
    FRI = "FRI"
    SAT = "SAT"
    SUN = "SUN"


class ConstraintTypeEnum(str, enum.Enum):
    HARD = "HARD"
    SOFT = "SOFT"


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------
class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    building_name = Column(String(100), nullable=False)
    building_code = Column(String(20), nullable=False)
    floor = Column(Integer, nullable=False)
    room_number = Column(Integer, nullable=False)
    code = Column(String(50), nullable=False)
    capacity = Column(Integer, nullable=False)
    room_type = Column(Enum(RoomTypeEnum), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="rooms")

    __table_args__ = (
        UniqueConstraint("dataset_id", "building_code", "floor", "room_number", name="uq_room_dataset_building_floor_number"),
    )


class Lecturer(Base):
    __tablename__ = "lecturers"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    code = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="lecturers")
    employee = relationship("Employee", back_populates="lecturer_assignments")
    bwm_responses = relationship("BwmResponse", back_populates="lecturer", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("dataset_id", "code", name="uq_lecturer_dataset_code"),
        UniqueConstraint("dataset_id", "employee_id", name="uq_lecturer_dataset_employee"),
    )


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    credits = Column(Integer, nullable=False)
    semester = Column(Integer, nullable=True)
    curriculum_year = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="courses")

    __table_args__ = (UniqueConstraint("dataset_id", "code", name="uq_course_dataset_code"),)


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    code = Column(String(50), nullable=False)
    day = Column(Enum(DayEnum), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="time_slots")

    __table_args__ = (UniqueConstraint("dataset_id", "code", name="uq_time_slot_dataset_code"),)


# ---------------------------------------------------------------------------
# Classes (Kelas)
# ---------------------------------------------------------------------------
class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    academic_year = Column(Integer, nullable=True)
    semester = Column(Integer, nullable=True)
    study_program = Column(String(255), nullable=True)
    capacity = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="classes")

    __table_args__ = (UniqueConstraint("dataset_id", "code", name="uq_class_dataset_code"),)


# ---------------------------------------------------------------------------
# Solver Criteria (Hard/Soft)
# ---------------------------------------------------------------------------
class Criterion(Base):
    __tablename__ = "criteria"

    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    type = Column(Enum(ConstraintTypeEnum), nullable=False, index=True)
    code = Column(String(20), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    bwm_responses_as_best = relationship("BwmResponse", foreign_keys="BwmResponse.best_criteria_id")
    bwm_responses_as_worst = relationship("BwmResponse", foreign_keys="BwmResponse.worst_criteria_id")
    bwm_best_to_others = relationship("BwmBestToOther", back_populates="criterion")
    bwm_others_to_worst = relationship("BwmOtherToWorst", back_populates="criterion")
    bwm_weights = relationship("BwmWeight", back_populates="criterion")


# ---------------------------------------------------------------------------
# BWM (Best Worst Method)
# ---------------------------------------------------------------------------
class BwmResponse(Base):
    __tablename__ = "bwm_responses"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    lecturer_id = Column(Integer, ForeignKey("lecturers.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    best_criteria_id = Column(Integer, ForeignKey("criteria.id", ondelete="CASCADE"), nullable=False)
    worst_criteria_id = Column(Integer, ForeignKey("criteria.id", ondelete="CASCADE"), nullable=False)
    scale_max = Column(Integer, nullable=False, default=9, server_default="9")
    ksi = Column(Float, nullable=True)
    consistency_ratio = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="bwm_responses")
    lecturer = relationship("Lecturer", back_populates="bwm_responses")
    best_criterion = relationship("Criterion", foreign_keys=[best_criteria_id])
    worst_criterion = relationship("Criterion", foreign_keys=[worst_criteria_id])
    best_to_others = relationship("BwmBestToOther", back_populates="response", cascade="all, delete-orphan")
    others_to_worst = relationship("BwmOtherToWorst", back_populates="response", cascade="all, delete-orphan")
    weights = relationship("BwmWeight", back_populates="response", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("dataset_id", "lecturer_id", name="uq_bwm_response_dataset_lecturer"),
        CheckConstraint("best_criteria_id <> worst_criteria_id", name="ck_bwm_best_worst_not_equal"),
        CheckConstraint("scale_max >= 3 AND scale_max <= 9", name="ck_bwm_scale_max_range"),
    )


class BwmBestToOther(Base):
    __tablename__ = "bwm_best_to_others"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(Integer, ForeignKey("bwm_responses.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id = Column(Integer, ForeignKey("criteria.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    value = Column(Integer, nullable=False)

    response = relationship("BwmResponse", back_populates="best_to_others")
    criterion = relationship("Criterion", back_populates="bwm_best_to_others")

    __table_args__ = (
        UniqueConstraint("response_id", "criterion_id", name="uq_bwm_best_to_other_response_criterion"),
        CheckConstraint("value >= 1 AND value <= 9", name="ck_bwm_best_to_other_value_range"),
    )


class BwmOtherToWorst(Base):
    __tablename__ = "bwm_others_to_worst"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(Integer, ForeignKey("bwm_responses.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id = Column(Integer, ForeignKey("criteria.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    value = Column(Integer, nullable=False)

    response = relationship("BwmResponse", back_populates="others_to_worst")
    criterion = relationship("Criterion", back_populates="bwm_others_to_worst")

    __table_args__ = (
        UniqueConstraint("response_id", "criterion_id", name="uq_bwm_other_to_worst_response_criterion"),
        CheckConstraint("value >= 1 AND value <= 9", name="ck_bwm_other_to_worst_value_range"),
    )


class BwmWeight(Base):
    __tablename__ = "bwm_weights"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(Integer, ForeignKey("bwm_responses.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id = Column(Integer, ForeignKey("criteria.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, server_default="1", index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    weight = Column(Float, nullable=False)

    response = relationship("BwmResponse", back_populates="weights")
    criterion = relationship("Criterion", back_populates="bwm_weights")

    __table_args__ = (
        UniqueConstraint("response_id", "criterion_id", name="uq_bwm_weight_response_criterion"),
        CheckConstraint("weight >= 0", name="ck_bwm_weight_non_negative"),
    )
