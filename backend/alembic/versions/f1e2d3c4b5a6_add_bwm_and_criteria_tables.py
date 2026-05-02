"""add bwm and criteria tables

Revision ID: f1e2d3c4b5a6
Revises: d1e2f3a4b5c6
Create Date: 2026-05-02 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, None] = "ab12cd34ef56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


constraint_type_enum = sa.Enum("HARD", "SOFT", name="constrainttypeenum")


def _drop_table_if_exists(table_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name in inspector.get_table_names():
        op.drop_table(table_name)


def upgrade() -> None:
    # Cleanup old AHP tables if they still exist in deployed DB.
    _drop_table_if_exists("ahp_weights")
    _drop_table_if_exists("ahp_pairwise")
    _drop_table_if_exists("ahp_rankings")
    _drop_table_if_exists("ahp_criteria")

    constraint_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "criteria",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", constraint_type_enum, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("(now())"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("(now())"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_criteria_id"), "criteria", ["id"], unique=False)
    op.create_index(op.f("ix_criteria_name"), "criteria", ["name"], unique=True)
    op.create_index(op.f("ix_criteria_type"), "criteria", ["type"], unique=False)

    op.create_table(
        "bwm_responses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("lecturer_id", sa.Integer(), nullable=False),
        sa.Column("best_criteria_id", sa.Integer(), nullable=False),
        sa.Column("worst_criteria_id", sa.Integer(), nullable=False),
        sa.Column("scale_max", sa.Integer(), server_default="9", nullable=False),
        sa.Column("ksi", sa.Float(), nullable=True),
        sa.Column("consistency_ratio", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("(now())"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("(now())"), nullable=False),
        sa.CheckConstraint("best_criteria_id <> worst_criteria_id", name="ck_bwm_best_worst_not_equal"),
        sa.CheckConstraint("scale_max >= 3 AND scale_max <= 9", name="ck_bwm_scale_max_range"),
        sa.ForeignKeyConstraint(["best_criteria_id"], ["criteria.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lecturer_id"], ["lecturers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["worst_criteria_id"], ["criteria.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dataset_id", "lecturer_id", name="uq_bwm_response_dataset_lecturer"),
    )
    op.create_index(op.f("ix_bwm_responses_id"), "bwm_responses", ["id"], unique=False)
    op.create_index(op.f("ix_bwm_responses_dataset_id"), "bwm_responses", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_bwm_responses_lecturer_id"), "bwm_responses", ["lecturer_id"], unique=False)

    op.create_table(
        "bwm_best_to_others",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("response_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.CheckConstraint("value >= 1 AND value <= 9", name="ck_bwm_best_to_other_value_range"),
        sa.ForeignKeyConstraint(["criterion_id"], ["criteria.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["response_id"], ["bwm_responses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("response_id", "criterion_id", name="uq_bwm_best_to_other_response_criterion"),
    )
    op.create_index(op.f("ix_bwm_best_to_others_id"), "bwm_best_to_others", ["id"], unique=False)
    op.create_index(op.f("ix_bwm_best_to_others_response_id"), "bwm_best_to_others", ["response_id"], unique=False)
    op.create_index(op.f("ix_bwm_best_to_others_criterion_id"), "bwm_best_to_others", ["criterion_id"], unique=False)

    op.create_table(
        "bwm_others_to_worst",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("response_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.CheckConstraint("value >= 1 AND value <= 9", name="ck_bwm_other_to_worst_value_range"),
        sa.ForeignKeyConstraint(["criterion_id"], ["criteria.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["response_id"], ["bwm_responses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("response_id", "criterion_id", name="uq_bwm_other_to_worst_response_criterion"),
    )
    op.create_index(op.f("ix_bwm_others_to_worst_id"), "bwm_others_to_worst", ["id"], unique=False)
    op.create_index(op.f("ix_bwm_others_to_worst_response_id"), "bwm_others_to_worst", ["response_id"], unique=False)
    op.create_index(op.f("ix_bwm_others_to_worst_criterion_id"), "bwm_others_to_worst", ["criterion_id"], unique=False)

    op.create_table(
        "bwm_weights",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("response_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.CheckConstraint("weight >= 0", name="ck_bwm_weight_non_negative"),
        sa.ForeignKeyConstraint(["criterion_id"], ["criteria.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["response_id"], ["bwm_responses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("response_id", "criterion_id", name="uq_bwm_weight_response_criterion"),
    )
    op.create_index(op.f("ix_bwm_weights_id"), "bwm_weights", ["id"], unique=False)
    op.create_index(op.f("ix_bwm_weights_response_id"), "bwm_weights", ["response_id"], unique=False)
    op.create_index(op.f("ix_bwm_weights_criterion_id"), "bwm_weights", ["criterion_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_bwm_weights_criterion_id"), table_name="bwm_weights")
    op.drop_index(op.f("ix_bwm_weights_response_id"), table_name="bwm_weights")
    op.drop_index(op.f("ix_bwm_weights_id"), table_name="bwm_weights")
    op.drop_table("bwm_weights")

    op.drop_index(op.f("ix_bwm_others_to_worst_criterion_id"), table_name="bwm_others_to_worst")
    op.drop_index(op.f("ix_bwm_others_to_worst_response_id"), table_name="bwm_others_to_worst")
    op.drop_index(op.f("ix_bwm_others_to_worst_id"), table_name="bwm_others_to_worst")
    op.drop_table("bwm_others_to_worst")

    op.drop_index(op.f("ix_bwm_best_to_others_criterion_id"), table_name="bwm_best_to_others")
    op.drop_index(op.f("ix_bwm_best_to_others_response_id"), table_name="bwm_best_to_others")
    op.drop_index(op.f("ix_bwm_best_to_others_id"), table_name="bwm_best_to_others")
    op.drop_table("bwm_best_to_others")

    op.drop_index(op.f("ix_bwm_responses_lecturer_id"), table_name="bwm_responses")
    op.drop_index(op.f("ix_bwm_responses_dataset_id"), table_name="bwm_responses")
    op.drop_index(op.f("ix_bwm_responses_id"), table_name="bwm_responses")
    op.drop_table("bwm_responses")

    op.drop_index(op.f("ix_criteria_type"), table_name="criteria")
    op.drop_index(op.f("ix_criteria_name"), table_name="criteria")
    op.drop_index(op.f("ix_criteria_id"), table_name="criteria")
    op.drop_table("criteria")

    constraint_type_enum.drop(op.get_bind(), checkfirst=True)
