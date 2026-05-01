"""add user role and lecturer user link

Revision ID: f7a8b9c0d1e2
Revises: e5f6a7b8c9d0
Create Date: 2026-05-01 00:00:00.000000

Changes:
- Add users.role with default 'user'
- Add lecturers.user_id nullable FK to users.id
"""

from alembic import op
from sqlalchemy import text


revision = "f7a8b9c0d1e2"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    res = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t"
        ),
        {"t": table},
    )
    return res.scalar() > 0


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


def _fk_exists(conn, table: str, fk_name: str) -> bool:
    res = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t "
            "AND CONSTRAINT_NAME = :f AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        ),
        {"t": table, "f": fk_name},
    )
    return res.scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "users"):
        if not _column_exists(conn, "users", "role"):
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user' AFTER password_hash"))
        conn.execute(text("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''"))
        if not _index_exists(conn, "users", "ix_users_role"):
            conn.execute(text("CREATE INDEX ix_users_role ON users (role)"))

    if _table_exists(conn, "lecturers"):
        if not _column_exists(conn, "lecturers", "user_id"):
            conn.execute(text("ALTER TABLE lecturers ADD COLUMN user_id INT NULL AFTER dataset_id"))
        if not _index_exists(conn, "lecturers", "uq_lecturers_user_id"):
            conn.execute(text("CREATE UNIQUE INDEX uq_lecturers_user_id ON lecturers (user_id)"))
        if not _fk_exists(conn, "lecturers", "fk_lecturers_user"):
            conn.execute(text(
                "ALTER TABLE lecturers "
                "ADD CONSTRAINT fk_lecturers_user "
                "FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL"
            ))


def downgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "lecturers"):
        if _fk_exists(conn, "lecturers", "fk_lecturers_user"):
            conn.execute(text("ALTER TABLE lecturers DROP FOREIGN KEY fk_lecturers_user"))
        if _index_exists(conn, "lecturers", "uq_lecturers_user_id"):
            conn.execute(text("DROP INDEX uq_lecturers_user_id ON lecturers"))
        if _column_exists(conn, "lecturers", "user_id"):
            conn.execute(text("ALTER TABLE lecturers DROP COLUMN user_id"))

    if _table_exists(conn, "users"):
        if _index_exists(conn, "users", "ix_users_role"):
            conn.execute(text("DROP INDEX ix_users_role ON users"))
        if _column_exists(conn, "users", "role"):
            conn.execute(text("ALTER TABLE users DROP COLUMN role"))
