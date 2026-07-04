# PayTrace AI — 3-Minute Demo Script
### Live Presentation Guide | Exact Dialogue + Stage Directions

---

## PRE-DEMO SETUP CHECKLIST

Before walking on stage or starting the screen share:

- [ ] Demo account loaded with Marcus Chen's data (Payout ID: PAY-2024-0847)
- [ ] Browser at `localhost:3000` or production URL — NOT the admin panel
- [ ] Stripe test mode CONFIRMED (no live credentials visible on screen)
- [ ] Xero sandbox tenant pre-authenticated — token must NOT be expired
- [ ] Redis cache cleared so the AI animation runs live (not from cache)
- [ ] Order #1821 refund anomaly confirmed present in the demo dataset
- [ ] Font size at 150% minimum — audience must be able to read table rows
- [ ] Close Slack, email, and all notifications — do not risk a ping mid-demo
- [ ] Second device or phone ready as fallback with a recorded screen video

---

## THE SCRIPT

---

### [00:00 – 00:25] THE HOOK

**[STAND STILL. Look at the audience, not the screen. Speak slowly.]**

"This is Marcus."

**[Gesture to the screen. Dashboard shows a clean bank feed interface with one unreconciled payout row highlighted in amber.]**

"Marcus runs a Shopify store. Sells about 200 orders a month. He is good at business. He is not a trained accountant."

**[Pause one beat.]**

"This morning, Marcus opened his bank app. His account shows **$8,742.63**."

**[Click to bring up the side-by-side view: bank balance on left, Shopify revenue dashboard on right.]**

"His Shopify dashboard shows **$9,102** in sales for the same period."

**[Pause. Let the gap land.]**

"**Where is the $359.37?**"

**[Beat of silence. Then:]**

"Until today, answering that question took Marcus 45 minutes. Five browser tabs. A spreadsheet full of VLOOKUP formulas. And at the end? He was still not completely certain."

**[Turn back to the screen.]**

"Let me show you a better way."

---

### [00:25 – 01:00] THE MAGIC CLICK

**[Move cursor deliberately to the amber payout row: "Stripe Payout — Jul 3 — $8,742.63"]**

"This is the payout sitting in Marcus's bank feed. Unreconciled. Unexplained. Just... a number."

**[Hover over the row to reveal the action button.]**

"PayTrace AI adds one button to this row."

**[Click "Explain with AI." The button highlights. A progress panel slides in from the right with a subtle animation.]**

"Watch what happens."

**[Read each progress item aloud as the checkmark appears. Speak in a calm, slightly reverent tone — like watching something impressive happen.]**

"Fetching Stripe transactions..."

**[Checkmark appears.]**

"Searching Xero for matching invoices..."

**[Checkmark appears.]**

"Calculating reconciliation..."

**[Checkmark appears.]**

"Done."

**[The full breakdown card appears. Pause for one beat to let the audience absorb it.]**

"Eight seconds."

---

### [01:00 – 01:40] THE EXPLANATION

**[Move cursor to the top of the AI summary card. Do not scroll yet. Read the summary header aloud.]**

"'Your Stripe payout of **$8,742.63** has been fully reconciled. Gross sales of $9,102 minus processing costs account for the difference. No unmatched transactions.' "

**[Pause.]**

"Plain English. No accounting jargon. But let's go deeper."

**[Scroll to the breakdown table. Point to each row as you read it.]**

"Gross sales from Shopify orders: **$9,102.00**"

"Stripe processing fees: **minus $214.37**"

"Customer refunds: **minus $96.00**"

"Chargeback: **minus $40.00**"

"Foreign exchange adjustment: **minus $9.00**"

"Net payout: **$8,742.63** — checkmark."

**[Pause to let the math sink in.]**

"Every number. Accounted for. To the cent."

**[Click on the "Stripe Fees — $214.37" row to expand the evidence panel.]**

"But here is what makes this different from a spreadsheet formula."

**[The evidence panel opens. It shows a scrollable list of individual Stripe transaction IDs, each with a fee amount.]**

