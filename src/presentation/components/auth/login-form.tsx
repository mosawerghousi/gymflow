"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/presentation/lib/demo";
import { cn } from "@/presentation/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [isRouting, startTransition] = useTransition();

  async function submit(credentials: { email: string; password: string }) {
    setError(null);

    const result = await signIn("credentials", { ...credentials, redirect: false });

    if (!result || result.error) {
      setError("That email and password combination did not match an account.");
      setPending(null);
      return;
    }

    toast.success("Welcome back to GymFlow");
    startTransition(() => {
      router.push(callbackUrl);
      router.refresh();
    });
  }

  /** One click: fill the form, then submit it. */
  async function loginAs(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setPending(account.role);
    await submit({ email: account.email, password: account.password });
  }

  const busy = isRouting || pending !== null;

  return (
    <div className="space-y-8">
      {/* The demo card leads — this is the public front door. */}
      <section
        aria-labelledby="demo-heading"
        className="overflow-hidden rounded-xl border border-primary/25 bg-surface-1"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="demo-heading" className="text-sm font-semibold">
              Try the demo
            </h2>
            <p className="text-xs text-muted-foreground">
              Pick a role — you are straight in, no typing.
            </p>
          </div>
          <span className="rounded-md bg-brand-subtle px-2 py-1 text-2xs font-medium tracking-wide text-primary uppercase">
            Live data
          </span>
        </div>

        <div className="divide-y divide-border">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.role}
              type="button"
              onClick={() => void loginAs(account)}
              disabled={busy}
              className={cn(
                "group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-150",
                "hover:bg-surface-2 disabled:opacity-60",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-primary">
                {account.label.slice(0, 2).toUpperCase()}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Login as {account.label}</span>
                {/* The address is shown, not just implied — the spec requires the
                    credentials to be readable for anyone signing in manually. */}
                <span className="block truncate text-xs text-muted-foreground">
                  <span className="font-mono">{account.email}</span> · {account.blurb}
                </span>
              </span>

              {pending === account.role ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              ) : (
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
              )}
            </button>
          ))}
        </div>

        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Or sign in manually — every demo account uses{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-foreground">
            {DEMO_PASSWORD}
          </code>
        </p>
      </section>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPending("form");
          void submit({ email, password });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@gymflow.demo"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            required
            disabled={busy}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {pending === "form" ? <Loader2 className="animate-spin" /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </div>
  );
}
