import { z } from "zod";

import { routeIdSchema } from "@/application/dto/common.dto";
import { requireActor } from "@/composition/auth";
import { container } from "@/composition/container";
import { NotFoundError } from "@/domain/errors";
import { ok, parseParams, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

/** The QR payload printed on a member card; the kiosk scanner reads it back. */
export const GET = route(async (_request: Request, { params }: Params) => {
  const actor = await requireActor();
  actor.assertCan("members:read");

  const { memberId } = await parseParams(params, z.object({ memberId: routeIdSchema }));
  const member = await container.members.findById(memberId);

  if (!member) throw new NotFoundError("Member", memberId);

  const payload = member.code.value;

  return ok({ payload, svg: await container.qr.toSvg(payload, { size: 260 }) });
});
