import { AuditLogEntry, type AuditAction } from "@/domain/entities/audit-log";
import type { User } from "@/domain/entities/user";
import { NotFoundError } from "@/domain/errors";

import type { ChangeMembershipStatusInput, MemberSummaryDto } from "../../dto/member.dto";
import { planNameMap, toMemberSummary } from "../../mappers/member.mapper";
import type {
  AuditLogRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface ChangeMembershipStatusDeps {
  members: MemberRepository;
  plans: MembershipPlanRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

const AUDIT_ACTIONS: Record<ChangeMembershipStatusInput["action"], AuditAction> = {
  freeze: "member.frozen",
  unfreeze: "member.unfrozen",
  cancel: "member.cancelled",
};

const VERBS: Record<ChangeMembershipStatusInput["action"], string> = {
  freeze: "froze",
  unfreeze: "unfroze",
  cancel: "cancelled",
};

/** Freeze / unfreeze / cancel. The legal transitions are enforced by the entity. */
export function makeChangeMembershipStatus(deps: ChangeMembershipStatusDeps) {
  return async function changeMembershipStatus(
    actor: User,
    input: ChangeMembershipStatusInput,
  ): Promise<MemberSummaryDto> {
    actor.assertCan("members:write");

    const member = await deps.members.findById(input.memberId);

    if (!member) {
      throw new NotFoundError("Member", input.memberId);
    }

    const now = deps.clock.now();
    const previousStatus = member.effectiveStatus(now);

    if (input.action === "freeze") member.freeze(now);
    else if (input.action === "unfreeze") member.unfreeze(now);
    else member.cancel(now);

    await deps.members.save(member);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: AUDIT_ACTIONS[input.action],
        entityType: "member",
        entityId: member.id,
        summary: `${actor.name} ${VERBS[input.action]} this membership.`,
        metadata: {
          from: previousStatus,
          to: member.status,
          membershipEndsAt: member.membershipEndsAt?.toISOString() ?? null,
        },
        createdAt: now,
      }),
    );

    const plans = await deps.plans.list({ includeInactive: true });

    return toMemberSummary(member, { now, planNamesById: planNameMap(plans) });
  };
}
