import { AuditLogEntry } from "@/domain/entities/audit-log";
import type { User } from "@/domain/entities/user";
import { NotFoundError } from "@/domain/errors";

import type { MemberSummaryDto, UpdateMemberInput } from "../../dto/member.dto";
import { planNameMap, toMemberSummary } from "../../mappers/member.mapper";
import type {
  AuditLogRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface UpdateMemberDeps {
  members: MemberRepository;
  plans: MembershipPlanRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

export function makeUpdateMember(deps: UpdateMemberDeps) {
  return async function updateMember(
    actor: User,
    input: UpdateMemberInput,
  ): Promise<MemberSummaryDto> {
    actor.assertCan("members:write");

    const member = await deps.members.findById(input.memberId);

    if (!member) {
      throw new NotFoundError("Member", input.memberId);
    }

    const now = deps.clock.now();
    const changed: string[] = [];

    if (input.firstName !== undefined && input.firstName !== member.firstName) changed.push("first name");
    if (input.lastName !== undefined && input.lastName !== member.lastName) changed.push("last name");
    if (input.email !== undefined && (input.email ?? null) !== member.email) changed.push("email");
    if (input.phone !== undefined && (input.phone ?? null) !== member.phone) changed.push("phone");
    if (input.notes !== undefined && (input.notes ?? null) !== member.notes) changed.push("notes");

    member.updateProfile(
      {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email?.toLowerCase() ?? null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      },
      now,
    );

    await deps.members.save(member);

    if (changed.length > 0) {
      await deps.audit.append(
        new AuditLogEntry({
          id: deps.ids.next(),
          actorUserId: actor.id,
          action: "member.updated",
          entityType: "member",
          entityId: member.id,
          summary: `${actor.name} updated ${changed.join(", ")}.`,
          metadata: { changed },
          createdAt: now,
        }),
      );
    }

    const plans = await deps.plans.list({ includeInactive: true });

    return toMemberSummary(member, { now, planNamesById: planNameMap(plans) });
  };
}
