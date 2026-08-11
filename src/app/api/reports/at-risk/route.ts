import { atRiskSchema } from "@/application/dto/report.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

/** Members with a live plan who have not visited recently. */
export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, atRiskSchema);

  return ok(
    await useCases.getAtRiskMembers(actor, {
      inactiveDays: input.inactiveDays,
      limit: input.limit,
    }),
  );
});
