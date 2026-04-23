"""enhance resources and add soft delete

Revision ID: a1b2c3d4e5f6
Revises: e9e67aed10f0
Create Date: 2026-04-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e9e67aed10f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col_exists(conn, table: str, col: str) -> bool:
    r = conn.execute(
        text("SELECT COUNT(*) FROM information_schema.COLUMNS "
             "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"),
        {"t": table, "c": col},
    )
    return r.scalar() > 0


def _idx_exists(conn, table: str, idx: str) -> bool:
    r = conn.execute(
        text("SELECT COUNT(*) FROM information_schema.STATISTICS "
             "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND INDEX_NAME = :i"),
        {"t": table, "i": idx},
    )
    return r.scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()

    # -----------------------------------------------------------------------
    # datasets — add soft delete
    # -----------------------------------------------------------------------
    if not _col_exists(conn, 'datasets', 'deleted_at'):
        conn.execute(text("ALTER TABLE datasets ADD COLUMN deleted_at DATETIME NULL"))
    if not _idx_exists(conn, 'datasets', 'ix_datasets_deleted_at'):
        conn.execute(text("CREATE INDEX ix_datasets_deleted_at ON datasets (deleted_at)"))

    # -----------------------------------------------------------------------
    # rooms — add new columns
    # -----------------------------------------------------------------------
    rooms_cols = {
        "building_name": "ALTER TABLE rooms ADD COLUMN building_name VARCHAR(100) NULL",
        "building_code": "ALTER TABLE rooms ADD COLUMN building_code VARCHAR(20) NULL",
        "floor": "ALTER TABLE rooms ADD COLUMN floor INT NULL",
        "code": "ALTER TABLE rooms ADD COLUMN code VARCHAR(50) NULL",
        "room_type": "ALTER TABLE rooms ADD COLUMN room_type ENUM('TEORI','LABORATORIUM','AULA','SEMINAR') NULL",
        "created_at": "ALTER TABLE rooms ADD COLUMN created_at DATETIME NOT NULL DEFAULT NOW()",
        "updated_at": "ALTER TABLE rooms ADD COLUMN updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()",
        "deleted_at": "ALTER TABLE rooms ADD COLUMN deleted_at DATETIME NULL",
    }
    for col, stmt in rooms_cols.items():
        if not _col_exists(conn, 'rooms', col):
            conn.execute(text(stmt))

    # Back-fill existing rows that have no building info yet
    conn.execute(text(
        "UPDATE rooms SET building_name = name, building_code = 'X', floor = 1, code = 'X1' "
        "WHERE building_name IS NULL OR building_name = ''"
    ))

    # Tighten required columns to NOT NULL
    for stmt in [
        "ALTER TABLE rooms MODIFY COLUMN building_name VARCHAR(100) NOT NULL",
        "ALTER TABLE rooms MODIFY COLUMN building_code VARCHAR(20) NOT NULL",
        "ALTER TABLE rooms MODIFY COLUMN floor INT NOT NULL",
        "ALTER TABLE rooms MODIFY COLUMN code VARCHAR(50) NOT NULL",
    ]:
        conn.execute(text(stmt))

    # Create new constraint first so dataset_id FK index is always covered,
    # then drop old one
    if not _idx_exists(conn, 'rooms', 'uq_room_dataset_building_floor_name'):
        conn.execute(text(
            "ALTER TABLE rooms ADD CONSTRAINT uq_room_dataset_building_floor_name "
            "UNIQUE (dataset_id, building_code, floor, name)"
        ))
    if _idx_exists(conn, 'rooms', 'uq_room_dataset_name'):
        conn.execute(text("ALTER TABLE rooms DROP INDEX uq_room_dataset_name"))
    if not _idx_exists(conn, 'rooms', 'ix_rooms_deleted_at'):
        conn.execute(text("CREATE INDEX ix_rooms_deleted_at ON rooms (deleted_at)"))

    # -----------------------------------------------------------------------
    # lecturers — add new columns + soft delete
    # -----------------------------------------------------------------------
    lecturers_cols = {
        "nidn": "ALTER TABLE lecturers ADD COLUMN nidn VARCHAR(20) NULL",
        "nip": "ALTER TABLE lecturers ADD COLUMN nip VARCHAR(20) NULL",
        "front_title": "ALTER TABLE lecturers ADD COLUMN front_title VARCHAR(50) NULL",
        "back_title": "ALTER TABLE lecturers ADD COLUMN back_title VARCHAR(100) NULL",
        "phone": "ALTER TABLE lecturers ADD COLUMN phone VARCHAR(20) NULL",
        "gender": "ALTER TABLE lecturers ADD COLUMN gender ENUM('L','P') NULL",
        "employment_status": "ALTER TABLE lecturers ADD COLUMN employment_status ENUM('PNS','TETAP_YAYASAN','KONTRAK','TIDAK_TETAP') NULL",
        "functional_position": "ALTER TABLE lecturers ADD COLUMN functional_position ENUM('ASISTEN_AHLI','LEKTOR','LEKTOR_KEPALA','GURU_BESAR') NULL",
        "expertise": "ALTER TABLE lecturers ADD COLUMN expertise VARCHAR(255) NULL",
        "max_credits": "ALTER TABLE lecturers ADD COLUMN max_credits INT NULL",
        "created_at": "ALTER TABLE lecturers ADD COLUMN created_at DATETIME NOT NULL DEFAULT NOW()",
        "updated_at": "ALTER TABLE lecturers ADD COLUMN updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()",
        "deleted_at": "ALTER TABLE lecturers ADD COLUMN deleted_at DATETIME NULL",
    }
    for col, stmt in lecturers_cols.items():
        if not _col_exists(conn, 'lecturers', col):
            conn.execute(text(stmt))
    if not _idx_exists(conn, 'lecturers', 'ix_lecturers_deleted_at'):
        conn.execute(text("CREATE INDEX ix_lecturers_deleted_at ON lecturers (deleted_at)"))

    # -----------------------------------------------------------------------
    # courses — add new columns + soft delete
    # -----------------------------------------------------------------------
    courses_cols = {
        "theory_credits": "ALTER TABLE courses ADD COLUMN theory_credits INT NULL",
        "practice_credits": "ALTER TABLE courses ADD COLUMN practice_credits INT NULL",
        "semester": "ALTER TABLE courses ADD COLUMN semester INT NULL",
        "course_type": "ALTER TABLE courses ADD COLUMN course_type ENUM('WAJIB','PILIHAN') NULL",
        "lecture_type": "ALTER TABLE courses ADD COLUMN lecture_type ENUM('TEORI','PRAKTIKUM','SEMINAR','PKL') NULL",
        "study_program": "ALTER TABLE courses ADD COLUMN study_program VARCHAR(255) NULL",
        "curriculum_year": "ALTER TABLE courses ADD COLUMN curriculum_year INT NULL",
        "description": "ALTER TABLE courses ADD COLUMN description TEXT NULL",
        "created_at": "ALTER TABLE courses ADD COLUMN created_at DATETIME NOT NULL DEFAULT NOW()",
        "updated_at": "ALTER TABLE courses ADD COLUMN updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()",
        "deleted_at": "ALTER TABLE courses ADD COLUMN deleted_at DATETIME NULL",
    }
    for col, stmt in courses_cols.items():
        if not _col_exists(conn, 'courses', col):
            conn.execute(text(stmt))
    if not _idx_exists(conn, 'courses', 'ix_courses_deleted_at'):
        conn.execute(text("CREATE INDEX ix_courses_deleted_at ON courses (deleted_at)"))

    # -----------------------------------------------------------------------
    # time_slots — drop is_morning, add timestamps + soft delete
    # -----------------------------------------------------------------------
    if _col_exists(conn, 'time_slots', 'is_morning'):
        conn.execute(text("ALTER TABLE time_slots DROP COLUMN is_morning"))
    time_slots_cols = {
        "created_at": "ALTER TABLE time_slots ADD COLUMN created_at DATETIME NOT NULL DEFAULT NOW()",
        "updated_at": "ALTER TABLE time_slots ADD COLUMN updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()",
        "deleted_at": "ALTER TABLE time_slots ADD COLUMN deleted_at DATETIME NULL",
    }
    for col, stmt in time_slots_cols.items():
        if not _col_exists(conn, 'time_slots', col):
            conn.execute(text(stmt))
    if not _idx_exists(conn, 'time_slots', 'ix_time_slots_deleted_at'):
        conn.execute(text("CREATE INDEX ix_time_slots_deleted_at ON time_slots (deleted_at)"))


def downgrade() -> None:
    conn = op.get_bind()

    # time_slots
    conn.execute(text("DROP INDEX IF EXISTS ix_time_slots_deleted_at ON time_slots"))
    if _col_exists(conn, 'time_slots', 'deleted_at'):
        conn.execute(text("ALTER TABLE time_slots DROP COLUMN deleted_at"))
    if _col_exists(conn, 'time_slots', 'updated_at'):
        conn.execute(text("ALTER TABLE time_slots DROP COLUMN updated_at"))
    if _col_exists(conn, 'time_slots', 'created_at'):
        conn.execute(text("ALTER TABLE time_slots DROP COLUMN created_at"))
    if not _col_exists(conn, 'time_slots', 'is_morning'):
        conn.execute(text("ALTER TABLE time_slots ADD COLUMN is_morning TINYINT(1) NOT NULL DEFAULT 1"))

    # courses
    conn.execute(text("DROP INDEX IF EXISTS ix_courses_deleted_at ON courses"))
    for col in ['deleted_at', 'updated_at', 'created_at', 'description', 'curriculum_year',
                'study_program', 'lecture_type', 'course_type', 'semester', 'practice_credits', 'theory_credits']:
        if _col_exists(conn, 'courses', col):
            conn.execute(text(f"ALTER TABLE courses DROP COLUMN {col}"))

    # lecturers
    conn.execute(text("DROP INDEX IF EXISTS ix_lecturers_deleted_at ON lecturers"))
    for col in ['deleted_at', 'updated_at', 'created_at', 'max_credits', 'expertise',
                'functional_position', 'employment_status', 'gender', 'phone', 'back_title',
                'front_title', 'nip', 'nidn']:
        if _col_exists(conn, 'lecturers', col):
            conn.execute(text(f"ALTER TABLE lecturers DROP COLUMN {col}"))

    # rooms
    conn.execute(text("DROP INDEX IF EXISTS ix_rooms_deleted_at ON rooms"))
    if not _idx_exists(conn, 'rooms', 'uq_room_dataset_name'):
        conn.execute(text(
            "ALTER TABLE rooms ADD CONSTRAINT uq_room_dataset_name UNIQUE (dataset_id, name)"
        ))
    if _idx_exists(conn, 'rooms', 'uq_room_dataset_building_floor_name'):
        conn.execute(text("ALTER TABLE rooms DROP INDEX uq_room_dataset_building_floor_name"))
    for col in ['deleted_at', 'updated_at', 'created_at', 'room_type', 'code', 'floor',
                'building_code', 'building_name']:
        if _col_exists(conn, 'rooms', col):
            conn.execute(text(f"ALTER TABLE rooms DROP COLUMN {col}"))

    # datasets
    conn.execute(text("DROP INDEX IF EXISTS ix_datasets_deleted_at ON datasets"))
    if _col_exists(conn, 'datasets', 'deleted_at'):
        conn.execute(text("ALTER TABLE datasets DROP COLUMN deleted_at"))
