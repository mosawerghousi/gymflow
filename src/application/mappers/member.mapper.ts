import type { Member } from "@/domain/entities/member";
import type { MembershipPlan } from "@/domain/entities/membership-plan";

import type { MemberDetailDto, MemberSummaryDto } from "../dto/member.dto";

export interface MemberMappingContext {
  now: Date;
  planNamesById: ReadonlyMap<string, string>;
  lastVisitByMemberId?: Readonly<Record<string, Date>>;
}

export function toMemberSummary(member: Member, ctx: MemberMappingContext): MemberSummaryDto {
  const lastVisit = ctx.lastVisitByMemberId?.[member.id] ?? null;

  return {
    id: member.id,
    code: member.code.value,
    firstName: member.firstName,
    lastName: member.lastName,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    planId: member.planId,
    planName: member.planId ? (ctx.planNamesById.get(member.planId) ?? null) : null,
    status: member.effectiveStatus(ctx.now),
    joinedAt: member.joinedAt.toISOString(),
    membershipEndsAt: member.membershipEndsAt?.toISOString() ?? null,
    daysUntilExpiry: member.daysUntilExpiry(ctx.now),
    lastVisitAt: lastVisit ? lastVisit.toISOString() : null,
    isDeleted: member.isDeleted,
  };
}

export function toMemberDetail(
  member: Member,
  ctx: MemberMappingContext & { totalVisits: number; visitsLast30Days: number },
): MemberDetailDto {
  const snapshot = member.snapshot();

  return {
    ...toMemberSummary(member, ctx),
    notes: member.notes,
    membershipStartsAt: member.membershipStartsAt?.toISOString() ?? null,
    frozenAt: member.frozenAt?.toISOString() ?? null,
    totalVisits: ctx.totalVisits,
    visitsLast30Days: ctx.visitsLast30Days,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function planNameMap(plans: readonly MembershipPlan[]): Map<string, string> {
  return new Map(plans.map((plan) => [plan.id, plan.name]));
}
