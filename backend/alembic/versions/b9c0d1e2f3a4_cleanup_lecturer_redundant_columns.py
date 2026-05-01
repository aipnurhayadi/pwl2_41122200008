"""cleanup lecturer redundant columns

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-05-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("lecturers", "name")
    op.drop_column("lecturers", "nidn")
    op.drop_column("lecturers", "nip")
    op.drop_column("lecturers", "front_title")
    op.drop_column("lecturers", "back_title")
    op.drop_column("lecturers", "email")
    op.drop_column("lecturers", "phone")
    op.drop_column("lecturers", "gender")


def downgrade() -> None:
    op.add_column("lecturers", sa.Column("gender", sa.Enum("L", "P", name="genderenum"), nullable=True))
    op.add_column("lecturers", sa.Column("phone", sa.String(length=20), nullable=True))
    op.add_column("lecturers", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("lecturers", sa.Column("back_title", sa.String(length=100), nullable=True))
    op.add_column("lecturers", sa.Column("front_title", sa.String(length=50), nullable=True))
    op.add_column("lecturers", sa.Column("nip", sa.String(length=20), nullable=True))
    op.add_column("lecturers", sa.Column("nidn", sa.String(length=20), nullable=True))
    op.add_column("lecturers", sa.Column("name", sa.String(length=255), nullable=False, server_default=""))
