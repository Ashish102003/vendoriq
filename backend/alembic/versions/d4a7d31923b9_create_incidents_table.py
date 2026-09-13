"""create incidents table

Revision ID: d4a7d31923b9
Revises: 160ca8129b1f
Create Date: 2026-09-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4a7d31923b9'
down_revision: Union[str, Sequence[str], None] = '160ca8129b1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('incidents',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('incident_number', sa.String(length=20), nullable=False),
    sa.Column('vendor_id', sa.Integer(), nullable=False),
    sa.Column('contract_id', sa.Integer(), nullable=True),
    sa.Column('purchase_order_id', sa.Integer(), nullable=True),
    sa.Column('title', sa.String(length=150), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('incident_type', sa.Enum('DELIVERY', 'QUALITY', 'SERVICE', 'CONTRACT', 'COMPLIANCE', 'COMMUNICATION', 'DOCUMENTATION', 'PAYMENT', 'OTHER', name='incidenttype', native_enum=False, length=32), nullable=False),
    sa.Column('severity', sa.Enum('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='incidentseverity', native_enum=False, length=32), nullable=False),
    sa.Column('status', sa.Enum('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', name='incidentstatus', native_enum=False, length=32), server_default='OPEN', nullable=False),
    sa.Column('reported_date', sa.Date(), nullable=False),
    sa.Column('due_date', sa.Date(), nullable=True),
    sa.Column('resolved_date', sa.Date(), nullable=True),
    sa.Column('impact_score', sa.Integer(), nullable=False),
    sa.Column('reported_by', sa.Integer(), nullable=False),
    sa.Column('assigned_to', sa.Integer(), nullable=True),
    sa.Column('resolution_notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('due_date IS NULL OR due_date >= reported_date', name='ck_incidents_due_date_not_before_reported_date'),
    sa.CheckConstraint('impact_score >= 1 AND impact_score <= 10', name='ck_incidents_impact_score_range'),
    sa.CheckConstraint('resolved_date IS NULL OR resolved_date >= reported_date', name='ck_incidents_resolved_date_not_before_reported_date'),
    sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['reported_by'], ['users.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_incidents_assigned_to'), 'incidents', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_incidents_contract_id'), 'incidents', ['contract_id'], unique=False)
    op.create_index(op.f('ix_incidents_incident_number'), 'incidents', ['incident_number'], unique=True)
    op.create_index(op.f('ix_incidents_purchase_order_id'), 'incidents', ['purchase_order_id'], unique=False)
    op.create_index(op.f('ix_incidents_reported_by'), 'incidents', ['reported_by'], unique=False)
    op.create_index(op.f('ix_incidents_severity'), 'incidents', ['severity'], unique=False)
    op.create_index(op.f('ix_incidents_status'), 'incidents', ['status'], unique=False)
    op.create_index(op.f('ix_incidents_vendor_id'), 'incidents', ['vendor_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_incidents_vendor_id'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_status'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_severity'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_reported_by'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_purchase_order_id'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_incident_number'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_contract_id'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_assigned_to'), table_name='incidents')
    op.drop_table('incidents')