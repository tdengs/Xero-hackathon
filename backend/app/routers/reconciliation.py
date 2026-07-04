from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditLog, ReconciliationEvidence, ReconciliationJob
from app.models.reconciliation import JobStatus
from app.models.user import User, XeroConnection
from app.routers.auth import get_current_user
from app.utils.audit import log_action

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class JobStatusResponse(BaseModel):
    id: str
    payout_id: str
    status: str
    created_at: datetime | None = None
    started_at: datetime | None
    completed_at: datetime | None
    # Field is named 'explanation' (not 'explanation_json') so the camelCase
    # key reaching the frontend is 'explanation', matching ReconciliationJob.explanation.
    explanation: dict | None = None
    error_message: str | None

    model_config = {"from_attributes": True, "populate_by_name": True}

    @classmethod
    def from_job(cls, job: ReconciliationJob) -> "JobStatusResponse":
        return cls(
            id=str(job.id),
            payout_id=str(job.payout_id),
            status=job.status.value,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            explanation=job.explanation_json,
            error_message=job.error_message,
        )


class EvidenceItem(BaseModel):
    id: str
    job_id: str
    claim: str
    evidence_type: str
    evidence_id: str
    amount: float | None
    verified: bool

    class Config:
        from_attributes = True


class AuditLogItem(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str | None
    timestamp: datetime

    class Config:
        from_attributes = True


class ApproveResponse(BaseModel):
    approved: bool
    actions_executed: int
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_job_for_user(
    job_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ReconciliationJob:
    """Load a ReconciliationJob and verify the requesting user owns the linked payout."""
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid job ID",
        )

    from app.models.payout import Payout

    result = await db.execute(
        select(ReconciliationJob)
        .join(Payout, ReconciliationJob.payout_id == Payout.id)
        .where(
            ReconciliationJob.id == job_uuid,
            Payout.user_id == user_id,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reconciliation job not found",
        )
    return job


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JobStatusResponse:
    """Return status and explanation for a reconciliation job."""
    job = await _get_job_for_user(job_id, current_user.id, db)
    return JobStatusResponse.from_job(job)


@router.post("/jobs/{job_id}/approve", response_model=ApproveResponse)
async def approve_job(
    job_id: str,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApproveResponse:
    """
    Execute the AI-proposed reconciliation actions in Xero:
    match invoices, create manual journal entries, reconcile bank transactions.
    Writes an audit log entry per action executed.
    """
    job = await _get_job_for_user(job_id, current_user.id, db)

    if job.status not in (JobStatus.completed, JobStatus.needs_review):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job cannot be approved in status '{job.status.value}'",
        )

    if not job.explanation_json:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job has no explanation to approve",
        )

    # Locate the user's Xero connection for this tenant
    xero_result = await db.execute(
        select(XeroConnection).where(XeroConnection.user_id == current_user.id)
    )
    xero_conn = xero_result.scalar_one_or_none()

    proposed_actions: list[dict] = job.explanation_json.get("proposed_actions", [])
    actions_requiring_approval = [a for a in proposed_actions if a.get("requires_approval", True)]

    actions_executed = 0
    client_ip: str | None = request.client.host if request.client else None

    for action in actions_requiring_approval:
        action_name: str = action.get("action", "unknown")
        description: str = action.get("description", "")

        # Execute recognised action types against Xero
        if action_name == "create_journal_entry" and xero_conn is not None:
            from app.services.xero_service import xero_service as xero_svc

            journal_lines: list[dict] = action.get("journal_lines", [])
            if journal_lines:
                try:
                    await xero_svc.create_journal_entry(
                        connection=xero_conn,
                        db=db,
                        narration=description,
                        lines=journal_lines,
                        reference=f"PayTrace-Job-{job_id[:8]}",
                        idempotency_key=f"job-{job_id}-{action_name}-{actions_executed}",
                    )
                    actions_executed += 1
                except Exception as exc:
                    # Log and continue; partial approval is recoverable
                    await log_action(
                        db=db,
                        action="reconciliation_action_failed",
                        entity_type="reconciliation_job",
                        entity_id=job.id,
                        user_id=current_user.id,
                        after={"action": action_name, "error": str(exc)},
                        agent_job_id=job.id,
                        ip_address=client_ip,
                    )
                    continue

        elif action_name in ("match_invoice", "flag_for_review"):
            # Stateless actions: just record in audit log
            actions_executed += 1

        # Write audit trail for each executed action
        await log_action(
            db=db,
            action=f"reconciliation_action_approved:{action_name}",
            entity_type="reconciliation_job",
            entity_id=job.id,
            user_id=current_user.id,
            after={"action": action_name, "description": description},
            agent_job_id=job.id,
            ip_address=client_ip,
        )

    await db.flush()

    return ApproveResponse(
        approved=True,
        actions_executed=actions_executed,
        message=f"Approved {actions_executed} of {len(actions_requiring_approval)} proposed actions",
    )


@router.get("/jobs/{job_id}/evidence", response_model=list[EvidenceItem])
async def get_job_evidence(
    job_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ReconciliationEvidence]:
    """Return all ReconciliationEvidence records for a job."""
    job = await _get_job_for_user(job_id, current_user.id, db)

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid job ID")

    result = await db.execute(
        select(ReconciliationEvidence).where(ReconciliationEvidence.job_id == job_uuid)
    )
    return list(result.scalars().all())


@router.get("/audit", response_model=list[AuditLogItem])
async def get_audit_log(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[AuditLog]:
    """Return paginated audit log entries for the current user."""
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
