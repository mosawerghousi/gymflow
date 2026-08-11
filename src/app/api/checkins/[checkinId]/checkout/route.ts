import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ checkinId: string }> };

export const POST = route(async (_request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { checkinId } = await params;

  return ok(await useCases.checkOut(actor, { checkinId }));
});
