import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema.
 *
 * Two rules that Drizzle cannot express are added by hand in
 * `migrations/0001_constraints.sql`: the `btree_gist` exclusion constraints
 * that make overlapping shifts and overlapping trainer sessions impossible at
 * the database level.
 */

export const userRoleEnum = pgEnum("user_role", ["admin", "staff", "trainer"]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "frozen",
  "expired",
  "cancelled",
]);
export const checkinMethodEnum = pgEnum("checkin_method", ["manual", "code", "qr"]);
export const shiftStatusEnum = pgEnum("shift_status", ["scheduled", "completed", "cancelled"]);
export const shiftPositionEnum = pgEnum("shift_position", [
  "front_desk",
  "floor",
  "training",
  "cleaning",
  "management",
]);
export const sessionStatusEnum = pgEnum("session_status", [
  "booked",
  "completed",
  "no_show",
  "cancelled",
]);
export const swapStatusEnum = pgEnum("swap_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("staff"),
    isDemo: boolean("is_demo").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const membershipPlans = pgTable("membership_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  durationDays: integer("duration_days").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberCode: varchar("member_code", { length: 16 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    email: varchar("email", { length: 160 }),
    phone: varchar("phone", { length: 40 }),
    planId: uuid("plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
    status: membershipStatusEnum("status").notNull().default("expired"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    membershipStartsAt: timestamp("membership_starts_at", { withTimezone: true }),
    membershipEndsAt: timestamp("membership_ends_at", { withTimezone: true }),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    notes: text("notes"),
    /** Seeded demo rows are protected from wholesale deletion. */
    isSeed: boolean("is_seed").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("members_code_unique").on(table.memberCode),
    index("members_status_idx").on(table.status),
    index("members_plan_idx").on(table.planId),
    index("members_ends_at_idx").on(table.membershipEndsAt),
    index("members_joined_at_idx").on(table.joinedAt),
  ],
);

export const kioskTokens = pgTable(
  "kiosk_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: varchar("token_prefix", { length: 12 }).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    isSeed: boolean("is_seed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("kiosk_tokens_hash_unique").on(table.tokenHash)],
);

export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    method: checkinMethodEnum("method").notNull().default("manual"),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kioskTokenId: uuid("kiosk_token_id").references(() => kioskTokens.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("checkins_member_idx").on(table.memberId, table.checkedInAt),
    index("checkins_checked_in_at_idx").on(table.checkedInAt),
  ],
);

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    position: shiftPositionEnum("position").notNull().default("front_desk"),
    status: shiftStatusEnum("status").notNull().default("scheduled"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("shifts_user_range_idx").on(table.userId, table.startsAt),
    index("shifts_starts_at_idx").on(table.startsAt),
  ],
);

export const shiftSwapRequests = pgTable(
  "shift_swap_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    status: swapStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("swap_requests_status_idx").on(table.status, table.shiftId)],
);

export const trainerSessions = pgTable(
  "trainer_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainerId: uuid("trainer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: sessionStatusEnum("status").notNull().default("booked"),
    notes: text("notes"),
    bookedByUserId: uuid("booked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_trainer_range_idx").on(table.trainerId, table.startsAt),
    index("sessions_member_idx").on(table.memberId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    index("audit_created_at_idx").on(table.createdAt),
  ],
);

export const operatingHours = pgTable(
  "operating_hours",
  {
    dayOfWeek: smallint("day_of_week").notNull(),
    opensAt: varchar("opens_at", { length: 5 }).notNull(),
    closesAt: varchar("closes_at", { length: 5 }).notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.dayOfWeek] })],
);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Bookkeeping for the nightly demo reset cron. */
export const demoResets = pgTable("demo_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  durationMs: integer("duration_ms").notNull(),
  summary: text("summary").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type MemberRow = typeof members.$inferSelect;
export type CheckinRow = typeof checkins.$inferSelect;
export type ShiftRow = typeof shifts.$inferSelect;
export type TrainerSessionRow = typeof trainerSessions.$inferSelect;
export type SwapRequestRow = typeof shiftSwapRequests.$inferSelect;
export type PlanRow = typeof membershipPlans.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
export type KioskTokenRow = typeof kioskTokens.$inferSelect;
