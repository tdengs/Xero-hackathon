import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Section, WobbleRule } from "@/components/reconciliation/Section";
import { SourceFragmentation } from "@/components/reconciliation/SourceFragmentation";
import { QueryInterface } from "@/components/reconciliation/QueryInterface";
import { ReasoningTrace } from "@/components/reconciliation/ReasoningTrace";
import { WriteBackConfirmation } from "@/components/reconciliation/WriteBackConfirmation";

export const Route = createFileRoute("/press-demo")({
  head: () => ({
    meta: [
      { title: "Press demo · Reconciliation Agent" },
      {
        name: "description",
        content:
          "The narrative demo — from three fragmented ledgers to one reconciled truth.",
      },
      { property: "og:title", content: "Reconciliation Agent — Press demo" },
      {
        property: "og:description",
        content: "See how the agent reconciles Shopify, Stripe, and Xero.",
      },
    ],
  }),
  component: PressDemo,
});

function PressDemo() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-tabular text-[0.7rem] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> back to app
        </Link>
      </div>

      <header className="mx-auto max-w-5xl px-5 pt-10 pb-6 sm:pt-16">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-success" />
          <span className="section-marker">reconciliation agent · press demo</span>
        </div>
        <h1 className="text-4xl leading-[0.98] tracking-tight sm:text-6xl md:text-7xl">
          Three ledgers.
          <br />
          <span className="italic text-accent">One reconciled</span> truth.
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-base text-foreground/75 sm:text-lg">
          An agent reads Shopify, Stripe, and Xero — and explains, in plain
          numbers, why a payout doesn&rsquo;t match what you expected.
        </p>
        <div className="mt-10">
          <WobbleRule />
        </div>
      </header>

      <Section
        number="01"
        eyebrow="fragmentation"
        title={
          <>
            The same sale, written three
            <span className="italic"> different ways.</span>
          </>
        }
      >
        <SourceFragmentation />
      </Section>

      <Section
        number="02"
        eyebrow="query"
        title={
          <>
            Ask what the numbers <span className="italic">actually</span> mean.
          </>
        }
      >
        <QueryInterface />
      </Section>

      <Section
        number="03"
        eyebrow="reasoning"
        title={
          <>
            The agent shows its <span className="italic">working</span>.
          </>
        }
      >
        <ReasoningTrace />
      </Section>

      <Section
        number="04"
        eyebrow="write-back"
        title={
          <>
            Post the correction. Keep the <span className="italic">receipt</span>.
          </>
        }
      >
        <WriteBackConfirmation />
      </Section>

      <footer className="mx-auto max-w-5xl px-5 pb-16 pt-8">
        <WobbleRule />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="section-marker">end of ledger</span>
          <span className="font-tabular text-[0.7rem] text-muted-foreground">
            reconciliation-agent · prototype
          </span>
        </div>
      </footer>
    </main>
  );
}
