"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/presentation/lib/demo";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(credentials: { email: string; password: string }) {
    setError(null);

    const result = await signIn("credentials", {
      ...credentials,
      redirect: false,
    });

    if (!result || result.error) {
      setError("That email and password combination did not match an account.");
      setPendingRole(null);
      return;
    }

    toast.success("Welcome back to GymFlow");
    startTransition(() => {
      router.push(callbackUrl);
      router.refresh();
    });
  }

  /** One-click demo login: fills the form, then submits it (spec §6). */
  async function loginAs(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setPendingRole(account.role);
    await submit({ email: account.email, password: account.password });
  }

  const busy = isPending || pendingRole !== null;

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPendingRole("form");
          void submit({ email, password });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@gymflow.demo"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={busy}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {pendingRole === "form" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LogIn />
          )}
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-card px-3 text-muted-foreground">Try the demo</span>
        </div>
      </div>

      <Card className="border-primary/25 bg-primary/[0.04]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Public demo — pick a role and you are straight in. Every account uses the
              password{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                {DEMO_PASSWORD}
              </code>
              .
            </p>
          </div>

          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => void loginAs(account)}
                disabled={busy}
                className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                  {account.label.slice(0, 2).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    Login as {account.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.email} · {account.blurb}
                  </span>
                </span>

                {pendingRole === account.role ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
