"""Stripe service — payout fetching, transaction pagination, and DB sync."""
from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

import stripe
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.payout import Payout, PayoutItem, PayoutItemType

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Type mapping: Stripe balance-transaction type → PayoutItemType
# ---------------------------------------------------------------------------
STRIPE_TYPE_MAP: dict[str, PayoutItemType] = {
    "charge": PayoutItemType.payment,
    "payment": PayoutItemType.payment,
    "refund": PayoutItemType.refund,
    "payment_refund": PayoutItemType.refund,
    "dispute": PayoutItemType.chargeback,
    "dispute_reversal": PayoutItemType.chargeback,
    "stripe_fee": PayoutItemType.stripe_fee,
    "application_fee": PayoutItemType.stripe_fee,
    "application_fee_refund": PayoutItemType.stripe_fee,
    "transfer": PayoutItemType.adjustment,
    "transfer_reversal": PayoutItemType.adjustment,
    "adjustment": PayoutItemType.adjustment,
    "fx_credit": PayoutItemType.fx_adjustment,
    "fx_debit": PayoutItemType.fx_adjustment,
    "currency_conversion": PayoutItemType.fx_adjustment,
}

# Amount conversion: Stripe sends integers in the currency's smallest unit
_ZERO_DECIMAL_CURRENCIES = {
    "bif", "clp", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
    "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
}


def _to_decimal(amount_int: int, currency: str) -> Decimal:
    """Convert Stripe integer amount to a Decimal in major currency units."""
    if currency.lower() in _ZERO_DECIMAL_CURRENCIES:
        return Decimal(amount_int)
    return Decimal(amount_int) / Decimal(100)


def _stripe_to_dict(obj: Any) -> dict:
    """Convert a Stripe SDK object to a plain dict (dict() raises KeyError on newer SDK)."""
    return obj.to_dict() if hasattr(obj, "to_dict") else dict(obj)


