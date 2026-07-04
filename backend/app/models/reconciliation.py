"""ReconciliationJob and ReconciliationEvidence ORM models."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.payout import Payout


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    needs_review = "needs_review"


class EvidenceType(str, enum.Enum):
    stripe_transaction = "stripe_transaction"
    xero_invoice = "xero_invoice"
    xero_payment = "xero_payment"
    bank_transaction = "bank_transaction"


class ReconciliationJob(Base):
    __tablename__ = "reconciliation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # One job per payout; UNIQUE enforced at DB level
    payout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payouts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status"),
        nullable=False,
        default=JobStatus.queued,
        index=True,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Model identifier used for the Claude agent run (e.g. "claude-sonnet-4-6")
    agent_model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Full chain-of-thought reasoning returned by the agent
    agent_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    items_matched: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    items_unmatched: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Numeric(12, 2) for financial precision — never use Float for money
    total_explained: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    total_unexplained: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    # JSONB columns for structured agent output
    journal_entries_created: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True
    )
    explanation_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    payout: Mapped["Payout"] = relationship(
        "Payout", back_populates="reconciliation_job"
    )
    evidence: Mapped[List["ReconciliationEvidence"]] = relationship(
        "ReconciliationEvidence",
        back_populates="job",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<ReconciliationJob id={self.id!r} payout_id={self.payout_id!r}"
            f" status={self.status!r}>"
        )


class ReconciliationEvidence(Base):
    __tablename__ = "reconciliation_evidence"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reconciliation_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_type: Mapped[EvidenceType] = mapped_column(
        Enum(EvidenceType, name="evidence_type"), nullable=False
    )
    evidence_id: Mapped[str] = mapped_column(String(255), nullable=False)
    evidence_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    # Numeric(12, 2) for financial precision — never use Float for money
    amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    job: Mapped["ReconciliationJob"] = relationship(
        "ReconciliationJob", back_populates="evidence"
    )

    def __repr__(self) -> str:
        return (
            f"<ReconciliationEvidence id={self.id!r} job_id={self.job_id!r}"
            f" evidence_type={self.evidence_type!r} verified={self.verified!r}>"
        )
