"""hard delete and audit standardization

Revision ID: bb22cc33dd44
Revises: aa11bb22cc33
Create Date: 2026-05-03 13:30:00.000000
"""

from alembic import op
from sqlalchemy import text


revision = "bb22cc33dd44"
down_revision = "aa11bb22cc33"
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


def _drop_index_if_exists(conn, table: str, index: str) -> None:
    if _index_exists(conn, table, index):
        conn.execute(text(f"DROP INDEX {index} ON {table}"))


def _drop_foreign_keys_for_column(conn, table: str, column: str) -> None:
    rows = conn.execute(
        text(
            "SELECT CONSTRAINT_NAME "
            "FROM information_schema.KEY_COLUMN_USAGE "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "  AND TABLE_NAME = :t "
            "  AND COLUMN_NAME = :c "
            "  AND REFERENCED_TABLE_NAME IS NOT NULL"
        ),
        {"t": table, "c": column},
    ).fetchall()

    for row in rows:
        fk_name = row.CONSTRAINT_NAME
        conn.execute(text(f"ALTER TABLE {table} DROP FOREIGN KEY {fk_name}"))


def _ensure_system_user(conn) -> None:
    if not _table_exists(conn, "users"):
        return

    conn.execute(
        text(
            "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) "
            "SELECT 1, 'SYSTEM', 'system@local', 'SYSTEM', 'ADMIN', NOW(), NOW() "
            "WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 1)"
        )
    )


def _add_created_by(conn, table: str, fk_name: str) -> None:
    if not _table_exists(conn, table):
        return

    if not _column_exists(conn, table, "created_by"):
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN created_by INT NULL"))

    conn.execute(text(f"UPDATE {table} SET created_by = 1 WHERE created_by IS NULL"))

    ix_name = f"ix_{table}_created_by"
    if not _index_exists(conn, table, ix_name):
        conn.execute(text(f"CREATE INDEX {ix_name} ON {table} (created_by)"))

    _drop_foreign_keys_for_column(conn, table, "created_by")
    conn.execute(text(f"ALTER TABLE {table} ADD CONSTRAINT {fk_name} FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE"))
    conn.execute(text(f"ALTER TABLE {table} MODIFY COLUMN created_by INT NOT NULL"))


def _drop_deleted_at(conn, table: str) -> None:
    if not _table_exists(conn, table):
        return

    if _column_exists(conn, table, "deleted_at"):
        _drop_index_if_exists(conn, table, f"ix_{table}_deleted_at")
        conn.execute(text(f"ALTER TABLE {table} DROP COLUMN deleted_at"))


