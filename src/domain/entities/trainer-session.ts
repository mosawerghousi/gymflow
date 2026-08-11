import { ConflictError, ValidationError } from "../errors";
import { subtractAll, TimeRange } from "../value-objects/time-range";

export const SESSION_STATUSES = ["booked", "completed", "no_show", "cancelled"] as const;

export type TrainerSessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATUS_LABELS: Record<TrainerSessionStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

const ALLOWED_TRANSITIONS: Record<TrainerSessionStatus, readonly TrainerSessionStatus[]> = {
  booked: ["completed", "no_show", "cancelled"],
  completed: [],
  no_show: ["completed"],
  cancelled: [],
};

const MIN_SESSION_MINUTES = 15;
const MAX_SESSION_MINUTES = 180;

export interface TrainerSessionProps {
  id: string;
  trainerId: string;
  memberId: string;
  range: TimeRange;
  status: TrainerSessionStatus;
  notes: string | null;
  bookedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A one-to-one personal training appointment. */
export class TrainerSession {
  private props: TrainerSessionProps;

  constructor(props: TrainerSessionProps) {
    const minutes = props.range.durationMinutes;

    if (minutes < MIN_SESSION_MINUTES || minutes > MAX_SESSION_MINUTES) {
      throw new ValidationError(
        `A session must run between ${MIN_SESSION_MINUTES} and ${MAX_SESSION_MINUTES} minutes.`,
        { field: "range" },
      );
    }

    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get trainerId(): string {
    return this.props.trainerId;
  }
  get memberId(): string {
    return this.props.memberId;
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
  get status(): TrainerSessionStatus {
    return this.props.status;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get bookedByUserId(): string | null {
    return this.props.bookedByUserId;
  }
  get isActive(): boolean {
    return this.props.status === "booked" || this.props.status === "completed";
  }

  conflictsWith(other: TrainerSession): boolean {
    if (other.id === this.id) return false;
    if (other.trainerId !== this.trainerId) return false;
    if (!other.isActive || !this.isActive) return false;

    return this.props.range.overlaps(other.range);
  }

  assertNoConflict(others: readonly TrainerSession[]): void {
    const clash = others.find((other) => this.conflictsWith(other));

    if (clash) {
      throw new ConflictError("This trainer already has a session booked in that slot.", {
        conflictingSessionId: clash.id,
        startsAt: clash.startsAt,
        endsAt: clash.endsAt,
      });
    }
  }

  transitionTo(status: TrainerSessionStatus, now: Date): void {
    if (status === this.props.status) return;

    if (!ALLOWED_TRANSITIONS[this.props.status].includes(status)) {
      throw new ConflictError(
        `A ${SESSION_STATUS_LABELS[this.props.status].toLowerCase()} session cannot become ${SESSION_STATUS_LABELS[status].toLowerCase()}.`,
        { from: this.props.status, to: status },
      );
    }

    this.props.status = status;
    this.props.updatedAt = now;
  }

  addNotes(notes: string | null, now: Date): void {
    this.props.notes = notes;
    this.props.updatedAt = now;
  }

  snapshot(): TrainerSessionProps {
    return { ...this.props };
  }
}

/**
 * Trainer availability is *derived*, never stored: it is the trainer's shifts
 * for the window minus the sessions already booked, keeping only gaps long
 * enough to hold a session of `slotMinutes`.
 */
export function deriveAvailability(params: {
  shiftRanges: readonly TimeRange[];
  bookedRanges: readonly TimeRange[];
  slotMinutes: number;
  now?: Date;
}): TimeRange[] {
  const { shiftRanges, bookedRanges, slotMinutes } = params;

  if (slotMinutes <= 0) {
    throw new ValidationError("Slot length must be positive.", { field: "slotMinutes" });
  }

  return shiftRanges
    .flatMap((shift) => subtractAll(shift, bookedRanges))
    .filter((gap) => gap.durationMinutes >= slotMinutes)
    .filter((gap) => !params.now || gap.end.getTime() > params.now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Splits availability windows into bookable start times on a fixed grid. */
export function toBookableSlots(
  availability: readonly TimeRange[],
  slotMinutes: number,
  stepMinutes = slotMinutes,
): TimeRange[] {
  const slots: TimeRange[] = [];

  for (const window of availability) {
    let cursor = window.start.getTime();

    while (cursor + slotMinutes * 60_000 <= window.end.getTime()) {
      slots.push(TimeRange.fromMinutes(new Date(cursor), slotMinutes));
      cursor += stepMinutes * 60_000;
    }
  }

  return slots;
}
