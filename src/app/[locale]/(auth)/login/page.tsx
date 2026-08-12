import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarRange, LineChart, ScanLine, Users } from "lucide-react";

import { auth } from "@/composition/auth";
import { LoginForm } from "@/presentation/components/auth/login-form";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { ThemeProvider } from "@/presentation/components/theme/theme-provider";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to GymFlow, or try the public demo as admin, staff, or trainer.",
};

const HIGHLIGHTS = [
  { icon: Users, label: "Members & check-ins" },
  { icon: CalendarRange, label: "Staff & trainer scheduling" },
  { icon: LineChart, label: "Reports that mean something" },
  { icon: ScanLine, label: "Self-service kiosk" },
];

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <ThemeProvider forcedTheme="dark">
      <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel — typography-led, one accent, no hero imagery. */}
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-12 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 -right-40 size-[36rem] rounded-full bg-primary/[0.07] blur-3xl"
          />

          <GymFlowLogo wordmarkClassName="text-xl" iconClassName="size-8" />

          <div className="relative max-w-lg">
            <p className="text-2xl leading-tight font-semibold tracking-tight text-balance">
              Everything the front desk needs,
              <br />
              <span className="text-primary">in one flow.</span>
            </p>
            <p className="mt-4 text-base text-muted-foreground">
              A single-location gym runs on three questions: who is in, who is working, and who
              is slipping away. GymFlow answers all three on one screen.
            </p>

            <ul className="mt-10 grid gap-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-sm">
                  <item.icon className="size-4 shrink-0 text-primary" />
                  <span className="text-secondary-foreground">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-muted-foreground">
            Next.js 15 · Redux Toolkit · Drizzle · Postgres ·{" "}
            <Link href="/kiosk" className="underline underline-offset-4 hover:text-primary">
              Open kiosk mode
            </Link>
          </p>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-10 lg:hidden">
              <GymFlowLogo />
            </div>

            <div className="mb-7 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">Sign in to GymFlow</h1>
              <p className="text-sm text-muted-foreground">
                Use your staff account, or jump into the demo.
              </p>
            </div>

            <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-xl" />}>
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </main>
    </ThemeProvider>
  );
}
