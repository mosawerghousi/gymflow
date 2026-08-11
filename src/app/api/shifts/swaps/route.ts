import { z } from "zod";

import { requestSwapSchema } from "@/application/dto/schedule.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { created, ok, parseBody, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

const listSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled", "all"]).default("pending"),
});

export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const { status } = parseQuery(request, listSchema);

  return ok(await useCases.listSwapRequests(actor, { status }));
});

export const POST = route(async (request: Request) => {
  const actor = await requireActor();
  const input = await parseBody(request, requestSwapSchema);

  return created(await useCases.requestShiftSwap(actor, input));
});
