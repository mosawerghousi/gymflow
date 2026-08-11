import { ConflictError } from "../errors";

export const MEMBERSHIP_STATUSES = ["active", "frozen", "expired", "cancelled"] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/**
 * Which statuses each status may move to.
 *
 * `expired` is reachable from `active` and `frozen` by the passage of time
 * rather than by an explicit command, so it is not listed as an operator
 * transition out of those states — `renew` is what an operator issues.
 */
const ALLOWED_TRANSITIONS: Record<MembershipStatus, readonly MembershipStatus[]> = {
  active: ["frozen", "cancelled", "expired"],
  frozen: ["active", "cancelled", "expired"],
  expired: ["active", "cancelled"],
  cancelled: ["active"],
};

export function isMembershipStatus(value: unknown): value is MembershipStatus {
  return typeof value === "string" && (MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: MembershipStatus, to: MembershipStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: MembershipStatus, to: MembershipStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`A ${from} membership cannot become ${to}.`, { from, to });
  }
}

/** Only active memberships open the door. */
export function allowsEntry(status: MembershipStatus): boolean {
  return status === "active";
}

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  expired: "Expired",
  cancelled: "Cancelled",
};
