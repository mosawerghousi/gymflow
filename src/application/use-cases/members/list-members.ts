import type { User } from "@/domain/entities/user";

import type { ListMembersInput, MemberListDto } from "../../dto/member.dto";
import { planNameMap, toMemberSummary } from "../../mappers/member.mapper";
import type {
  CheckinRepository,
  MemberRepository,
  MembershipPlanRepository,
} from "../../ports/repositories";
import type { Clock } from "../../ports/services";

export interface ListMembersDeps {
  members: MemberRepository;
  plans: MembershipPlanRepository;
  checkins: CheckinRepository;
  clock: Clock;
}

/** Paginated, searchable member list for the members screen. */
export function makeListMembers(deps: ListMembersDeps) {
  return async function listMembers(
    actor: User,
    input: ListMembersInput,
  ): Promise<MemberListDto> {
    actor.assertCan("members:read");

    const now = deps.clock.now();

    const page = await deps.members.list({
      search: input.search,
      status: input.status,
      planId: input.planId,
      sort: input.sort,
      includeDeleted: input.includeDeleted && actor.isAdmin,
      page: input.page,
      pageSize: input.pageSize,
    });

    const [plans, lastVisits] = await Promise.all([
      deps.plans.list({ includeInactive: true }),
      deps.checkins.lastVisitForMembers(page.items.map((member) => member.id)),
    ]);

    const ctx = {
      now,
      planNamesById: planNameMap(plans),
      lastVisitByMemberId: lastVisits,
    };

    return {
      items: page.items.map((member) => toMemberSummary(member, ctx)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      pageCount: Math.max(1, Math.ceil(page.total / page.pageSize)),
    };
  };
}
