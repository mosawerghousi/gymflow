import { DemoRestrictedError } from "@/domain/errors";
import type { User } from "@/domain/entities/user";

/**
 * Demo guardrails (spec §6).
 *
 * The seeded demo accounts drive a public URL, so a handful of destructive or
 * lock-yourself-out actions are refused for them. Everything else — creating
 * members, checking people in, scheduling, renewing — stays fully usable, and a
 * nightly cron restores the seed.
 */
export const DEMO_RESTRICTED_ACTIONS = [
  "Change password",
  "Delete all members",
  "Revoke kiosk token",
  "Deactivate staff account",
  "Change demo account role",
] as const;

export type DemoRestrictedAction = (typeof DEMO_RESTRICTED_ACTIONS)[number];

export function isDemoActor(actor: Pick<User, "isDemo">): boolean {
  return actor.isDemo === true;
}

/** Throws when a demo account attempts one of the restricted actions. */
export function assertNotDemo(
  actor: Pick<User, "isDemo">,
  action: DemoRestrictedAction,
): void {
  if (isDemoActor(actor)) {
    throw new DemoRestrictedError(action);
  }
}

/**
 * Seeded records are protected from deletion so the demo keeps its shape; the
 * nightly reset restores them anyway, but failing loudly is friendlier than a
 * demo that silently empties out.
 */
export function assertNotSeedDeletion(
  actor: Pick<User, "isDemo">,
  options: { isSeedRecord: boolean; action: DemoRestrictedAction },
): void {
  if (isDemoActor(actor) && options.isSeedRecord) {
    throw new DemoRestrictedError(options.action);
  }
}
