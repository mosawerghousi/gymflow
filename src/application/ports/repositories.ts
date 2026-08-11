import type { AuditLogEntry } from "@/domain/entities/audit-log";
import type { Checkin } from "@/domain/entities/checkin";
import type { KioskToken } from "@/domain/entities/kiosk-token";
import type { MembershipPlan } from "@/domain/entities/membership-plan";
import type { Member } from "@/domain/entities/member";
import type { OperatingHours } from "@/domain/entities/operating-hours";
import type { Shift, ShiftStatus } from "@/domain/entities/shift";
import type { ShiftSwapRequest, SwapRequestStatus } from "@/domain/entities/shift-swap-request";
import type { TrainerSession, TrainerSessionStatus } from "@/domain/entities/trainer-session";
import type { User, UserRole } from "@/domain/entities/user";
import type { MembershipStatus } from "@/domain/value-objects/membership-status";

/**
 * Repository ports.
 *
 * The application layer talks only to these. `/infrastructure/db` provides the
 * Drizzle-backed implementations; the unit tests provide in-memory fakes.
 */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MemberListFilters {
  search?: string;
  status?: MembershipStatus | "all";
  planId?: string;
  includeDeleted?: boolean;
  sort?: "recent" | "name" | "expiring";
  page?: number;
  pageSize?: number;
}

export interface MemberRepository {
  findById(id: string): Promise<Member | null>;
  findByCode(code: string): Promise<Member | null>;
  findByIds(ids: readonly string[]): Promise<Member[]>;
  /** Front-desk rapid search across name, code, email and phone. */
  search(query: string, limit: number): Promise<Member[]>;
  list(filters: MemberListFilters): Promise<Page<Member>>;
  save(member: Member): Promise<void>;
  create(member: Member): Promise<void>;
  /** Next value for the `GF-000123` sequence. */
  nextMemberSequence(): Promise<number>;
  countByStatus(): Promise<Record<MembershipStatus, number>>;
}

export interface CheckinListFilters {
  memberId?: string;
  from?: Date;
  to?: Date;
  openOnly?: boolean;
  limit?: number;
}

export interface CheckinRepository {
  findById(id: string): Promise<Checkin | null>;
  /** The member's currently open visit, if any. */
  findOpenForMember(memberId: string): Promise<Checkin | null>;
  findLastForMember(memberId: string): Promise<Checkin | null>;
  list(filters: CheckinListFilters): Promise<Checkin[]>;
  listOpen(since: Date): Promise<Checkin[]>;
  countOpen(since: Date): Promise<number>;
  create(checkin: Checkin): Promise<void>;
  save(checkin: Checkin): Promise<void>;
  /** Visit counts per day for a single member's attendance chart. */
  dailyCountsForMember(memberId: string, from: Date, to: Date): Promise<DailyCount[]>;
  /**
   * Most recent visit per member, in one round trip — keeps the member list off
   * an N+1 query when rendering "last seen".
   */
  lastVisitForMembers(memberIds: readonly string[]): Promise<Record<string, Date>>;
  countForMember(memberId: string, since?: Date): Promise<number>;
}

export interface ShiftListFilters {
  userId?: string;
  userIds?: readonly string[];
  from: Date;
  to: Date;
  status?: ShiftStatus | "all";
}

export interface ShiftRepository {
  findById(id: string): Promise<Shift | null>;
  list(filters: ShiftListFilters): Promise<Shift[]>;
  /** Active shifts for one user that overlap `[from, to)` — the conflict check. */
  findOverlapping(userId: string, from: Date, to: Date, excludeShiftId?: string): Promise<Shift[]>;
  create(shift: Shift): Promise<void>;
  save(shift: Shift): Promise<void>;
}

export interface SwapRequestRepository {
  findById(id: string): Promise<ShiftSwapRequest | null>;
  findPendingForShift(shiftId: string): Promise<ShiftSwapRequest | null>;
  list(filters: { status?: SwapRequestStatus | "all"; requestedByUserId?: string }): Promise<
    ShiftSwapRequest[]
  >;
  create(request: ShiftSwapRequest): Promise<void>;
  save(request: ShiftSwapRequest): Promise<void>;
}

export interface TrainerSessionListFilters {
  trainerId?: string;
  memberId?: string;
  from: Date;
  to: Date;
  status?: TrainerSessionStatus | "all";
}

