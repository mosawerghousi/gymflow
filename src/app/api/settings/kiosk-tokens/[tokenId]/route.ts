import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tokenId: string }> };

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { tokenId } = await params;

  return ok(await useCases.revokeKioskToken(actor, { tokenId }));
});
