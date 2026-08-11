import { ConflictError, ValidationError } from "../errors";
import { MemberCode } from "../value-objects/member-code";
import {
  assertTransition,
  allowsEntry,
  type MembershipStatus,
} from "../value-objects/membership-status";

const DAY_MS = 86_400_000;

export interface MemberProps {
  id: string;
  code: MemberCode;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  planId: string | null;
  status: MembershipStatus;
  joinedAt: Date;
  membershipStartsAt: Date | null;
  membershipEndsAt: Date | null;
  frozenAt: Date | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The reason a check-in was refused, so the desk can show the right warning. */
export type CheckInRefusal =
  | { allowed: true }
  | { allowed: false; reason: "expired" | "frozen" | "cancelled" | "deleted"; message: string };

/**
 * A gym member.
 *
 * Membership state transitions and the "may this person enter?" rule live here
 * — never in a route handler or a component.
 */
export class Member {
  private props: MemberProps;

  constructor(props: MemberProps) {
    if (!props.firstName.trim() || !props.lastName.trim()) {
      throw new ValidationError("A member needs both a first and a last name.", {
        field: "name",
      });
    }

    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get code(): MemberCode {
    return this.props.code;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }
  get email(): string | null {
    return this.props.email;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get planId(): string | null {
    return this.props.planId;
  }
  get status(): MembershipStatus {
    return this.props.status;
  }
  get joinedAt(): Date {
    return this.props.joinedAt;
  }
  get membershipStartsAt(): Date | null {
    return this.props.membershipStartsAt;
  }
  get membershipEndsAt(): Date | null {
    return this.props.membershipEndsAt;
  }
  get frozenAt(): Date | null {
    return this.props.frozenAt;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /**
   * The status the membership *actually* has at `now`, accounting for a term
   * that has run out since the row was last written. Persisted status is a
   * cache; this is the truth.
   */
  effectiveStatus(now: Date): MembershipStatus {
    const stored = this.props.status;

    if (stored === "cancelled" || stored === "frozen") return stored;

    const endsAt = this.props.membershipEndsAt;
    if (endsAt && endsAt.getTime() <= now.getTime()) return "expired";

    return stored;
  }

  daysUntilExpiry(now: Date): number | null {
    if (!this.props.membershipEndsAt) return null;
    return Math.ceil((this.props.membershipEndsAt.getTime() - now.getTime()) / DAY_MS);
  }

  /** Business rule: an expired, frozen, cancelled or deleted member cannot check in. */
  canCheckIn(now: Date): CheckInRefusal {
    if (this.isDeleted) {
      return {
        allowed: false,
        reason: "deleted",
        message: "This member record has been removed.",
      };
    }

    const status = this.effectiveStatus(now);

    if (allowsEntry(status)) return { allowed: true };

    const messages: Record<Exclude<MembershipStatus, "active">, string> = {
      expired: `${this.fullName}'s membership expired. Renew the plan before checking them in.`,
      frozen: `${this.fullName}'s membership is frozen. Unfreeze it before checking them in.`,
      cancelled: `${this.fullName}'s membership was cancelled.`,
    };

    return { allowed: false, reason: status, message: messages[status] };
  }

  /** Extends the term by `durationDays`, from today or from the unused remainder. */
  renew(params: { planId: string; durationDays: number; now: Date }): void {
    if (this.isDeleted) {
      throw new ConflictError("A removed member cannot be renewed.");
    }

    if (!Number.isInteger(params.durationDays) || params.durationDays < 1) {
      throw new ValidationError("A plan duration must be at least one day.", {
        field: "durationDays",
      });
    }

    const current = this.props.membershipEndsAt;
    const base =
      current && current.getTime() > params.now.getTime() ? current : params.now;

    assertTransition(this.effectiveStatus(params.now), "active");

    this.props.planId = params.planId;
    this.props.membershipStartsAt = this.props.membershipStartsAt ?? params.now;
    this.props.membershipEndsAt = new Date(base.getTime() + params.durationDays * DAY_MS);
    this.props.status = "active";
    this.props.frozenAt = null;
    this.props.updatedAt = params.now;
  }

  freeze(now: Date): void {
    if (this.props.status === "frozen") {
      throw new ConflictError("This membership is already frozen.");
    }

    assertTransition(this.effectiveStatus(now), "frozen");

    this.props.status = "frozen";
    this.props.frozenAt = now;
    this.props.updatedAt = now;
  }

  /**
   * Unfreezing pushes the end date out by however long the membership was
   * paused, so a member never loses paid days to a freeze.
   */
  unfreeze(now: Date): void {
    if (this.props.status !== "frozen") {
      throw new ConflictError("This membership is not frozen.");
    }

    const frozenAt = this.props.frozenAt;

    if (frozenAt && this.props.membershipEndsAt) {
      const pausedMs = Math.max(0, now.getTime() - frozenAt.getTime());
      this.props.membershipEndsAt = new Date(this.props.membershipEndsAt.getTime() + pausedMs);
    }

    this.props.status =
      this.props.membershipEndsAt && this.props.membershipEndsAt.getTime() <= now.getTime()
        ? "expired"
        : "active";
    this.props.frozenAt = null;
    this.props.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.props.status === "cancelled") {
      throw new ConflictError("This membership is already cancelled.");
    }

    assertTransition(this.effectiveStatus(now), "cancelled");

    this.props.status = "cancelled";
    this.props.frozenAt = null;
    this.props.updatedAt = now;
  }

  updateProfile(
    changes: Partial<
      Pick<MemberProps, "firstName" | "lastName" | "email" | "phone" | "notes">
    >,
    now: Date,
  ): void {
    if (changes.firstName !== undefined && !changes.firstName.trim()) {
      throw new ValidationError("First name cannot be empty.", { field: "firstName" });
    }

    if (changes.lastName !== undefined && !changes.lastName.trim()) {
      throw new ValidationError("Last name cannot be empty.", { field: "lastName" });
    }

    this.props = { ...this.props, ...changes, updatedAt: now };
  }

  /** Soft delete — the row stays for audit and historical reports. */
  softDelete(now: Date): void {
    if (this.isDeleted) {
      throw new ConflictError("This member has already been removed.");
    }

    this.props.deletedAt = now;
    this.props.updatedAt = now;
  }

  restore(now: Date): void {
    if (!this.isDeleted) {
      throw new ConflictError("This member is not removed.");
    }

    this.props.deletedAt = null;
    this.props.updatedAt = now;
  }

  /** A defensive copy for the persistence layer. */
  snapshot(): MemberProps {
    return { ...this.props };
  }
}
