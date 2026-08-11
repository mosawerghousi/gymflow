import { and, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import type {
  CheckinListFilters,
  CheckinRepository,
  DailyCount,
} from "@/application/ports/repositories";
import { Checkin } from "@/domain/entities/checkin";

import type { Database } from "../client";
import { checkins, type CheckinRow } from "../schema";

function toEntity(row: CheckinRow): Checkin {
  return new Checkin({
    id: row.id,
    memberId: row.memberId,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt,
    method: row.method,
    recordedByUserId: row.recordedByUserId,
    kioskTokenId: row.kioskTokenId,
  });
}

export class DrizzleCheckinRepository implements CheckinRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Checkin | null> {
    const [row] = await this.db.select().from(checkins).where(eq(checkins.id, id)).limit(1);
    return row ? toEntity(row) : null;
  }

  async findOpenForMember(memberId: string): Promise<Checkin | null> {
    const [row] = await this.db
      .select()
      .from(checkins)
      .where(and(eq(checkins.memberId, memberId), isNull(checkins.checkedOutAt)))
      .orderBy(desc(checkins.checkedInAt))
      .limit(1);

    return row ? toEntity(row) : null;
  }

  async findLastForMember(memberId: string): Promise<Checkin | null> {
    const [row] = await this.db
      .select()
      .from(checkins)
      .where(eq(checkins.memberId, memberId))
      .orderBy(desc(checkins.checkedInAt))
      .limit(1);

    return row ? toEntity(row) : null;
  }

  async list(filters: CheckinListFilters): Promise<Checkin[]> {
    const conditions = [];

    if (filters.memberId) conditions.push(eq(checkins.memberId, filters.memberId));
    if (filters.from) conditions.push(gte(checkins.checkedInAt, filters.from));
    if (filters.to) conditions.push(lte(checkins.checkedInAt, filters.to));
    if (filters.openOnly) conditions.push(isNull(checkins.checkedOutAt));

    const rows = await this.db
      .select()
      .from(checkins)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(checkins.checkedInAt))
      .limit(filters.limit ?? 50);

    return rows.map(toEntity);
  }

  async listOpen(since: Date): Promise<Checkin[]> {
    const rows = await this.db
      .select()
      .from(checkins)
      .where(and(isNull(checkins.checkedOutAt), gte(checkins.checkedInAt, since)))
      .orderBy(desc(checkins.checkedInAt));

    return rows.map(toEntity);
  }

  async countOpen(since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(checkins)
      .where(and(isNull(checkins.checkedOutAt), gte(checkins.checkedInAt, since)));

    return Number(row?.value ?? 0);
  }

  async create(checkin: Checkin): Promise<void> {
    const props = checkin.snapshot();

    await this.db.insert(checkins).values({
      id: props.id,
      memberId: props.memberId,
      checkedInAt: props.checkedInAt,
      checkedOutAt: props.checkedOutAt,
      method: props.method,
      recordedByUserId: props.recordedByUserId,
      kioskTokenId: props.kioskTokenId,
    });
  }

  async save(checkin: Checkin): Promise<void> {
    const props = checkin.snapshot();

    await this.db
      .update(checkins)
      .set({ checkedOutAt: props.checkedOutAt })
      .where(eq(checkins.id, props.id));
  }

  async dailyCountsForMember(memberId: string, from: Date, to: Date): Promise<DailyCount[]> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(${checkins.checkedInAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(checkins)
      .where(
        and(
          eq(checkins.memberId, memberId),
          gte(checkins.checkedInAt, from),
          lte(checkins.checkedInAt, to),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  }

  async lastVisitForMembers(memberIds: readonly string[]): Promise<Record<string, Date>> {
    if (memberIds.length === 0) return {};

    const rows = await this.db
      .select({
        memberId: checkins.memberId,
        lastVisit: sql<Date>`max(${checkins.checkedInAt})`,
      })
      .from(checkins)
      .where(inArray(checkins.memberId, [...memberIds]))
      .groupBy(checkins.memberId);

    return Object.fromEntries(
      rows.map((row) => [row.memberId, new Date(row.lastVisit)] as const),
    );
  }

  async countForMember(memberId: string, since?: Date): Promise<number> {
    const conditions = [eq(checkins.memberId, memberId)];
    if (since) conditions.push(gte(checkins.checkedInAt, since));

    const [row] = await this.db
      .select({ value: count() })
      .from(checkins)
      .where(and(...conditions));

    return Number(row?.value ?? 0);
  }
}
