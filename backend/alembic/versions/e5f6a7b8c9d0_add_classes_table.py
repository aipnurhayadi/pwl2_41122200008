"""add classes table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-23 00:00:00.000000

Changes:
- Create `classes` table with soft-delete support
"""
from alembic import op
from sqlalchemy import text


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
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


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "classes"):
        conn.execute(text("""
            CREATE TABLE classes (
                id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                dataset_id  INT NOT NULL,
                name        VARCHAR(255) NOT NULL,
                code        VARCHAR(50) NOT NULL,
                academic_year INT NULL,
                semester    INT NULL,
                study_program VARCHAR(255) NULL,
                capacity    INT NULL,
                description TEXT NULL,
                created_at  DATETIME NOT NULL DEFAULT NOW(),
                updated_at  DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                deleted_at  DATETIME NULL,
                INDEX ix_classes_deleted_at (deleted_at),
                UNIQUE KEY uq_class_dataset_code (dataset_id, code),
                CONSTRAINT fk_classes_dataset
                    FOREIGN KEY (dataset_id) REFERENCES datasets (id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "classes"):
        conn.execute(text("DROP TABLE classes"))
