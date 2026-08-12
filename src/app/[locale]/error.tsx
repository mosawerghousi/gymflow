"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Link } from "@/i18n/routing";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { Button } from "@/presentation/components/ui/button";

/**
 * The catch-all for a Server Component that threw — most realistically a
 * database outage. Without this the user meets Next's raw error page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("states");
  const tCommon = useTranslations("common");

  useEffect(() => {
    console.error("[gymflow] render error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <GymFlowLogo />

      <span className="flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <AlertTriangle className="size-6" />
      </span>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">{t("appErrorTitle")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t("appErrorBody")}</p>
        {error.digest ? (
          <p className="font-mono text-2xs text-muted-foreground">
            {t("reference", { digest: error.digest })}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw /> {tCommon("retry")}
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/dashboard">{t("backToDashboard")}</Link>
        </Button>
      </div>
    </main>
  );
}
