import { useTranslations } from "next-intl";
import { Compass } from "lucide-react";

import { Link } from "@/i18n/routing";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { Button } from "@/presentation/components/ui/button";

export default function NotFound() {
  const t = useTranslations("states");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <GymFlowLogo />

      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Compass className="size-6" />
      </span>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">{t("notFoundTitle")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t("notFoundBody")}</p>
      </div>

      <Button asChild>
        <Link href="/dashboard">{t("backToDashboard")}</Link>
      </Button>
    </main>
  );
}