def upgrade() -> None:
    conn = op.get_bind()

    _ensure_system_user(conn)

    if _table_exists(conn, "personal_access_tokens"):
        conn.execute(text("DROP TABLE personal_access_tokens"))

    if _table_exists(conn, "lecturer_courses"):
        conn.execute(text("DROP TABLE lecturer_courses"))

    tables_with_created_by = [
        ("users", "fk_users_created_by_users"),
        ("employees", "fk_employees_created_by_users"),
        ("refresh_tokens", "fk_refresh_tokens_created_by_users"),
        ("datasets", "fk_datasets_created_by_users"),
        ("rooms", "fk_rooms_created_by_users"),
        ("lecturers", "fk_lecturers_created_by_users"),
        ("courses", "fk_courses_created_by_users"),
        ("time_slots", "fk_time_slots_created_by_users"),
        ("classes", "fk_classes_created_by_users"),
        ("criteria", "fk_criteria_created_by_users"),
        ("bwm_responses", "fk_bwm_responses_created_by_users"),
        ("bwm_best_to_others", "fk_bwm_best_to_others_created_by_users"),
        ("bwm_others_to_worst", "fk_bwm_others_to_worst_created_by_users"),
        ("bwm_weights", "fk_bwm_weights_created_by_users"),
    ]

    for table, fk_name in tables_with_created_by:
        _add_created_by(conn, table, fk_name)

    if _table_exists(conn, "refresh_tokens") and not _column_exists(conn, "refresh_tokens", "updated_at"):
        conn.execute(text("ALTER TABLE refresh_tokens ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))

    if _table_exists(conn, "bwm_best_to_others") and not _column_exists(conn, "bwm_best_to_others", "created_at"):
        conn.execute(text("ALTER TABLE bwm_best_to_others ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"))

    if _table_exists(conn, "bwm_others_to_worst") and not _column_exists(conn, "bwm_others_to_worst", "created_at"):
        conn.execute(text("ALTER TABLE bwm_others_to_worst ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"))

    if _table_exists(conn, "bwm_weights") and not _column_exists(conn, "bwm_weights", "created_at"):
        conn.execute(text("ALTER TABLE bwm_weights ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"))

    for table in ["datasets", "rooms", "lecturers", "courses", "time_slots", "classes"]:
        _drop_deleted_at(conn, table)

    if _table_exists(conn, "bwm_responses"):
        _drop_foreign_keys_for_column(conn, "bwm_responses", "best_criteria_id")
        _drop_foreign_keys_for_column(conn, "bwm_responses", "worst_criteria_id")
        conn.execute(
            text(
                "ALTER TABLE bwm_responses "
                "ADD CONSTRAINT fk_bwm_responses_best_criteria_id "
                "FOREIGN KEY (best_criteria_id) REFERENCES criteria(id) ON DELETE CASCADE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE bwm_responses "
                "ADD CONSTRAINT fk_bwm_responses_worst_criteria_id "
                "FOREIGN KEY (worst_criteria_id) REFERENCES criteria(id) ON DELETE CASCADE"
            )
        )


def downgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "bwm_responses"):
        _drop_foreign_keys_for_column(conn, "bwm_responses", "best_criteria_id")
        _drop_foreign_keys_for_column(conn, "bwm_responses", "worst_criteria_id")
        conn.execute(
            text(
                "ALTER TABLE bwm_responses "
                "ADD CONSTRAINT fk_bwm_responses_best_criteria_id_restrict "
                "FOREIGN KEY (best_criteria_id) REFERENCES criteria(id) ON DELETE RESTRICT"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE bwm_responses "
                "ADD CONSTRAINT fk_bwm_responses_worst_criteria_id_restrict "
                "FOREIGN KEY (worst_criteria_id) REFERENCES criteria(id) ON DELETE RESTRICT"
            )
        )

    for table in ["datasets", "rooms", "lecturers", "courses", "time_slots", "classes"]:
        if _table_exists(conn, table) and not _column_exists(conn, table, "deleted_at"):
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN deleted_at DATETIME NULL"))
            ix_name = f"ix_{table}_deleted_at"
            if not _index_exists(conn, table, ix_name):
                conn.execute(text(f"CREATE INDEX {ix_name} ON {table} (deleted_at)"))

    if _table_exists(conn, "bwm_weights") and _column_exists(conn, "bwm_weights", "created_at"):
        conn.execute(text("ALTER TABLE bwm_weights DROP COLUMN created_at"))
    if _table_exists(conn, "bwm_others_to_worst") and _column_exists(conn, "bwm_others_to_worst", "created_at"):
        conn.execute(text("ALTER TABLE bwm_others_to_worst DROP COLUMN created_at"))
    if _table_exists(conn, "bwm_best_to_others") and _column_exists(conn, "bwm_best_to_others", "created_at"):
        conn.execute(text("ALTER TABLE bwm_best_to_others DROP COLUMN created_at"))

    if _table_exists(conn, "refresh_tokens") and _column_exists(conn, "refresh_tokens", "updated_at"):
        conn.execute(text("ALTER TABLE refresh_tokens DROP COLUMN updated_at"))

    tables_with_created_by = [
        "bwm_weights",
        "bwm_others_to_worst",
        "bwm_best_to_others",
        "bwm_responses",
        "criteria",
        "classes",
        "time_slots",
        "courses",
        "lecturers",
        "rooms",
        "datasets",
        "refresh_tokens",
        "employees",
        "users",
    ]

    for table in tables_with_created_by:
        if _table_exists(conn, table) and _column_exists(conn, table, "created_by"):
            _drop_foreign_keys_for_column(conn, table, "created_by")
            _drop_index_if_exists(conn, table, f"ix_{table}_created_by")
            conn.execute(text(f"ALTER TABLE {table} DROP COLUMN created_by"))

    if not _table_exists(conn, "personal_access_tokens"):
        conn.execute(
            text(
                "CREATE TABLE personal_access_tokens ("
                "id INT NOT NULL AUTO_INCREMENT, "
                "user_id INT NOT NULL, "
                "name VARCHAR(255) NOT NULL, "
                "token_hash VARCHAR(64) NOT NULL, "
                "last_used_at DATETIME NULL, "
                "expires_at DATETIME NULL, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, "
                "PRIMARY KEY (id), "
                "UNIQUE KEY uq_pat_token_hash (token_hash), "
                "CONSTRAINT fk_pat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
                ")"
            )
        )

    if not _table_exists(conn, "lecturer_courses"):
        conn.execute(
            text(
                "CREATE TABLE lecturer_courses ("
                "lecturer_id INT NOT NULL, "
                "course_id INT NOT NULL, "
                "PRIMARY KEY (lecturer_id, course_id), "
                "CONSTRAINT fk_lecturer_courses_lecturer FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE, "
                "CONSTRAINT fk_lecturer_courses_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE"
                ")"
            )
        )
