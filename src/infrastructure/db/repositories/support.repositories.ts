import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import type {
  AuditLogRepository,
  KioskTokenRepository,
  MembershipPlanRepository,
  SettingsRepository,
  UserRepository,
} from "@/application/ports/repositories";
import { AuditLogEntry, type AuditAction, type AuditEntityType } from "@/domain/entities/audit-log";
import { KioskToken } from "@/domain/entities/kiosk-token";
import { MembershipPlan } from "@/domain/entities/membership-plan";
import {
  DEFAULT_OPERATING_HOURS,
  OperatingHours,
  type DayOfWeek,
} from "@/domain/entities/operating-hours";
import { User, type UserRole } from "@/domain/entities/user";

import type { Database } from "../client";
import {
  appSettings,
  auditLog,
  kioskTokens,
  members,
  membershipPlans,
  operatingHours,
  users,
  type AuditRow,
  type KioskTokenRow,
  type PlanRow,
  type UserRow,
} from "../schema";

function toUser(row: UserRow): User {
  return new User({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isDemo: row.isDemo,
    isActive: row.isActive,
    createdAt: row.createdAt,
  });
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return row ? toUser(row) : null;
  }

  async findCredentialsByEmail(
    email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async list(filters?: { role?: UserRole; includeInactive?: boolean }): Promise<User[]> {
    const conditions = [];

    if (filters?.role) conditions.push(eq(users.role, filters.role));
    if (!filters?.includeInactive) conditions.push(eq(users.isActive, true));

    const rows = await this.db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(users.name));

    return rows.map(toUser);
  }

  async create(user: User, passwordHash: string): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash,
      role: user.role,
      isDemo: user.isDemo,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  }

  async save(user: User): Promise<void> {
    await this.db
      .update(users)
      .set({
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }
}

function toPlan(row: PlanRow): MembershipPlan {
  return new MembershipPlan({
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    durationDays: row.durationDays,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzlePlanRepository implements MembershipPlanRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<MembershipPlan | null> {
    const [row] = await this.db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.id, id))
      .limit(1);

    return row ? toPlan(row) : null;
  }

  async list(options?: { includeInactive?: boolean }): Promise<MembershipPlan[]> {
    const rows = await this.db
      .select()
      .from(membershipPlans)
      .where(options?.includeInactive ? undefined : eq(membershipPlans.isActive, true))
      .orderBy(asc(membershipPlans.durationDays));

    return rows.map(toPlan);
  }

  async create(plan: MembershipPlan): Promise<void> {
    const props = plan.snapshot();

    await this.db.insert(membershipPlans).values({
      id: props.id,
      name: props.name,
      description: props.description,
      priceCents: props.priceCents,
      durationDays: props.durationDays,
      isActive: props.isActive,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  async save(plan: MembershipPlan): Promise<void> {
    const props = plan.snapshot();

    await this.db
      .update(membershipPlans)
      .set({
        name: props.name,
        description: props.description,
        priceCents: props.priceCents,
        durationDays: props.durationDays,
        isActive: props.isActive,
        updatedAt: props.updatedAt,
      })
      .where(eq(membershipPlans.id, props.id));
  }

  async countMembersOnPlan(planId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(members)
      .where(and(eq(members.planId, planId), sql`${members.deletedAt} is null`));

    return Number(row?.value ?? 0);
  }
}

function toAudit(row: AuditRow): AuditLogEntry {
  return new AuditLogEntry({
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action as AuditAction,
    entityType: row.entityType as AuditEntityType,
    entityId: row.entityId,
    summary: row.summary,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  });
}

export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Database) {}

  async append(entry: AuditLogEntry): Promise<void> {
    const props = entry.snapshot();

    await this.db.insert(auditLog).values({
      id: props.id,
      actorUserId: props.actorUserId,
      action: props.action,
      entityType: props.entityType,
      entityId: props.entityId,
      summary: props.summary,
      metadata: props.metadata,
      createdAt: props.createdAt,
    });
  }

  async listForEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<AuditLogEntry[]> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    return rows.map(toAudit);
  }

  async listRecent(limit: number): Promise<AuditLogEntry[]> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    return rows.map(toAudit);
  }
}

function toKioskToken(row: KioskTokenRow): KioskToken {
  return new KioskToken({
    id: row.id,
    name: row.name,
    tokenHash: row.tokenHash,
    tokenPrefix: row.tokenPrefix,
    createdByUserId: row.createdByUserId,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  });
}

export class DrizzleKioskTokenRepository implements KioskTokenRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<KioskToken | null> {
    const [row] = await this.db
      .select()
      .from(kioskTokens)
      .where(eq(kioskTokens.id, id))
      .limit(1);

    return row ? toKioskToken(row) : null;
  }

  async findByHash(hash: string): Promise<KioskToken | null> {
    const [row] = await this.db
      .select()
      .from(kioskTokens)
      .where(eq(kioskTokens.tokenHash, hash))
      .limit(1);

    return row ? toKioskToken(row) : null;
  }

  async list(): Promise<KioskToken[]> {
    const rows = await this.db.select().from(kioskTokens).orderBy(asc(kioskTokens.createdAt));
    return rows.map(toKioskToken);
  }

  async create(token: KioskToken): Promise<void> {
    const props = token.snapshot();

    await this.db.insert(kioskTokens).values({
      id: props.id,
      name: props.name,
      tokenHash: props.tokenHash,
      tokenPrefix: props.tokenPrefix,
      createdByUserId: props.createdByUserId,
      lastUsedAt: props.lastUsedAt,
      revokedAt: props.revokedAt,
      createdAt: props.createdAt,
    });
  }

  async save(token: KioskToken): Promise<void> {
    const props = token.snapshot();

    await this.db
      .update(kioskTokens)
      .set({ lastUsedAt: props.lastUsedAt, revokedAt: props.revokedAt, name: props.name })
      .where(eq(kioskTokens.id, props.id));
  }
}

const GYM_NAME_KEY = "gym_name";

export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Database) {}

  async getOperatingHours(): Promise<OperatingHours[]> {
    const rows = await this.db
      .select()
      .from(operatingHours)
      .orderBy(asc(operatingHours.dayOfWeek));

    if (rows.length === 0) {
      return DEFAULT_OPERATING_HOURS.map((entry) => new OperatingHours(entry));
    }

    return rows.map(
      (row) =>
        new OperatingHours({
          dayOfWeek: row.dayOfWeek as DayOfWeek,
          opensAt: row.opensAt,
          closesAt: row.closesAt,
          isClosed: row.isClosed,
        }),
    );
  }

  async saveOperatingHours(hours: readonly OperatingHours[]): Promise<void> {
    await this.db
      .insert(operatingHours)
      .values(
        hours.map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          opensAt: entry.opensAt,
          closesAt: entry.closesAt,
          isClosed: entry.isClosed,
        })),
      )
      .onConflictDoUpdate({
        target: operatingHours.dayOfWeek,
        set: {
          opensAt: sql`excluded.opens_at`,
          closesAt: sql`excluded.closes_at`,
          isClosed: sql`excluded.is_closed`,
        },
      });
  }

  async getGymName(): Promise<string> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, GYM_NAME_KEY))
      .limit(1);

    return row?.value ?? "GymFlow Demo Gym";
  }

  async setGymName(name: string): Promise<void> {
    await this.db
      .insert(appSettings)
      .values({ key: GYM_NAME_KEY, value: name })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: name, updatedAt: new Date() },
      });
  }
}
