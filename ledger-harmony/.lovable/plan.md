# Reconciliation Agent — Prototype Plan (revised for distinctive feel)

Single-page React + Tailwind prototype, static mock data, no backend. Design pushed away from generic SaaS defaults toward a tactile ledger-paper aesthetic.

## Distinctive design system

**Typography** — swap the generic defaults for characterful Google Fonts:
- Display / headers / agent conclusions: **Fraunces** (variable slab-ish serif, opsz 96, soft/wonky axis dialed up for warmth — not the standard flat setting).
- Body / labels: **Instrument Sans** (replacing Inter — humanist grotesque, less ubiquitous, slightly quirky terminals).
- Data / numbers / IDs / timestamps: **Space Mono** with `font-variant-numeric: tabular-nums slashed-zero` (replacing JetBrains Mono — more mechanical, ledger-typewriter feel).
- Loaded via `<link>` in `src/routes/__root.tsx` head. Registered in `@theme` as `--font-display`, `--font-sans`, `--font-mono`.

**Color tokens** (in oklch, spec palette held as hard constraint since it's already a distinctive ledger-paper direction):
- `--background` #EDF1EA, `--foreground` #1C2B2A, `--success` #2F6B4F, `--danger` #A63A2E, `--border` #C7CEC3, `--accent` #3E5C76.
- Source tints (low-opacity header bars): shopify green, stripe blue-violet, xero teal — defined as `--tint-shopify`, `--tint-stripe`, `--tint-xero`.

**Texture & rules** (the non-generic layer):
- Body background: sage `#EDF1EA` + very subtle SVG paper-grain noise overlay (`bg-[url()]`, ~4% opacity) so it doesn't read as flat SaaS.
- All horizontal dividers rendered as SVG hand-drawn wobble lines (slight jitter path), not `border-t`, in `--border` color.
- Section headings prefixed with a small monospaced § marker + section number in Space Mono, like a printed ledger.
- Card corners: `rounded-none` with a 1px inner rule inset 4px (double-ruled ledger card), not the default rounded shadow card look.
- No shadows anywhere except a single soft drop under the "Post to Xero" button.

## Files

- `src/lib/reconciliation-data.ts` — static mock: shopify orders, stripe payout, xero txn, reasoning steps, proposed correction, audit row.
- `src/hooks/use-in-view.ts` — IntersectionObserver hook for fade-in on scroll.
- `src/hooks/use-typewriter.ts` — character-by-character text hook (triggered on in-view).
- `src/components/reconciliation/Section.tsx` — wrapper: ledger section number, wobble-rule divider, scroll fade-in.
- `src/components/reconciliation/SourceFragmentation.tsx` — S1: three ledger cards + SVG converging dashed lines.
- `src/components/reconciliation/QueryInterface.tsx` — S2: search input + typewriter question bubble.
- `src/components/reconciliation/ReasoningTrace.tsx` — S3: four steps with animated SVG check/flag glyphs.
- `src/components/reconciliation/WriteBackConfirmation.tsx` — S4: correction card + "Post to Xero" button + audit log table.
- `src/routes/index.tsx` — replace placeholder; compose the four sections.
- `src/routes/__root.tsx` — add Google Fonts links, update title/description/og/twitter for "Reconciliation Agent".
- `src/styles.css` — palette + font tokens, paper-grain bg, ledger `.rule-wobble` utility, mono tabular-nums utility.

## Section details

- **S1 Source Fragmentation**: 3-col grid (stacks 1-col mobile: Shopify → Stripe → Xero). Ledger card = tinted header bar with source name in Space Mono uppercase, double-ruled body, rows with order # + amount (mono) + status badge. Xero row uses brick-red text + flag. Below grid: SVG with three dashed paths converging to a single point.
- **S2 Query Interface**: Rounded-none search input with dashed border, placeholder "Ask the agent about this reconciliation." Below, a bubble typing "Why doesn't this payout match the expected total?" with blinking block caret in Space Mono.
- **S3 Reasoning Trace**: Vertical list; left glyph = hand-drawn checkmark SVG (forest green) for 1–3, flag SVG (brick red) for step 4. Stroke-dasharray keyframe on enter. Monospace figures + one line of plain-text explanation. Step 4 shows `confidence: 94%`.
- **S4 Write-back**: Card lists 3 split lines (gross +$155.75, fee −$4.20, refund −$32.50) in mono. Slate-blue "Post to Xero" button (only element with a shadow). On click → "Posted ✓" state and fade in audit log table (Timestamp / Action / Confidence / Outcome), plainly ruled ledger style.

## Motion rules

- Sections fade in on scroll (`use-in-view` + fade).
- Featured animations: typewriter (S2), stroke-dasharray glyph draw (S3). Nothing else.
- No spring/bounce. Fades only.

## Responsive

- S1 grid: `grid-cols-1 md:grid-cols-3`, stacking order Shopify → Stripe → Xero.
- All sections `max-w-5xl mx-auto px-4`.
