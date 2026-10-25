"""Initial tenant-aware schema for new installations.

Revision ID: 0001_secure_tenants
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_secure_tenants"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
    )
    op.create_table(
        "memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("subject", sa.String(512), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("organization_id", "subject", name="uq_org_subject"),
    )
    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50)),
        sa.Column("priority", sa.String(16), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("assignee", sa.String(120)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("actor", sa.String(512), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "automation_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("playbook", sa.String(60), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("requested_by", sa.String(512), nullable=False),
        sa.Column("reviewed_by", sa.String(512)),
    )
    op.create_index("ix_tickets_org_id", "tickets", ["organization_id", "id"])
    op.create_index("ix_audit_org_ticket", "audit_events", ["organization_id", "ticket_id"])
    op.create_index("ix_automation_org", "automation_requests", ["organization_id"])


def downgrade():
    op.drop_index("ix_automation_org", table_name="automation_requests")
    op.drop_index("ix_audit_org_ticket", table_name="audit_events")
    op.drop_index("ix_tickets_org_id", table_name="tickets")
    op.drop_table("automation_requests")
    op.drop_table("audit_events")
    op.drop_table("tickets")
    op.drop_table("memberships")
    op.drop_table("organizations")
