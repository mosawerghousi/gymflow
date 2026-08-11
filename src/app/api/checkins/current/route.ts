import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

/** Live "currently in gym" roster and counter. */
export const GET = route(async () => {
  const actor = await requireActor();

  return ok(await useCases.getCurrentlyInGym(actor));
});
