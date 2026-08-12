import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { SettingsScreen } from "@/presentation/components/settings/settings-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("settings") };
}
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const actor = await requireActor();
  actor.assertCan("settings:read");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />
      <SettingsScreen isDemoAccount={actor.isDemo} />
    </>
  );
}
