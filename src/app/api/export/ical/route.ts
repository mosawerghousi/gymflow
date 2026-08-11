import { z } from "zod";

import { dateSchema } from "@/application/dto/common.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { fileResponse, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  mine: z.coerce.boolean().default(false),
});

export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, querySchema);
  const file = await useCases.exportScheduleICal(actor, input);

  return fileResponse(file.content, file.filename, "text/calendar; charset=utf-8");
});
