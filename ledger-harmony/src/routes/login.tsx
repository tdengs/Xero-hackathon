import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login, register } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [{ title: "Sign in · Reconciliation Agent" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    },
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md ledger-card p-8">
        <div className="section-marker mb-2">paytrace ai</div>
        <h1 className="text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect to your Stripe and Xero data through the reconciliation backend.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            authMutation.mutate();
          }}
        >
          <label className="block">
            <span className="section-marker">email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-rule bg-background px-3 py-2 font-tabular text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="block">
            <span className="section-marker">password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full border border-rule bg-background px-3 py-2 font-tabular text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          {error ? (
            <p className="border border-danger/50 bg-danger/[0.06] px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={authMutation.isPending}
            className="w-full border border-accent bg-accent px-4 py-2 font-tabular text-[0.72rem] uppercase tracking-widest text-accent-foreground shadow-[0_3px_0_0_rgba(28,43,42,0.15)] disabled:opacity-60"
          >
            {authMutation.isPending
              ? "please wait…"
              : mode === "login"
                ? "sign in"
                : "create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          className="mt-4 font-tabular text-[0.72rem] uppercase tracking-widest text-accent hover:underline"
        >
          {mode === "login" ? "need an account? register" : "already have an account? sign in"}
        </button>
      </div>
    </div>
  );
}
