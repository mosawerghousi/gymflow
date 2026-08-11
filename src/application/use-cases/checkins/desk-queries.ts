import { MAX_VISIT_HOURS } from "@/domain/entities/checkin";
import type { User } from "@/domain/entities/user";
import { NotFoundError } from "@/domain/errors";
import { addDays } from "@/domain/value-objects/date-range";

import type {
  CheckinDto,
  CurrentlyInGymDto,
  DeskSearchResultDto,
} from "../../dto/checkin.dto";
import type {
  CheckinRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock } from "../../ports/services";

export interface DeskQueryDeps {
  members: MemberRepository;
  checkins: CheckinRepository;
  plans: MembershipPlanRepository;
  clock: Clock;
}

/** Rapid front-desk search: name, member code, email or phone. */
export function makeSearchMembersForDesk(deps: DeskQueryDeps) {
  return async function searchMembersForDesk(
    actor: User,
    input: { query: string; limit: number },
  ): Promise<DeskSearchResultDto[]> {
    actor.assertCan("checkins:read");

    const now = deps.clock.now();

    if (input.query.trim().length === 0) {
      return [];
    }

    const [matches, plans, openVisits] = await Promise.all([
      deps.members.search(input.query.trim(), input.limit),
      deps.plans.list({ includeInactive: true }),
      deps.checkins.listOpen(new Date(now.getTime() - MAX_VISIT_HOURS * 3_600_000)),
    ]);

    const planNames = new Map(plans.map((plan) => [plan.id, plan.name]));
    const insideMemberIds = new Set(openVisits.map((visit) => visit.memberId));
    const lastVisits = await deps.checkins.lastVisitForMembers(matches.map((m) => m.id));

    return matches.map((member) => {
      const verdict = member.canCheckIn(now);

      return {
        id: member.id,
        code: member.code.value,
        fullName: member.fullName,
        status: member.effectiveStatus(now),
        planName: member.planId ? (planNames.get(member.planId) ?? null) : null,
        membershipEndsAt: member.membershipEndsAt?.toISOString() ?? null,
        isInsideNow: insideMemberIds.has(member.id),
        lastVisitAt: lastVisits[member.id]?.toISOString() ?? null,
        canCheckIn: verdict.allowed,
        blockedReason: verdict.allowed ? null : verdict.message,
      };
    });
  };
}

/** The live "currently in gym" counter and roster. */
export function makeGetCurrentlyInGym(deps: DeskQueryDeps) {
  return async function getCurrentlyInGym(actor: User): Promise<CurrentlyInGymDto> {
    actor.assertCan("checkins:read");

    const now = deps.clock.now();
    const since = new Date(now.getTime() - MAX_VISIT_HOURS * 3_600_000);
    const openVisits = await deps.checkins.listOpen(since);
    const members = await deps.members.findByIds(openVisits.map((visit) => visit.memberId));
    const membersById = new Map(members.map((member) => [member.id, member]));

    const visitors = openVisits
      .map((visit) => {
        const member = membersById.get(visit.memberId);
        if (!member) return null;

        return {
          checkinId: visit.id,
          memberId: member.id,
          memberCode: member.code.value,
          fullName: member.fullName,
          checkedInAt: visit.checkedInAt.toISOString(),
          minutesInside: visit.durationMinutes(now),
        };
      })
      .filter((visitor): visitor is NonNullable<typeof visitor> => visitor !== null)
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));

    return { count: visitors.length, visitors };
  };
}

/** Recent check-in feed for the desk and the member profile. */
export function makeListCheckins(deps: DeskQueryDeps) {
  return async function listCheckins(
    actor: User,
    input: { memberId?: string; from?: Date; to?: Date; limit: number },
  ): Promise<CheckinDto[]> {
    actor.assertCan("checkins:read");

    const now = deps.clock.now();

    const visits = await deps.checkins.list({
      memberId: input.memberId,
      from: input.from ?? addDays(now, -1),
      to: input.to ?? now,
      limit: input.limit,
    });

    const members = await deps.members.findByIds(visits.map((visit) => visit.memberId));
    const membersById = new Map(members.map((member) => [member.id, member]));

    return visits.flatMap((visit) => {
      const member = membersById.get(visit.memberId);
      if (!member) return [];

      return [
        {
          id: visit.id,
          memberId: member.id,
          memberCode: member.code.value,
          memberName: member.fullName,
          memberStatus: member.effectiveStatus(now),
          checkedInAt: visit.checkedInAt.toISOString(),
          checkedOutAt: visit.checkedOutAt?.toISOString() ?? null,
          method: visit.method,
          durationMinutes: visit.durationMinutes(now),
          isOpen: visit.isOpen,
        },
      ];
    });
  };
}

/** Closes an open visit. */
export function makeCheckOut(deps: DeskQueryDeps) {
  return async function checkOut(
    actor: User,
    input: { checkinId: string },
  ): Promise<{ checkinId: string; checkedOutAt: string; durationMinutes: number }> {
    actor.assertCan("checkins:write");

    const visit = await deps.checkins.findById(input.checkinId);

    if (!visit) {
      throw new NotFoundError("Check-in", input.checkinId);
    }

    const now = deps.clock.now();

    visit.checkOut(now);
    await deps.checkins.save(visit);

    return {
      checkinId: visit.id,
      checkedOutAt: now.toISOString(),
      durationMinutes: visit.durationMinutes(now),
    };
  };
}
