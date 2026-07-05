import { issueContent, type IssueKind, type Step } from "@/lib/reconciliation-data";
import { useInView } from "@/hooks/use-in-view";

function CheckGlyph({ inView }: { inView: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 text-success" aria-hidden>
      <path
        d="M5 17 Q 10 22, 13 24 Q 18 18, 27 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        style={{ ["--dash" as string]: "40" }}
        className={inView ? "draw-in" : "opacity-0"}
      />
    </svg>
  );
}

function FlagGlyph({ inView }: { inView: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 text-danger" aria-hidden>
      <path
        d="M8 28 L 8 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        style={{ ["--dash" as string]: "24" }}
        className={inView ? "draw-in" : "opacity-0"}
      />
      <path
        d="M8 6 Q 16 3, 24 7 Q 18 12, 24 16 L 8 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        style={{ ["--dash" as string]: "60", animationDelay: "200ms" }}
        className={inView ? "draw-in" : "opacity-0"}
      />
    </svg>
  );
}

function StepRow({ step, index }: { step: Step; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  const flagged = step.kind === "flag";
  return (
    <div
      ref={ref}
      className={`grid grid-cols-[3rem_1fr] gap-4 border-b border-rule py-6 last:border-b-0 ${
        flagged ? "bg-danger/[0.04] px-3 -mx-3" : ""
      }`}
    >
      <div className="pt-1">
        {flagged ? <FlagGlyph inView={inView} /> : <CheckGlyph inView={inView} />}
      </div>
      <div>
        <div className="mb-1 flex items-center gap-3">
          <span className="section-marker">step {index + 1}</span>
          {flagged ? (
            <span className="font-tabular text-[0.62rem] uppercase tracking-widest text-danger">
              discrepancy
            </span>
          ) : (
            <span className="font-tabular text-[0.62rem] uppercase tracking-widest text-success">
              matched
            </span>
          )}
        </div>
        <div
          className={`font-tabular text-sm ${flagged ? "text-danger" : "text-foreground"}`}
        >
          {step.figures}
        </div>
        <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-foreground/85">
          {step.text}
        </p>
      </div>
    </div>
  );
}

export function ReasoningTrace({
  issue = "refund-timing",
}: {
  issue?: IssueKind;
}) {
  const c = issueContent[issue];
  return (
    <div>
      {c.reasoning.map((s, i) => (
        <StepRow key={i} step={s} index={i} />
      ))}
      <div className="mt-8 grid gap-0 border border-rule bg-card sm:grid-cols-2">
        <div className="border-b border-rule px-5 py-4 sm:border-b-0 sm:border-r">
          <div className="section-marker mb-1">diagnosis</div>
          <p className="font-display text-lg leading-snug sm:text-xl">{c.diagnosis}</p>
        </div>
        <div className="px-5 py-4">
          <div className="section-marker mb-1">action</div>
          <p className="font-display text-lg leading-snug sm:text-xl">{c.action}</p>
        </div>
      </div>
    </div>
  );
}
