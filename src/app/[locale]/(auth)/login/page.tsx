import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarRange, LineChart, ScanLine, Users } from "lucide-react";

import { auth } from "@/composition/auth";
import { Link, redirect } from "@/i18n/routing";
import { LanguageSwitcher } from "@/presentation/components/i18n/language-switcher";
import { LoginForm } from "@/presentation/components/auth/login-form";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { ThemeProvider } from "@/presentation/components/theme/theme-provider";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return { title: t("signInTitle"), description: t("signInSubtitle") };
}

const HIGHLIGHTS = [
  { icon: Users, key: "highlightMembers" },
  { icon: CalendarRange, key: "highlightSchedule" },
  { icon: LineChart, key: "highlightReports" },
  { icon: ScanLine, key: "highlightKiosk" },
] as const;

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();

  if (session?.user) {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <ThemeProvider forcedTheme="dark">
      <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel — typography-led, one accent, no hero imagery. */}
        <section className="relative hidden flex-col justify-between overflow-hidden border-e border-border bg-sidebar p-12 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 -end-40 size-[36rem] rounded-full bg-primary/[0.07] blur-3xl"
          />

          <GymFlowLogo wordmarkClassName="text-xl" iconClassName="size-8" />

          <div className="relative max-w-lg">
            <p className="text-2xl leading-tight font-semibold tracking-tight text-balance">
              {t("heroLine1")}
              <br />
              <span className="text-primary">{t("heroLine2")}</span>
            </p>
            <p className="mt-4 text-base text-muted-foreground">
              {t("heroBody")}
            </p>

            <ul className="mt-10 grid gap-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item.key} className="flex items-center gap-3 text-sm">
                  <item.icon className="size-4 shrink-0 text-primary" />
                  <span className="text-secondary-foreground">{t(item.key)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-muted-foreground">
            {t("builtWith")} ·{" "}
            <Link href="/kiosk" className="underline underline-offset-4 hover:text-primary">
              {t("openKiosk")}
            </Link>
          </p>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            {/* The switcher is on the public front door, not just behind login. */}
            <div className="mb-8 flex items-center justify-between gap-3">
              <GymFlowLogo className="lg:hidden" />
              <LanguageSwitcher className="ms-auto" />
            </div>

            <div className="mb-7 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{t("signInTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("signInSubtitle")}</p>
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
