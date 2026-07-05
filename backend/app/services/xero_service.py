"""Xero API service for PayTrace AI.

Handles all interactions with the Xero API:
- OAuth2 authorisation flow (PKCE-less, server-side)
- Token exchange and refresh
- Bank transactions, invoices, manual journals, accounts
"""
from __future__ import annotations

import base64
import urllib.parse
from datetime import date, datetime, timezone
from typing import Any, Optional

import httpx
import structlog

from app.config import settings
from app.models.user import XeroConnection
from app.utils.encryption import decrypt

# ---------------------------------------------------------------------------
# Module logger
# ---------------------------------------------------------------------------

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Retry decorator import (best-effort — falls back to identity if not present)
# ---------------------------------------------------------------------------

try:
    from app.utils.retry import retry_external_api  # type: ignore[import]
except ImportError:  # pragma: no cover
    import functools

    def retry_external_api(fn):  # type: ignore[misc]
        """No-op fallback when app.utils.retry is not yet implemented."""

        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            return await fn(*args, **kwargs)

        return wrapper


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

XERO_IDENTITY_BASE = "https://identity.xero.com"
XERO_AUTHORIZE_BASE = "https://login.xero.com/identity"
XERO_API_BASE = "https://api.xero.com/api.xro/2.0"
XERO_CONNECTIONS_URL = "https://api.xero.com/connections"

# Xero Chart-of-Accounts code mapping used by reconciliation journaling.
XERO_ACCOUNT_CODES: dict[str, int] = {
    "stripe_fees": 461,
    "bank_charges": 461,
    "refunds_payable": 200,
    "chargebacks": 461,
    "fx_gains": 880,
    "fx_losses": 881,
}

# Token is considered expired if it expires within this many seconds.
_TOKEN_EXPIRY_BUFFER_SECONDS = 60

# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class XeroAuthError(Exception):
    """Raised when Xero OAuth2 authentication fails (token exchange, refresh)."""

    def __init__(self, message: str, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class XeroAPIError(Exception):
    """Raised when a Xero API request returns a non-success status."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response_body: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class XeroRateLimitError(XeroAPIError):
    """Raised when Xero returns HTTP 429 Too Many Requests."""

    def __init__(self, retry_after: Optional[int] = None) -> None:
        super().__init__(
            f"Xero rate limit exceeded. Retry after {retry_after}s.",
            status_code=429,
        )
        self.retry_after = retry_after


# ---------------------------------------------------------------------------
# XeroService
# ---------------------------------------------------------------------------


class XeroService:
    """Centralised Xero API client for PayTrace AI.

    All public methods accept a ``XeroConnection`` ORM instance and a DB
    session so they can transparently refresh tokens when needed.
    """

    # ------------------------------------------------------------------
    # OAuth helpers
    # ------------------------------------------------------------------

    def get_authorization_url(self, state: str) -> str:
        """Build the Xero OAuth2 authorisation URL.

        Parameters
        ----------
        state:
            An opaque string used for CSRF protection. The calling layer is
            responsible for generating and later verifying this value.

        Returns
        -------
        str
            The fully-formed URL to redirect the user to.
        """
        params = {
            "response_type": "code",
            "client_id": settings.xero_client_id,
            "redirect_uri": settings.xero_redirect_uri,
            "scope": settings.xero_scopes,
            "state": state,
        }
        query_string = urllib.parse.urlencode(params)
        url = f"{XERO_AUTHORIZE_BASE}/connect/authorize?{query_string}"
        logger.debug("xero_auth_url_built", state=state)
        return url

    @retry_external_api()
    async def exchange_code_for_tokens(self, code: str, db) -> dict:
        """Exchange an authorisation code for access + refresh tokens.

        Parameters
        ----------
        code:
            The ``code`` query parameter received in the OAuth2 callback.
        db:
            SQLAlchemy async session (not used directly here, but kept for
            signature consistency and future audit logging).

        Returns
        -------
        dict
            The raw token response from Xero (access_token, refresh_token,
            expires_in, token_type, id_token, etc.).

        Raises
        ------
        XeroAuthError
            If Xero returns a non-200 response.
        """
        credentials = base64.b64encode(
            f"{settings.xero_client_id}:{settings.xero_client_secret}".encode()
        ).decode()

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{XERO_IDENTITY_BASE}/connect/token",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.xero_redirect_uri,
                },
            )

        if response.status_code != 200:
            logger.error(
                "xero_token_exchange_failed",
                status_code=response.status_code,
                body=response.text[:500],
            )
            raise XeroAuthError(
                f"Token exchange failed: {response.status_code} {response.text[:200]}",
                status_code=response.status_code,
            )

        token_data = response.json()
        logger.info("xero_token_exchange_success")
        return token_data

    @retry_external_api()
    async def get_tenants(self, access_token: str) -> list:
        """Retrieve all Xero tenants (organisations) for the given access token.

        Parameters
        ----------
        access_token:
            A *plaintext* (not encrypted) Xero access token.

        Returns
        -------
        list[dict]
            Each element contains at least ``tenantId``, ``tenantName``, and
            ``tenantType``.

        Raises
        ------
        XeroAuthError
            If the request is rejected with a 4xx status.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                XERO_CONNECTIONS_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if response.status_code == 401:
            raise XeroAuthError("Invalid or expired access token.", status_code=401)

        if not response.is_success:
            raise XeroAuthError(
                f"Failed to retrieve tenants: {response.status_code}",
                status_code=response.status_code,
            )

        tenants = response.json()
        logger.info("xero_tenants_fetched", count=len(tenants))
        return tenants

    @retry_external_api()
    async def refresh_access_token(self, connection: XeroConnection, db) -> XeroConnection:
        """Refresh an expired (or near-expired) Xero access token.

        Decrypts the stored refresh token, calls the Xero token endpoint, then
        encrypts and persists the new token pair back to the database.

        Parameters
        ----------
        connection:
            The ORM ``XeroConnection`` whose tokens should be refreshed.
        db:
            SQLAlchemy async session used to persist updated token values.

        Returns
        -------
        XeroConnection
            The same ORM instance with updated ``access_token``,
            ``refresh_token``, and ``token_expires_at`` fields (already
            flushed to the DB).

        Raises
        ------
        XeroAuthError
            If Xero rejects the refresh request.
        """
        from app.utils.encryption import encrypt  # local import to avoid circulars

        plaintext_refresh_token = decrypt(connection.refresh_token)

        credentials = base64.b64encode(
            f"{settings.xero_client_id}:{settings.xero_client_secret}".encode()
        ).decode()

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{XERO_IDENTITY_BASE}/connect/token",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": plaintext_refresh_token,
                },
            )

        if not response.is_success:
            logger.error(
                "xero_token_refresh_failed",
                connection_id=str(connection.id),
                status_code=response.status_code,
                body=response.text[:500],
            )
            raise XeroAuthError(
                f"Token refresh failed: {response.status_code} {response.text[:200]}",
                status_code=response.status_code,
            )

        token_data = response.json()
        new_access_token: str = token_data["access_token"]
        new_refresh_token: str = token_data["refresh_token"]
        expires_in: int = token_data.get("expires_in", 1800)

        connection.access_token = encrypt(new_access_token)
        connection.refresh_token = encrypt(new_refresh_token)
        connection.token_expires_at = datetime.fromtimestamp(
            datetime.now(tz=timezone.utc).timestamp() + expires_in,
            tz=timezone.utc,
        )

        db.add(connection)
        await db.flush()

        logger.info(
            "xero_token_refreshed",
            connection_id=str(connection.id),
            tenant_id=connection.tenant_id,
            expires_at=connection.token_expires_at.isoformat(),
        )
        return connection

    async def _get_headers(self, connection: XeroConnection, db) -> dict:
        """Return HTTP headers required for authenticated Xero API calls.

        If the stored access token expires within
        ``_TOKEN_EXPIRY_BUFFER_SECONDS`` seconds, it is automatically
        refreshed before the headers are returned.

        Parameters
        ----------
        connection:
            The ORM ``XeroConnection`` for the target organisation.
        db:
            SQLAlchemy async session (passed through to
            :meth:`refresh_access_token` if needed).

        Returns
        -------
        dict
            ``{"Authorization": "Bearer <token>", "Xero-tenant-id": "<id>"}``
        """
        now_ts = datetime.now(tz=timezone.utc).timestamp()
        expires_ts = connection.token_expires_at.replace(tzinfo=timezone.utc).timestamp()

        if expires_ts - now_ts < _TOKEN_EXPIRY_BUFFER_SECONDS:
            logger.debug(
                "xero_token_near_expiry_refreshing",
                connection_id=str(connection.id),
                seconds_remaining=round(expires_ts - now_ts, 1),
            )
            connection = await self.refresh_access_token(connection, db)

        plaintext_access_token = decrypt(connection.access_token)

        return {
            "Authorization": f"Bearer {plaintext_access_token}",
            "Xero-tenant-id": connection.tenant_id,
            "Accept": "application/json",
        }

    # ------------------------------------------------------------------
    # Low-level HTTP helpers
    # ------------------------------------------------------------------

    @retry_external_api()
    async def _get(
        self,
        connection: XeroConnection,
        db,
        path: str,
        params: Optional[dict] = None,
    ) -> dict:
        """Perform an authenticated GET against the Xero 2.0 API.

        Parameters
        ----------
        connection:
            Authenticated ``XeroConnection`` for the target tenant.
        db:
            SQLAlchemy async session.
        path:
            Xero API resource path (e.g. ``"BankTransactions"``).
        params:
            Optional query-string parameters.

        Returns
        -------
        dict
            Parsed JSON response body.

        Raises
        ------
        XeroRateLimitError
            On HTTP 429.
        XeroAuthError
            On HTTP 401.
        XeroAPIError
            On any other non-success status.
        """
        headers = await self._get_headers(connection, db)
        url = f"{XERO_API_BASE}/{path}"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers, params=params)

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            logger.warning(
                "xero_rate_limit_hit",
                path=path,
                retry_after=retry_after,
            )
            raise XeroRateLimitError(retry_after=retry_after)

        if response.status_code == 401:
            raise XeroAuthError("Xero returned 401 on API call.", status_code=401)

        if not response.is_success:
            raise XeroAPIError(
                f"Xero GET {path} failed: {response.status_code}",
                status_code=response.status_code,
                response_body=response.text[:1000],
            )

        return response.json()

    @retry_external_api()
    async def _post(
        self,
        connection: XeroConnection,
        db,
        path: str,
        body: dict,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        """Perform an authenticated POST against the Xero 2.0 API.

        Parameters
        ----------
        connection:
            Authenticated ``XeroConnection`` for the target tenant.
        db:
            SQLAlchemy async session.
        path:
            Xero API resource path (e.g. ``"ManualJournals"``).
        body:
            JSON-serialisable request body.
        idempotency_key:
            Optional value sent as the ``Idempotency-Key`` header to prevent
            duplicate journal entries on retry.

        Returns
        -------
        dict
            Parsed JSON response body.

        Raises
        ------
        XeroRateLimitError
            On HTTP 429.
        XeroAuthError
            On HTTP 401.
        XeroAPIError
            On any other non-success status.
        """
        headers = await self._get_headers(connection, db)
        headers["Content-Type"] = "application/json"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        url = f"{XERO_API_BASE}/{path}"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=body)

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            logger.warning(
                "xero_rate_limit_hit",
                path=path,
                retry_after=retry_after,
            )
            raise XeroRateLimitError(retry_after=retry_after)

        if response.status_code == 401:
            raise XeroAuthError("Xero returned 401 on API call.", status_code=401)

        if not response.is_success:
            raise XeroAPIError(
                f"Xero POST {path} failed: {response.status_code}",
                status_code=response.status_code,
                response_body=response.text[:1000],
            )

        return response.json()

    # ------------------------------------------------------------------
    # Bank transactions
    # ------------------------------------------------------------------

    async def get_bank_transactions(
        self,
        connection: XeroConnection,
        db,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> list:
        """Retrieve unreconciled RECEIVE-type bank transactions.

        Filters the results to ``Type=="RECEIVE"`` and
        ``IsReconciled==false`` so the reconciliation engine only sees
        incoming payments awaiting matching.

        Parameters
        ----------
        connection:
            Authenticated Xero connection.
        db:
            SQLAlchemy async session.
        from_date:
            If provided, only transactions on or after this date are returned.
        to_date:
            If provided, only transactions on or before this date are returned.

        Returns
        -------
        list[dict]
            List of bank transaction dicts as returned by Xero.
        """
        where_clauses: list[str] = [
            'Type=="RECEIVE"',
            "IsReconciled==false",
        ]

        if from_date:
            where_clauses.append(
                f'Date>=DateTime({from_date.year},{from_date.month:02d},{from_date.day:02d})'
            )
        if to_date:
            where_clauses.append(
                f'Date<=DateTime({to_date.year},{to_date.month:02d},{to_date.day:02d})'
            )

        params: dict[str, Any] = {"where": "&&".join(where_clauses)}

        data = await self._get(connection, db, "BankTransactions", params=params)
        transactions: list = data.get("BankTransactions", [])
        logger.info(
            "xero_bank_transactions_fetched",
            count=len(transactions),
            tenant_id=connection.tenant_id,
        )
        return transactions

    async def get_bank_transaction(
        self,
        connection: XeroConnection,
        db,
        transaction_id: str,
    ) -> dict:
        """Retrieve a single bank transaction by its Xero ID.

        Parameters
        ----------
        connection:
            Authenticated Xero connection.
        db:
            SQLAlchemy async session.
        transaction_id:
            The Xero ``BankTransactionID`` (GUID).

        Returns
        -------
        dict
            The bank transaction resource dict.

        Raises
        ------
        XeroAPIError
            If the transaction is not found or the request fails.
        """
        data = await self._get(connection, db, f"BankTransactions/{transaction_id}")
        transactions: list = data.get("BankTransactions", [])
        if not transactions:
            raise XeroAPIError(
                f"BankTransaction {transaction_id} not found.", status_code=404
            )
        return transactions[0]

    # ------------------------------------------------------------------
    # Invoices
    # ------------------------------------------------------------------

    async def search_invoices(
        self,
        connection: XeroConnection,
        db,
        amount_min: Optional[float] = None,
        amount_max: Optional[float] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        reference: Optional[str] = None,
    ) -> list:
        """Search invoices with optional amount, date, and reference filters.

        Only ``AUTHORISED`` and ``PAID`` invoices are returned. All filter
        conditions are ANDed together.

        Parameters
        ----------
        connection:
            Authenticated Xero connection.
        db:
            SQLAlchemy async session.
        amount_min:
            Minimum ``AmountDue`` (inclusive).
        amount_max:
            Maximum ``AmountDue`` (inclusive).
        from_date:
            Filter invoices whose ``Date`` is on or after this value.
        to_date:
            Filter invoices whose ``Date`` is on or before this value.
        reference:
            Exact ``Reference`` field match.

        Returns
        -------
        list[dict]
            List of matching invoice dicts.
        """
        where_clauses: list[str] = ['(Status=="AUTHORISED"||Status=="PAID")']

        if from_date is not None:
            if isinstance(from_date, str):
                from_date = date.fromisoformat(from_date[:10])
            elif isinstance(from_date, datetime):
                from_date = from_date.date()
        if to_date is not None:
            if isinstance(to_date, str):
                to_date = date.fromisoformat(to_date[:10])
            elif isinstance(to_date, datetime):
                to_date = to_date.date()

        if amount_min is not None:
            where_clauses.append(f"AmountDue>={amount_min}")
        if amount_max is not None:
            where_clauses.append(f"AmountDue<={amount_max}")
        if from_date:
            where_clauses.append(
                f'Date>=DateTime({from_date.year},{from_date.month:02d},{from_date.day:02d})'
            )
        if to_date:
            where_clauses.append(
                f'Date<=DateTime({to_date.year},{to_date.month:02d},{to_date.day:02d})'
            )
        if reference:
            where_clauses.append(f'Reference=="{reference}"')

        params: dict[str, Any] = {"where": "&&".join(where_clauses)}

        data = await self._get(connection, db, "Invoices", params=params)
        invoices: list = data.get("Invoices", [])
        logger.info(
            "xero_invoices_searched",
            count=len(invoices),
            tenant_id=connection.tenant_id,
        )
        return invoices

    async def get_invoice(
        self,
        connection: XeroConnection,
        db,
        invoice_id: str,
    ) -> dict:
        """Retrieve a single invoice by its Xero ID.

        Parameters
        ----------
        connection:
            Authenticated Xero connection.
        db:
            SQLAlchemy async session.
        invoice_id:
            The Xero ``InvoiceID`` (GUID).

        Returns
        -------
        dict
            The invoice resource dict.

        Raises
        ------
        XeroAPIError
            If the invoice is not found.
        """
        data = await self._get(connection, db, f"Invoices/{invoice_id}")
        invoices: list = data.get("Invoices", [])
        if not invoices:
            raise XeroAPIError(f"Invoice {invoice_id} not found.", status_code=404)
        return invoices[0]

    # ------------------------------------------------------------------
    # Manual journals
    # ------------------------------------------------------------------

    async def create_journal_entry(
        self,
        connection: XeroConnection,
        db,
        narration: str,
        lines: list,
        reference: str,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        """Create a manual journal entry in Xero.

        Validates double-entry accounting (total debits == total credits)
        before posting to the API.

        Parameters
        ----------
        connection:
            Authenticated Xero connection.
        db:
            SQLAlchemy async session.
        narration:
            Free-text description of the journal (maps to ``Narration``).
        lines:
            List of journal line dicts. Each line must have at minimum:
            ``LineAmount`` (positive = debit, negative = credit),
            ``AccountCode``, and optionally ``Description`` and ``TaxType``.
        reference:
            Reference string attached to the manual journal.
        idempotency_key:
            Optional idempotency key to prevent duplicate postings on retry.

        Returns
        -------
        dict
            The created ``ManualJournal`` resource from Xero.

        Raises
        ------
        ValueError
            If the sum of debits does not equal the sum of credits (i.e., the
            journal does not balance).
        XeroAPIError
            If Xero rejects the request.
        """
        # --- Double-entry accounting validation ---
        total_debits = sum(
            line["LineAmount"] for line in lines if line.get("LineAmount", 0) > 0
        )
        total_credits = abs(
            sum(line["LineAmount"] for line in lines if line.get("LineAmount", 0) < 0)
        )

        # Use a small epsilon for floating-point comparison
        if abs(total_debits - total_credits) > 0.005:
            raise ValueError(
                f"Journal does not balance: debits={total_debits:.4f} "
                f"credits={total_credits:.4f}. "
                "Total debits must equal total credits."
            )

        body = {
            "Narration": narration,
            "Reference": reference,
            "JournalLines": lines,
        }

        data = await self._post(
            connection,
            db,
            "ManualJournals",
            body=body,
            idempotency_key=idempotency_key,
        )

        journals: list = data.get("ManualJournals", [])
        journal = journals[0] if journals else data

        logger.info(
            "xero_manual_journal_created",
            journal_id=journal.get("ManualJournalID"),
            narration=narration,
            reference=reference,
            total_debits=total_debits,
            tenant_id=connection.tenant_id,
        )
        return journal

    # ------------------------------------------------------------------
    # Accounts (chart of accounts)
    # ------------------------------------------------------------------

    async def get_accounts(
        self,
        connection: XeroConnection,
        db,
    ) -> list:
        """Retrieve the full chart of accounts for the tenant.

        Parameters
        ----------
        connection:
            Authenticated Xero connection.
        db:
            SQLAlchemy async session.

        Returns
        -------
        list[dict]
            List of account dicts from Xero.
        """
        data = await self._get(connection, db, "Accounts")
        accounts: list = data.get("Accounts", [])
        logger.info(
            "xero_accounts_fetched",
            count=len(accounts),
            tenant_id=connection.tenant_id,
        )
        return accounts


# ---------------------------------------------------------------------------
# Module-level singleton (import as ``from app.services.xero_service import xero_service``)
# ---------------------------------------------------------------------------

xero_service = XeroService()
