import { trainerAvailabilitySchema } from "@/application/dto/schedule.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

/** Bookable slots derived from the trainer's shifts minus existing sessions. */
export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, trainerAvailabilitySchema);

  return ok(await useCases.getTrainerAvailability(actor, input));
});
