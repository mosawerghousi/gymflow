import { Member, type MemberProps } from "@/domain/entities/member";
import { MembershipPlan } from "@/domain/entities/membership-plan";
import { Shift, type ShiftProps } from "@/domain/entities/shift";
import { TrainerSession } from "@/domain/entities/trainer-session";
import { User, type UserRole } from "@/domain/entities/user";
import { KioskToken } from "@/domain/entities/kiosk-token";
import { MemberCode } from "@/domain/value-objects/member-code";
import { TimeRange } from "@/domain/value-objects/time-range";
import type { MembershipStatus } from "@/domain/value-objects/membership-status";

/** Test data builders. Every field has a sane default so tests state only what matters. */

export const NOW = new Date("2026-03-16T10:00:00.000Z");
const DAY_MS = 86_400_000;

let seq = 0;
export function id(label = "id"): string {
  seq += 1;
  return `0000000${label.length % 10}-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

export function aUser(overrides: Partial<{ id: string; name: string; email: string; role: UserRole; isDemo: boolean; isActive: boolean }> = {}): User {
  return new User({
    id: overrides.id ?? id("user"),
    name: overrides.name ?? "Alex Admin",
    email: overrides.email ?? "alex@gymflow.demo",
    role: overrides.role ?? "admin",
    isDemo: overrides.isDemo ?? false,
    isActive: overrides.isActive ?? true,
    createdAt: NOW,
  });
}

export function anAdmin(overrides = {}): User {
  return aUser({ role: "admin", name: "Alex Admin", ...overrides });
}

export function aStaff(overrides = {}): User {
  return aUser({ role: "staff", name: "Sam Staff", email: "sam@gymflow.demo", ...overrides });
}

export function aTrainer(overrides = {}): User {
  return aUser({ role: "trainer", name: "Tia Trainer", email: "tia@gymflow.demo", ...overrides });
}

export function aMember(
  overrides: Partial<Omit<MemberProps, "code">> & {
    code?: string;
    status?: MembershipStatus;
    endsInDays?: number;
  } = {},
): Member {
  const { endsInDays, code, ...rest } = overrides;

  const membershipEndsAt =
    endsInDays !== undefined
      ? new Date(NOW.getTime() + endsInDays * DAY_MS)
      : (rest.membershipEndsAt ?? new Date(NOW.getTime() + 30 * DAY_MS));

  return new Member({
    id: rest.id ?? id("member"),
    code: MemberCode.create(code ?? "GF-000001"),
    firstName: rest.firstName ?? "Jordan",
    lastName: rest.lastName ?? "Reed",
    email: rest.email ?? "jordan.reed@example.com",
    phone: rest.phone ?? "+1 555 0100",
    planId: rest.planId ?? null,
    status: rest.status ?? "active",
    joinedAt: rest.joinedAt ?? new Date(NOW.getTime() - 120 * DAY_MS),
    membershipStartsAt: rest.membershipStartsAt ?? new Date(NOW.getTime() - 30 * DAY_MS),
    membershipEndsAt,
    frozenAt: rest.frozenAt ?? null,
    notes: rest.notes ?? null,
    deletedAt: rest.deletedAt ?? null,
    createdAt: rest.createdAt ?? NOW,
    updatedAt: rest.updatedAt ?? NOW,
  });
}

export function aPlan(
  overrides: Partial<{
    id: string;
    name: string;
    priceCents: number;
    durationDays: number;
    isActive: boolean;
  }> = {},
): MembershipPlan {
  return new MembershipPlan({
    id: overrides.id ?? id("plan"),
    name: overrides.name ?? "Monthly",
    description: null,
    priceCents: overrides.priceCents ?? 4900,
    durationDays: overrides.durationDays ?? 30,
    isActive: overrides.isActive ?? true,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

export function aShift(
  overrides: Partial<Omit<ShiftProps, "range">> & { startsAt?: Date; hours?: number } = {},
): Shift {
  const startsAt = overrides.startsAt ?? new Date("2026-03-16T09:00:00.000Z");
  const hours = overrides.hours ?? 8;

  return new Shift({
    id: overrides.id ?? id("shift"),
    userId: overrides.userId ?? id("user"),
    range: TimeRange.create(startsAt, new Date(startsAt.getTime() + hours * 3_600_000)),
    position: overrides.position ?? "front_desk",
    status: overrides.status ?? "scheduled",
    notes: overrides.notes ?? null,
    createdByUserId: overrides.createdByUserId ?? null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

export function aSession(
  overrides: Partial<{
    id: string;
    trainerId: string;
    memberId: string;
    startsAt: Date;
    minutes: number;
    status: "booked" | "completed" | "no_show" | "cancelled";
  }> = {},
): TrainerSession {
  const startsAt = overrides.startsAt ?? new Date("2026-03-16T11:00:00.000Z");

  return new TrainerSession({
    id: overrides.id ?? id("session"),
    trainerId: overrides.trainerId ?? id("user"),
    memberId: overrides.memberId ?? id("member"),
    range: TimeRange.fromMinutes(startsAt, overrides.minutes ?? 60),
    status: overrides.status ?? "booked",
    notes: null,
    bookedByUserId: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

export function aKioskToken(
  overrides: Partial<{ id: string; name: string; plaintext: string; revokedAt: Date | null }> = {},
): KioskToken {
  const plaintext = overrides.plaintext ?? "kiosk-test-token";

  return new KioskToken({
    id: overrides.id ?? id("kiosk"),
    name: overrides.name ?? "Front door",
    tokenHash: `hashed:${plaintext}`,
    tokenPrefix: plaintext.slice(0, 6),
    createdByUserId: null,
    lastUsedAt: null,
    revokedAt: overrides.revokedAt ?? null,
    createdAt: NOW,
  });
}

export function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY_MS);
}
