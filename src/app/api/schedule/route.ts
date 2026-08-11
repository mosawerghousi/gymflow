import { listScheduleSchema } from "@/application/dto/schedule.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

/** Shifts, sessions, pending swaps and the staff roster for one window. */
export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, listScheduleSchema);

  return ok(await useCases.getSchedule(actor, input));
});
