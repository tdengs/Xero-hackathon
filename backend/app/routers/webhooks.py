from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, HTTPException, Request, status

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/stripe")
async def stripe_webhook(request: Request) -> dict[str, bool]:
    """
    Receive and process Stripe webhook events.

    Verifies the Stripe-Signature header using the configured webhook secret.
    On payout.paid: enqueues a payout sync job.
    On charge.refunded: marks relevant payout items as refunded.
    Returns {"received": true} on success; raises HTTP 400 on invalid signature.
    """
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError as exc:
        logger.warning("stripe_webhook_invalid_signature: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe-Signature",
        )
    except Exception as exc:
        logger.exception("stripe_webhook_construct_event_failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook error: {exc}",
        )

    event_type: str = event["type"]
    event_data: dict = event["data"]["object"]

    logger.info("stripe_webhook_received type=%s id=%s", event_type, event.get("id"))

    if event_type == "payout.paid":
        await _handle_payout_paid(event_data)

    elif event_type == "charge.refunded":
        await _handle_charge_refunded(event_data)

    return {"received": True}


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------


async def _handle_payout_paid(payout_data: dict) -> None:
    """Log the payout.paid event. Sync happens on-demand when the user clicks Explain with AI."""
    payout_id: str = payout_data.get("id", "")
    logger.info("stripe_payout_paid payout_id=%s", payout_id)


async def _handle_charge_refunded(charge_data: dict) -> None:
    """Update payout item records for a refunded charge."""
    charge_id: str = charge_data.get("id", "")
    logger.info("stripe_charge_refunded charge_id=%s", charge_id)

    try:
        from app.database import AsyncSessionLocal
        from app.models.payout import PayoutItem, PayoutItemType
        from sqlalchemy import select, update

        async with AsyncSessionLocal() as db:
            # Mark any existing payment items for this charge as refunded in metadata
            result = await db.execute(
                select(PayoutItem).where(PayoutItem.stripe_charge_id == charge_id)
            )
            items = result.scalars().all()
            for item in items:
                meta = dict(item.metadata_ or {})
                meta["refunded"] = True
                meta["refund_amount"] = charge_data.get("amount_refunded", 0)
                item.metadata_ = meta
            await db.commit()
            logger.info(
                "stripe_charge_refunded_items_updated charge_id=%s count=%d",
                charge_id,
                len(items),
            )
    except Exception:
        logger.exception(
            "stripe_charge_refunded_update_failed charge_id=%s", charge_id
        )
