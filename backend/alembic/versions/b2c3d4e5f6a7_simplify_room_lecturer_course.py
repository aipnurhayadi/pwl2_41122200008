"""simplify room lecturer course

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-23 00:00:00.000000

Changes:
- rooms: add room_number column
- lecturers: drop employment_status, functional_position, expertise, max_credits
- courses: drop theory_credits, practice_credits, course_type, lecture_type, study_program
"""
from alembic import op
from sqlalchemy import text


# revision identifiers
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, col: str) -> bool:
    res = conn.execute(
        text("SELECT COUNT(*) FROM information_schema.COLUMNS "
             "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"),
        {"t": table, "c": col},
    )
    return res.scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()

    # ── rooms ──────────────────────────────────────────────────────────────
    if not _col_exists(conn, "rooms", "room_number"):
        conn.execute(text(
            "ALTER TABLE rooms ADD COLUMN room_number INT NOT NULL DEFAULT 1 "
            "AFTER floor"
        ))

    # ── lecturers ──────────────────────────────────────────────────────────
    for col, col_type in [
        ("employment_status", None),
        ("functional_position", None),
        ("expertise", None),
        ("max_credits", None),
    ]:
        if _col_exists(conn, "lecturers", col):
            conn.execute(text(f"ALTER TABLE lecturers DROP COLUMN {col}"))

    # ── courses ────────────────────────────────────────────────────────────
    for col in ["theory_credits", "practice_credits", "course_type", "lecture_type", "study_program"]:
        if _col_exists(conn, "courses", col):
            conn.execute(text(f"ALTER TABLE courses DROP COLUMN {col}"))


def downgrade() -> None:
    conn = op.get_bind()

    # ── rooms ──────────────────────────────────────────────────────────────
    if _col_exists(conn, "rooms", "room_number"):
        conn.execute(text("ALTER TABLE rooms DROP COLUMN room_number"))

    # ── lecturers ──────────────────────────────────────────────────────────
    if not _col_exists(conn, "lecturers", "employment_status"):
        conn.execute(text(
            "ALTER TABLE lecturers ADD COLUMN employment_status "
            "ENUM('PNS','TETAP_YAYASAN','KONTRAK','TIDAK_TETAP') NULL"
        ))
    if not _col_exists(conn, "lecturers", "functional_position"):
        conn.execute(text(
            "ALTER TABLE lecturers ADD COLUMN functional_position "
            "ENUM('ASISTEN_AHLI','LEKTOR','LEKTOR_KEPALA','GURU_BESAR') NULL"
        ))
    if not _col_exists(conn, "lecturers", "expertise"):
        conn.execute(text("ALTER TABLE lecturers ADD COLUMN expertise VARCHAR(255) NULL"))
    if not _col_exists(conn, "lecturers", "max_credits"):
        conn.execute(text("ALTER TABLE lecturers ADD COLUMN max_credits INT NULL"))

    # ── courses ────────────────────────────────────────────────────────────
    if not _col_exists(conn, "courses", "theory_credits"):
        conn.execute(text("ALTER TABLE courses ADD COLUMN theory_credits INT NULL"))
    if not _col_exists(conn, "courses", "practice_credits"):
        conn.execute(text("ALTER TABLE courses ADD COLUMN practice_credits INT NULL"))
    if not _col_exists(conn, "courses", "course_type"):
        conn.execute(text(
            "ALTER TABLE courses ADD COLUMN course_type ENUM('WAJIB','PILIHAN') NULL"
        ))
    if not _col_exists(conn, "courses", "lecture_type"):
        conn.execute(text(
            "ALTER TABLE courses ADD COLUMN lecture_type "
            "ENUM('TEORI','PRAKTIKUM','SEMINAR','PKL') NULL"
        ))
    if not _col_exists(conn, "courses", "study_program"):
        conn.execute(text("ALTER TABLE courses ADD COLUMN study_program VARCHAR(255) NULL"))
