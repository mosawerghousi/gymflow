import { updateOperatingHoursSchema } from "@/application/dto/settings.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const actor = await requireActor();

  return ok(await useCases.getOperatingHours(actor));
});

export const PUT = route(async (request: Request) => {
  const actor = await requireActor();
  const input = await parseBody(request, updateOperatingHoursSchema);

  return ok(await useCases.updateOperatingHours(actor, input));
});
