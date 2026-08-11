import { AuditLogEntry } from "@/domain/entities/audit-log";
import { Checkin } from "@/domain/entities/checkin";
import { KioskToken } from "@/domain/entities/kiosk-token";
import { Member } from "@/domain/entities/member";
import { MembershipPlan } from "@/domain/entities/membership-plan";
import { Shift } from "@/domain/entities/shift";
import { ShiftSwapRequest } from "@/domain/entities/shift-swap-request";
import { TrainerSession } from "@/domain/entities/trainer-session";
import { User } from "@/domain/entities/user";
import type { MembershipStatus } from "@/domain/value-objects/membership-status";

import type {
  AuditLogRepository,
  CheckinListFilters,
  CheckinRepository,
  DailyCount,
  KioskTokenRepository,
  MemberListFilters,
  MemberRepository,
  MembershipPlanRepository,
  Page,
  ShiftListFilters,
  ShiftRepository,
  SwapRequestRepository,
  TrainerSessionListFilters,
  TrainerSessionRepository,
  UserRepository,
} from "@/application/ports/repositories";
import type { Clock, IdGenerator, TokenGenerator } from "@/application/ports/services";

/**
 * In-memory fakes used by the use-case tests.
 *
 * They implement the same ports as the Drizzle repositories, so the use cases
 * under test are the real ones — no database, no mocking framework.
 */

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = date;
  }

  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * 86_400_000);
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = "0000000a-0000-4000-8000") {}

  next(): string {
    this.counter += 1;
    return `${this.prefix}-${String(this.counter).padStart(12, "0")}`;
  }
}

export class FakeTokenGenerator implements TokenGenerator {
  async generate() {
    const plaintext = "kiosk-test-token";
    return { plaintext, hash: await this.hash(plaintext), prefix: plaintext.slice(0, 6) };
  }

  async hash(plaintext: string): Promise<string> {
    return `hashed:${plaintext}`;
  }
}

export class InMemoryMemberRepository implements MemberRepository {
  readonly items = new Map<string, Member>();
  private sequence = 0;

  seed(members: readonly Member[]): void {
    for (const member of members) {
      this.items.set(member.id, member);
      this.sequence = Math.max(this.sequence, member.code.sequence);
    }
  }

  async findById(id: string): Promise<Member | null> {
    return this.items.get(id) ?? null;
  }

  async findByCode(code: string): Promise<Member | null> {
    return [...this.items.values()].find((member) => member.code.value === code) ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<Member[]> {
    return ids.flatMap((id) => {
      const member = this.items.get(id);
      return member ? [member] : [];
    });
  }

  async search(query: string, limit: number): Promise<Member[]> {
    const needle = query.toLowerCase();

    return [...this.items.values()]
      .filter((member) => !member.isDeleted)
      .filter((member) =>
        [member.fullName, member.code.value, member.email ?? "", member.phone ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, limit);
  }

  async list(filters: MemberListFilters): Promise<Page<Member>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    let rows = [...this.items.values()];

    if (!filters.includeDeleted) rows = rows.filter((member) => !member.isDeleted);
    if (filters.status && filters.status !== "all") {
      rows = rows.filter((member) => member.status === filters.status);
    }
    if (filters.planId) rows = rows.filter((member) => member.planId === filters.planId);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      rows = rows.filter((member) =>
        `${member.fullName} ${member.code.value} ${member.email ?? ""}`
          .toLowerCase()
          .includes(needle),
      );
    }

    if (filters.sort === "name") {
      rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else {
      rows.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
    }

    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  }

  async save(member: Member): Promise<void> {
    this.items.set(member.id, member);
  }

  async create(member: Member): Promise<void> {
    this.items.set(member.id, member);
  }

  async nextMemberSequence(): Promise<number> {
    this.sequence += 1;
    return this.sequence;
  }

  async countByStatus(): Promise<Record<MembershipStatus, number>> {
    const counts: Record<MembershipStatus, number> = {
      active: 0,
      frozen: 0,
      expired: 0,
      cancelled: 0,
    };

    for (const member of this.items.values()) {
      if (!member.isDeleted) counts[member.status] += 1;
    }

    return counts;
  }
}

export class InMemoryCheckinRepository implements CheckinRepository {
  readonly items: Checkin[] = [];

  async findById(id: string): Promise<Checkin | null> {
    return this.items.find((visit) => visit.id === id) ?? null;
  }

