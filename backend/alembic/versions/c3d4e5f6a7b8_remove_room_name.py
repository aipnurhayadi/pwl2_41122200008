"""remove room name column

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-23 00:00:00.000000

Changes:
- rooms: drop `name` column
- rooms: drop unique constraint uq_room_dataset_building_floor_name
- rooms: add unique constraint uq_room_dataset_building_floor_number (dataset_id, building_code, floor, room_number)
- rooms: back-fill building_name as {building_code}{floor}{room_number}
"""
from alembic import op
from sqlalchemy import text


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
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


def _idx_exists(conn, table: str, idx: str) -> bool:
    res = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND INDEX_NAME = :i"
        ),
        {"t": table, "i": idx},
    )
    return res.scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()

    # Back-fill building_name as {building_code}{floor}{room_number} for existing rows
    conn.execute(text(
        "UPDATE rooms SET building_name = CONCAT(building_code, floor, room_number)"
    ))

    # Add new unique constraint FIRST so dataset_id FK index remains covered
    if not _idx_exists(conn, "rooms", "uq_room_dataset_building_floor_number"):
        conn.execute(text(
            "ALTER TABLE rooms ADD CONSTRAINT uq_room_dataset_building_floor_number "
            "UNIQUE (dataset_id, building_code, floor, room_number)"
        ))

    # Now drop the old unique constraint that included `name`
    if _idx_exists(conn, "rooms", "uq_room_dataset_building_floor_name"):
        conn.execute(text("ALTER TABLE rooms DROP INDEX uq_room_dataset_building_floor_name"))

    # Drop `name` column
    if _col_exists(conn, "rooms", "name"):
        conn.execute(text("ALTER TABLE rooms DROP COLUMN name"))


def downgrade() -> None:
    conn = op.get_bind()

    # Drop new constraint
    if _idx_exists(conn, "rooms", "uq_room_dataset_building_floor_number"):
        conn.execute(text("ALTER TABLE rooms DROP INDEX uq_room_dataset_building_floor_number"))

    # Re-add `name` column (nullable to avoid breaking existing rows)
    if not _col_exists(conn, "rooms", "name"):
        conn.execute(text("ALTER TABLE rooms ADD COLUMN name VARCHAR(255) NULL"))
        # Back-fill name from building_name (best-effort)
        conn.execute(text("UPDATE rooms SET name = building_name"))
        conn.execute(text("ALTER TABLE rooms MODIFY COLUMN name VARCHAR(255) NOT NULL"))

    # Restore old unique constraint
    if not _idx_exists(conn, "rooms", "uq_room_dataset_building_floor_name"):
        conn.execute(text(
            "ALTER TABLE rooms ADD CONSTRAINT uq_room_dataset_building_floor_name "
            "UNIQUE (dataset_id, building_code, floor, name)"
        ))
