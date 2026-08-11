import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { createMemberSchema, listMembersSchema } from "@/application/dto/member.dto";
import { created, ok, parseBody, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, listMembersSchema);

  return ok(await useCases.listMembers(actor, input));
});

export const POST = route(async (request: Request) => {
  const actor = await requireActor();
  const input = await parseBody(request, createMemberSchema);

  return created(await useCases.createMember(actor, input));
});
