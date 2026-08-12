import { z } from "zod";

import { routeIdSchema } from "@/application/dto/common.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseParams, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tokenId: string }> };

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { tokenId } = await parseParams(params, z.object({ tokenId: routeIdSchema }));

  return ok(await useCases.revokeKioskToken(actor, { tokenId }));
});
