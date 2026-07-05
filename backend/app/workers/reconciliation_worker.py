"""ARQ background worker — processes reconciliation jobs from Redis queue."""
from __future__ import annotations

import logging
import uuid

from arq import run_worker
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.reconciliation import JobStatus, ReconciliationJob
from app.services.ai_agent import ReconciliationAgent
from app.services.xero_service import XeroService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Worker lifecycle hooks
# ---------------------------------------------------------------------------


async def startup(ctx: dict) -> None:
    """Initialise shared resources: DB session factory and service instances."""
    engine = create_async_engine(
        settings.database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )
    ctx["session_factory"] = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    ctx["xero_svc"] = XeroService()
    ctx["agent"] = ReconciliationAgent(xero_svc=ctx["xero_svc"])
    logger.info("reconciliation_worker_started")


async def shutdown(ctx: dict) -> None:
    """Clean up resources on worker shutdown."""
    logger.info("reconciliation_worker_shutdown")


# ---------------------------------------------------------------------------
# Job functions
# ---------------------------------------------------------------------------


async def reconcile_payout_job(ctx: dict, payout_id: str, user_id: str) -> dict:
    """
    Process a single reconciliation job from the ARQ queue.

    Loads the DB session, resolves the user's Xero connection, runs
    ReconciliationAgent.explain_payout, and persists the result.

    Parameters
    ----------
    ctx:
        ARQ context dict — contains ``session_factory`` and ``agent`` from startup.
    payout_id:
        String UUID of the Payout record to reconcile.
    user_id:
        String UUID of the User who owns the payout.

    Returns
    -------
    dict
        ``{"job_id": str, "status": str}`` on success, or
        ``{"error": str}`` on failure.
    """
    session_factory: async_sessionmaker[AsyncSession] = ctx["session_factory"]
    agent: ReconciliationAgent = ctx["agent"]

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        logger.error("reconcile_payout_job_invalid_user_id user_id=%s error=%s", user_id, exc)
        return {"error": f"Invalid user_id: {exc}"}

    async with session_factory() as db:
        try:
            # Resolve the user's Xero connection so the agent can query invoices
            from app.models.user import XeroConnection

            xero_result = await db.execute(
                select(XeroConnection).where(XeroConnection.user_id == user_uuid)
            )
            xero_conn = xero_result.scalar_one_or_none()

            job = await agent.explain_payout(
                payout_id=payout_id,
                user_id=user_uuid,
                xero_connection=xero_conn,
                db=db,
            )
            await db.commit()

            logger.info(
                "reconcile_payout_job_complete job_id=%s status=%s",
                str(job.id),
                job.status.value,
            )
            return {"job_id": str(job.id), "status": job.status.value}

        except Exception as exc:
            logger.exception(
                "reconcile_payout_job_failed payout_id=%s user_id=%s",
                payout_id,
                user_id,
            )
            await db.rollback()

            # Attempt to mark any queued job as failed so the UI reflects the error
            try:
                async with session_factory() as error_db:
                    from app.models.payout import Payout

                    payout_result = await error_db.execute(
                        select(Payout).where(Payout.id == uuid.UUID(payout_id))
                    )
                    payout = payout_result.scalar_one_or_none()
                    if payout is not None:
                        job_result = await error_db.execute(
                            select(ReconciliationJob).where(
                                ReconciliationJob.payout_id == payout.id,
                                ReconciliationJob.status == JobStatus.queued,
                            )
                        )
                        failed_job = job_result.scalar_one_or_none()
                        if failed_job is not None:
                            failed_job.status = JobStatus.failed
                            failed_job.error_message = str(exc)
                            await error_db.commit()
            except Exception:
                logger.exception("reconcile_payout_job_error_update_failed")

            return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Worker settings
# ---------------------------------------------------------------------------


class WorkerSettings:
    """ARQ WorkerSettings — configure functions, Redis, and concurrency."""

    functions = [reconcile_payout_job]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 300  # 5 minutes max per reconciliation job
    keep_result = 3600  # retain job results in Redis for 1 hour
    redis_settings = RedisSettings.from_dsn(settings.redis_url)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_worker(WorkerSettings)
