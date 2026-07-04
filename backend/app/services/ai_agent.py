"""AI reconciliation agent — Claude-powered Stripe + Xero analysis."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.payout import Payout, PayoutItem, PayoutItemType
from app.models.reconciliation import (
    EvidenceType,
    JobStatus,
    ReconciliationEvidence,
    ReconciliationJob,
)
from app.services.stripe_service import StripeService
from app.utils.audit import log_action

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — given to Claude on every agent run
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are an expert AI accounting agent specialising in Stripe-to-Xero \
reconciliation for small and medium businesses.

RULES you must follow without exception:
1. Every claim you make about amounts, counts, or dates must be backed by a \
tool result from the current session. Never invent or guess figures.
2. Journal entries you propose must balance: total debits must equal total \
credits to the penny. If they do not balance, say so explicitly.
3. Any payout amount you cannot fully explain through tool results triggers \
the needs_human_review flag in your output.
4. Never instruct or imply that any write operation (creating Xero invoices, \
journal entries, bank transactions) should be executed without explicit human \
approval. Always mark such actions as "proposed", not "executed".
5. Be concise. Use accounting terminology correctly. Reference specific \
transaction IDs from tool results.

INVOICE MATCHING STRATEGY — follow these steps in order for every payment item:
Step 1 — Exact reference match: call search_xero_invoices_by_reference with \
the Stripe charge ID (stripe_charge_id field from get_payout_items). If exactly \
one invoice is returned, that is the match. Record it and move on.
Step 2 — Amount + date match: only if step 1 returns no results, call \
search_xero_invoices with amount_min and amount_max set to ±1% of the \
transaction amount (never more than ±$5 variance), and date_from set to \
7 days before the payout arrival date.
Step 3 — If multiple invoices match in step 2, pick the one whose date is \
closest to the Stripe transaction. If two invoices are equally close, flag \
both as candidates and set needs_human_review to true for that item.
Step 4 — If no match is found after both steps, explicitly mark that item as \
unmatched. Do not guess or leave it silently unaccounted.

After using the available tools to gather all necessary evidence, output your \
final analysis as a JSON object with exactly these keys:
{
  "summary": "<plain-English narrative, 2-5 sentences>",
  "gross_sales": <number>,
  "stripe_fees": <number>,
  "refunds": <number>,
  "chargebacks": <number>,
  "fx_adjustments": <number>,
  "net_payout": <number>,
  "balanced": <bool>,
  "needs_human_review": <bool>,
  "anomalies": ["<string>", ...],
  "proposed_actions": [
    {
      "action": "<create_journal_entry | match_invoice | flag_for_review | ...>",
      "description": "<what and why>",
      "requires_approval": <bool>
    }
  ],
  "evidence": [
    {
      "claim": "<specific claim>",
      "evidence_type": "<stripe_transaction | xero_invoice | xero_payment | bank_transaction>",
      "evidence_id": "<ID string>",
      "amount": <number or null>
    }
  ]
}

Output ONLY valid JSON in your final turn — no markdown fences, no preamble."""

