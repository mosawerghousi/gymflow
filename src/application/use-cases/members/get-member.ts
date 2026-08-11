import type { User } from "@/domain/entities/user";
import { NotFoundError } from "@/domain/errors";
import { addDays } from "@/domain/value-objects/date-range";

import type { MemberDetailDto } from "../../dto/member.dto";
import { planNameMap, toMemberDetail } from "../../mappers/member.mapper";
import type {
  AuditLogRepository,
  CheckinRepository,
  DailyCount,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock } from "../../ports/services";

export interface GetMemberDeps {
  members: MemberRepository;
  plans: MembershipPlanRepository;
  checkins: CheckinRepository;
  audit: AuditLogRepository;
  clock: Clock;
}

export interface MemberProfileDto {
  member: MemberDetailDto;
  attendance: DailyCount[];
  auditTrail: Array<{
    id: string;
    action: string;
    summary: string;
    createdAt: string;
  }>;
  isInsideNow: boolean;
}

/** The member profile screen: details, attendance chart data, and audit trail. */
export function makeGetMember(deps: GetMemberDeps) {
  return async function getMember(
    actor: User,
    input: { memberId: string; attendanceDays?: number },
  ): Promise<MemberProfileDto> {
    actor.assertCan("members:read");

    const member = await deps.members.findById(input.memberId);

    if (!member) {
      throw new NotFoundError("Member", input.memberId);
    }

    const now = deps.clock.now();
    const attendanceDays = input.attendanceDays ?? 90;
    const attendanceFrom = addDays(now, -attendanceDays);

    const [plans, attendance, totalVisits, visitsLast30Days, auditTrail, openVisit] =
      await Promise.all([
        deps.plans.list({ includeInactive: true }),
        deps.checkins.dailyCountsForMember(member.id, attendanceFrom, now),
        deps.checkins.countForMember(member.id),
        deps.checkins.countForMember(member.id, addDays(now, -30)),
        deps.audit.listForEntity("member", member.id, 25),
        deps.checkins.findOpenForMember(member.id),
      ]);

    return {
      member: toMemberDetail(member, {
        now,
        planNamesById: planNameMap(plans),
        totalVisits,
        visitsLast30Days,
      }),
      attendance,
      auditTrail: auditTrail.map((entry) => ({
        id: entry.id,
        action: entry.action,
        summary: entry.summary,
        createdAt: entry.createdAt.toISOString(),
      })),
      isInsideNow: openVisit !== null && !openVisit.isStale(now),
    };
  };
}
