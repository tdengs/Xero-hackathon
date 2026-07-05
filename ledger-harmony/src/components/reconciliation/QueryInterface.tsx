import { Search } from "lucide-react";
import { agentQuestion } from "@/lib/reconciliation-data";
import { useInView } from "@/hooks/use-in-view";
import { useTypewriter } from "@/hooks/use-typewriter";

export function QueryInterface() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { out, done } = useTypewriter(agentQuestion, inView, 28);

  return (
    <div ref={ref}>
      <label className="flex items-center gap-3 border border-dashed border-rule bg-card px-4 py-4">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          disabled
          placeholder="Ask the agent about this reconciliation."
          className="w-full bg-transparent font-tabular text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <span className="font-tabular text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          ⌘K
        </span>
      </label>

      <div className="mt-6 max-w-2xl border-l-2 border-accent bg-card/60 px-5 py-4">
        <div className="font-tabular text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          you
        </div>
        <p className="mt-1 font-tabular text-base text-foreground">
          {out}
          {!done ? <span className="caret" aria-hidden /> : null}
        </p>
      </div>
    </div>
  );
}