# ---------------------------------------------------------------------------
# Tool definitions (Anthropic tool_param format)
# ---------------------------------------------------------------------------
TOOLS: list[anthropic.types.ToolParam] = [
    {
        "name": "get_payout_summary",
        "description": (
            "Return the financial summary for a synced payout, including gross sales, "
            "Stripe fees, refunds, chargebacks, FX adjustments, net payout, a balanced "
            "flag, and any detected anomalies."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "payout_id": {
                    "type": "string",
                    "description": "The internal DB UUID of the payout (not the Stripe po_... ID).",
                }
            },
            "required": ["payout_id"],
        },
    },
    {
        "name": "get_payout_items",
        "description": (
            "Return the individual balance-transaction line items belonging to a payout. "
            "Optionally filter by item_type (payment, refund, stripe_fee, chargeback, "
            "fx_adjustment, adjustment)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "payout_id": {
                    "type": "string",
                    "description": "The internal DB UUID of the payout.",
                },
                "item_type": {
                    "type": "string",
                    "description": (
                        "Optional filter. One of: payment, refund, stripe_fee, "
                        "chargeback, fx_adjustment, adjustment."
                    ),
                },
            },
            "required": ["payout_id"],
        },
    },
    {
        "name": "search_xero_invoices",
        "description": (
            "Search Xero for invoices whose AmountDue falls within the given range "
            "and (optionally) whose DueDate falls within the given date range. "
            "Returns a list of matching invoice summaries."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "amount_min": {
                    "type": "number",
                    "description": "Minimum invoice amount (inclusive, major currency units).",
                },
                "amount_max": {
                    "type": "number",
                    "description": "Maximum invoice amount (inclusive, major currency units).",
                },
                "date_from": {
                    "type": "string",
                    "description": "ISO-8601 date string (YYYY-MM-DD) for the start of the search window.",
                },
                "date_to": {
                    "type": "string",
                    "description": "Optional ISO-8601 date string (YYYY-MM-DD) for the end of the search window.",
                },
            },
            "required": ["amount_min", "amount_max", "date_from"],
        },
    },
    {
        "name": "search_xero_invoices_by_reference",
        "description": (
            "Find a Xero invoice whose Reference field contains the given string. "
            "Use this first for every payment item, passing the stripe_charge_id "
            "(e.g. ch_abc123) as the reference. Returns a list of matching invoices."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "reference": {
                    "type": "string",
                    "description": "The Stripe charge ID or other reference string to search for (e.g. ch_abc123).",
                }
            },
            "required": ["reference"],
        },
    },
    {
        "name": "detect_anomalies",
        "description": (
            "Run the anomaly-detection logic for a payout and return a list of "
            "anomaly descriptions (e.g. high refund rate, unbalanced totals, "
            "chargebacks present)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "payout_id": {
                    "type": "string",
                    "description": "The internal DB UUID of the payout.",
                }
            },
            "required": ["payout_id"],
        },
    },
]


# ---------------------------------------------------------------------------
# Xero service stub — replaced by the real XeroService when injected
# ---------------------------------------------------------------------------
class _XeroServiceStub:
    """Minimal stub so _execute_tool can call xero_svc.search_invoices safely."""

    async def search_invoices(
        self,
        connection: Any,
        amount_min: float,
        amount_max: float,
        date_from: str,
        date_to: Optional[str] = None,
    ) -> list[dict]:
        return []


