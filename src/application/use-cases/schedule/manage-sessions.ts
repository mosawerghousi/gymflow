import { AuditLogEntry } from "@/domain/entities/audit-log";
import type { Member } from "@/domain/entities/member";
import {
  deriveAvailability,
  TrainerSession,
  toBookableSlots,
} from "@/domain/entities/trainer-session";
import type { User } from "@/domain/entities/user";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { TimeRange } from "@/domain/value-objects/time-range";

import type {
  AvailabilitySlotDto,
  BookSessionInput,
  TrainerAvailabilityInput,
  TrainerSessionDto,
  UpdateSessionInput,
} from "../../dto/schedule.dto";
import type {
  AuditLogRepository,
  MemberRepository,
  ShiftRepository,
  TrainerSessionRepository,
  UserRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface ManageSessionsDeps {
  sessions: TrainerSessionRepository;
  shifts: ShiftRepository;
  members: MemberRepository;
  users: UserRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Books a personal training session.
 *
 * A slot is only bookable when it sits inside one of the trainer's shifts and
 * does not collide with an existing session — availability is derived, never
 * stored, so it can never drift from the roster.
 */
export function makeBookTrainerSession(deps: ManageSessionsDeps) {
  return async function bookTrainerSession(
    actor: User,
    input: BookSessionInput,
  ): Promise<TrainerSessionDto> {
    actor.assertCan("sessions:book");

    const [trainer, member] = await Promise.all([
      deps.users.findById(input.trainerId),
      deps.members.findById(input.memberId),
    ]);

    if (!trainer || trainer.role !== "trainer") {
      throw new NotFoundError("Trainer", input.trainerId);
    }

    if (!member) {
      throw new NotFoundError("Member", input.memberId);
    }

    const now = deps.clock.now();
    const range = TimeRange.fromMinutes(input.startsAt, input.durationMinutes);

    if (member.effectiveStatus(now) === "cancelled" || member.isDeleted) {
      throw new ConflictError(
        `${member.fullName}'s membership is not active, so sessions cannot be booked.`,
        { memberId: member.id },
      );
    }

    const [trainerShifts, existingSessions] = await Promise.all([
      deps.shifts.list({ userId: trainer.id, from: range.start, to: range.end, status: "scheduled" }),
      deps.sessions.findOverlapping(trainer.id, range.start, range.end),
    ]);

    const covering = trainerShifts.find((shift) => shift.isActive && shift.range.contains(range));

    if (!covering) {
      throw new ConflictError(
        `${trainer.name} is not rostered for that slot. Add a shift first, or pick a time inside an existing one.`,
        { trainerId: trainer.id, startsAt: range.start.toISOString() },
      );
    }

    const session = new TrainerSession({
      id: deps.ids.next(),
      trainerId: trainer.id,
      memberId: member.id,
      range,
      status: "booked",
      notes: input.notes ?? null,
      bookedByUserId: actor.id,
      createdAt: now,
      updatedAt: now,
    });

    session.assertNoConflict(existingSessions);

    await deps.sessions.create(session);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "session.booked",
        entityType: "member",
        entityId: member.id,
        summary: `${actor.name} booked a session with ${trainer.name}.`,
        metadata: {
          sessionId: session.id,
          trainerId: trainer.id,
          startsAt: range.start.toISOString(),
        },
        createdAt: now,
      }),
    );

    return toSessionDto(session, trainer, member);
  };
}

/** Marks a session completed / no-show / cancelled, or edits its notes. */
export function makeUpdateTrainerSession(deps: ManageSessionsDeps) {
  return async function updateTrainerSession(
    actor: User,
    input: UpdateSessionInput,
  ): Promise<TrainerSessionDto> {
    const session = await deps.sessions.findById(input.sessionId);

    if (!session) {
      throw new NotFoundError("Session", input.sessionId);
    }

    const ownsSession = session.trainerId === actor.id;

    if (!ownsSession && !actor.can("sessions:read:all")) {
      throw new ForbiddenError("You can only update your own sessions.");
    }

    if (!ownsSession && !actor.isAdmin && !actor.can("sessions:book")) {
      throw new ForbiddenError("You do not have permission to update this session.");
    }

    const now = deps.clock.now();

    if (input.status) {
      session.transitionTo(input.status, now);
    }

    if (input.notes !== undefined) {
      session.addNotes(input.notes ?? null, now);
    }

    await deps.sessions.save(session);

    const [trainer, member] = await Promise.all([
      deps.users.findById(session.trainerId),
      deps.members.findById(session.memberId),
    ]);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "session.updated",
        entityType: "session",
        entityId: session.id,
        summary: `${actor.name} marked a session ${session.status.replace("_", "-")}.`,
        metadata: { status: session.status },
        createdAt: now,
      }),
    );

    return toSessionDto(session, trainer, member);
  };
}

/** Derives bookable slots for a trainer across a window. */
export function makeGetTrainerAvailability(deps: ManageSessionsDeps) {
  return async function getTrainerAvailability(
    actor: User,
    input: TrainerAvailabilityInput,
  ): Promise<AvailabilitySlotDto[]> {
    actor.assertCan("sessions:read:all");

    if (input.to.getTime() <= input.from.getTime()) {
      throw new ValidationError("The availability window must end after it starts.", {
        field: "to",
      });
    }

    const [shifts, sessions] = await Promise.all([
      deps.shifts.list({
        userId: input.trainerId,
        from: input.from,
        to: input.to,
        status: "scheduled",
      }),
      deps.sessions.list({ trainerId: input.trainerId, from: input.from, to: input.to }),
    ]);

    const windows = deriveAvailability({
      shiftRanges: shifts.filter((shift) => shift.isActive).map((shift) => shift.range),
      bookedRanges: sessions.filter((session) => session.isActive).map((session) => session.range),
      slotMinutes: input.slotMinutes,
      now: deps.clock.now(),
    });

    return toBookableSlots(windows, input.slotMinutes, input.slotMinutes).map((slot) => ({
      startsAt: slot.start.toISOString(),
      endsAt: slot.end.toISOString(),
    }));
  };
}

export function toSessionDto(
  session: TrainerSession,
  trainer?: Pick<User, "id" | "name"> | null,
  member?: Member | null,
): TrainerSessionDto {
  return {
    id: session.id,
    trainerId: session.trainerId,
    trainerName: trainer?.name ?? "Unknown trainer",
    memberId: session.memberId,
    memberName: member?.fullName ?? "Unknown member",
    memberCode: member?.code.value ?? "—",
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    status: session.status,
    notes: session.notes,
    durationMinutes: session.range.durationMinutes,
  };
}
