import { z } from "zod";

import { updateShiftSchema } from "@/application/dto/schedule.dto";
import { routeIdSchema } from "@/application/dto/common.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, parseParams, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ shiftId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { shiftId } = await parseParams(params, z.object({ shiftId: routeIdSchema }));
  const body = await parseBody(request, updateShiftSchema.omit({ shiftId: true }));

  return ok(await useCases.updateShift(actor, { ...body, shiftId }));
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { shiftId } = await parseParams(params, z.object({ shiftId: routeIdSchema }));

  return ok(await useCases.cancelShift(actor, { shiftId }));
});