# ---------------------------------------------------------------------------
# Main agent class
# ---------------------------------------------------------------------------
class ReconciliationAgent:
    """
    Claude-powered agent that analyses a synced payout and proposes
    Xero reconciliation actions.

    Each call to `explain_payout` creates a ReconciliationJob in the DB,
    runs a full tool-use loop against Claude, and persists the structured
    output plus the raw reasoning chain.
    """

    def __init__(
        self,
        stripe_svc: Optional[StripeService] = None,
        xero_svc: Optional[Any] = None,
    ) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model
        self.stripe_svc = stripe_svc or StripeService()
        self.xero_svc = xero_svc or _XeroServiceStub()

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def explain_payout(
        self,
        payout_id: str,
        user_id: Any,
        xero_connection: Optional[Any],
        db: AsyncSession,
    ) -> ReconciliationJob:
        """
        Analyse *payout_id* with Claude and persist the result.

        Creates a ReconciliationJob, runs the agent loop, stores the
        structured explanation and full reasoning chain, creates
        ReconciliationEvidence rows, and writes an audit entry.

        Returns the finalised ReconciliationJob.
        """
        # ---- Load the payout ------------------------------------------
        result = await db.execute(
            select(Payout).where(Payout.id == uuid.UUID(str(payout_id)))
        )
        payout = result.scalar_one_or_none()
        if payout is None:
            raise ValueError(f"Payout {payout_id} not found in database")

        # ---- Create job record ----------------------------------------
        job = ReconciliationJob(
            payout_id=payout.id,
            status=JobStatus.running,
            started_at=datetime.now(tz=timezone.utc),
            agent_model=self._model,
        )
        db.add(job)
        await db.flush()

        # ---- Run agent -----------------------------------------------
        try:
            output = await self._run_agent_loop(payout, job, xero_connection, db)

            reasoning_chain = output.pop("_reasoning_chain", [])
            job.status = JobStatus.completed
            job.completed_at = datetime.now(tz=timezone.utc)
            job.explanation_json = output
            job.agent_reasoning = json.dumps(reasoning_chain, indent=2)

            # Populate financial summary fields
            job.total_explained = output.get("net_payout")
            if not output.get("balanced", True):
                job.status = JobStatus.needs_review

            # ---- Persist evidence records ----------------------------
            for ev in output.get("evidence", []):
                ev_type_raw = ev.get("evidence_type", "stripe_transaction")
                try:
                    ev_type = EvidenceType(ev_type_raw)
                except ValueError:
                    ev_type = EvidenceType.stripe_transaction

                evidence = ReconciliationEvidence(
                    job_id=job.id,
                    claim=ev.get("claim", ""),
                    evidence_type=ev_type,
                    evidence_id=str(ev.get("evidence_id", "")),
                    amount=ev.get("amount"),
                    verified=True,
                )
                db.add(evidence)

            await db.flush()

        except Exception as exc:
            logger.exception("ReconciliationAgent failed for payout=%s", payout_id)
            job.status = JobStatus.failed
            job.completed_at = datetime.now(tz=timezone.utc)
            job.error_message = str(exc)
            await db.flush()
            raise

        finally:
            # Audit regardless of success / failure
            await log_action(
                db=db,
                action="reconciliation_agent_run",
                entity_type="reconciliation_job",
                entity_id=job.id,
                user_id=uuid.UUID(str(user_id)) if user_id else None,
                after={"status": job.status.value},
                agent_job_id=job.id,
            )

        return job

    # ------------------------------------------------------------------
    # Agent loop
    # ------------------------------------------------------------------

    async def _run_agent_loop(
        self,
        payout: Payout,
        job: ReconciliationJob,
        xero_connection: Optional[Any],
        db: AsyncSession,
    ) -> dict:
        """
        Anthropic tool-use loop.

        Sends an initial user message, then alternates between:
          - appending tool results and calling the API again (tool_use)
          - parsing and returning the final JSON (end_turn)

        Returns the parsed analysis dict with an additional
        ``_reasoning_chain`` key containing every message turn.
        """
        reasoning_chain: list[dict] = []

        initial_message = (
            f"Please analyse payout {payout.id} (Stripe ID: {payout.stripe_payout_id}, "
            f"amount: {payout.amount} {payout.currency}, "
            f"arrival date: {payout.arrival_date}). "
            "Use the available tools to gather all required evidence, then output "
            "your final analysis as the JSON structure described in the system prompt."
        )

        messages: list[dict] = [{"role": "user", "content": initial_message}]
        reasoning_chain.append({"role": "user", "content": initial_message})

        max_iterations = 20  # guard against runaway loops
        for iteration in range(max_iterations):
            logger.debug(
                "Agent loop iteration %d for payout=%s", iteration, payout.id
            )

            response = await self._client.messages.create(
                model=self._model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )

            # Record assistant turn
            reasoning_chain.append(
                {
                    "role": "assistant",
                    "iteration": iteration,
                    "stop_reason": response.stop_reason,
                    "content": [
                        b.model_dump() if hasattr(b, "model_dump") else str(b)
                        for b in response.content
                    ],
                }
            )

            if response.stop_reason == "end_turn":
                # Extract the JSON from the text block
                text_block = next(
                    (b for b in response.content if b.type == "text"), None
                )
                if text_block is None:
                    raise RuntimeError(
                        "Agent returned end_turn but no text block found"
                    )
                parsed = _parse_agent_json(text_block.text)
                parsed["_reasoning_chain"] = reasoning_chain
                return parsed

            if response.stop_reason == "tool_use":
                # Append assistant message then process all tool calls
                messages.append({"role": "assistant", "content": response.content})

                tool_results = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue

                    logger.info(
                        "Agent calling tool=%s inputs=%s payout=%s",
                        block.name,
                        block.input,
                        payout.id,
                    )
                    tool_output = await self._execute_tool(
                        name=block.name,
                        inputs=block.input,
                        payout=payout,
                        xero_connection=xero_connection,
                        db=db,
                    )
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(tool_output, default=str),
                        }
                    )
                    reasoning_chain.append(
                        {
                            "role": "tool_result",
                            "tool": block.name,
                            "output": tool_output,
                        }
                    )

                messages.append({"role": "user", "content": tool_results})
                continue

            # Unexpected stop reason
            raise RuntimeError(
                f"Unexpected stop_reason from Claude: {response.stop_reason!r}"
            )

        raise RuntimeError(
            f"Agent loop exceeded {max_iterations} iterations for payout {payout.id}"
        )

    # ------------------------------------------------------------------
    # Tool dispatcher
    # ------------------------------------------------------------------

    async def _execute_tool(
        self,
        name: str,
        inputs: dict,
        payout: Payout,
        xero_connection: Optional[Any],
        db: AsyncSession,
    ) -> Any:
        """
        Route a tool call to the appropriate service method and return a
        JSON-serialisable result.
        """
        if name == "get_payout_summary":
            target_payout = await _load_payout(inputs["payout_id"], db, payout)
            return await self.stripe_svc.build_payout_summary(target_payout)

        if name == "get_payout_items":
            target_payout = await _load_payout(inputs["payout_id"], db, payout)
            type_filter: Optional[str] = inputs.get("item_type")
            items = target_payout.items
            if type_filter:
                try:
                    filter_enum = PayoutItemType(type_filter)
                    items = [i for i in items if i.type == filter_enum]
                except ValueError:
                    pass  # unknown type — return all items

            return [
                {
                    "id": str(item.id),
                    "stripe_balance_transaction_id": item.stripe_balance_transaction_id,
                    "type": item.type.value,
                    "amount": float(item.amount),
                    "currency": item.currency,
                    "description": item.description,
                    "stripe_charge_id": item.stripe_charge_id,
                    "metadata": item.metadata_,
                }
                for item in items
            ]

        if name == "search_xero_invoices":
            if xero_connection is None:
                return {"error": "No Xero connection available for this user."}
            results = await self.xero_svc.search_invoices(
                connection=xero_connection,
                db=db,
                amount_min=inputs["amount_min"],
                amount_max=inputs["amount_max"],
                from_date=inputs.get("date_from"),
                to_date=inputs.get("date_to"),
            )
            return results

        if name == "search_xero_invoices_by_reference":
            if xero_connection is None:
                return {"error": "No Xero connection available for this user."}
            results = await self.xero_svc.search_invoices(
                connection=xero_connection,
                db=db,
                reference=inputs["reference"],
            )
            return results

        if name == "detect_anomalies":
            target_payout = await _load_payout(inputs["payout_id"], db, payout)
            summary = await self.stripe_svc.build_payout_summary(target_payout)
            return {
                "payout_id": inputs["payout_id"],
                "anomalies": summary["anomalies"],
                "balanced": summary["balanced"],
            }

        raise ValueError(f"Unknown tool: {name!r}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _load_payout(
    payout_id_str: str,
    db: AsyncSession,
    fallback: Payout,
) -> Payout:
    """
    Load a Payout by its string UUID.  Falls back to *fallback* when the
    agent passes the same payout ID that we already have in memory, to
    avoid an unnecessary DB round-trip.
    """
    try:
        target_uuid = uuid.UUID(str(payout_id_str))
    except ValueError:
        return fallback

    if target_uuid == fallback.id:
        return fallback

    result = await db.execute(
        select(Payout).where(Payout.id == target_uuid)
    )
    payout = result.scalar_one_or_none()
    if payout is None:
        raise ValueError(f"Payout {payout_id_str} not found")
    return payout


def _parse_agent_json(text: str) -> dict:
    """
    Extract and parse the JSON object from the agent's final text block.

    Handles the case where the agent wraps the JSON in markdown fences
    despite the instruction not to.
    """
    text = text.strip()

    # Strip optional markdown fences
    if text.startswith("```"):
        lines = text.splitlines()
        # Drop opening fence (and optional language tag) and closing fence
        inner_lines = []
        inside = False
        for line in lines:
            if line.startswith("```") and not inside:
                inside = True
                continue
            if line.startswith("```") and inside:
                break
            if inside:
                inner_lines.append(line)
        text = "\n".join(inner_lines).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Agent returned non-JSON in final turn: {exc}\n\nRaw text:\n{text[:500]}"
        ) from exc
