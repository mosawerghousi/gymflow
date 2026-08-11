import { ValidationError } from "../errors";

const MINUTE_MS = 60_000;

/**
 * A half-open interval `[start, end)`.
 *
 * Half-open is what makes back-to-back shifts (09:00–13:00 and 13:00–17:00)
 * legal while genuine overlaps are not — the same semantics as the Postgres
 * exclusion constraint that backs shifts and trainer sessions.
 */
export class TimeRange {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static create(start: Date, end: Date): TimeRange {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ValidationError("A time range needs two valid dates.", {
        field: "timeRange",
      });
    }

    if (end.getTime() <= start.getTime()) {
      throw new ValidationError("The end time must be after the start time.", {
        field: "endsAt",
      });
    }

    return new TimeRange(new Date(start), new Date(end));
  }

  static fromMinutes(start: Date, durationMinutes: number): TimeRange {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new ValidationError("Duration must be a positive number of minutes.", {
        field: "durationMinutes",
      });
    }

    return TimeRange.create(start, new Date(start.getTime() + durationMinutes * MINUTE_MS));
  }

  get durationMinutes(): number {
    return (this.end.getTime() - this.start.getTime()) / MINUTE_MS;
  }

  get durationHours(): number {
    return this.durationMinutes / 60;
  }

  /** True when the two ranges share at least one instant. Touching is not overlapping. */
  overlaps(other: TimeRange): boolean {
    return this.start.getTime() < other.end.getTime() && other.start.getTime() < this.end.getTime();
  }

  /** True when `other` fits entirely inside this range. */
  contains(other: TimeRange): boolean {
    return this.start.getTime() <= other.start.getTime() && other.end.getTime() <= this.end.getTime();
  }

  containsInstant(instant: Date): boolean {
    return instant.getTime() >= this.start.getTime() && instant.getTime() < this.end.getTime();
  }

  /** The overlapping portion of two ranges, or `null` when they are disjoint. */
  intersection(other: TimeRange): TimeRange | null {
    if (!this.overlaps(other)) return null;

    return new TimeRange(
      new Date(Math.max(this.start.getTime(), other.start.getTime())),
      new Date(Math.min(this.end.getTime(), other.end.getTime())),
    );
  }

  /**
   * Everything in this range that is *not* covered by `other`. Used to derive
   * trainer availability from a shift minus the sessions already booked in it.
   */
  subtract(other: TimeRange): TimeRange[] {
    if (!this.overlaps(other)) return [this];

    const parts: TimeRange[] = [];

    if (this.start.getTime() < other.start.getTime()) {
      parts.push(new TimeRange(this.start, other.start));
    }

    if (other.end.getTime() < this.end.getTime()) {
      parts.push(new TimeRange(other.end, this.end));
    }

    return parts;
  }

  equals(other: TimeRange): boolean {
    return (
      this.start.getTime() === other.start.getTime() && this.end.getTime() === other.end.getTime()
    );
  }

  toString(): string {
    return `${this.start.toISOString()}/${this.end.toISOString()}`;
  }
}

/** Subtracts many ranges from a base range, in order. */
export function subtractAll(base: TimeRange, holes: readonly TimeRange[]): TimeRange[] {
  return holes.reduce<TimeRange[]>(
    (remaining, hole) => remaining.flatMap((part) => part.subtract(hole)),
    [base],
  );
}
