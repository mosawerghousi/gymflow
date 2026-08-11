import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarRange, LineChart, ScanLine, Users } from "lucide-react";

import { auth } from "@/composition/auth";
import { LoginForm } from "@/presentation/components/auth/login-form";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to GymFlow, or try the public demo as admin, staff, or trainer.",
};

const HIGHLIGHTS = [
  { icon: Users, title: "Members & check-ins", body: "Rapid front-desk search, one-click entry, expired-plan warnings." },
  { icon: ScanLine, title: "Kiosk mode", body: "A fullscreen self-service screen with code entry and QR scanning." },
  { icon: CalendarRange, title: "Scheduling", body: "Drag out shifts, approve swaps, book trainers against real availability." },
  { icon: LineChart, title: "Reports", body: "Churn, sign-ups, busiest hours, at-risk members — aggregated in SQL." },
];

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden border-r border-border bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-32 size-[32rem] rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative">
          <GymFlowLogo wordmarkClassName="text-2xl" iconClassName="size-10" />
          <p className="mt-8 max-w-md text-3xl font-semibold leading-tight tracking-tight text-balance">
            Everything the front desk needs, in one flow.
          </p>
          <p className="mt-3 max-w-md text-muted-foreground">
            Members, check-ins, staff scheduling and analytics for a single-location gym.
          </p>
        </div>

        <ul className="relative mt-12 grid gap-5">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <item.icon className="size-4.5" />
              </span>
              <span>
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-sm text-muted-foreground">{item.body}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="relative text-xs text-muted-foreground">
          Built with Next.js 15, Redux Toolkit, Drizzle and Postgres ·{" "}
          <Link href="/kiosk" className="underline underline-offset-4 hover:text-primary">
            Open kiosk mode
          </Link>
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <GymFlowLogo />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Sign in to GymFlow</h1>
          <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
            Use your staff account, or jump straight into the demo below.
          </p>

          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
