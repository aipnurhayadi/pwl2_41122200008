"""enforce employee user not null

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-05-01 00:00:00.000000

"""
from __future__ import annotations

import hashlib
from typing import Sequence, Union

from alembic import op
from passlib.context import CryptContext
from sqlalchemy import text

revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_EMPLOYEE_PASSWORD = "Employee123!"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _prehash(plain: str) -> str:
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


def _hash_password(plain: str) -> str:
    return pwd_context.hash(_prehash(plain))


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


def _next_unique_email(conn, preferred: str | None, employee_code: str, employee_id: int) -> str:
    base = (preferred or "").strip().lower()
    if not base:
        base = f"{employee_code.lower()}@example.com"

    if "@" not in base:
        base = f"{base}@example.com"

    local, domain = base.split("@", 1)
    if not local:
        local = employee_code.lower()
    if not domain:
        domain = "example.com"

    candidate = f"{local}@{domain}"
    suffix = 1
    while conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": candidate}).first():
        candidate = f"{local}{employee_id}{suffix}@{domain}"
        suffix += 1

    return candidate


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "employees") or not _column_exists(conn, "employees", "user_id"):
        return

    rows = conn.execute(
        text(
            "SELECT id, employee_code, name, email "
            "FROM employees WHERE user_id IS NULL ORDER BY id ASC"
        )
    ).fetchall()

    for row in rows:
        user_email = _next_unique_email(conn, row.email, row.employee_code, row.id)
        conn.execute(
            text(
                "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) "
                "VALUES (:name, :email, :password_hash, 'LECTURER', NOW(), NOW())"
            ),
            {
                "name": row.name,
                "email": user_email,
                "password_hash": _hash_password(DEFAULT_EMPLOYEE_PASSWORD),
            },
        )
        user_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        conn.execute(
            text("UPDATE employees SET user_id = :user_id WHERE id = :employee_id"),
            {"user_id": user_id, "employee_id": row.id},
        )

    if _fk_exists(conn, "employees", "fk_employees_user"):
        conn.execute(text("ALTER TABLE employees DROP FOREIGN KEY fk_employees_user"))

    conn.execute(text("ALTER TABLE employees MODIFY COLUMN user_id INT NOT NULL"))
    conn.execute(
        text(
            "ALTER TABLE employees "
            "ADD CONSTRAINT fk_employees_user "
            "FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "employees") or not _column_exists(conn, "employees", "user_id"):
        return

    if _fk_exists(conn, "employees", "fk_employees_user"):
        conn.execute(text("ALTER TABLE employees DROP FOREIGN KEY fk_employees_user"))

    conn.execute(text("ALTER TABLE employees MODIFY COLUMN user_id INT NULL"))
    conn.execute(
        text(
            "ALTER TABLE employees "
            "ADD CONSTRAINT fk_employees_user "
            "FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL"
        )
    )
