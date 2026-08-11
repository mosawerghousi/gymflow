import { ConflictError, ForbiddenError } from "../errors";

export const SWAP_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export type SwapRequestStatus = (typeof SWAP_STATUSES)[number];

export interface ShiftSwapRequestProps {
  id: string;
  shiftId: string;
  requestedByUserId: string;
  /** `null` means "open to anyone" — an admin picks the cover when approving. */
  targetUserId: string | null;
  status: SwapRequestStatus;
  reason: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

/**
 * A staff member asking to hand off one of their shifts. Only an admin can
 * resolve one; the requester may withdraw it while it is still pending.
 */
export class ShiftSwapRequest {
  private props: ShiftSwapRequestProps;

  constructor(props: ShiftSwapRequestProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get shiftId(): string {
    return this.props.shiftId;
  }
  get requestedByUserId(): string {
    return this.props.requestedByUserId;
  }
  get targetUserId(): string | null {
    return this.props.targetUserId;
  }
  get status(): SwapRequestStatus {
    return this.props.status;
  }
  get reason(): string | null {
    return this.props.reason;
  }
  get resolvedByUserId(): string | null {
    return this.props.resolvedByUserId;
  }
  get resolvedAt(): Date | null {
    return this.props.resolvedAt;
  }
  get isPending(): boolean {
    return this.props.status === "pending";
  }

  private assertPending(): void {
    if (!this.isPending) {
      throw new ConflictError(`This swap request was already ${this.props.status}.`, {
        status: this.props.status,
      });
    }
  }

  approve(params: { resolvedByUserId: string; coverUserId: string; now: Date }): void {
    this.assertPending();

    this.props.status = "approved";
    this.props.targetUserId = params.coverUserId;
    this.props.resolvedByUserId = params.resolvedByUserId;
    this.props.resolvedAt = params.now;
  }

  reject(params: { resolvedByUserId: string; now: Date }): void {
    this.assertPending();

    this.props.status = "rejected";
    this.props.resolvedByUserId = params.resolvedByUserId;
    this.props.resolvedAt = params.now;
  }

  /** Withdrawal by the requester themselves. */
  withdraw(params: { byUserId: string; now: Date }): void {
    this.assertPending();

    if (params.byUserId !== this.props.requestedByUserId) {
      throw new ForbiddenError("Only the requester can withdraw a swap request.");
    }

    this.props.status = "cancelled";
    this.props.resolvedByUserId = params.byUserId;
    this.props.resolvedAt = params.now;
  }

  snapshot(): ShiftSwapRequestProps {
    return { ...this.props };
  }
}
