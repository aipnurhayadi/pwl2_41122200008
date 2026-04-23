import enum

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, String, Table, Text, Time, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Soft-delete mixin
# ---------------------------------------------------------------------------
class SoftDeleteMixin:
    deleted_at = Column(DateTime, nullable=True, index=True)


# ---------------------------------------------------------------------------
# Many-to-many join table: lecturers ↔ courses (within a dataset)
# ---------------------------------------------------------------------------
lecturer_courses = Table(
    "lecturer_courses",
    Base.metadata,
    Column("lecturer_id", Integer, ForeignKey("lecturers.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", Integer, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
)


# ---------------------------------------------------------------------------
# Users & Auth
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")
    personal_access_tokens = relationship("PersonalAccessToken", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class PersonalAccessToken(Base):
    __tablename__ = "personal_access_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="personal_access_tokens")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="refresh_tokens")


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------
class Dataset(SoftDeleteMixin, Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="datasets")
    rooms = relationship("Room", back_populates="dataset", cascade="all, delete-orphan")
    lecturers = relationship("Lecturer", back_populates="dataset", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="dataset", cascade="all, delete-orphan")
    time_slots = relationship("TimeSlot", back_populates="dataset", cascade="all, delete-orphan")
    classes = relationship("Class", back_populates="dataset", cascade="all, delete-orphan")


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


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------
class Room(SoftDeleteMixin, Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
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


class Lecturer(SoftDeleteMixin, Base):
    __tablename__ = "lecturers"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    nidn = Column(String(20), nullable=True)
    nip = Column(String(20), nullable=True)
    front_title = Column(String(50), nullable=True)
    back_title = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    gender = Column(Enum(GenderEnum), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="lecturers")
    courses = relationship("Course", secondary=lecturer_courses, back_populates="lecturers")

    __table_args__ = (UniqueConstraint("dataset_id", "code", name="uq_lecturer_dataset_code"),)


class Course(SoftDeleteMixin, Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    credits = Column(Integer, nullable=False)
    semester = Column(Integer, nullable=True)
    curriculum_year = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="courses")
    lecturers = relationship("Lecturer", secondary=lecturer_courses, back_populates="courses")

    __table_args__ = (UniqueConstraint("dataset_id", "code", name="uq_course_dataset_code"),)


class TimeSlot(SoftDeleteMixin, Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    day = Column(Enum(DayEnum), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="time_slots")


# ---------------------------------------------------------------------------
# Classes (Kelas)
# ---------------------------------------------------------------------------
class Class(SoftDeleteMixin, Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
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
