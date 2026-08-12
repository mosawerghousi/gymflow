import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { ReportsScreen } from "@/presentation/components/reports/reports-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("reports") };
}
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reports");
  const actor = await requireActor();
  actor.assertCan("reports:read:limited");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />
      <ReportsScreen canSeeStaffHours={actor.can("reports:read:full")} />
    </>
  );
}
