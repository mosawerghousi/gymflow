import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MonitorSmartphone } from "lucide-react";

import { requireActor } from "@/composition/auth";
import { CheckInDesk } from "@/presentation/components/checkin/check-in-desk";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { Button } from "@/presentation/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("checkin") };
}
export const dynamic = "force-dynamic";

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("checkin");
  const tNav = await getTranslations("nav");
  const actor = await requireActor();
  actor.assertCan("checkins:write");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/kiosk" target="_blank">
              <MonitorSmartphone /> {tNav("kiosk")}
            </Link>
          </Button>
        }
      />
      <CheckInDesk />
    </>
  );
}
