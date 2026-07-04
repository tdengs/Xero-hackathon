"""Chat router — natural-language Q&A about the user's Xero + Stripe data."""
from __future__ import annotations

from typing import Annotated

import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.payout import Payout
from app.models.reconciliation import ReconciliationJob, JobStatus
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    payoutId: str | None = None


class ChatResponse(BaseModel):
    reply: str
    evidence: list[dict] = []


CHAT_SYSTEM_PROMPT = """You are PayTrace AI, a friendly and precise accounting assistant.

You help small business owners and bookkeepers understand their Stripe payouts and Xero accounting.

You have access to context about the user's recent reconciliation jobs and payouts.

RULES:
1. Be concise and plain-English — avoid jargon unless the user uses it first.
2. If you cite specific amounts or transactions, only use figures from the context provided.
3. If you don't have enough information to answer precisely, say so and suggest what data to check.
4. Never make up transaction IDs, invoice numbers, or specific amounts.

Format responses in 2-3 paragraphs maximum. Use bullet points for lists."""


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatResponse:
    """Answer a natural-language question about the user's accounting data."""
    context_parts: list[str] = []

    # Include payout-specific context if a payoutId is given
    if body.payoutId:
        payout_result = await db.execute(
            select(Payout).where(
                Payout.id == body.payoutId,  # type: ignore[arg-type]
                Payout.user_id == current_user.id,
            )
        )
        payout = payout_result.scalar_one_or_none()
        if payout is not None:
            context_parts.append(
                f"Current payout: {payout.stripe_payout_id}, "
                f"amount={payout.amount} {payout.currency}, "
                f"date={payout.arrival_date}, "
                f"status={payout.reconciliation_status.value}"
            )
            # Include the latest reconciliation explanation for this payout
            job_result = await db.execute(
                select(ReconciliationJob).where(
                    ReconciliationJob.payout_id == payout.id,
                    ReconciliationJob.status == JobStatus.completed,
                )
            )
            job = job_result.scalar_one_or_none()
            if job and job.explanation_json:
                exp = job.explanation_json
                context_parts.append(
                    f"Latest AI analysis: gross_sales={exp.get('gross_sales')}, "
                    f"stripe_fees={exp.get('stripe_fees')}, "
                    f"refunds={exp.get('refunds')}, "
                    f"chargebacks={exp.get('chargebacks')}, "
                    f"net={exp.get('net_payout')}, "
                    f"balanced={exp.get('balanced')}, "
                    f"anomalies={exp.get('anomalies', [])}"
                )

    # Include recent payout summary
    recent_result = await db.execute(
        select(Payout)
        .where(Payout.user_id == current_user.id)
        .order_by(Payout.arrival_date.desc())
        .limit(5)
    )
    recent = recent_result.scalars().all()
    if recent:
        summary = ", ".join(
            f"{p.stripe_payout_id[:12]}… {p.amount}{p.currency} ({p.reconciliation_status.value})"
            for p in recent
        )
        context_parts.append(f"Recent payouts: {summary}")

    context_block = "\n".join(context_parts) if context_parts else "No specific payout context available."

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=512,
        system=CHAT_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Context about my account:\n{context_block}\n\nMy question: {body.message}",
            }
        ],
    )

    reply_text = ""
    for block in message.content:
        if hasattr(block, "text"):
            reply_text = block.text
            break

    return ChatResponse(reply=reply_text, evidence=[])
