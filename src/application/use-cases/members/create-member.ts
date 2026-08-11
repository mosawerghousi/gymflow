import { AuditLogEntry } from "@/domain/entities/audit-log";
import { Member } from "@/domain/entities/member";
import type { User } from "@/domain/entities/user";
import { NotFoundError } from "@/domain/errors";
import { MemberCode } from "@/domain/value-objects/member-code";

import type { CreateMemberInput, MemberSummaryDto } from "../../dto/member.dto";
import { planNameMap, toMemberSummary } from "../../mappers/member.mapper";
import type {
  AuditLogRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface CreateMemberDeps {
  members: MemberRepository;
  plans: MembershipPlanRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Registers a new member and, when a plan is chosen, starts their first term
 * immediately.
 */
export function makeCreateMember(deps: CreateMemberDeps) {
  return async function createMember(
    actor: User,
    input: CreateMemberInput,
  ): Promise<MemberSummaryDto> {
    actor.assertCan("members:write");

    const now = deps.clock.now();
    const sequence = await deps.members.nextMemberSequence();

    const member = new Member({
      id: deps.ids.next(),
      code: MemberCode.fromSequence(sequence),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email?.toLowerCase() ?? null,
      phone: input.phone ?? null,
      planId: null,
      status: "expired",
      joinedAt: input.joinedAt ?? now,
      membershipStartsAt: null,
      membershipEndsAt: null,
      frozenAt: null,
      notes: input.notes ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const plans = await deps.plans.list({ includeInactive: true });

    if (input.planId) {
      const plan = plans.find((candidate) => candidate.id === input.planId);

      if (!plan) {
        throw new NotFoundError("Membership plan", input.planId);
      }

      member.renew({ planId: plan.id, durationDays: plan.durationDays, now });
    }

    await deps.members.create(member);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "member.created",
        entityType: "member",
        entityId: member.id,
        summary: `${actor.name} registered ${member.fullName} (${member.code.value}).`,
        metadata: { planId: member.planId },
        createdAt: now,
      }),
    );

    return toMemberSummary(member, { now, planNamesById: planNameMap(plans) });
  };
}
