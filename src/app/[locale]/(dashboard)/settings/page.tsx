import type { Metadata } from "next";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { SettingsScreen } from "@/presentation/components/settings/settings-screen";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const actor = await requireActor();
  actor.assertCan("settings:read");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Plans, opening hours, kiosk devices and the team."
      />
      <SettingsScreen isDemoAccount={actor.isDemo} />
    </>
  );
}
