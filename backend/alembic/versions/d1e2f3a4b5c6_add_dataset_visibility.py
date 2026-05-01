"""add dataset visibility

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-05-01 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c0d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    res = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"
        ),
        {"t": table, "c": column},
    )
    return res.scalar() > 0


def _index_exists(conn, table: str, index: str) -> bool:
    res = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND INDEX_NAME = :i"
        ),
        {"t": table, "i": index},
    )
    return res.scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()

    if not _column_exists(conn, "datasets", "visibility"):
        conn.execute(
            text(
                "ALTER TABLE datasets "
                "ADD COLUMN visibility ENUM('PUBLIC','PRIVATE') NOT NULL DEFAULT 'PRIVATE'"
            )
        )

    conn.execute(text("UPDATE datasets SET visibility = 'PRIVATE' WHERE visibility IS NULL"))

    if not _index_exists(conn, "datasets", "ix_datasets_visibility"):
        conn.execute(text("CREATE INDEX ix_datasets_visibility ON datasets (visibility)"))


def downgrade() -> None:
    conn = op.get_bind()

    if _index_exists(conn, "datasets", "ix_datasets_visibility"):
        conn.execute(text("DROP INDEX ix_datasets_visibility ON datasets"))

    if _column_exists(conn, "datasets", "visibility"):
        conn.execute(text("ALTER TABLE datasets DROP COLUMN visibility"))
