import { z } from "zod";

import { updatePlanSchema } from "@/application/dto/settings.dto";
import { routeIdSchema } from "@/application/dto/common.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, parseParams, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ planId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { planId } = await parseParams(params, z.object({ planId: routeIdSchema }));
  const body = await parseBody(request, updatePlanSchema.omit({ planId: true }));

  return ok(await useCases.updatePlan(actor, { ...body, planId }));
});
