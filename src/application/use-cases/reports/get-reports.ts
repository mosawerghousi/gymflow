import type { User } from "@/domain/entities/user";
import { DateRange } from "@/domain/value-objects/date-range";

import type {
  AtRiskMemberDto,
  BusiestHoursDto,
  MetricDto,
  ReportOverviewDto,
  ReportRangeInput,
  StaffHoursDto,
  TrainerPerformanceDto,
  TrendsDto,
} from "../../dto/report.dto";
import type { DailyCount, ReportRepository } from "../../ports/repositories";
import type { Clock } from "../../ports/services";

export interface ReportDeps {
  reports: ReportRepository;
  clock: Clock;
}

/** Turns the loose `{ from?, to?, days }` query into a concrete range. */
export function resolveRange(input: ReportRangeInput, now: Date): DateRange {
  if (input.from && input.to) {
    return DateRange.create(input.from, input.to);
  }

  return DateRange.lastDays(input.days, now);
}

function metric(value: number, previousValue: number): MetricDto {
  const changePct =
    previousValue === 0 ? (value === 0 ? 0 : null) : ((value - previousValue) / previousValue) * 100;

  return {
    value,
    previousValue,
    changePct: changePct === null ? null : Math.round(changePct * 10) / 10,
  };
}

function sum(rows: readonly DailyCount[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

function rangeMeta(range: DateRange) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    days: range.days,
  };
}

/**
 * Headline numbers for the reports screen, each with a period-over-period
 * delta against the immediately preceding window of the same length.
 */
export function makeGetReportOverview(deps: ReportDeps) {
  return async function getReportOverview(
    actor: User,
    input: ReportRangeInput,
  ): Promise<ReportOverviewDto> {
    actor.assertCan("reports:read:limited");

    const now = deps.clock.now();
    const range = resolveRange(input, now);
    const previous = range.previousPeriod();

    const [
      membership,
      signups,
      previousSignups,
      churn,
      previousChurn,
      checkins,
      previousCheckins,
      uniqueVisitors,
      previousUnique,
      plans,
      activeAtStart,
    ] = await Promise.all([
      deps.reports.membershipSnapshot(now),
      deps.reports.signupsPerDay(range.from, range.to),
      deps.reports.signupsPerDay(previous.from, previous.to),
      deps.reports.churnedCount(range.from, range.to),
      deps.reports.churnedCount(previous.from, previous.to),
      deps.reports.checkinsPerDay(range.from, range.to),
      deps.reports.checkinsPerDay(previous.from, previous.to),
      deps.reports.uniqueVisitors(range.from, range.to),
      deps.reports.uniqueVisitors(previous.from, previous.to),
      deps.reports.planBreakdown(),
      deps.reports.activeAt(range.from),
    ]);

    const checkinTotal = sum(checkins);

    return {
      range: rangeMeta(range),
      membership,
      signups: metric(sum(signups), sum(previousSignups)),
      churn: metric(churn, previousChurn),
      checkins: metric(checkinTotal, sum(previousCheckins)),
      uniqueVisitors: metric(uniqueVisitors, previousUnique),
      churnRatePct:
        activeAtStart === 0 ? 0 : Math.round((churn / activeAtStart) * 1000) / 10,
      averageVisitsPerActiveMember:
        membership.active === 0 ? 0 : Math.round((checkinTotal / membership.active) * 10) / 10,
      plans: plans.map((plan) => ({
        planId: plan.planId,
        planName: plan.planName,
        memberCount: plan.memberCount,
        monthlyRevenueCents: plan.monthlyRevenueCents,
      })),
    };
  };
}

/** Sign-ups, cancellations and check-ins per day, zero-filled for the charts. */
export function makeGetTrends(deps: ReportDeps) {
  return async function getTrends(actor: User, input: ReportRangeInput): Promise<TrendsDto> {
    actor.assertCan("reports:read:limited");

    const now = deps.clock.now();
    const range = resolveRange(input, now);

    const [signups, cancellations, checkins] = await Promise.all([
      deps.reports.signupsPerDay(range.from, range.to),
      deps.reports.cancellationsPerDay(range.from, range.to),
      deps.reports.checkinsPerDay(range.from, range.to),
    ]);

    return {
      range: rangeMeta(range),
      signups: zeroFill(signups, range),
      cancellations: zeroFill(cancellations, range),
      checkins: zeroFill(checkins, range),
    };
  };
}

