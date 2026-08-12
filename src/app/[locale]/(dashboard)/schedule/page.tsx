import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { ScheduleScreen } from "@/presentation/components/schedule/schedule-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("schedule") };
}
export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("schedule");
  const actor = await requireActor();
  actor.assertCan("shifts:read:own");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />
      <ScheduleScreen
        currentUserId={actor.id}
        canManageShifts={actor.can("shifts:write")}
        canResolveSwaps={actor.can("shifts:swap:resolve")}
        canRequestSwap={actor.can("shifts:swap:request")}
        canBookSessions={actor.can("sessions:book")}
      />
    </>
  );
}
