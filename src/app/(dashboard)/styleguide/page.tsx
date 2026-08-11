import type { Metadata } from "next";

import { requireActor } from "@/composition/auth";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { Styleguide } from "@/presentation/components/styleguide/styleguide";

export const metadata: Metadata = { title: "Style guide" };
export const dynamic = "force-dynamic";

/** Internal reference for the design system. Admin-only. */
export default async function StyleguidePage() {
  const actor = await requireActor();
  actor.assertCan("settings:read");

  return (
    <>
      <PageHeader
        title="Style guide"
        description="Every token and primitive the app is built from. If something drifts, it shows here first."
      />
      <Styleguide />
    </>
  );
}
