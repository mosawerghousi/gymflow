import type { Metadata } from "next";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { ScheduleScreen } from "@/presentation/components/schedule/schedule-screen";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const actor = await requireActor();
  actor.assertCan("shifts:read:own");

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Weekly roster, trainer sessions and swap requests. Overlapping shifts are refused."
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