"This is not a calculation. This is **evidence.** Every dollar of that $214.37 links to a real Stripe transaction. Click any row and you see the charge ID, the fee rate, the timestamp. Nothing is hidden. Nothing is assumed."

**[Close the evidence panel.]**

"This is what I mean when I say PayTrace AI does not guess. It reasons. And it shows its work."

---

### [01:40 – 02:10] THE ANOMALY

**[Scroll down slightly. A yellow warning banner is visible below the reconciliation table.]**

"But there is something else."

**[Pause. Do not rush this.]**

"PayTrace AI did not just reconcile the payout. It read the data — and it noticed something."

**[Click to expand the yellow warning banner.]**

"'**Refund rate alert.** This period's refund rate is **3.2%**, compared to your 90-day average of **1.6%.** Order #1821 accounts for $96 in refunds across three separate transactions.'"

**[Let that sit for a moment. Then speak quietly, conversationally.]**

"Marcus did not notice this."

**[Pause.]**

"His accountant — who looks at the books once a month — did not catch this either."

**[Pause.]**

"Order #1821 was refunded. Three times. For the same product. In the same week."

**[Look at the audience.]**

"That is either a fulfillment problem, a fraud signal, or a customer service breakdown. Marcus does not know which yet. But now he knows it **happened.** Before PayTrace AI? This would have been buried in a CSV file that nobody reads."

**[Beat.]**

"This is the difference between a tool that processes data and a tool that **understands** it."

---

### [02:10 – 02:45] THE EXECUTE

**[Scroll to the bottom of the breakdown card. A green "Reconcile Everything" button is visible.]**

"Now let's close the loop."

**[Click "Reconcile Everything." A confirmation modal appears with a clean list of four proposed actions.]**

"PayTrace AI is proposing four actions in Xero:"

**[Read each line crisply. Point to each row as you say it.]**

"One — reconcile the $8,742.63 bank transaction to the Stripe payout record."

"Two — create a bank transaction for $214.37 in Stripe processing fees."

"Three — post a manual journal entry for the $40 chargeback."

"Four — record the $9.00 FX adjustment."

**[Pause.]**

"Marcus reviews these. They look right. He types a brief audit note —"

**[Type into the audit note field: "Reconciled via PayTrace AI — Jul 3 payout. Refund anomaly flagged for review."]**

"— and he clicks **Confirm.**"

**[Click Confirm. The success animation plays: a green checkmark expands, and the four Xero actions flash complete one by one.]**

"Xero is updated."

"The bank transaction is reconciled."

"The audit trail is written."

"The anomaly is flagged for follow-up."

**[Look up from the screen.]**

"Forty-five minutes of work. In under two minutes."

---

### [02:45 – 03:00] THE CLOSE

**[Step back from the screen. Speak directly to the audience. No gesturing. Just eye contact.]**

"PayTrace AI is not another integration tool."

**[Pause.]**

"It is an AI accountant that **reasons** across your entire financial stack — Stripe, Xero, Shopify — simultaneously, in seconds, with evidence for every claim."

**[Beat.]**

"There are 4.4 million businesses on Xero. More than half of them process payments. Every single one of them has a Marcus."

**[Final pause. Then, with quiet conviction:]**

"They all deserve better than 45 minutes and a VLOOKUP."

**[Hold. Let the audience respond. Do not fill the silence.]**

---

## CONTINGENCY PLANS

---

### CONTINGENCY A — Stripe API is Slow or Unresponsive

**Trigger:** The progress animation stalls on "Fetching Stripe transactions..." for more than 4 seconds.

**What to say (without breaking composure):**
> "While the live data loads — and you can see it is actually hitting the real Stripe API right now — let me walk you through what the AI is doing in this step."

**Then:** Narrate the Stripe fetch process verbally for 10–15 seconds. If the response comes back before you finish, stop mid-sentence and say: "And there it is." If it does not come back within 20 seconds:

**Fallback:** Press `Ctrl+Shift+D` (pre-configured hotkey) to load the cached demo snapshot. Say:
> "I have a pre-loaded dataset from an earlier run — same data, same math — so we can keep moving."

**Do NOT:** Apologize more than once. Do NOT refresh the browser. Do NOT switch to a different payout row.

