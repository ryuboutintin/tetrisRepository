"""add user auth and tags

Revision ID: aa32719fcffd
Revises: dd8e16c6f77e
Create Date: 2026-05-19 01:39:23.768847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'aa32719fcffd'
down_revision: Union[str, None] = 'dd8e16c6f77e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # ── 새 테이블 (없을 때만 생성 — fresh DB 지원) ──────────────────────────
    if 'users' not in existing_tables:
        op.create_table(
            'users',
            sa.Column('id',         sa.Integer(),      primary_key=True, autoincrement=True),
            sa.Column('email',      sa.String(255),    nullable=False, unique=True),
            sa.Column('username',   sa.String(50),     nullable=False, unique=True),
            sa.Column('hashed_pw',  sa.String(255),    nullable=False),
            sa.Column('is_active',  sa.Boolean(),      nullable=False, server_default='1'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        )

    if 'categories' not in existing_tables:
        op.create_table(
            'categories',
            sa.Column('id',       sa.Integer(),   primary_key=True, autoincrement=True),
            sa.Column('name',     sa.String(50),  nullable=False),
            sa.Column('color',    sa.String(7),   nullable=False, server_default='#6366f1'),
            sa.Column('owner_id', sa.Integer(),   sa.ForeignKey('users.id'), nullable=False),
        )

    if 'tags' not in existing_tables:
        op.create_table(
            'tags',
            sa.Column('id',       sa.Integer(),  primary_key=True, autoincrement=True),
            sa.Column('name',     sa.String(50), nullable=False),
            sa.Column('owner_id', sa.Integer(),  sa.ForeignKey('users.id'), nullable=False),
            sa.UniqueConstraint('name', 'owner_id'),
        )

    if 'memo_tags' not in existing_tables:
        op.create_table(
            'memo_tags',
            sa.Column('memo_id', sa.Integer(), sa.ForeignKey('memos.id',  ondelete='CASCADE'), primary_key=True),
            sa.Column('tag_id',  sa.Integer(), sa.ForeignKey('tags.id',   ondelete='CASCADE'), primary_key=True),
        )

    # ── memos 컬럼 추가 (없을 때만) ─────────────────────────────────────────
    existing_cols = {c['name'] for c in inspector.get_columns('memos')}

    if 'owner_id' not in existing_cols:
        op.add_column('memos', sa.Column('owner_id', sa.Integer(), server_default='1', nullable=False))

    if 'category_id' not in existing_cols:
        op.add_column('memos', sa.Column('category_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('memos', 'category_id')
    op.drop_column('memos', 'owner_id')
    op.drop_table('memo_tags')
    op.drop_table('tags')
    op.drop_table('categories')
    op.drop_table('users')