/** Day-of-week × hour heatmap of check-in volume. */
export function makeGetBusiestHours(deps: ReportDeps) {
  return async function getBusiestHours(
    actor: User,
    input: ReportRangeInput,
  ): Promise<BusiestHoursDto> {
    actor.assertCan("reports:read:limited");

    const now = deps.clock.now();
    const range = resolveRange(input, now);
    const buckets = await deps.reports.busiestHours(range.from, range.to);

    const matrix: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));

    let peak: BusiestHoursDto["peak"] = null;

    for (const bucket of buckets) {
      const row = matrix[bucket.dayOfWeek];
      if (!row) continue;

      row[bucket.hour] = bucket.count;
      byHour[bucket.hour]!.count += bucket.count;

      if (!peak || bucket.count > peak.count) {
        peak = { dayOfWeek: bucket.dayOfWeek, hour: bucket.hour, count: bucket.count };
      }
    }

    return { range: rangeMeta(range), matrix, peak, byHour };
  };
}

/** Members with an active plan who have not visited in `inactiveDays`. */
export function makeGetAtRiskMembers(deps: ReportDeps) {
  return async function getAtRiskMembers(
    actor: User,
    input: { inactiveDays: number; limit: number },
  ): Promise<AtRiskMemberDto[]> {
    actor.assertCan("reports:read:limited");

    const now = deps.clock.now();
    const rows = await deps.reports.atRiskMembers(now, input.inactiveDays, input.limit);

    return rows.map((row) => ({
      memberId: row.memberId,
      memberCode: row.memberCode,
      fullName: row.fullName,
      email: row.email,
      lastVisitAt: row.lastVisitAt?.toISOString() ?? null,
      daysSinceLastVisit: row.daysSinceLastVisit,
      membershipEndsAt: row.membershipEndsAt?.toISOString() ?? null,
    }));
  };
}

/** Scheduled vs. completed hours per staff member. Admin-only. */
export function makeGetStaffHours(deps: ReportDeps) {
  return async function getStaffHours(
    actor: User,
    input: ReportRangeInput,
  ): Promise<StaffHoursDto> {
    actor.assertCan("reports:read:full");

    const now = deps.clock.now();
    const range = resolveRange(input, now);
    const rows = await deps.reports.staffHours(range.from, range.to);

    return {
      range: rangeMeta(range),
      rows: rows.map((row) => ({
        userId: row.userId,
        name: row.name,
        role: row.role,
        scheduledHours: Math.round(row.scheduledHours * 10) / 10,
        completedHours: Math.round(row.completedHours * 10) / 10,
        shiftCount: row.shiftCount,
      })),
      totalScheduledHours:
        Math.round(rows.reduce((total, row) => total + row.scheduledHours, 0) * 10) / 10,
    };
  };
}

/** Completion and no-show rates per trainer. */
export function makeGetTrainerPerformance(deps: ReportDeps) {
  return async function getTrainerPerformance(
    actor: User,
    input: ReportRangeInput,
  ): Promise<TrainerPerformanceDto> {
    actor.assertCan("reports:read:limited");

    const now = deps.clock.now();
    const range = resolveRange(input, now);
    const rows = await deps.reports.trainerPerformance(range.from, range.to);

    const visible =
      actor.role === "trainer" ? rows.filter((row) => row.trainerId === actor.id) : rows;

    return { range: rangeMeta(range), rows: visible };
  };
}

/** Fills gaps so a chart shows a continuous line rather than a jagged one. */
function zeroFill(rows: readonly DailyCount[], range: DateRange) {
  const byDate = new Map(rows.map((row) => [row.date, row.count]));
  const out: DailyCount[] = [];

  for (let day = 0; day < range.days; day += 1) {
    const date = new Date(range.from.getTime() + day * 86_400_000).toISOString().slice(0, 10);
    out.push({ date, count: byDate.get(date) ?? 0 });
  }

  return out;
}
