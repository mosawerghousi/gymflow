import type { Metadata } from "next";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";

import { requireActor } from "@/composition/auth";
import { CheckInDesk } from "@/presentation/components/checkin/check-in-desk";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { Button } from "@/presentation/components/ui/button";

export const metadata: Metadata = { title: "Check-in desk" };
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const actor = await requireActor();
  actor.assertCan("checkins:write");

  return (
    <>
      <PageHeader
        title="Check-in desk"
        description="Find a member and check them in. Expired and frozen memberships are blocked with a reason."
        actions={
          <Button asChild variant="outline">
            <Link href="/kiosk" target="_blank">
              <MonitorSmartphone /> Kiosk mode
            </Link>
          </Button>
        }
      />
      <CheckInDesk />
    </>
  );
}
