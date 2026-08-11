import { z } from "zod";

import { updateMemberSchema } from "@/application/dto/member.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { ok, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

export const GET = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { memberId } = await params;
  const days = Number(new URL(request.url).searchParams.get("days") ?? 90);

  return ok(
    await useCases.getMember(actor, {
      memberId,
      attendanceDays: Number.isFinite(days) ? days : 90,
    }),
  );
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { memberId } = await params;
  const body = await parseBody(request, updateMemberSchema.omit({ memberId: true }));

  return ok(await useCases.updateMember(actor, { ...body, memberId }));
});

export const DELETE = route(async (request: Request, { params }: Params) => {
  const actor = await requireActor();
  const { memberId } = await params;
  const restore = z.coerce
    .boolean()
    .parse(new URL(request.url).searchParams.get("restore") ?? false);

  return ok(await useCases.deleteMember(actor, { memberId, restore }));
});
