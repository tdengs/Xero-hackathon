from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Payout, PayoutItem, ReconciliationJob
from app.models.reconciliation import JobStatus
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.stripe_service import StripeService

router = APIRouter()

_stripe_svc = StripeService()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class PayoutListItem(BaseModel):
    id: str
    stripe_payout_id: str
    amount: float
    currency: str
    status: str
    arrival_date: str
    reconciliation_status: str

    class Config:
        from_attributes = True


class PayoutItemOut(BaseModel):
    id: str
    stripe_balance_transaction_id: str
    type: str
    amount: float
    currency: str
    description: str | None

    class Config:
        from_attributes = True


class PayoutDetail(BaseModel):
    id: str
    stripe_payout_id: str
    amount: float
    currency: str
    status: str
    arrival_date: str
    reconciliation_status: str
    description: str | None
    items: list[PayoutItemOut]

    class Config:
        from_attributes = True


class SyncResponse(BaseModel):
    queued: bool
    message: str


class ExplainResponse(BaseModel):
    job_id: str
    status: str


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------


async def _run_stripe_sync(user_id: str) -> None:
    """Pull recent payouts from Stripe and persist them to the database."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            payouts = await _stripe_svc.list_payouts(limit=50)
            for p in payouts:
                await _stripe_svc.sync_payout_to_db(
                    payout_id=p["id"],
                    user_id=uuid.UUID(user_id),
                    db=db,
                )
            await db.commit()
        except Exception:
            await db.rollback()
            raise


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[PayoutListItem])
async def list_payouts(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[Payout]:
    """List payouts, auto-syncing from Stripe on first load."""
    count_result = await db.execute(
        select(Payout).where(Payout.user_id == current_user.id).limit(1)
    )
    if count_result.scalar_one_or_none() is None:
        background_tasks.add_task(_run_stripe_sync, user_id=str(current_user.id))

    result = await db.execute(
        select(Payout)
        .where(Payout.user_id == current_user.id)
        .order_by(Payout.arrival_date.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


@router.get("/{payout_id}", response_model=PayoutDetail)
async def get_payout(
    payout_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Payout:
    """Get a single payout with its line items."""
    try:
        payout_uuid = uuid.UUID(payout_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid payout ID")

    result = await db.execute(
        select(Payout).where(
            Payout.id == payout_uuid,
            Payout.user_id == current_user.id,
        )
    )
    payout = result.scalar_one_or_none()
    if payout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found")
    return payout


@router.post("/sync", response_model=SyncResponse)
async def sync_payouts(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SyncResponse:
    """Trigger a Stripe payout sync in the background for the current user."""
    background_tasks.add_task(_run_stripe_sync, user_id=str(current_user.id))
    return SyncResponse(queued=True, message="Stripe payout sync queued")


@router.get("/{payout_id}/summary")
async def get_payout_summary(
    payout_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return the reconciliation financial summary for a payout."""
    try:
        payout_uuid = uuid.UUID(payout_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid payout ID")

    result = await db.execute(
        select(Payout).where(
            Payout.id == payout_uuid,
            Payout.user_id == current_user.id,
        )
    )
    payout = result.scalar_one_or_none()
    if payout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found")

    summary = await _stripe_svc.build_payout_summary(payout)
    return summary


@router.post("/{payout_id}/explain", response_model=ExplainResponse)
async def explain_payout(
    payout_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExplainResponse:
    """Queue an AI explanation job for the payout and return the job ID."""
    try:
        payout_uuid = uuid.UUID(payout_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid payout ID")

    result = await db.execute(
        select(Payout).where(
            Payout.id == payout_uuid,
            Payout.user_id == current_user.id,
        )
    )
    payout = result.scalar_one_or_none()
    if payout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found")

    # Ensure Stripe transaction items are synced before running AI analysis.
    # sync_payout_to_db is idempotent — skips the Stripe API call if items
    # already exist in DB, so this is effectively free on repeat calls.
    await _stripe_svc.sync_payout_to_db(
        payout_id=payout.stripe_payout_id,
        user_id=current_user.id,
        db=db,
    )
    await db.refresh(payout)

    # Check for an existing job to avoid duplicates
    existing_job_result = await db.execute(
        select(ReconciliationJob).where(ReconciliationJob.payout_id == payout_uuid)
    )
    existing_job = existing_job_result.scalar_one_or_none()
    if existing_job is not None and existing_job.status in (
        JobStatus.queued,
        JobStatus.running,
    ):
        return ExplainResponse(job_id=str(existing_job.id), status=existing_job.status.value)

    # Create a queued job record and enqueue via ARQ
    job = ReconciliationJob(
        payout_id=payout_uuid,
        status=JobStatus.queued,
    )
    db.add(job)
    await db.flush()
    job_id = str(job.id)
    await db.commit()

    from app.config import settings as _settings
    import arq

    redis_pool = await arq.create_pool(arq.connections.RedisSettings.from_dsn(_settings.redis_url))
    await redis_pool.enqueue_job(
        "reconcile_payout_job",
        payout_id=payout_id,
        user_id=str(current_user.id),
    )
    await redis_pool.aclose()

    return ExplainResponse(job_id=job_id, status=JobStatus.queued.value)
