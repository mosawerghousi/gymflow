import { createHash, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import { DEFAULT_OPERATING_HOURS } from "@/domain/entities/operating-hours";
import type { MembershipStatus } from "@/domain/value-objects/membership-status";

import type { Database } from "../client";
import {
  appSettings,
  auditLog,
  checkins,
  kioskTokens,
  members,
  membershipPlans,
  operatingHours,
  shiftSwapRequests,
  shifts,
  trainerSessions,
  users,
} from "../schema";
import {
  createRandom,
  DEMO_PLANS,
  DEMO_USERS,
  emailFor,
  phoneFor,
  pickProfile,
  randomName,
  SEED_CONFIG,
  SHIFT_TEMPLATES,
  weightedHour,
  WEEKDAY_WEIGHTS,
} from "./seed-data";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export interface SeedSummary {
  users: number;
  plans: number;
  members: number;
  checkins: number;
  shifts: number;
  sessions: number;
  swapRequests: number;
}

/**
 * Wipes and rebuilds the demo dataset.
 *
 * Everything hangs off a fixed PRNG seed and a `now` passed in by the caller,
 * so the same command produces the same-shaped gym every night — 200 members
 * with realistic attendance, four weeks of roster, and enough history for
 * every report to render.
 */
export async function seedDatabase(db: Database, now = new Date()): Promise<SeedSummary> {
  const random = createRandom(20260316);

  // Order matters: children before parents.
  await db.delete(auditLog);
  await db.delete(trainerSessions);
  await db.delete(shiftSwapRequests);
  await db.delete(shifts);
  await db.delete(checkins);
  await db.delete(members);
  await db.delete(kioskTokens);
  await db.delete(membershipPlans);
  await db.delete(users);
  await db.delete(operatingHours);
  await db.delete(appSettings);

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  await db.insert(appSettings).values({ key: "gym_name", value: "Ironline Fitness" });
  await db.insert(operatingHours).values([...DEFAULT_OPERATING_HOURS]);

  /* ------------------------------------------------------------------ */
  /* Users                                                               */
  /* ------------------------------------------------------------------ */

  const passwordHash = await bcrypt.hash(SEED_CONFIG.password, 10);

  const userRows = DEMO_USERS.map((user) => ({
    id: randomUUID(),
    name: user.name,
    email: user.email,
    passwordHash,
    role: user.role,
    isDemo: user.isDemo,
    isActive: true,
    createdAt: new Date(now.getTime() - 400 * DAY_MS),
    updatedAt: now,
  }));

  await db.insert(users).values(userRows);

  const adminUser = userRows.find((user) => user.role === "admin")!;
  const staffUsers = userRows.filter((user) => user.role === "staff");
  const trainerUsers = userRows.filter((user) => user.role === "trainer");

  /* ------------------------------------------------------------------ */
  /* Kiosk token                                                         */
  /* ------------------------------------------------------------------ */

  await db.insert(kioskTokens).values({
    id: randomUUID(),
    name: "Front door",
    tokenHash: createHash("sha256").update(SEED_CONFIG.kioskToken).digest("hex"),
    tokenPrefix: SEED_CONFIG.kioskToken.slice(0, 12),
    createdByUserId: adminUser.id,
    lastUsedAt: new Date(now.getTime() - 2 * HOUR_MS),
    revokedAt: null,
    isSeed: true,
    createdAt: new Date(now.getTime() - 200 * DAY_MS),
  });

  /* ------------------------------------------------------------------ */
  /* Plans                                                               */
  /* ------------------------------------------------------------------ */

  const planRows = DEMO_PLANS.map((plan) => ({
    id: randomUUID(),
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    durationDays: plan.durationDays,
    isActive: true,
    createdAt: new Date(now.getTime() - 400 * DAY_MS),
    updatedAt: now,
  }));

  await db.insert(membershipPlans).values(planRows);

  // Day passes are rare; most members sit on monthly or quarterly.
  const planWeights = [0.04, 0.48, 0.31, 0.17];

  function pickPlan() {
    let threshold = random.next();

    for (let index = 0; index < planWeights.length; index += 1) {
      threshold -= planWeights[index]!;
      if (threshold <= 0) return planRows[index]!;
    }

    return planRows[1]!;
  }

  /* ------------------------------------------------------------------ */
  /* Members                                                             */
  /* ------------------------------------------------------------------ */

  interface SeedMember {
    id: string;
    memberCode: string;
    joinedAt: Date;
    membershipEndsAt: Date | null;
    status: MembershipStatus;
    profile: ReturnType<typeof pickProfile>;
  }

  const memberRows: Array<typeof members.$inferInsert> = [];
  const seedMembers: SeedMember[] = [];

  for (let index = 1; index <= SEED_CONFIG.memberCount; index += 1) {
    const { firstName, lastName } = randomName(random);
    const plan = pickPlan();
    const profile = pickProfile(random);

    // Sign-ups spread over ~27 months, denser recently so the gym reads as
    // steadily growing rather than as having appeared all at once.
    const daysAgo = Math.floor(Math.pow(random.next(), 1.5) * SEED_CONFIG.joinSpreadDays);
    const joinedAt = new Date(now.getTime() - daysAgo * DAY_MS);

    const membershipStartsAt = joinedAt;
    let status: MembershipStatus = "active";
    let membershipEndsAt: Date | null = null;
    let frozenAt: Date | null = null;

    if (random.chance(0.06)) {
      // Cancelled at some point in the past.
      status = "cancelled";
      membershipEndsAt = new Date(joinedAt.getTime() + plan.durationDays * DAY_MS);
    } else if (random.chance(0.05)) {
      status = "frozen";
      frozenAt = new Date(now.getTime() - random.int(3, 40) * DAY_MS);
      membershipEndsAt = new Date(now.getTime() + random.int(5, 120) * DAY_MS);
    } else if (random.chance(0.14)) {
      // Lapsed: the term ran out and was not renewed.
      status = "active";
      membershipEndsAt = new Date(now.getTime() - random.int(1, 90) * DAY_MS);
    } else {
      // Renewed up to a future date.
      membershipEndsAt = new Date(now.getTime() + random.int(2, plan.durationDays) * DAY_MS);
    }

    const id = randomUUID();
    const memberCode = `GF-${String(index).padStart(6, "0")}`;
    const updatedAt =
      status === "cancelled"
        ? new Date(now.getTime() - random.int(1, 180) * DAY_MS)
        : new Date(now.getTime() - random.int(0, 30) * DAY_MS);

    memberRows.push({
      id,
      memberCode,
      firstName,
      lastName,
      email: emailFor(firstName, lastName, index),
      phone: phoneFor(random),
      planId: plan.id,
      status,
      joinedAt,
      membershipStartsAt,
      membershipEndsAt,
      frozenAt,
      notes: random.chance(0.12) ? "Prefers morning sessions." : null,
      isSeed: true,
      deletedAt: null,
      createdAt: joinedAt,
      updatedAt,
    });

    seedMembers.push({ id, memberCode, joinedAt, membershipEndsAt, status, profile });
  }

  await db.insert(members).values(memberRows);

  /* ------------------------------------------------------------------ */
  /* Check-ins — 90 days, weighted to evenings and weekends              */
  /* ------------------------------------------------------------------ */

  const checkinRows: Array<typeof checkins.$inferInsert> = [];
  const historyStart = new Date(now.getTime() - SEED_CONFIG.checkinHistoryDays * DAY_MS);

  for (const member of seedMembers) {
    if (member.status === "cancelled") continue;

    // Someone who lapses stops showing up partway through the window.
    const stopsAt = random.chance(member.profile.dropOffChance)
      ? new Date(now.getTime() - random.int(30, 80) * DAY_MS)
      : now;

    const startsAt = member.joinedAt > historyStart ? member.joinedAt : historyStart;

    for (let cursor = startsAt.getTime(); cursor < stopsAt.getTime(); cursor += DAY_MS) {
      const day = new Date(cursor);
      const weekdayWeight = WEEKDAY_WEIGHTS[day.getUTCDay()] ?? 1;
      const dailyChance = (member.profile.visitsPerWeek / 7) * weekdayWeight;

      if (!random.chance(dailyChance)) continue;
      if (member.membershipEndsAt && day > member.membershipEndsAt) continue;

      const hour = weightedHour(random);
      const checkedInAt = new Date(
        Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          hour,
          random.int(0, 59),
        ),
      );

      if (checkedInAt > now) continue;

      const stayedMinutes = random.int(35, 110);
      const isToday = checkedInAt.toDateString() === now.toDateString();
      // A few of today's visits are left open so the "in gym" counter is alive.
      const stillInside = isToday && random.chance(0.35);

      checkinRows.push({
        id: randomUUID(),
        memberId: member.id,
        checkedInAt,
        checkedOutAt: stillInside
          ? null
          : new Date(checkedInAt.getTime() + stayedMinutes * 60_000),
        method: random.chance(0.55) ? "code" : random.chance(0.5) ? "qr" : "manual",
        recordedByUserId: null,
        kioskTokenId: null,
        createdAt: checkedInAt,
      });
    }
  }

  await insertInChunks(db, checkins, checkinRows);

  /* ------------------------------------------------------------------ */
  /* Shifts — two past weeks and two upcoming                            */
  /* ------------------------------------------------------------------ */

  const shiftRows: Array<typeof shifts.$inferInsert> = [];
  const rosterStart = startOfWeek(new Date(now.getTime() - 14 * DAY_MS));
  const workers = [...staffUsers, ...trainerUsers, adminUser];

  for (let day = 0; day < SEED_CONFIG.shiftWeeks * 7; day += 1) {
    const date = new Date(rosterStart.getTime() + day * DAY_MS);
    // Each person can hold at most one shift per day, which is also what the
    // exclusion constraint enforces for any overlap.
    const assigned = new Set<string>();

    for (const template of SHIFT_TEMPLATES) {
      const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      if (isWeekend && template.position === "management") continue;
      if (random.chance(0.12)) continue;

      const candidates = workers.filter((worker) => {
        if (assigned.has(worker.id)) return false;
        if (template.position === "training") return worker.role === "trainer";
        if (template.position === "management") return worker.role === "admin";
        return worker.role !== "trainer";
      });

      const worker = candidates[random.int(0, Math.max(0, candidates.length - 1))];
      if (!worker) continue;

      assigned.add(worker.id);

      const startsAt = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          template.startHour,
        ),
      );
      const endsAt = new Date(startsAt.getTime() + template.hours * HOUR_MS);

      shiftRows.push({
        id: randomUUID(),
        userId: worker.id,
        startsAt,
        endsAt,
        position: template.position,
        status: endsAt < now ? "completed" : "scheduled",
        notes: null,
        createdByUserId: adminUser.id,
        createdAt: new Date(startsAt.getTime() - 10 * DAY_MS),
        updatedAt: now,
      });
    }
  }

  await db.insert(shifts).values(shiftRows);

  /* ------------------------------------------------------------------ */
  /* Swap requests — a couple pending, so the screen has something to do  */
  /* ------------------------------------------------------------------ */

  const futureStaffShifts = shiftRows.filter(
    (shift) =>
      shift.startsAt > now && staffUsers.some((staffUser) => staffUser.id === shift.userId),
  );

  const swapRows = futureStaffShifts.slice(0, 2).map((shift) => ({
    id: randomUUID(),
    shiftId: shift.id!,
    requestedByUserId: shift.userId,
    targetUserId: null,
    status: "pending" as const,
    reason: "Family commitment — happy to cover someone else another day.",
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: new Date(now.getTime() - 2 * DAY_MS),
  }));

  if (swapRows.length > 0) {
    await db.insert(shiftSwapRequests).values(swapRows);
  }

  /* ------------------------------------------------------------------ */
  /* Trainer sessions — inside training shifts, so they are legal         */
  /* ------------------------------------------------------------------ */

  const sessionRows: Array<typeof trainerSessions.$inferInsert> = [];
  const activeMembers = seedMembers.filter((member) => member.status !== "cancelled");

  for (const shift of shiftRows) {
    if (shift.position !== "training") continue;

    const slots = Math.floor(
      (shift.endsAt.getTime() - shift.startsAt.getTime()) / HOUR_MS,
    );

    for (let slot = 0; slot < slots; slot += 1) {
      if (!random.chance(0.45)) continue;

      const startsAt = new Date(shift.startsAt.getTime() + slot * HOUR_MS);
      const endsAt = new Date(startsAt.getTime() + HOUR_MS);
      const member = random.pick(activeMembers);

      const status =
        endsAt > now
          ? ("booked" as const)
          : random.chance(0.82)
            ? ("completed" as const)
            : random.chance(0.6)
              ? ("no_show" as const)
              : ("cancelled" as const);

      sessionRows.push({
        id: randomUUID(),
        trainerId: shift.userId,
        memberId: member.id,
        startsAt,
        endsAt,
        status,
        notes: status === "completed" ? "Progressive overload — upper body." : null,
        bookedByUserId: adminUser.id,
        createdAt: new Date(startsAt.getTime() - 5 * DAY_MS),
        updatedAt: now,
      });
    }
  }

  await insertInChunks(db, trainerSessions, sessionRows);

  /* ------------------------------------------------------------------ */
  /* Audit trail — a handful of entries so profiles are not empty         */
  /* ------------------------------------------------------------------ */

  const auditRows = seedMembers.slice(0, 40).map((member) => ({
    id: randomUUID(),
    actorUserId: adminUser.id,
    action: "member.created",
    entityType: "member",
    entityId: member.id,
    summary: `Avery Bennett registered this member (${member.memberCode}).`,
    metadata: null,
    createdAt: member.joinedAt,
  }));

  await db.insert(auditLog).values(auditRows);

  return {
    users: userRows.length,
    plans: planRows.length,
    members: memberRows.length,
    checkins: checkinRows.length,
    shifts: shiftRows.length,
    sessions: sessionRows.length,
    swapRequests: swapRows.length,
  };
}

/** Postgres caps bind parameters per statement, so wide inserts go in batches. */
async function insertInChunks<T extends { $inferInsert: Record<string, unknown> }>(
  db: Database,
  table: T,
  rows: Array<T["$inferInsert"]>,
  chunkSize = 500,
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.insert(table as any).values(chunk as any);
    }
  }
}

function startOfWeek(date: Date): Date {
  const copy = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayOfWeek = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));

  return copy;
}
