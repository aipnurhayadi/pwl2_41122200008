import enum

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, String, Table, Text, Time, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship

from app.database import Base


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
class Dataset(Base):
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


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------
class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    capacity = Column(Integer, nullable=False)

    dataset = relationship("Dataset", back_populates="rooms")

    __table_args__ = (UniqueConstraint("dataset_id", "name", name="uq_room_dataset_name"),)


class Lecturer(Base):
    __tablename__ = "lecturers"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)

    dataset = relationship("Dataset", back_populates="lecturers")
    courses = relationship("Course", secondary=lecturer_courses, back_populates="lecturers")

    __table_args__ = (UniqueConstraint("dataset_id", "code", name="uq_lecturer_dataset_code"),)


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    num_students = Column(Integer, nullable=False)
    credits = Column(Integer, nullable=False)

    dataset = relationship("Dataset", back_populates="courses")
    lecturers = relationship("Lecturer", secondary=lecturer_courses, back_populates="courses")

    __table_args__ = (UniqueConstraint("dataset_id", "code", name="uq_course_dataset_code"),)


class DayEnum(str, enum.Enum):
    MON = "MON"
    TUE = "TUE"
    WED = "WED"
    THU = "THU"
    FRI = "FRI"
    SAT = "SAT"
    SUN = "SUN"


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    day = Column(Enum(DayEnum), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_morning = Column(Boolean, default=True, nullable=False)

    dataset = relationship("Dataset", back_populates="time_slots")
