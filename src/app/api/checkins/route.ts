import { checkInSchema, listCheckinsSchema } from "@/application/dto/checkin.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { created, ok, parseBody, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, listCheckinsSchema);

  return ok(await useCases.listCheckins(actor, input));
});

export const POST = route(async (request: Request) => {
  const actor = await requireActor();
  const input = await parseBody(request, checkInSchema);

  return created(await useCases.checkInMember(actor, input));
});
