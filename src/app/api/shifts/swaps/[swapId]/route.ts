import { resolveSwapSchema } from "@/application/dto/schedule.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ swapId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { swapId } = await params;
  const raw = await request.json().catch(() => ({}));
  const input = resolveSwapSchema.parse({ ...raw, swapRequestId: swapId });

  return ok(await useCases.resolveShiftSwap(actor, input));
});
