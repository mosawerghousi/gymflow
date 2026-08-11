import { AuditLogEntry } from "@/domain/entities/audit-log";
import { Checkin, type CheckinMethod } from "@/domain/entities/checkin";
import type { Member } from "@/domain/entities/member";
import type { User } from "@/domain/entities/user";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { MemberCode } from "@/domain/value-objects/member-code";

import type { CheckInInput, CheckInResultDto } from "../../dto/checkin.dto";
import type {
  AuditLogRepository,
  CheckinRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface CheckInMemberDeps {
  members: MemberRepository;
  checkins: CheckinRepository;
  plans: MembershipPlanRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

/** Members are warned this many days before their term ends. */
const EXPIRY_WARNING_DAYS = 7;

/**
 * Front-desk check-in.
 *
 * The rule that an expired, frozen or cancelled member cannot enter lives on
 * the Member entity — this use case only orchestrates and records the decision.
 */
export function makeCheckInMember(deps: CheckInMemberDeps) {
  return async function checkInMember(
    actor: User,
    input: CheckInInput,
  ): Promise<CheckInResultDto> {
    actor.assertCan("checkins:write");

    const now = deps.clock.now();
    const member = await resolveMember(deps.members, input);

    const verdict = member.canCheckIn(now);

    if (!verdict.allowed) {
      throw new ConflictError(verdict.message, {
        reason: verdict.reason,
        memberId: member.id,
        memberCode: member.code.value,
        memberName: member.fullName,
      });
    }

    const existing = await deps.checkins.findOpenForMember(member.id);

    if (existing && !existing.isStale(now)) {
      return buildResult({
        outcome: "already_inside",
        checkin: existing,
        member,
        now,
        planName: await planNameFor(deps.plans, member),
      });
    }

    // A forgotten check-out from an earlier visit is closed before opening a new one.
    if (existing?.isStale(now)) {
      existing.checkOut(new Date(existing.checkedInAt.getTime() + 60 * 60_000));
      await deps.checkins.save(existing);
    }

    const checkin = Checkin.open({
      id: deps.ids.next(),
      memberId: member.id,
      method: input.method as CheckinMethod,
      at: now,
      recordedByUserId: actor.id,
    });

    await deps.checkins.create(checkin);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "checkin.created",
        entityType: "member",
        entityId: member.id,
        summary: `${member.fullName} checked in at the front desk.`,
        metadata: { method: input.method, checkinId: checkin.id },
        createdAt: now,
      }),
    );

    return buildResult({
      outcome: "checked_in",
      checkin,
      member,
      now,
      planName: await planNameFor(deps.plans, member),
    });
  };
}

export async function resolveMember(
  members: MemberRepository,
  input: { memberId?: string; memberCode?: string },
): Promise<Member> {
  if (input.memberId) {
    const byId = await members.findById(input.memberId);
    if (!byId) throw new NotFoundError("Member", input.memberId);
    return byId;
  }

  const code = MemberCode.create(input.memberCode ?? "");
  const byCode = await members.findByCode(code.value);

  if (!byCode) {
    throw new NotFoundError("Member", code.value);
  }

  return byCode;
}

async function planNameFor(
  plans: MembershipPlanRepository,
  member: Member,
): Promise<string | null> {
  if (!member.planId) return null;
  const plan = await plans.findById(member.planId);
  return plan?.name ?? null;
}

export function buildResult(params: {
  outcome: "checked_in" | "already_inside";
  checkin: Checkin;
  member: Member;
  now: Date;
  planName: string | null;
}): CheckInResultDto {
  const { checkin, member, now } = params;
  const daysUntilExpiry = member.daysUntilExpiry(now);
  const warnings: string[] = [];

  if (daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
    warnings.push(
      daysUntilExpiry === 0
        ? "Membership expires today — offer a renewal."
        : `Membership expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"} — offer a renewal.`,
    );
  }

  if (params.outcome === "already_inside") {
    warnings.push(`Already checked in ${checkin.durationMinutes(now)} minutes ago.`);
  }

  return {
    outcome: params.outcome,
    checkin: {
      id: checkin.id,
      memberId: member.id,
      memberCode: member.code.value,
      memberName: member.fullName,
      memberStatus: member.effectiveStatus(now),
      checkedInAt: checkin.checkedInAt.toISOString(),
      checkedOutAt: checkin.checkedOutAt?.toISOString() ?? null,
      method: checkin.method,
      durationMinutes: checkin.durationMinutes(now),
      isOpen: checkin.isOpen,
    },
    member: {
      id: member.id,
      code: member.code.value,
      fullName: member.fullName,
      status: member.effectiveStatus(now),
      planName: params.planName,
      membershipEndsAt: member.membershipEndsAt?.toISOString() ?? null,
      daysUntilExpiry,
    },
    warnings,
  };
}
