"""employee profile and lecturer assignment refactor

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-05-01 00:00:00.000000

Changes:
- Add employees table
- Add datasets.code
- Convert users.role values to ADMIN/LECTURER
- Add lecturers.employee_id and backfill from existing lecturer rows
"""

from alembic import op
from sqlalchemy import text


revision = "a8b9c0d1e2f3"
down_revision = "f7a8b9c0d1e2"
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

    if not _table_exists(conn, "employees"):
        conn.execute(text("""
            CREATE TABLE employees (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                employee_code VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                nidn VARCHAR(20) NULL,
                nip VARCHAR(20) NULL,
                front_title VARCHAR(50) NULL,
                back_title VARCHAR(100) NULL,
                email VARCHAR(255) NULL,
                phone VARCHAR(20) NULL,
                gender VARCHAR(1) NULL,
                created_at DATETIME NOT NULL DEFAULT NOW(),
                updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                UNIQUE KEY uq_employees_employee_code (employee_code),
                UNIQUE KEY uq_employees_user_id (user_id),
                INDEX ix_employees_employee_code (employee_code),
                INDEX ix_employees_user_id (user_id),
                CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))

    if _table_exists(conn, "users") and _column_exists(conn, "users", "role"):
        conn.execute(text("UPDATE users SET role = UPPER(role)"))
        conn.execute(text("UPDATE users SET role = 'ADMIN' WHERE role NOT IN ('ADMIN','LECTURER') OR role IS NULL OR role = ''"))

    if _table_exists(conn, "datasets"):
        if not _column_exists(conn, "datasets", "code"):
            conn.execute(text("ALTER TABLE datasets ADD COLUMN code VARCHAR(50) NULL AFTER user_id"))
        conn.execute(text("UPDATE datasets SET code = CONCAT('DS', LPAD(id, 3, '0')) WHERE code IS NULL OR code = ''"))
        if not _index_exists(conn, "datasets", "uq_datasets_code"):
            conn.execute(text("CREATE UNIQUE INDEX uq_datasets_code ON datasets (code)"))
        conn.execute(text("ALTER TABLE datasets MODIFY COLUMN code VARCHAR(50) NOT NULL"))

    if _table_exists(conn, "lecturers"):
        if not _column_exists(conn, "lecturers", "employee_id"):
            conn.execute(text("ALTER TABLE lecturers ADD COLUMN employee_id INT NULL AFTER dataset_id"))

        # Backfill employees and link each lecturer row to one employee.
        lecturers = conn.execute(text("""
            SELECT id, name, nidn, nip, front_title, back_title, email, phone, gender, user_id
            FROM lecturers
            ORDER BY id ASC
        """)).fetchall()

        for row in lecturers:
            employee_code = f"EMP{row.id:03d}"
            conn.execute(
                text("""
                    INSERT INTO employees (
                        user_id, employee_code, name, nidn, nip, front_title, back_title, email, phone, gender
                    ) VALUES (
                        :user_id, :employee_code, :name, :nidn, :nip, :front_title, :back_title, :email, :phone, :gender
                    )
                """),
                {
                    "user_id": row.user_id,
                    "employee_code": employee_code,
                    "name": row.name,
                    "nidn": row.nidn,
                    "nip": row.nip,
                    "front_title": row.front_title,
                    "back_title": row.back_title,
                    "email": row.email,
                    "phone": row.phone,
                    "gender": row.gender,
                },
            )
            employee_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
            conn.execute(
                text("UPDATE lecturers SET employee_id = :employee_id WHERE id = :lecturer_id"),
                {"employee_id": employee_id, "lecturer_id": row.id},
            )

        conn.execute(text("""
            UPDATE lecturers l
            JOIN datasets d ON d.id = l.dataset_id
            JOIN employees e ON e.id = l.employee_id
            SET l.code = CONCAT(d.code, '-', e.employee_code)
        """))

        if not _index_exists(conn, "lecturers", "ix_lecturers_employee_id"):
            conn.execute(text("CREATE INDEX ix_lecturers_employee_id ON lecturers (employee_id)"))
        if not _index_exists(conn, "lecturers", "uq_lecturer_dataset_employee"):
            conn.execute(text("CREATE UNIQUE INDEX uq_lecturer_dataset_employee ON lecturers (dataset_id, employee_id)"))
        if not _fk_exists(conn, "lecturers", "fk_lecturers_employee"):
            conn.execute(text(
                "ALTER TABLE lecturers "
                "ADD CONSTRAINT fk_lecturers_employee "
                "FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE"
            ))
        conn.execute(text("ALTER TABLE lecturers MODIFY COLUMN employee_id INT NOT NULL"))


def downgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "lecturers"):
        if _fk_exists(conn, "lecturers", "fk_lecturers_employee"):
            conn.execute(text("ALTER TABLE lecturers DROP FOREIGN KEY fk_lecturers_employee"))
        if _index_exists(conn, "lecturers", "uq_lecturer_dataset_employee"):
            conn.execute(text("DROP INDEX uq_lecturer_dataset_employee ON lecturers"))
        if _index_exists(conn, "lecturers", "ix_lecturers_employee_id"):
            conn.execute(text("DROP INDEX ix_lecturers_employee_id ON lecturers"))
        if _column_exists(conn, "lecturers", "employee_id"):
            conn.execute(text("ALTER TABLE lecturers DROP COLUMN employee_id"))

    if _table_exists(conn, "datasets"):
        if _index_exists(conn, "datasets", "uq_datasets_code"):
            conn.execute(text("DROP INDEX uq_datasets_code ON datasets"))
        if _column_exists(conn, "datasets", "code"):
            conn.execute(text("ALTER TABLE datasets DROP COLUMN code"))

    if _table_exists(conn, "users") and _column_exists(conn, "users", "role"):
        conn.execute(text("UPDATE users SET role = LOWER(role)"))

    if _table_exists(conn, "employees"):
        conn.execute(text("DROP TABLE employees"))
