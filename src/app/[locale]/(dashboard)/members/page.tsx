import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { MembersScreen } from "@/presentation/components/members/members-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("members") };
}
export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("members");
  const actor = await requireActor();
  actor.assertCan("members:read");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />
      <MembersScreen canWrite={actor.can("members:write")} />
    </>
  );
}