export interface TrainerSessionRepository {
  findById(id: string): Promise<TrainerSession | null>;
  list(filters: TrainerSessionListFilters): Promise<TrainerSession[]>;
  findOverlapping(
    trainerId: string,
    from: Date,
    to: Date,
    excludeSessionId?: string,
  ): Promise<TrainerSession[]>;
  create(session: TrainerSession): Promise<void>;
  save(session: TrainerSession): Promise<void>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Returns the stored hash for the credentials provider. */
  findCredentialsByEmail(email: string): Promise<{ user: User; passwordHash: string } | null>;
  list(filters?: { role?: UserRole; includeInactive?: boolean }): Promise<User[]>;
  create(user: User, passwordHash: string): Promise<void>;
  save(user: User): Promise<void>;
}

export interface MembershipPlanRepository {
  findById(id: string): Promise<MembershipPlan | null>;
  list(options?: { includeInactive?: boolean }): Promise<MembershipPlan[]>;
  create(plan: MembershipPlan): Promise<void>;
  save(plan: MembershipPlan): Promise<void>;
  countMembersOnPlan(planId: string): Promise<number>;
}

export interface AuditLogRepository {
  append(entry: AuditLogEntry): Promise<void>;
  listForEntity(entityType: string, entityId: string, limit: number): Promise<AuditLogEntry[]>;
  listRecent(limit: number): Promise<AuditLogEntry[]>;
}

export interface KioskTokenRepository {
  findById(id: string): Promise<KioskToken | null>;
  findByHash(hash: string): Promise<KioskToken | null>;
  list(): Promise<KioskToken[]>;
  create(token: KioskToken): Promise<void>;
  save(token: KioskToken): Promise<void>;
}

export interface SettingsRepository {
  getOperatingHours(): Promise<OperatingHours[]>;
  saveOperatingHours(hours: readonly OperatingHours[]): Promise<void>;
  getGymName(): Promise<string>;
  setGymName(name: string): Promise<void>;
}

/* ------------------------------------------------------------------------- */
/* Reporting                                                                  */
/* ------------------------------------------------------------------------- */

export interface DailyCount {
  /** `YYYY-MM-DD` */
  date: string;
  count: number;
}

export interface HourlyBucket {
  /** 0 (Sunday) – 6 (Saturday) */
  dayOfWeek: number;
  /** 0 – 23 */
  hour: number;
  count: number;
}

export interface AtRiskMember {
  memberId: string;
  memberCode: string;
  fullName: string;
  email: string | null;
  lastVisitAt: Date | null;
  daysSinceLastVisit: number | null;
  membershipEndsAt: Date | null;
}

export interface StaffHoursRow {
  userId: string;
  name: string;
  role: UserRole;
  scheduledHours: number;
  completedHours: number;
  shiftCount: number;
}

export interface TrainerPerformanceRow {
  trainerId: string;
  name: string;
  booked: number;
  completed: number;
  noShow: number;
  cancelled: number;
  completionRate: number;
  noShowRate: number;
}

export interface MembershipSnapshot {
  active: number;
  frozen: number;
  expired: number;
  cancelled: number;
  total: number;
}

export interface PlanBreakdownRow {
  planId: string;
  planName: string;
  memberCount: number;
  monthlyRevenueCents: number;
}

/**
 * All aggregation happens in SQL (spec §5.4) — these methods return finished
 * numbers, never rows for the application layer to fold.
 */
export interface ReportRepository {
  membershipSnapshot(asOf: Date): Promise<MembershipSnapshot>;
  signupsPerDay(from: Date, to: Date): Promise<DailyCount[]>;
  cancellationsPerDay(from: Date, to: Date): Promise<DailyCount[]>;
  checkinsPerDay(from: Date, to: Date): Promise<DailyCount[]>;
  uniqueVisitors(from: Date, to: Date): Promise<number>;
  busiestHours(from: Date, to: Date): Promise<HourlyBucket[]>;
  atRiskMembers(asOf: Date, inactiveDays: number, limit: number): Promise<AtRiskMember[]>;
  staffHours(from: Date, to: Date): Promise<StaffHoursRow[]>;
  trainerPerformance(from: Date, to: Date): Promise<TrainerPerformanceRow[]>;
  planBreakdown(): Promise<PlanBreakdownRow[]>;
  /** Members whose term ended inside the window and were not renewed. */
  churnedCount(from: Date, to: Date): Promise<number>;
  activeAt(instant: Date): Promise<number>;
}