  async findOpenForMember(memberId: string): Promise<Checkin | null> {
    return (
      this.items.find((visit) => visit.memberId === memberId && visit.isOpen) ?? null
    );
  }

  async findLastForMember(memberId: string): Promise<Checkin | null> {
    return (
      [...this.items]
        .filter((visit) => visit.memberId === memberId)
        .sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime())[0] ?? null
    );
  }

  async list(filters: CheckinListFilters): Promise<Checkin[]> {
    return this.items
      .filter((visit) => !filters.memberId || visit.memberId === filters.memberId)
      .filter((visit) => !filters.from || visit.checkedInAt >= filters.from)
      .filter((visit) => !filters.to || visit.checkedInAt <= filters.to)
      .filter((visit) => !filters.openOnly || visit.isOpen)
      .sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime())
      .slice(0, filters.limit ?? 50);
  }

  async listOpen(since: Date): Promise<Checkin[]> {
    return this.items.filter((visit) => visit.isOpen && visit.checkedInAt >= since);
  }

  async countOpen(since: Date): Promise<number> {
    return (await this.listOpen(since)).length;
  }

  async create(checkin: Checkin): Promise<void> {
    this.items.push(checkin);
  }

  async save(checkin: Checkin): Promise<void> {
    const index = this.items.findIndex((visit) => visit.id === checkin.id);
    if (index >= 0) this.items[index] = checkin;
    else this.items.push(checkin);
  }

  async dailyCountsForMember(memberId: string, from: Date, to: Date): Promise<DailyCount[]> {
    const counts = new Map<string, number>();

    for (const visit of this.items) {
      if (visit.memberId !== memberId) continue;
      if (visit.checkedInAt < from || visit.checkedInAt > to) continue;

      const key = visit.checkedInAt.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async lastVisitForMembers(memberIds: readonly string[]): Promise<Record<string, Date>> {
    const result: Record<string, Date> = {};

    for (const visit of this.items) {
      if (!memberIds.includes(visit.memberId)) continue;

      const current = result[visit.memberId];
      if (!current || visit.checkedInAt > current) {
        result[visit.memberId] = visit.checkedInAt;
      }
    }

    return result;
  }

  async countForMember(memberId: string, since?: Date): Promise<number> {
    return this.items.filter(
      (visit) => visit.memberId === memberId && (!since || visit.checkedInAt >= since),
    ).length;
  }
}

export class InMemoryPlanRepository implements MembershipPlanRepository {
  readonly items = new Map<string, MembershipPlan>();

  seed(plans: readonly MembershipPlan[]): void {
    for (const plan of plans) this.items.set(plan.id, plan);
  }

  async findById(id: string): Promise<MembershipPlan | null> {
    return this.items.get(id) ?? null;
  }

  async list(options?: { includeInactive?: boolean }): Promise<MembershipPlan[]> {
    return [...this.items.values()].filter(
      (plan) => options?.includeInactive || plan.isActive,
    );
  }

  async create(plan: MembershipPlan): Promise<void> {
    this.items.set(plan.id, plan);
  }

  async save(plan: MembershipPlan): Promise<void> {
    this.items.set(plan.id, plan);
  }

  async countMembersOnPlan(): Promise<number> {
    return 0;
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly entries: AuditLogEntry[] = [];

  async append(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }

  async listForEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<AuditLogEntry[]> {
    return this.entries
      .filter((entry) => entry.entityType === entityType && entry.entityId === entityId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listRecent(limit: number): Promise<AuditLogEntry[]> {
    return [...this.entries]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export class InMemoryShiftRepository implements ShiftRepository {
  readonly items = new Map<string, Shift>();

  seed(shifts: readonly Shift[]): void {
    for (const shift of shifts) this.items.set(shift.id, shift);
  }

  async findById(id: string): Promise<Shift | null> {
    return this.items.get(id) ?? null;
  }

  async list(filters: ShiftListFilters): Promise<Shift[]> {
    return [...this.items.values()]
      .filter((shift) => !filters.userId || shift.userId === filters.userId)
      .filter((shift) => !filters.userIds || filters.userIds.includes(shift.userId))
      .filter((shift) => shift.endsAt > filters.from && shift.startsAt < filters.to)
      .filter((shift) =>
        !filters.status || filters.status === "all" ? true : shift.status === filters.status,
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async findOverlapping(
    userId: string,
    from: Date,
    to: Date,
    excludeShiftId?: string,
  ): Promise<Shift[]> {
    return [...this.items.values()].filter(
      (shift) =>
        shift.userId === userId &&
        shift.id !== excludeShiftId &&
        shift.isActive &&
        shift.startsAt < to &&
        from < shift.endsAt,
    );
  }

  async create(shift: Shift): Promise<void> {
    this.items.set(shift.id, shift);
  }

  async save(shift: Shift): Promise<void> {
    this.items.set(shift.id, shift);
  }
}

export class InMemorySwapRequestRepository implements SwapRequestRepository {
  readonly items = new Map<string, ShiftSwapRequest>();

  async findById(id: string): Promise<ShiftSwapRequest | null> {
    return this.items.get(id) ?? null;
  }

  async findPendingForShift(shiftId: string): Promise<ShiftSwapRequest | null> {
    return (
      [...this.items.values()].find(
        (request) => request.shiftId === shiftId && request.isPending,
      ) ?? null
    );
  }

  async list(filters: {
    status?: string;
    requestedByUserId?: string;
  }): Promise<ShiftSwapRequest[]> {
    return [...this.items.values()]
      .filter((request) =>
        !filters.status || filters.status === "all" ? true : request.status === filters.status,
      )
      .filter(
        (request) =>
          !filters.requestedByUserId || request.requestedByUserId === filters.requestedByUserId,
      );
  }

  async create(request: ShiftSwapRequest): Promise<void> {
    this.items.set(request.id, request);
  }

  async save(request: ShiftSwapRequest): Promise<void> {
    this.items.set(request.id, request);
  }
}

export class InMemoryTrainerSessionRepository implements TrainerSessionRepository {
  readonly items = new Map<string, TrainerSession>();

  seed(sessions: readonly TrainerSession[]): void {
    for (const session of sessions) this.items.set(session.id, session);
  }

  async findById(id: string): Promise<TrainerSession | null> {
    return this.items.get(id) ?? null;
  }

  async list(filters: TrainerSessionListFilters): Promise<TrainerSession[]> {
    return [...this.items.values()]
      .filter((session) => !filters.trainerId || session.trainerId === filters.trainerId)
      .filter((session) => !filters.memberId || session.memberId === filters.memberId)
      .filter((session) => session.endsAt > filters.from && session.startsAt < filters.to)
      .filter((session) =>
        !filters.status || filters.status === "all" ? true : session.status === filters.status,
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async findOverlapping(
    trainerId: string,
    from: Date,
    to: Date,
    excludeSessionId?: string,
  ): Promise<TrainerSession[]> {
    return [...this.items.values()].filter(
      (session) =>
        session.trainerId === trainerId &&
        session.id !== excludeSessionId &&
        session.isActive &&
        session.startsAt < to &&
        from < session.endsAt,
    );
  }

  async create(session: TrainerSession): Promise<void> {
    this.items.set(session.id, session);
  }

  async save(session: TrainerSession): Promise<void> {
    this.items.set(session.id, session);
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly items = new Map<string, User>();

  seed(users: readonly User[]): void {
    for (const user of users) this.items.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.items.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.items.values()].find((user) => user.email === email) ?? null;
  }

  async findCredentialsByEmail(): Promise<{ user: User; passwordHash: string } | null> {
    return null;
  }

  async list(filters?: { role?: string; includeInactive?: boolean }): Promise<User[]> {
    return [...this.items.values()]
      .filter((user) => !filters?.role || user.role === filters.role)
      .filter((user) => filters?.includeInactive || user.isActive);
  }

  async create(user: User): Promise<void> {
    this.items.set(user.id, user);
  }

  async save(user: User): Promise<void> {
    this.items.set(user.id, user);
  }
}

export class InMemoryKioskTokenRepository implements KioskTokenRepository {
  readonly items = new Map<string, KioskToken>();

  seed(tokens: readonly KioskToken[]): void {
    for (const token of tokens) this.items.set(token.id, token);
  }

  async findById(id: string): Promise<KioskToken | null> {
    return this.items.get(id) ?? null;
  }

  async findByHash(hash: string): Promise<KioskToken | null> {
    return [...this.items.values()].find((token) => token.tokenHash === hash) ?? null;
  }

  async list(): Promise<KioskToken[]> {
    return [...this.items.values()];
  }

  async create(token: KioskToken): Promise<void> {
    this.items.set(token.id, token);
  }

  async save(token: KioskToken): Promise<void> {
    this.items.set(token.id, token);
  }
}
