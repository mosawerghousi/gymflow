import { ValidationError } from "../errors";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 730;

/**
 * An inclusive calendar range used by the reporting use cases. Normalized to
 * cover whole days so a report never silently drops the edges of the window.
 */
export class DateRange {
  private constructor(
    readonly from: Date,
    readonly to: Date,
  ) {}

  static create(from: Date, to: Date): DateRange {
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new ValidationError("A date range needs two valid dates.", { field: "dateRange" });
    }

    const start = startOfDayUtc(from);
    const end = endOfDayUtc(to);

    if (end.getTime() <= start.getTime()) {
      throw new ValidationError("The end of the range must be on or after the start.", {
        field: "to",
      });
    }

    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new ValidationError(`Report ranges are limited to ${MAX_RANGE_DAYS} days.`, {
        field: "dateRange",
      });
    }

    return new DateRange(start, end);
  }

  /** The last `days` days, ending at the end of `reference`'s day. */
  static lastDays(days: number, reference: Date): DateRange {
    if (!Number.isInteger(days) || days < 1) {
      throw new ValidationError("Day count must be a positive integer.", { field: "days" });
    }

    const end = endOfDayUtc(reference);
    const start = startOfDayUtc(new Date(end.getTime() - (days - 1) * DAY_MS));

    return new DateRange(start, end);
  }

  get days(): number {
    return Math.round((this.to.getTime() - this.from.getTime()) / DAY_MS);
  }

  /** The equally long window immediately before this one, for period-over-period deltas. */
  previousPeriod(): DateRange {
    const span = this.to.getTime() - this.from.getTime();
    return new DateRange(new Date(this.from.getTime() - span), new Date(this.from.getTime() - 1));
  }

  contains(instant: Date): boolean {
    return instant.getTime() >= this.from.getTime() && instant.getTime() <= this.to.getTime();
  }

  toString(): string {
    return `${this.from.toISOString()}..${this.to.toISOString()}`;
  }
}

export function startOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

export function endOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
