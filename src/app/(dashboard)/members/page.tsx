import type { Metadata } from "next";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { MembersScreen } from "@/presentation/components/members/members-screen";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const actor = await requireActor();
  actor.assertCan("members:read");

  return (
    <>
      <PageHeader
        title="Members"
        description="Search, filter and manage everyone on the books."
      />
      <MembersScreen canWrite={actor.can("members:write")} />
    </>
  );
}
