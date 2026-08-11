import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import type {
  MemberListFilters,
  MemberRepository,
  Page,
} from "@/application/ports/repositories";
import { Member } from "@/domain/entities/member";
import { MemberCode } from "@/domain/value-objects/member-code";
import type { MembershipStatus } from "@/domain/value-objects/membership-status";

import type { Database } from "../client";
import { members, type MemberRow } from "../schema";

export function toMemberEntity(row: MemberRow): Member {
  return new Member({
    id: row.id,
    code: MemberCode.create(row.memberCode),
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    planId: row.planId,
    status: row.status,
    joinedAt: row.joinedAt,
    membershipStartsAt: row.membershipStartsAt,
    membershipEndsAt: row.membershipEndsAt,
    frozenAt: row.frozenAt,
    notes: row.notes,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleMemberRepository implements MemberRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Member | null> {
    const [row] = await this.db.select().from(members).where(eq(members.id, id)).limit(1);
    return row ? toMemberEntity(row) : null;
  }

  async findByCode(code: string): Promise<Member | null> {
    const [row] = await this.db
      .select()
      .from(members)
      .where(eq(members.memberCode, code))
      .limit(1);

    return row ? toMemberEntity(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Member[]> {
    if (ids.length === 0) return [];

    const rows = await this.db.select().from(members).where(inArray(members.id, [...ids]));

    return rows.map(toMemberEntity);
  }

  async search(query: string, limit: number): Promise<Member[]> {
    const pattern = `%${query}%`;
    const normalizedCode = MemberCode.normalize(query);

    const rows = await this.db
      .select()
      .from(members)
      .where(
        and(
          isNull(members.deletedAt),
          or(
            ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, pattern),
            ilike(members.memberCode, `%${normalizedCode}%`),
            ilike(members.memberCode, pattern),
            ilike(members.email, pattern),
            ilike(members.phone, pattern),
          ),
        ),
      )
      .orderBy(asc(members.lastName), asc(members.firstName))
      .limit(limit);

    return rows.map(toMemberEntity);
  }

  async list(filters: MemberListFilters): Promise<Page<Member>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    const conditions = [];

    if (!filters.includeDeleted) conditions.push(isNull(members.deletedAt));

    if (filters.status && filters.status !== "all") {
      conditions.push(
        filters.status === "expired"
          ? // "Expired" is a derived state: either the stored flag says so, or the
            // term has simply run out while the row still says active.
            or(
              eq(members.status, "expired"),
              and(eq(members.status, "active"), sql`${members.membershipEndsAt} <= now()`),
            )!
          : filters.status === "active"
            ? and(
                eq(members.status, "active"),
                or(isNull(members.membershipEndsAt), sql`${members.membershipEndsAt} > now()`),
              )!
            : eq(members.status, filters.status),
      );
    }

    if (filters.planId) conditions.push(eq(members.planId, filters.planId));

    if (filters.search?.trim()) {
      const pattern = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, pattern),
          ilike(members.memberCode, `%${MemberCode.normalize(filters.search)}%`),
          ilike(members.email, pattern),
          ilike(members.phone, pattern),
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy =
      filters.sort === "name"
        ? [asc(members.lastName), asc(members.firstName)]
        : filters.sort === "expiring"
          ? [sql`${members.membershipEndsAt} asc nulls last`]
          : [desc(members.joinedAt)];

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(members)
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(members).where(where),
    ]);

    return {
      items: rows.map(toMemberEntity),
      total: totals?.value ?? 0,
      page,
      pageSize,
    };
  }

  async save(member: Member): Promise<void> {
    const props = member.snapshot();

    await this.db
      .update(members)
      .set({
        firstName: props.firstName,
        lastName: props.lastName,
        email: props.email,
        phone: props.phone,
        planId: props.planId,
        status: props.status,
        membershipStartsAt: props.membershipStartsAt,
        membershipEndsAt: props.membershipEndsAt,
        frozenAt: props.frozenAt,
        notes: props.notes,
        deletedAt: props.deletedAt,
        updatedAt: props.updatedAt,
      })
      .where(eq(members.id, props.id));
  }

  async create(member: Member): Promise<void> {
    const props = member.snapshot();

    await this.db.insert(members).values({
      id: props.id,
      memberCode: props.code.value,
      firstName: props.firstName,
      lastName: props.lastName,
      email: props.email,
      phone: props.phone,
      planId: props.planId,
      status: props.status,
      joinedAt: props.joinedAt,
      membershipStartsAt: props.membershipStartsAt,
      membershipEndsAt: props.membershipEndsAt,
      frozenAt: props.frozenAt,
      notes: props.notes,
      deletedAt: props.deletedAt,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  async nextMemberSequence(): Promise<number> {
    const [row] = await this.db
      .select({
        max: sql<number>`coalesce(max(nullif(regexp_replace(${members.memberCode}, '\\D', '', 'g'), '')::int), 0)`,
      })
      .from(members);

    return Number(row?.max ?? 0) + 1;
  }

  async countByStatus(): Promise<Record<MembershipStatus, number>> {
    const rows = await this.db
      .select({
        status: sql<MembershipStatus>`
          case
            when ${members.status} = 'active' and ${members.membershipEndsAt} <= now() then 'expired'
            else ${members.status}
          end
        `,
        value: count(),
      })
      .from(members)
      .where(isNull(members.deletedAt))
      .groupBy(sql`1`);

    const counts: Record<MembershipStatus, number> = {
      active: 0,
      frozen: 0,
      expired: 0,
      cancelled: 0,
    };

    for (const row of rows) {
      counts[row.status] = Number(row.value);
    }

    return counts;
  }
}
