from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def log_action(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: Any,
    user_id: Any = None,
    before: dict | None = None,
    after: dict | None = None,
    agent_job_id: Any = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Persist an audit trail entry and return the flushed ORM instance.

    Parameters
    ----------
    db:             Active async SQLAlchemy session.
    action:         Verb describing the operation (e.g. ``"create"``, ``"update"``).
    entity_type:    Name of the affected resource type (e.g. ``"payout"``).
    entity_id:      Primary-key value of the affected record.
    user_id:        ID of the user who triggered the action, if any.
    before:         State of the entity before the change.
    after:          State of the entity after the change.
    agent_job_id:   ID of the reconciliation/agent job that triggered the action, if any.
    ip_address:     Client IP address, if available.
    """
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        user_id=user_id,
        before=before,
        after=after,
        agent_job_id=agent_job_id,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()
    return entry
