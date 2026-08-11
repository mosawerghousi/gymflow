import { createShiftSchema } from "@/application/dto/schedule.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { created, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const actor = await requireActor();
  const input = await parseBody(request, createShiftSchema);

  return created(await useCases.createShift(actor, input));
});
