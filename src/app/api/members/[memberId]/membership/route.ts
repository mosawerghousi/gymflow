import { z } from "zod";

import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("renew"), planId: z.string().uuid() }),
  z.object({ action: z.enum(["freeze", "unfreeze", "cancel"]) }),
]);

type Params = { params: Promise<{ memberId: string }> };

/** One endpoint for every membership state change the profile screen offers. */
export const POST = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { memberId } = await params;
  const body = await parseBody(request, bodySchema);

  if (body.action === "renew") {
    return ok(await useCases.renewMembership(actor, { memberId, planId: body.planId }));
  }

  return ok(await useCases.changeMembershipStatus(actor, { memberId, action: body.action }));
});
