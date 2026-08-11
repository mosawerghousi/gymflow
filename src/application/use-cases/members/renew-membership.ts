import { AuditLogEntry } from "@/domain/entities/audit-log";
import type { User } from "@/domain/entities/user";
import { ConflictError, NotFoundError } from "@/domain/errors";

import type { MemberSummaryDto, RenewMembershipInput } from "../../dto/member.dto";
import { planNameMap, toMemberSummary } from "../../mappers/member.mapper";
import type {
  AuditLogRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface RenewMembershipDeps {
  members: MemberRepository;
  plans: MembershipPlanRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Extends a membership by the plan's duration. Unused days are preserved: a
 * renewal on a term that still has time left stacks onto the existing end date
 * rather than restarting from today.
 */
export function makeRenewMembership(deps: RenewMembershipDeps) {
  return async function renewMembership(
    actor: User,
    input: RenewMembershipInput,
  ): Promise<MemberSummaryDto> {
    actor.assertCan("members:write");

    const [member, plan] = await Promise.all([
      deps.members.findById(input.memberId),
      deps.plans.findById(input.planId),
    ]);

    if (!member) throw new NotFoundError("Member", input.memberId);
    if (!plan) throw new NotFoundError("Membership plan", input.planId);

    if (!plan.isActive) {
      throw new ConflictError(`The "${plan.name}" plan is archived and cannot be sold.`, {
        planId: plan.id,
      });
    }

    const now = deps.clock.now();
    const previousEnd = member.membershipEndsAt;

    member.renew({ planId: plan.id, durationDays: plan.durationDays, now });

    await deps.members.save(member);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "member.renewed",
        entityType: "member",
        entityId: member.id,
        summary: `${actor.name} renewed the ${plan.name} plan through ${formatDate(member.membershipEndsAt)}.`,
        metadata: {
          planId: plan.id,
          durationDays: plan.durationDays,
          previousEndsAt: previousEnd?.toISOString() ?? null,
          newEndsAt: member.membershipEndsAt?.toISOString() ?? null,
        },
        createdAt: now,
      }),
    );

    const plans = await deps.plans.list({ includeInactive: true });

    return toMemberSummary(member, { now, planNamesById: planNameMap(plans) });
  };
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "—";
}
