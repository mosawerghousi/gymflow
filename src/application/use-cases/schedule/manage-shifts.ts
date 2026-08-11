import { AuditLogEntry } from "@/domain/entities/audit-log";
import { Shift } from "@/domain/entities/shift";
import type { User } from "@/domain/entities/user";
import { ForbiddenError, NotFoundError } from "@/domain/errors";
import { TimeRange } from "@/domain/value-objects/time-range";

import type { CreateShiftInput, ShiftDto, UpdateShiftInput } from "../../dto/schedule.dto";
import type {
  AuditLogRepository,
  ShiftRepository,
  UserRepository,
} from "../../ports/repositories";
import type { Clock, IdGenerator } from "../../ports/services";

export interface ManageShiftsDeps {
  shifts: ShiftRepository;
  users: UserRepository;
  audit: AuditLogRepository;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Creates a shift, refusing any overlap with that person's existing shifts.
 *
 * The same rule is enforced by a Postgres exclusion constraint, so a race
 * between two admins cannot double-book someone; checking here first turns that
 * race into a friendly message in the common case.
 */
export function makeCreateShift(deps: ManageShiftsDeps) {
  return async function createShift(actor: User, input: CreateShiftInput): Promise<ShiftDto> {
    actor.assertCan("shifts:write");

    const assignee = await deps.users.findById(input.userId);

    if (!assignee) {
      throw new NotFoundError("Staff member", input.userId);
    }

    const now = deps.clock.now();
    const range = TimeRange.create(input.startsAt, input.endsAt);

    const shift = new Shift({
      id: deps.ids.next(),
      userId: assignee.id,
      range,
      position: input.position,
      status: "scheduled",
      notes: input.notes ?? null,
      createdByUserId: actor.id,
      createdAt: now,
      updatedAt: now,
    });

    const neighbours = await deps.shifts.findOverlapping(assignee.id, range.start, range.end);
    shift.assertNoConflict(neighbours);

    await deps.shifts.create(shift);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "shift.created",
        entityType: "shift",
        entityId: shift.id,
        summary: `${actor.name} scheduled ${assignee.name} for ${formatRange(range)}.`,
        metadata: { userId: assignee.id, position: shift.position },
        createdAt: now,
      }),
    );

    return toShiftDto(shift, assignee);
  };
}

/** Moves, resizes, reassigns, or cancels a shift. Drag-to-resize lands here too. */
export function makeUpdateShift(deps: ManageShiftsDeps) {
  return async function updateShift(actor: User, input: UpdateShiftInput): Promise<ShiftDto> {
    actor.assertCan("shifts:write");

    const shift = await deps.shifts.findById(input.shiftId);

    if (!shift) {
      throw new NotFoundError("Shift", input.shiftId);
    }

    const now = deps.clock.now();

    if (input.userId && input.userId !== shift.userId) {
      const nextAssignee = await deps.users.findById(input.userId);
      if (!nextAssignee) throw new NotFoundError("Staff member", input.userId);
      shift.reassignTo(nextAssignee.id, now);
    }

    if (input.startsAt || input.endsAt) {
      shift.reschedule(
        TimeRange.create(input.startsAt ?? shift.startsAt, input.endsAt ?? shift.endsAt),
        now,
      );
    }

    shift.update(
      {
        ...(input.position ? { position: input.position } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      now,
    );

    if (shift.isActive) {
      const neighbours = await deps.shifts.findOverlapping(
        shift.userId,
        shift.startsAt,
        shift.endsAt,
        shift.id,
      );
      shift.assertNoConflict(neighbours);
    }

    await deps.shifts.save(shift);

    const assignee = await deps.users.findById(shift.userId);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: input.status === "cancelled" ? "shift.cancelled" : "shift.updated",
        entityType: "shift",
        entityId: shift.id,
        summary: `${actor.name} ${input.status === "cancelled" ? "cancelled" : "updated"} a shift for ${assignee?.name ?? "a staff member"}.`,
        metadata: { startsAt: shift.startsAt.toISOString(), endsAt: shift.endsAt.toISOString() },
        createdAt: now,
      }),
    );

    return toShiftDto(shift, assignee);
  };
}

/** Cancels a shift. Staff may only cancel their own; admins may cancel any. */
export function makeCancelShift(deps: ManageShiftsDeps) {
  return async function cancelShift(
    actor: User,
    input: { shiftId: string },
  ): Promise<{ shiftId: string; status: string }> {
    const shift = await deps.shifts.findById(input.shiftId);

    if (!shift) {
      throw new NotFoundError("Shift", input.shiftId);
    }

    if (!actor.can("shifts:write") && shift.userId !== actor.id) {
      throw new ForbiddenError("You can only cancel your own shifts.");
    }

    const now = deps.clock.now();
    shift.cancel(now);
    await deps.shifts.save(shift);

    await deps.audit.append(
      new AuditLogEntry({
        id: deps.ids.next(),
        actorUserId: actor.id,
        action: "shift.cancelled",
        entityType: "shift",
        entityId: shift.id,
        summary: `${actor.name} cancelled a shift.`,
        metadata: null,
        createdAt: now,
      }),
    );

    return { shiftId: shift.id, status: shift.status };
  };
}

export function toShiftDto(
  shift: Shift,
  assignee?: Pick<User, "id" | "name" | "role"> | null,
  swap?: { id: string; status: string } | null,
): ShiftDto {
  return {
    id: shift.id,
    userId: shift.userId,
    userName: assignee?.name ?? "Unassigned",
    userRole: assignee?.role ?? "staff",
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    position: shift.position,
    status: shift.status,
    notes: shift.notes,
    hours: Math.round(shift.hours * 100) / 100,
    swapRequestId: swap?.id ?? null,
    swapStatus: swap?.status ?? null,
  };
}

function formatRange(range: TimeRange): string {
  const day = range.start.toISOString().slice(0, 10);
  const start = range.start.toISOString().slice(11, 16);
  const end = range.end.toISOString().slice(11, 16);
  return `${day} ${start}–${end}`;
}
