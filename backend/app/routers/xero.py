from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Payout
from app.models.user import User, XeroConnection
from app.routers.auth import get_current_user
from app.services.xero_service import xero_service as xero_svc

router = APIRouter()

_XERO_DATE_RE = re.compile(r"/Date\((\d+)[+-]\d+\)/")


def _parse_xero_date(raw: str) -> str:
    """Convert Xero's /Date(ms+tz)/ format to an ISO date string (YYYY-MM-DD)."""
    match = _XERO_DATE_RE.search(raw)
    if match:
        ms = int(match.group(1))
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date().isoformat()
    return raw


class BankTransactionOut(BaseModel):
    id: str
    date: str
    amount: float
    description: str
    status: str
    payout_id: str | None
    reconciliation_status: str


async def _get_xero_connection(user: User, db: AsyncSession) -> XeroConnection:
    result = await db.execute(
        select(XeroConnection).where(XeroConnection.user_id == user.id).limit(1)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No Xero connection found. Please connect your Xero account first.",
        )
    return conn


@router.get("/bank-transactions", response_model=list[BankTransactionOut])
async def get_bank_transactions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    from_date: Annotated[Optional[str], Query()] = None,
    to_date: Annotated[Optional[str], Query()] = None,
) -> list[BankTransactionOut]:
    """Return unreconciled RECEIVE-type bank transactions live from Xero."""
    connection = await _get_xero_connection(current_user, db)

    from_dt = datetime.fromisoformat(from_date) if from_date else None
    to_dt = datetime.fromisoformat(to_date) if to_date else None

    xero_txns = await xero_svc.get_bank_transactions(connection, db, from_dt, to_dt)

    xero_ids = [t["BankTransactionID"] for t in xero_txns if t.get("BankTransactionID")]

    payout_lookup: dict[str, tuple[str, str]] = {}
    if xero_ids:
        rows = await db.execute(
            select(Payout.xero_bank_transaction_id, Payout.id, Payout.reconciliation_status)
            .where(Payout.user_id == current_user.id)
            .where(Payout.xero_bank_transaction_id.in_(xero_ids))
        )
        for xero_id, payout_id, recon_status in rows:
            payout_lookup[xero_id] = (str(payout_id), recon_status.value)

    out: list[BankTransactionOut] = []
    for txn in xero_txns:
        txn_id = txn.get("BankTransactionID", "")
        payout_info = payout_lookup.get(txn_id)
        line_items = txn.get("LineItems") or []
        description = (
            txn.get("Reference")
            or (line_items[0].get("Description") if line_items else None)
            or ""
        )
        out.append(
            BankTransactionOut(
                id=txn_id,
                date=_parse_xero_date(txn.get("Date", "")),
                amount=float(txn.get("Total", 0)),
                description=description,
                status="reconciled" if txn.get("IsReconciled") else "unreconciled",
                payout_id=payout_info[0] if payout_info else None,
                reconciliation_status=payout_info[1] if payout_info else "unreconciled",
            )
        )
    return out


@router.get("/accounts")
async def get_accounts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Return the full chart of accounts from Xero."""
    connection = await _get_xero_connection(current_user, db)
    return await xero_svc.get_accounts(connection, db)


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return a single Xero invoice by its ID."""
    connection = await _get_xero_connection(current_user, db)
    return await xero_svc.get_invoice(connection, db, invoice_id)