class StripeService:
    """Async wrapper around the Stripe Python SDK for payout operations."""

    def __init__(self) -> None:
        stripe.api_key = settings.stripe_api_key

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def list_payouts(
        self,
        limit: int = 50,
        arrival_date_gte: Optional[int] = None,
    ) -> list[dict]:
        """
        Return up to *limit* payouts for the configured Stripe account,
        optionally filtered by arrival date (Unix timestamp).
        """
        params: dict[str, Any] = {"limit": min(limit, 100)}
        if arrival_date_gte is not None:
            params["arrival_date"] = {"gte": arrival_date_gte}

        payouts: list[dict] = []
        page = stripe.Payout.list(**params)
        for payout in page.auto_paging_iter():
            payouts.append(payout)
            if len(payouts) >= limit:
                break

        logger.info("list_payouts: fetched=%d", len(payouts))
        return payouts

    async def get_payout(self, payout_id: str) -> dict:
        """Retrieve a single Stripe payout object."""
        payout = stripe.Payout.retrieve(payout_id)
        logger.info("get_payout: payout_id=%s", payout_id)
        return _stripe_to_dict(payout)

    async def get_payout_transactions(self, payout_id: str) -> list[dict]:
        """
        Retrieve ALL balance transactions associated with a payout,
        consuming every page via auto_paging_iter.
        """
        transactions: list[dict] = []
        try:
            page = stripe.BalanceTransaction.list(payout=payout_id, limit=100)
            for txn in page.auto_paging_iter():
                transactions.append(_stripe_to_dict(txn))
        except stripe.InvalidRequestError as exc:
            # Manual payouts cannot be filtered by payout ID in the Balance
            # Transactions API — fall back to the payout's own balance txn.
            if "manual" not in str(exc).lower():
                raise
            logger.warning(
                "get_payout_transactions: manual payout %s — using payout balance transaction only",
                payout_id,
            )
            payout_dict = _stripe_to_dict(stripe.Payout.retrieve(payout_id))
            bt_id = payout_dict.get("balance_transaction")
            if bt_id:
                transactions.append(_stripe_to_dict(stripe.BalanceTransaction.retrieve(bt_id)))

        logger.info(
            "get_payout_transactions: payout_id=%s count=%d",
            payout_id,
            len(transactions),
        )
        return transactions

    async def sync_payout_to_db(
        self,
        payout_id: str,
        user_id: Any,
        db: AsyncSession,
    ) -> Payout:
        """
        Idempotently sync a Stripe payout and its balance transactions into
        the database.

        If the payout already exists AND has items it is returned immediately
        without hitting Stripe again.  If the payout record exists but has no
        items (e.g. partially synced), items are fetched and created.
        """
        # ---- Idempotency check ----------------------------------------
        result = await db.execute(
            select(Payout).where(Payout.stripe_payout_id == payout_id)
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            item_count = await db.scalar(
                select(func.count())
                .select_from(PayoutItem)
                .where(PayoutItem.payout_id == existing.id)
            )
            if item_count and item_count > 0:
                logger.info(
                    "sync_payout_to_db: payout_id=%s already in DB with items — skipping",
                    payout_id,
                )
                return existing

        # ---- Fetch from Stripe ----------------------------------------
        stripe_payout = await self.get_payout(payout_id)
        transactions = await self.get_payout_transactions(payout_id)

        currency = stripe_payout.get("currency", "usd").upper()
        arrival_ts: int = stripe_payout.get("arrival_date", 0)
        arrival = datetime.utcfromtimestamp(arrival_ts).date() if arrival_ts else date.today()

        # ---- Create or reuse Payout record ---------------------------
        if existing is None:
            payout_record = Payout(
                user_id=user_id,
                stripe_payout_id=payout_id,
                amount=float(_to_decimal(stripe_payout.get("amount", 0), currency)),
                currency=currency,
                status=stripe_payout.get("status", "paid"),
                arrival_date=arrival,
                description=stripe_payout.get("description"),
            )
            db.add(payout_record)
            await db.flush()
        else:
            payout_record = existing

        # ---- Create PayoutItem records --------------------------------
        for txn in transactions:
            txn_type_raw: str = txn.get("type", "adjustment")
            item_type: PayoutItemType = STRIPE_TYPE_MAP.get(
                txn_type_raw, PayoutItemType.adjustment
            )
            txn_currency = txn.get("currency", "usd").upper()
            gross_amount = _to_decimal(txn.get("amount", 0), txn_currency)
            fee_amount = _to_decimal(txn.get("fee", 0), txn_currency)
            net_amount = _to_decimal(txn.get("net", 0), txn_currency)

            # Store fee breakdown in metadata for later analysis
            metadata: dict = {
                "stripe_type": txn_type_raw,
                "fee": float(fee_amount),
                "net": float(net_amount),
                "fee_details": txn.get("fee_details", []),
            }

            # Best-effort: extract the originating charge ID from the source
            source = txn.get("source")
            charge_id: Optional[str] = None
            if isinstance(source, str) and source.startswith("ch_"):
                charge_id = source
            elif isinstance(source, dict):
                charge_id = source.get("id")

            item = PayoutItem(
                payout_id=payout_record.id,
                stripe_balance_transaction_id=txn.get("id", ""),
                type=item_type,
                amount=float(gross_amount),
                currency=txn_currency,
                description=txn.get("description"),
                stripe_charge_id=charge_id,
                metadata_=metadata,
            )
            db.add(item)

        await db.flush()
        logger.info(
            "sync_payout_to_db: payout_id=%s created %d items",
            payout_id,
            len(transactions),
        )
        return payout_record

    async def build_payout_summary(self, payout: Payout, db: AsyncSession) -> dict:
        """
        Aggregate PayoutItem rows into a financial summary dict.

        Returns:
            gross_sales      — sum of payment items (positive)
            stripe_fees      — sum of stripe_fee items (negative, fees deducted)
            refunds          — sum of refund items (negative)
            chargebacks      — sum of chargeback items (negative)
            fx_adjustments   — sum of fx_adjustment items (signed)
            adjustments      — sum of adjustment items (signed)
            net_payout       — stored payout amount
            balanced         — whether computed net matches net_payout within $0.01
            item_counts      — breakdown by type
            payment_count    — number of payment items
            anomalies        — list of anomaly description strings
        """
        gross_sales = Decimal("0")
        stripe_fees = Decimal("0")
        refunds = Decimal("0")
        chargebacks = Decimal("0")
        fx_adjustments = Decimal("0")
        adjustments = Decimal("0")

        counts: dict[str, int] = {t.value: 0 for t in PayoutItemType}

        items_result = await db.execute(
            select(PayoutItem).where(PayoutItem.payout_id == payout.id)
        )
        for item in items_result.scalars().all():
            amount = Decimal(str(item.amount))
            counts[item.type.value] += 1
            if item.type == PayoutItemType.payment:
                gross_sales += amount
            elif item.type == PayoutItemType.refund:
                refunds += amount  # Stripe reports refunds as negative integers
            elif item.type == PayoutItemType.stripe_fee:
                stripe_fees += amount  # Stripe reports fees as negative integers
            elif item.type == PayoutItemType.chargeback:
                chargebacks += amount
            elif item.type == PayoutItemType.fx_adjustment:
                fx_adjustments += amount
            elif item.type == PayoutItemType.adjustment:
                adjustments += amount

        net_payout = Decimal(str(payout.amount))
        computed_net = (
            gross_sales
            + stripe_fees   # already negative
            + refunds        # already negative
            + chargebacks    # already negative
            + fx_adjustments
            + adjustments
        )
        balanced = abs(computed_net - net_payout) < Decimal("0.01")

        # ---- Anomaly detection ----------------------------------------
        anomalies: list[str] = []

        # Refund rate > 5 % of gross sales
        if gross_sales > 0:
            refund_abs = abs(refunds)
            refund_rate = float(refund_abs / gross_sales)
            if refund_rate > 0.05:
                anomalies.append(
                    f"High refund rate: {refund_rate:.1%} of gross sales "
                    f"(threshold 5%)"
                )

        # Unbalanced payout — unexplained remainder
        if not balanced:
            delta = float(computed_net - net_payout)
            anomalies.append(
                f"Payout does not balance: computed_net={float(computed_net):.2f} "
                f"vs stripe_net={float(net_payout):.2f} (delta={delta:.2f})"
            )

        # Chargebacks present
        if abs(chargebacks) > 0:
            anomalies.append(
                f"Chargebacks detected: {counts['chargeback']} item(s) "
                f"totalling {float(abs(chargebacks)):.2f} {payout.currency}"
            )

        return {
            "payout_id": str(payout.id),
            "stripe_payout_id": payout.stripe_payout_id,
            "currency": payout.currency,
            "gross_sales": float(gross_sales),
            "stripe_fees": float(stripe_fees),
            "refunds": float(refunds),
            "chargebacks": float(chargebacks),
            "fx_adjustments": float(fx_adjustments),
            "adjustments": float(adjustments),
            "net_payout": float(net_payout),
            "computed_net": float(computed_net),
            "balanced": balanced,
            "item_counts": counts,
            "payment_count": counts.get("payment", 0),
            "anomalies": anomalies,
        }
