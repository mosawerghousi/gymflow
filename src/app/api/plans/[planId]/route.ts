import { updatePlanSchema } from "@/application/dto/settings.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ planId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { planId } = await params;
  const body = await parseBody(request, updatePlanSchema.omit({ planId: true }));

  return ok(await useCases.updatePlan(actor, { ...body, planId }));
});
