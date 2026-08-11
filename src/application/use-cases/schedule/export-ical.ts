import { SHIFT_POSITION_LABELS } from "@/domain/entities/shift";
import type { User } from "@/domain/entities/user";

import type {
  MemberRepository,
  ShiftRepository,
  TrainerSessionRepository,
  UserRepository,
} from "../../ports/repositories";
import type { CalendarEvent, CalendarExporter, Clock } from "../../ports/services";

export interface ExportICalDeps {
  shifts: ShiftRepository;
  sessions: TrainerSessionRepository;
  users: UserRepository;
  members: MemberRepository;
  calendar: CalendarExporter;
  clock: Clock;
}

/**
 * Exports the caller's roster — or the whole gym's, for an admin — as an
 * iCalendar file that subscribes cleanly in Google/Apple Calendar.
 */
export function makeExportScheduleICal(deps: ExportICalDeps) {
  return async function exportScheduleICal(
    actor: User,
    input: { from: Date; to: Date; mine: boolean },
  ): Promise<{ filename: string; content: string }> {
    const restrictToSelf = input.mine || !actor.can("shifts:read:all");
    const userId = restrictToSelf ? actor.id : undefined;

    const [shifts, sessions, users] = await Promise.all([
      deps.shifts.list({ from: input.from, to: input.to, userId, status: "all" }),
      deps.sessions.list({
        from: input.from,
        to: input.to,
        trainerId: restrictToSelf && actor.role === "trainer" ? actor.id : undefined,
      }),
      deps.users.list({ includeInactive: true }),
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const members = await deps.members.findByIds(sessions.map((session) => session.memberId));
    const membersById = new Map(members.map((member) => [member.id, member]));

    const events: CalendarEvent[] = [
      ...shifts.map<CalendarEvent>((shift) => ({
        uid: `shift-${shift.id}@gymflow`,
        title: `${SHIFT_POSITION_LABELS[shift.position]} — ${usersById.get(shift.userId)?.name ?? "Staff"}`,
        description: shift.notes ?? undefined,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        status: shift.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
      })),
      ...sessions.map<CalendarEvent>((session) => ({
        uid: `session-${session.id}@gymflow`,
        title: `PT — ${membersById.get(session.memberId)?.fullName ?? "Member"} with ${usersById.get(session.trainerId)?.name ?? "Trainer"}`,
        description: session.notes ?? undefined,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
      })),
    ];

    return {
      filename: `gymflow-schedule-${input.from.toISOString().slice(0, 10)}.ics`,
      content: deps.calendar.toICal(events, {
        calendarName: restrictToSelf ? `GymFlow — ${actor.name}` : "GymFlow — All staff",
      }),
    };
  };
}
