import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCw, AlertCircle, Plus, Settings2 } from "lucide-react";
import { checkXeroConnected, fetchMe, getXeroAuthorizeUrl, syncPayouts } from "@/lib/api";
import stripeLogo from "@/assets/stripe-logo.png.asset.json";
import xeroLogo from "@/assets/xero-logo.png.asset.json";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Connections · Reconciliation Agent" },
      {
        name: "description",
        content: "Connected accounts and providers powering the reconciliation agent.",
      },
    ],
  }),
  component: SourcesPage,
});

const tintMap = {
  stripe: "bg-tint-stripe",
  xero: "bg-tint-xero",
} as const;

const localLogo: Record<string, string> = {
  stripe: stripeLogo.url,
  xero: xeroLogo.url,
};

function ConnectedPill() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-success bg-success px-2 py-0.5 font-tabular text-[0.62rem] uppercase tracking-widest text-[color:var(--color-card)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-card)]" />
      connected
    </span>
  );
}

function DegradedPill() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-danger bg-danger px-2 py-0.5 font-tabular text-[0.62rem] uppercase tracking-widest text-[color:var(--color-card)]">
      <AlertCircle className="h-3 w-3" /> not connected
    </span>
  );
}

function Logo({ id, name }: { id: string; name: string }) {
  const src = localLogo[id];
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center border border-rule bg-background">
      {src ? (
        <img src={src} alt={`${name} logo`} className="h-7 w-7 object-contain" />
      ) : (
        <span className="font-tabular text-[0.7rem] uppercase">{name.slice(0, 2)}</span>
      )}
    </div>
  );
}

function SourcesPage() {
  const [xeroConnected, setXeroConnected] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
  });

  useEffect(() => {
    checkXeroConnected().then(setXeroConnected);
    const params = new URLSearchParams(window.location.search);
    if (params.get("xero") === "connected") {
      setNotice("Xero connected successfully.");
      setXeroConnected(true);
    }
  }, []);

  const syncMutation = useMutation({
    mutationFn: syncPayouts,
    onSuccess: () => setNotice("Stripe payout sync queued."),
  });

  const xeroMutation = useMutation({
    mutationFn: getXeroAuthorizeUrl,
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const connections = [
    {
      id: "stripe" as const,
      name: "Stripe",
      account: "Test mode · synced via backend",
      connected: true,
    },
    {
      id: "xero" as const,
      name: "Xero",
      account: meQuery.data?.email ?? "Connect your organisation",
      connected: xeroConnected === true,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="section-marker">workspace</div>
          <h1 className="mt-1 font-display text-2xl">Connections</h1>
        </div>
      </div>

      {notice ? (
        <div className="mb-4 border border-success/50 bg-success/[0.06] px-4 py-2 text-sm text-success">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {connections.map((s) => (
          <div key={s.id} className="ledger-card">
            <div
              className={`${tintMap[s.id]} flex items-center justify-between gap-3 border-b border-rule px-4 py-3`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Logo id={s.id} name={s.name} />
                <div className="min-w-0">
                  <div className="truncate font-display text-sm leading-tight">{s.name}</div>
                  <div className="font-tabular text-[0.68rem] text-muted-foreground">
                    {s.account}
                  </div>
                </div>
              </div>
              {s.connected ? <ConnectedPill /> : <DegradedPill />}
            </div>
            <div className="px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {s.id === "stripe" ? (
                  <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="inline-flex items-center gap-2 border border-rule bg-background px-3 py-2 font-tabular text-[0.68rem] uppercase tracking-widest hover:bg-muted disabled:opacity-60"
                  >
                    <RefreshCw className="h-3 w-3" />{" "}
                    {syncMutation.isPending ? "syncing…" : "sync payouts"}
                  </button>
                ) : (
                  <button
                    onClick={() => xeroMutation.mutate()}
                    disabled={xeroMutation.isPending}
                    className="inline-flex items-center gap-2 border border-accent bg-accent px-3 py-2 font-tabular text-[0.68rem] uppercase tracking-widest text-accent-foreground disabled:opacity-60"
                  >
                    <Plus className="h-3 w-3" />{" "}
                    {s.connected ? "reconnect" : "connect xero"}
                  </button>
                )}
                <button className="inline-flex items-center gap-2 border border-rule bg-background px-3 py-2 font-tabular text-[0.68rem] uppercase tracking-widest hover:bg-muted">
                  <Settings2 className="h-3 w-3" /> manage
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 mb-3 section-marker">llm integration</div>
      <div className="ledger-card max-w-xl">
        <div className="flex items-center justify-between gap-3 border-b border-rule bg-accent/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center border border-rule bg-background">
              <span className="font-display text-base">Λ</span>
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-sm leading-tight">LLM Provider</div>
              <div className="font-tabular text-[0.68rem] text-muted-foreground">
                Anthropic · claude-sonnet-4-6 (backend)
              </div>
            </div>
          </div>
          <ConnectedPill />
        </div>
      </div>
    </div>
  );
}
