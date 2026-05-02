"""restore missing legacy revision

Revision ID: ab12cd34ef56
Revises: d1e2f3a4b5c6
Create Date: 2026-05-02 00:00:00.000000

This migration is intentionally a no-op.
It restores a missing revision file that may already be recorded
in existing databases, allowing Alembic to continue migration history.
"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "ab12cd34ef56"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
