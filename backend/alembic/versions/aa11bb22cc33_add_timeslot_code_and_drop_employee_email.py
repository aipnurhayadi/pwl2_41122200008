"""add timeslot code and drop employee email

Revision ID: aa11bb22cc33
Revises: c7d8e9f0a1b2
Create Date: 2026-05-02 00:00:00.000000

Changes:
- Add `time_slots.code` with unique constraint per dataset
- Drop `employees.email` (use `users.email` via employee.user_id)
"""

from alembic import op
from sqlalchemy import text


revision = "aa11bb22cc33"
down_revision = "c7d8e9f0a1b2"
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


def upgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "time_slots"):
        if not _column_exists(conn, "time_slots", "code"):
            conn.execute(text("ALTER TABLE time_slots ADD COLUMN code VARCHAR(50) NULL AFTER dataset_id"))

        rows = conn.execute(
            text(
                "SELECT id, dataset_id "
                "FROM time_slots "
                "ORDER BY dataset_id ASC, day ASC, start_time ASC, id ASC"
            )
        ).fetchall()
        seq_by_dataset: dict[int, int] = {}
        for row in rows:
            dataset_id = int(row.dataset_id)
            seq = seq_by_dataset.get(dataset_id, 0) + 1
            seq_by_dataset[dataset_id] = seq
            conn.execute(
                text("UPDATE time_slots SET code = :code WHERE id = :id"),
                {"code": f"TS{seq:03d}", "id": row.id},
            )

        conn.execute(text("ALTER TABLE time_slots MODIFY COLUMN code VARCHAR(50) NOT NULL"))

        if not _index_exists(conn, "time_slots", "uq_time_slot_dataset_code"):
            conn.execute(text("CREATE UNIQUE INDEX uq_time_slot_dataset_code ON time_slots (dataset_id, code)"))

    if _table_exists(conn, "employees") and _column_exists(conn, "employees", "email"):
        conn.execute(text("ALTER TABLE employees DROP COLUMN email"))


def downgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "employees") and not _column_exists(conn, "employees", "email"):
        conn.execute(text("ALTER TABLE employees ADD COLUMN email VARCHAR(255) NULL AFTER back_title"))

    if _table_exists(conn, "time_slots"):
        if _index_exists(conn, "time_slots", "uq_time_slot_dataset_code"):
            conn.execute(text("DROP INDEX uq_time_slot_dataset_code ON time_slots"))
        if _column_exists(conn, "time_slots", "code"):
            conn.execute(text("ALTER TABLE time_slots DROP COLUMN code"))
