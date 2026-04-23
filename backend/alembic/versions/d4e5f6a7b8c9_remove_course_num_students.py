"""remove course num_students column

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-23 00:00:00.000000

Changes:
- courses: drop `num_students` column
"""
from alembic import op
from sqlalchemy import text


revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, col: str) -> bool:
    res = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"
        ),
        {"t": table, "c": col},
    )
    return res.scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "courses", "num_students"):
        conn.execute(text("ALTER TABLE courses DROP COLUMN num_students"))


def downgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "courses", "num_students"):
        conn.execute(text(
            "ALTER TABLE courses ADD COLUMN num_students INT NOT NULL DEFAULT 0"
        ))
