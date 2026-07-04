"""Payout and PayoutItem ORM models with financial-precision Numeric fields."""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.reconciliation import ReconciliationJob
    from app.models.user import User


class PayoutStatus(str, enum.Enum):
    pending = "pending"
    in_transit = "in_transit"
    paid = "paid"
    failed = "failed"
    canceled = "canceled"


class ReconciliationStatus(str, enum.Enum):
    unreconciled = "unreconciled"
    in_progress = "in_progress"
    reconciled = "reconciled"
    needs_review = "needs_review"


class PayoutItemType(str, enum.Enum):
    payment = "payment"
    refund = "refund"
    stripe_fee = "stripe_fee"
    adjustment = "adjustment"
    chargeback = "chargeback"
    fx_adjustment = "fx_adjustment"


class Payout(Base):
    __tablename__ = "payouts"

    __table_args__ = (
        Index("ix_payouts_user_recon_status", "user_id", "reconciliation_status"),
        Index("ix_payouts_user_arrival_date", "user_id", "arrival_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stripe_payout_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    stripe_account_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Numeric(12, 2) for financial precision — never use Float for money
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[PayoutStatus] = mapped_column(
        Enum(PayoutStatus, name="payout_status"), nullable=False
    )
    arrival_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    xero_bank_transaction_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    reconciliation_status: Mapped[ReconciliationStatus] = mapped_column(
        Enum(ReconciliationStatus, name="reconciliation_status"),
        nullable=False,
        default=ReconciliationStatus.unreconciled,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="payouts")
    items: Mapped[List["PayoutItem"]] = relationship(
        "PayoutItem", back_populates="payout", cascade="all, delete-orphan"
    )
    reconciliation_job: Mapped[Optional["ReconciliationJob"]] = relationship(
        "ReconciliationJob", back_populates="payout", uselist=False
    )

    def __repr__(self) -> str:
        return (
            f"<Payout id={self.id!r} stripe_payout_id={self.stripe_payout_id!r}"
            f" amount={self.amount!r} currency={self.currency!r}"
            f" status={self.status!r}>"
        )


class PayoutItem(Base):
    __tablename__ = "payout_items"

    __table_args__ = (
        Index("ix_payout_items_payout_type", "payout_id", "type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    payout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payouts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stripe_balance_transaction_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    type: Mapped[PayoutItemType] = mapped_column(
        Enum(PayoutItemType, name="payout_item_type"), nullable=False
    )
    # Numeric(12, 2) for financial precision — never use Float for money
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stripe_charge_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    xero_invoice_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    xero_invoice_number: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    matched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # JSONB for arbitrary Stripe metadata — use metadata_ to avoid SQLAlchemy collision
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    payout: Mapped["Payout"] = relationship("Payout", back_populates="items")

    def __repr__(self) -> str:
        return (
            f"<PayoutItem id={self.id!r} payout_id={self.payout_id!r}"
            f" type={self.type!r} amount={self.amount!r}>"
        )
