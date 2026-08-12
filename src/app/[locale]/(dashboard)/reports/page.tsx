import type { Metadata } from "next";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { ReportsScreen } from "@/presentation/components/reports/reports-screen";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const actor = await requireActor();
  actor.assertCan("reports:read:limited");

  return (
    <>
      <PageHeader
        title="Reports"
        description="Membership, retention and traffic — every figure aggregated in SQL."
      />
      <ReportsScreen canSeeStaffHours={actor.can("reports:read:full")} />
    </>
  );
}
