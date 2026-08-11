import type { User } from "@/domain/entities/user";

import type { ListScheduleInput, ScheduleDto, SwapRequestDto } from "../../dto/schedule.dto";
import type {
  MemberRepository,
  ShiftRepository,
  SwapRequestRepository,
  TrainerSessionRepository,
  UserRepository,
} from "../../ports/repositories";
import { toShiftDto } from "./manage-shifts";
import { toSessionDto } from "./manage-sessions";

export interface GetScheduleDeps {
  shifts: ShiftRepository;
  sessions: TrainerSessionRepository;
  swaps: SwapRequestRepository;
  users: UserRepository;
  members: MemberRepository;
}

/**
 * Everything the weekly calendar grid needs in one round trip: shifts, trainer
 * sessions, pending swap requests, and the staff roster to lay out rows.
 */
export function makeGetSchedule(deps: GetScheduleDeps) {
  return async function getSchedule(actor: User, input: ListScheduleInput): Promise<ScheduleDto> {
    const seesEveryone = actor.can("shifts:read:all");
    const restrictToSelf = input.mine || !seesEveryone;

    const userIdFilter = restrictToSelf ? actor.id : input.userId;

    const [staff, shifts, sessions, swapRequests] = await Promise.all([
      deps.users.list({}),
      deps.shifts.list({
        from: input.from,
        to: input.to,
        userId: userIdFilter,
        status: "all",
      }),
      deps.sessions.list({
        from: input.from,
        to: input.to,
        trainerId: restrictToSelf && actor.role === "trainer" ? actor.id : input.userId,
        status: "all",
      }),
      deps.swaps.list({ status: "pending" }),
    ]);

    const usersById = new Map(staff.map((user) => [user.id, user]));
    const swapByShiftId = new Map(swapRequests.map((request) => [request.shiftId, request]));

    const members = await deps.members.findByIds(sessions.map((session) => session.memberId));
    const membersById = new Map(members.map((member) => [member.id, member]));

    const swapDtos: SwapRequestDto[] = swapRequests.flatMap((request) => {
      const shift = shifts.find((candidate) => candidate.id === request.shiftId);
      if (!shift) return [];

      return [
        {
          id: request.id,
          shiftId: request.shiftId,
          shiftStartsAt: shift.startsAt.toISOString(),
          shiftEndsAt: shift.endsAt.toISOString(),
          requestedByUserId: request.requestedByUserId,
          requestedByName: usersById.get(request.requestedByUserId)?.name ?? "Unknown",
          targetUserId: request.targetUserId,
          targetUserName: request.targetUserId
            ? (usersById.get(request.targetUserId)?.name ?? null)
            : null,
          status: request.status,
          reason: request.reason,
          createdAt: request.createdAt.toISOString(),
          resolvedAt: request.resolvedAt?.toISOString() ?? null,
        },
      ];
    });

    return {
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      shifts: shifts.map((shift) => {
        const swap = swapByShiftId.get(shift.id);
        return toShiftDto(
          shift,
          usersById.get(shift.userId),
          swap ? { id: swap.id, status: swap.status } : null,
        );
      }),
      sessions: sessions.map((session) =>
        toSessionDto(
          session,
          usersById.get(session.trainerId),
          membersById.get(session.memberId),
        ),
      ),
      swapRequests: swapDtos,
      staff: staff.map((user) => ({ id: user.id, name: user.name, role: user.role })),
    };
  };
}
