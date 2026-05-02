"""add code column to criteria

Revision ID: c7d8e9f0a1b2
Revises: f1e2d3c4b5a6
Create Date: 2026-05-02 00:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


criteria_table = sa.table(
    "criteria",
    sa.column("id", sa.Integer),
    sa.column("type", sa.String),
    sa.column("code", sa.String),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_columns = {col["name"] for col in inspector.get_columns("criteria")}
    if "code" not in existing_columns:
        op.add_column("criteria", sa.Column("code", sa.String(length=20), nullable=True))

    rows = bind.execute(sa.text("SELECT id, type FROM criteria ORDER BY id ASC")).fetchall()

    counters = {"SOFT": 0, "HARD": 0}
    for row in rows:
        key = "SOFT" if row.type == "SOFT" else "HARD"
        counters[key] += 1
        prefix = "SFT" if key == "SOFT" else "HRD"
        code = f"{prefix}_{counters[key]:03d}"
        bind.execute(
            criteria_table.update()
            .where(criteria_table.c.id == row.id)
            .where(sa.or_(criteria_table.c.code.is_(None), criteria_table.c.code == ""))
            .values(code=code)
        )

    op.alter_column("criteria", "code", existing_type=sa.String(length=20), nullable=False)

    unique_names = {item["name"] for item in inspector.get_unique_constraints("criteria")}
    if "uq_criteria_code" not in unique_names:
        op.create_unique_constraint("uq_criteria_code", "criteria", ["code"])

    index_names = {item["name"] for item in inspector.get_indexes("criteria")}
    if op.f("ix_criteria_code") not in index_names:
        op.create_index(op.f("ix_criteria_code"), "criteria", ["code"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    index_names = {item["name"] for item in inspector.get_indexes("criteria")}
    if op.f("ix_criteria_code") in index_names:
        op.drop_index(op.f("ix_criteria_code"), table_name="criteria")

    unique_names = {item["name"] for item in inspector.get_unique_constraints("criteria")}
    if "uq_criteria_code" in unique_names:
        op.drop_constraint("uq_criteria_code", "criteria", type_="unique")

    existing_columns = {col["name"] for col in inspector.get_columns("criteria")}
    if "code" in existing_columns:
        op.drop_column("criteria", "code")
