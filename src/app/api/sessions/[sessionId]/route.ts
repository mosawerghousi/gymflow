import { z } from "zod";

import { updateSessionSchema } from "@/application/dto/schedule.dto";
import { routeIdSchema } from "@/application/dto/common.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, parseParams, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { sessionId } = await parseParams(params, z.object({ sessionId: routeIdSchema }));
  const body = await parseBody(request, updateSessionSchema.omit({ sessionId: true }));

  return ok(await useCases.updateTrainerSession(actor, { ...body, sessionId }));
});
