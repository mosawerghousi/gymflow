import { inviteStaffSchema } from "@/application/dto/settings.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { created, ok, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const actor = await requireActor();

  return ok(await useCases.listStaff(actor));
});

export const POST = route(async (request: Request) => {
  const actor = await requireActor();
  const input = await parseBody(request, inviteStaffSchema);

  return created(await useCases.inviteStaff(actor, input));
});
