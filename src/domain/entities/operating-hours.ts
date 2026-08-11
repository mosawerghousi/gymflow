import { ValidationError } from "../errors";

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** 0 = Sunday, matching `Date#getUTCDay()`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface OperatingHoursProps {
  dayOfWeek: DayOfWeek;
  /** `HH:mm` in the gym's local time. */
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

/** When the gym is open on a given weekday. Shifts are validated against this. */
export class OperatingHours {
  readonly dayOfWeek: DayOfWeek;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly isClosed: boolean;

  constructor(props: OperatingHoursProps) {
    if (!TIME_PATTERN.test(props.opensAt) || !TIME_PATTERN.test(props.closesAt)) {
      throw new ValidationError("Opening hours must use the 24-hour HH:mm format.", {
        field: "operatingHours",
      });
    }

    if (!props.isClosed && toMinutes(props.closesAt) <= toMinutes(props.opensAt)) {
      throw new ValidationError("Closing time must be after opening time.", {
        field: "closesAt",
      });
    }

    this.dayOfWeek = props.dayOfWeek;
    this.opensAt = props.opensAt;
    this.closesAt = props.closesAt;
    this.isClosed = props.isClosed;
  }

  get label(): string {
    return WEEKDAYS[this.dayOfWeek];
  }

  get openMinutes(): number {
    return this.isClosed ? 0 : toMinutes(this.closesAt) - toMinutes(this.opensAt);
  }

  /** True when `HH:mm` falls inside the open window. */
  covers(time: string): boolean {
    if (this.isClosed) return false;

    const minutes = toMinutes(time);
    return minutes >= toMinutes(this.opensAt) && minutes < toMinutes(this.closesAt);
  }

  snapshot(): OperatingHoursProps {
    return {
      dayOfWeek: this.dayOfWeek,
      opensAt: this.opensAt,
      closesAt: this.closesAt,
      isClosed: this.isClosed,
    };
  }
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function toTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export const DEFAULT_OPERATING_HOURS: readonly OperatingHoursProps[] = [
  { dayOfWeek: 0, opensAt: "08:00", closesAt: "18:00", isClosed: false },
  { dayOfWeek: 1, opensAt: "06:00", closesAt: "22:00", isClosed: false },
  { dayOfWeek: 2, opensAt: "06:00", closesAt: "22:00", isClosed: false },
  { dayOfWeek: 3, opensAt: "06:00", closesAt: "22:00", isClosed: false },
  { dayOfWeek: 4, opensAt: "06:00", closesAt: "22:00", isClosed: false },
  { dayOfWeek: 5, opensAt: "06:00", closesAt: "21:00", isClosed: false },
  { dayOfWeek: 6, opensAt: "08:00", closesAt: "18:00", isClosed: false },
];