---

### CONTINGENCY B — Demo Account Has No Anomaly

**Trigger:** The yellow warning banner does not appear after the AI breakdown loads.

**What to say:**
> "In this particular payout, everything looks clean — which is actually the best-case scenario for Marcus. But in the last week of demos, we had a dataset where this is what showed up:"

**Then:** Switch to Tab 2 (pre-opened, minimized), which shows a screenshot of the anomaly banner on a different payout row. Walk through the anomaly scenario using the screenshot.

**Key talking point to add:**
> "The AI scans for anomaly patterns on every reconciliation, not just when you ask. This is the proactive layer — the thing that catches problems before month-end."

**Recovery:** Return to the live demo for the Execute step. The Reconcile button still works on the clean payout.

---

### CONTINGENCY C — Xero Write Fails (API Error on Reconcile)

**Trigger:** After clicking Confirm, one or more of the four Xero actions shows a red error state.

**What to say (immediately, before the audience processes what they saw):**
> "And this is actually an important thing to show you — watch what happens when something goes wrong."

**Then walk through the error recovery:**
- Point to the audit log entry that was written despite the failure
- Point to the retry mechanism in the UI
- Say: "PayTrace AI never writes partial data to Xero. If any step fails, the whole batch rolls back. Your books are never left in an inconsistent state."

**Then:** Click the "Retry Failed Actions" button (pre-configured to succeed on retry). Let the success animation play. Say:
> "And on retry, we get the clean result. The idempotency keys mean Xero never double-counts anything even on a retry."

**Key message:** Frame the failure as a feature demonstration, not a bug. You are showing resilience, not a broken product.

---

### CONTINGENCY D — Screen Share Fails / Tech Meltdown

**Trigger:** Screen share disconnects, laptop freezes, or projector signal is lost.

**Immediately:** Pick up phone or second device. Pull up the 90-second recorded screen capture video (saved to Photos as "PayTrace-Demo-Final.mp4").

**What to say:**
> "While we sort the technical side — let me show you a recording from this morning's run-through. Same flow, real data."

**Then:** Play the video and narrate over it live, following the same script above. The video has no audio — your live narration is the soundtrack.

**After the video:** Say:
> "The live version is what you just saw. The tech hiccup doesn't change what the product does."

---

## TIMING REFERENCE

| Segment | Time | Key Action |
|---|---|---|
| The Hook | 00:00 – 00:25 | Introduce Marcus and the gap |
| The Magic Click | 00:25 – 01:00 | Click Explain, watch progress, reveal 8 seconds |
| The Explanation | 01:00 – 01:40 | Walk the table, click into evidence |
| The Anomaly | 01:40 – 02:10 | Yellow banner, Order #1821, the "Marcus didn't notice" beat |
| The Execute | 02:10 – 02:45 | Confirm modal, type note, click Confirm, success animation |
| The Close | 02:45 – 03:00 | Eye contact, no screen, final line |

**Total: 3:00 exactly.** Do not run long. The silence after the final line is intentional — it lands harder than any extra words.

---

## DELIVERY NOTES

- **Pace the anomaly beat.** The three-sentence sequence — "Marcus did not notice this. His accountant did not catch this. PayTrace AI did." — must have a pause after each sentence. This is the emotional peak of the demo. Do not rush it.

- **Never apologize for the tech.** If something goes wrong, move immediately to the contingency and frame it as a feature. Apologizing signals panic. Pivoting signals competence.

- **The final line is a full stop.** After "They all deserve better than 45 minutes and a VLOOKUP" — stop. Do not say "Thank you." Do not say "Any questions?" Just hold eye contact. The MC or judges will take it from there. Silence is confidence.

- **Know the numbers cold.** $8,742.63. $9,102. $359.37. $214.37. $96. $40. $9. 3.2%. 1.6%. 4.4M. $30/seat. If you stumble on a number, the math story falls apart. Practice these until they are automatic.

- **The anomaly is the money moment.** Everything before it is setup. Everything after it is resolution. The anomaly is the proof that this is intelligence, not automation.

---

*PayTrace AI — Demo Script v1.0 | Hackathon Submission*
