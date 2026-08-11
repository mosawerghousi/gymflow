import { bookSessionSchema } from "@/application/dto/schedule.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { created, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const actor = await requireActor();
  const input = await parseBody(request, bookSessionSchema);

  return created(await useCases.bookTrainerSession(actor, input));
});
