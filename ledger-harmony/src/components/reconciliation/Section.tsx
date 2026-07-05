import type { ReactNode } from "react";
import { useInView } from "@/hooks/use-in-view";

type Props = {
  number: string;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
};

export function Section({ number, eyebrow, title, children }: Props) {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section
      ref={ref}
      className={`mx-auto max-w-5xl px-5 py-20 transition-all duration-700 ease-out sm:py-28 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="mb-10 flex items-baseline gap-4">
        <span className="font-tabular text-xs text-muted-foreground">§ {number}</span>
        <span className="section-marker">{eyebrow}</span>
      </div>
      <h2 className="mb-8 max-w-3xl text-3xl leading-tight sm:text-4xl md:text-5xl">
        {title}
      </h2>
      <WobbleRule />
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function WobbleRule() {
  return (
    <svg
      viewBox="0 0 1000 6"
      preserveAspectRatio="none"
      className="h-[6px] w-full text-rule"
      aria-hidden
    >
      <path
        d="M0 3 Q 60 1.4, 120 3 T 240 3 T 360 3 T 480 3 T 600 3 T 720 3 T 840 3 T 1000 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
