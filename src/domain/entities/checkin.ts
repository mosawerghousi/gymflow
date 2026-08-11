import { ConflictError, ValidationError } from "../errors";

export const CHECKIN_METHODS = ["manual", "code", "qr"] as const;

export type CheckinMethod = (typeof CHECKIN_METHODS)[number];

export function isCheckinMethod(value: unknown): value is CheckinMethod {
  return typeof value === "string" && (CHECKIN_METHODS as readonly string[]).includes(value);
}

/** Visits longer than this are auto-closed by the "currently in gym" logic. */
export const MAX_VISIT_HOURS = 6;

export interface CheckinProps {
  id: string;
  memberId: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  method: CheckinMethod;
  recordedByUserId: string | null;
  kioskTokenId: string | null;
}

/**
 * One visit. Open (`checkedOutAt === null`) means the member is in the gym.
 */
export class Checkin {
  private props: CheckinProps;

  constructor(props: CheckinProps) {
    if (props.checkedOutAt && props.checkedOutAt.getTime() < props.checkedInAt.getTime()) {
      throw new ValidationError("A check-out cannot precede its check-in.", {
        field: "checkedOutAt",
      });
    }

    this.props = { ...props };
  }

  static open(params: {
    id: string;
    memberId: string;
    method: CheckinMethod;
    at: Date;
    recordedByUserId?: string | null;
    kioskTokenId?: string | null;
  }): Checkin {
    return new Checkin({
      id: params.id,
      memberId: params.memberId,
      checkedInAt: params.at,
      checkedOutAt: null,
      method: params.method,
      recordedByUserId: params.recordedByUserId ?? null,
      kioskTokenId: params.kioskTokenId ?? null,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get memberId(): string {
    return this.props.memberId;
  }
  get checkedInAt(): Date {
    return this.props.checkedInAt;
  }
  get checkedOutAt(): Date | null {
    return this.props.checkedOutAt;
  }
  get method(): CheckinMethod {
    return this.props.method;
  }
  get recordedByUserId(): string | null {
    return this.props.recordedByUserId;
  }
  get kioskTokenId(): string | null {
    return this.props.kioskTokenId;
  }
  get isOpen(): boolean {
    return this.props.checkedOutAt === null;
  }

  durationMinutes(now: Date): number {
    const end = this.props.checkedOutAt ?? now;
    return Math.max(0, Math.round((end.getTime() - this.props.checkedInAt.getTime()) / 60_000));
  }

  /** An open visit older than {@link MAX_VISIT_HOURS} is treated as a forgotten check-out. */
  isStale(now: Date): boolean {
    return this.isOpen && this.durationMinutes(now) > MAX_VISIT_HOURS * 60;
  }

  checkOut(at: Date): void {
    if (!this.isOpen) {
      throw new ConflictError("This visit has already been checked out.");
    }

    if (at.getTime() < this.props.checkedInAt.getTime()) {
      throw new ValidationError("A check-out cannot precede its check-in.", {
        field: "checkedOutAt",
      });
    }

    this.props.checkedOutAt = at;
  }

  snapshot(): CheckinProps {
    return { ...this.props };
  }
}
