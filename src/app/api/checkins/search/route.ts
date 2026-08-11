import { searchMembersForDeskSchema } from "@/application/dto/checkin.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, searchMembersForDeskSchema);

  return ok(await useCases.searchMembersForDesk(actor, input));
});
