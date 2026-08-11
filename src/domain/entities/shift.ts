import { ConflictError, ValidationError } from "../errors";
import { TimeRange } from "../value-objects/time-range";

export const SHIFT_STATUSES = ["scheduled", "completed", "cancelled"] as const;

export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const SHIFT_POSITIONS = ["front_desk", "floor", "training", "cleaning", "management"] as const;

export type ShiftPosition = (typeof SHIFT_POSITIONS)[number];

export const SHIFT_POSITION_LABELS: Record<ShiftPosition, string> = {
  front_desk: "Front desk",
  floor: "Gym floor",
  training: "Training",
  cleaning: "Cleaning",
  management: "Management",
};

const MIN_SHIFT_MINUTES = 30;
const MAX_SHIFT_HOURS = 12;

export interface ShiftProps {
  id: string;
  userId: string;
  range: TimeRange;
  position: ShiftPosition;
  status: ShiftStatus;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A staff or trainer work shift.
 *
 * Overlap is prevented in two places on purpose: here, so the rule is testable
 * without a database, and by a Postgres exclusion constraint, so concurrent
 * writers cannot slip past the check.
 */
export class Shift {
  private props: ShiftProps;

  constructor(props: ShiftProps) {
    Shift.assertSaneLength(props.range);
    this.props = { ...props };
  }

  private static assertSaneLength(range: TimeRange): void {
    if (range.durationMinutes < MIN_SHIFT_MINUTES) {
      throw new ValidationError(`A shift must be at least ${MIN_SHIFT_MINUTES} minutes long.`, {
        field: "range",
      });
    }

    if (range.durationHours > MAX_SHIFT_HOURS) {
      throw new ValidationError(`A shift cannot be longer than ${MAX_SHIFT_HOURS} hours.`, {
        field: "range",
      });
    }
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get range(): TimeRange {
    return this.props.range;
  }
  get startsAt(): Date {
    return this.props.range.start;
  }
  get endsAt(): Date {
    return this.props.range.end;
  }
  get position(): ShiftPosition {
    return this.props.position;
  }
  get status(): ShiftStatus {
    return this.props.status;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  get hours(): number {
    return this.props.range.durationHours;
  }
  get isActive(): boolean {
    return this.props.status !== "cancelled";
  }

  /** Two shifts clash when they belong to the same person, overlap, and neither is cancelled. */
  conflictsWith(other: Shift): boolean {
    if (other.id === this.id) return false;
    if (other.userId !== this.userId) return false;
    if (!other.isActive || !this.isActive) return false;

    return this.props.range.overlaps(other.range);
  }

  assertNoConflict(others: readonly Shift[]): void {
    const clash = others.find((other) => this.conflictsWith(other));

    if (clash) {
      throw new ConflictError(
        `This shift overlaps an existing shift on ${formatShort(clash.startsAt)}–${formatShort(clash.endsAt)}.`,
        { conflictingShiftId: clash.id, startsAt: clash.startsAt, endsAt: clash.endsAt },
      );
    }
  }

  reschedule(range: TimeRange, now: Date): void {
    Shift.assertSaneLength(range);

    if (this.props.status === "cancelled") {
      throw new ConflictError("A cancelled shift cannot be rescheduled.");
    }

    this.props.range = range;
    this.props.updatedAt = now;
  }

  reassignTo(userId: string, now: Date): void {
    if (this.props.status === "cancelled") {
      throw new ConflictError("A cancelled shift cannot be reassigned.");
    }

    this.props.userId = userId;
    this.props.updatedAt = now;
  }

  update(
    changes: Partial<Pick<ShiftProps, "position" | "notes" | "status">>,
    now: Date,
  ): void {
    this.props = { ...this.props, ...changes, updatedAt: now };
  }

  cancel(now: Date): void {
    if (this.props.status === "cancelled") {
      throw new ConflictError("This shift is already cancelled.");
    }

    this.props.status = "cancelled";
    this.props.updatedAt = now;
  }

  snapshot(): ShiftProps {
    return { ...this.props };
  }
}

function formatShort(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}
