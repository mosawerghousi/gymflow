import { sql } from "drizzle-orm";

import type {
  AtRiskMember,
  DailyCount,
  HourlyBucket,
  MembershipSnapshot,
  PlanBreakdownRow,
  ReportRepository,
  StaffHoursRow,
  TrainerPerformanceRow,
} from "@/application/ports/repositories";
import type { UserRole } from "@/domain/entities/user";

import type { Database } from "../client";

/**
 * Every figure on the reports screen is computed by Postgres.
 *
 * Nothing here pulls rows into JavaScript to fold them — a 200-member demo and
 * a 20,000-member gym cost the same round trip.
 */
export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async membershipSnapshot(asOf: Date): Promise<MembershipSnapshot> {
    const rows = await this.db.execute<{
      active: string;
      frozen: string;
      expired: string;
      cancelled: string;
      total: string;
    }>(sql`
      select
        count(*) filter (
          where status = 'active' and (membership_ends_at is null or membership_ends_at > ${asOf})
        ) as active,
        count(*) filter (where status = 'frozen') as frozen,
        count(*) filter (
          where status = 'expired'
             or (status = 'active' and membership_ends_at <= ${asOf})
        ) as expired,
        count(*) filter (where status = 'cancelled') as cancelled,
        count(*) as total
      from members
      where deleted_at is null
    `);

    const row = rows[0];

    return {
      active: Number(row?.active ?? 0),
      frozen: Number(row?.frozen ?? 0),
      expired: Number(row?.expired ?? 0),
      cancelled: Number(row?.cancelled ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  async signupsPerDay(from: Date, to: Date): Promise<DailyCount[]> {
    const rows = await this.db.execute<{ date: string; count: string }>(sql`
      select to_char(joined_at at time zone 'UTC', 'YYYY-MM-DD') as date, count(*) as count
      from members
      where joined_at between ${from} and ${to}
      group by 1
      order by 1
    `);

    return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  }

  async cancellationsPerDay(from: Date, to: Date): Promise<DailyCount[]> {
    const rows = await this.db.execute<{ date: string; count: string }>(sql`
      select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD') as date, count(*) as count
      from members
      where status = 'cancelled' and updated_at between ${from} and ${to}
      group by 1
      order by 1
    `);

    return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  }

  async checkinsPerDay(from: Date, to: Date): Promise<DailyCount[]> {
    const rows = await this.db.execute<{ date: string; count: string }>(sql`
      select to_char(checked_in_at at time zone 'UTC', 'YYYY-MM-DD') as date, count(*) as count
      from checkins
      where checked_in_at between ${from} and ${to}
      group by 1
      order by 1
    `);

    return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  }

  async uniqueVisitors(from: Date, to: Date): Promise<number> {
    const rows = await this.db.execute<{ count: string }>(sql`
      select count(distinct member_id) as count
      from checkins
      where checked_in_at between ${from} and ${to}
    `);

    return Number(rows[0]?.count ?? 0);
  }

  async busiestHours(from: Date, to: Date): Promise<HourlyBucket[]> {
    const rows = await this.db.execute<{
      day_of_week: string;
      hour: string;
      count: string;
    }>(sql`
      select
        extract(dow from checked_in_at at time zone 'UTC')::int  as day_of_week,
        extract(hour from checked_in_at at time zone 'UTC')::int as hour,
        count(*) as count
      from checkins
      where checked_in_at between ${from} and ${to}
      group by 1, 2
      order by 1, 2
    `);

    return rows.map((row) => ({
      dayOfWeek: Number(row.day_of_week),
      hour: Number(row.hour),
      count: Number(row.count),
    }));
  }

  async atRiskMembers(asOf: Date, inactiveDays: number, limit: number): Promise<AtRiskMember[]> {
    const rows = await this.db.execute<{
      member_id: string;
      member_code: string;
      full_name: string;
      email: string | null;
      last_visit_at: string | null;
      days_since_last_visit: string | null;
      membership_ends_at: string | null;
    }>(sql`
      with last_visits as (
        select member_id, max(checked_in_at) as last_visit_at
        from checkins
        group by member_id
      )
      select
        m.id                                  as member_id,
        m.member_code                         as member_code,
        m.first_name || ' ' || m.last_name    as full_name,
        m.email                               as email,
        lv.last_visit_at                      as last_visit_at,
        case
          when lv.last_visit_at is null then null
          else floor(extract(epoch from (${asOf}::timestamptz - lv.last_visit_at)) / 86400)::int
        end                                   as days_since_last_visit,
        m.membership_ends_at                  as membership_ends_at
      from members m
      left join last_visits lv on lv.member_id = m.id
      where m.deleted_at is null
        and m.status in ('active', 'frozen')
        and (m.membership_ends_at is null or m.membership_ends_at > ${asOf})
        and (
          lv.last_visit_at is null
          or lv.last_visit_at < ${asOf}::timestamptz - make_interval(days => ${inactiveDays})
        )
      order by lv.last_visit_at asc nulls first
      limit ${limit}
    `);

    return rows.map((row) => ({
      memberId: row.member_id,
      memberCode: row.member_code,
      fullName: row.full_name,
      email: row.email,
      lastVisitAt: row.last_visit_at ? new Date(row.last_visit_at) : null,
      daysSinceLastVisit:
        row.days_since_last_visit === null ? null : Number(row.days_since_last_visit),
      membershipEndsAt: row.membership_ends_at ? new Date(row.membership_ends_at) : null,
    }));
  }

  async staffHours(from: Date, to: Date): Promise<StaffHoursRow[]> {
    const rows = await this.db.execute<{
      user_id: string;
      name: string;
      role: UserRole;
      scheduled_hours: string;
      completed_hours: string;
      shift_count: string;
    }>(sql`
      select
        u.id   as user_id,
        u.name as name,
        u.role as role,
        coalesce(sum(
          extract(epoch from (s.ends_at - s.starts_at)) / 3600
        ) filter (where s.status <> 'cancelled'), 0) as scheduled_hours,
        coalesce(sum(
          extract(epoch from (s.ends_at - s.starts_at)) / 3600
        ) filter (where s.status = 'completed'), 0) as completed_hours,
        count(s.id) filter (where s.status <> 'cancelled') as shift_count
      from users u
      left join shifts s
        on s.user_id = u.id
       and s.starts_at >= ${from}
       and s.starts_at <= ${to}
      where u.is_active = true
      group by u.id, u.name, u.role
      order by scheduled_hours desc, u.name asc
    `);

    return rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      role: row.role,
      scheduledHours: Number(row.scheduled_hours),
      completedHours: Number(row.completed_hours),
      shiftCount: Number(row.shift_count),
    }));
  }

  async trainerPerformance(from: Date, to: Date): Promise<TrainerPerformanceRow[]> {
    const rows = await this.db.execute<{
      trainer_id: string;
      name: string;
      booked: string;
      completed: string;
      no_show: string;
      cancelled: string;
    }>(sql`
      select
        u.id   as trainer_id,
        u.name as name,
        count(ts.id) filter (where ts.status = 'booked')    as booked,
        count(ts.id) filter (where ts.status = 'completed') as completed,
        count(ts.id) filter (where ts.status = 'no_show')   as no_show,
        count(ts.id) filter (where ts.status = 'cancelled') as cancelled
      from users u
      left join trainer_sessions ts
        on ts.trainer_id = u.id
       and ts.starts_at >= ${from}
       and ts.starts_at <= ${to}
      where u.role = 'trainer' and u.is_active = true
      group by u.id, u.name
      order by u.name asc
    `);

    return rows.map((row) => {
      const completed = Number(row.completed);
      const noShow = Number(row.no_show);
      // Rates are measured against sessions that actually came due — a
      // cancellation was called off in advance and is not a trainer outcome.
      const resolved = completed + noShow;

      return {
        trainerId: row.trainer_id,
        name: row.name,
        booked: Number(row.booked),
        completed,
        noShow,
        cancelled: Number(row.cancelled),
        completionRate: resolved === 0 ? 0 : Math.round((completed / resolved) * 1000) / 10,
        noShowRate: resolved === 0 ? 0 : Math.round((noShow / resolved) * 1000) / 10,
      };
    });
  }

  async planBreakdown(): Promise<PlanBreakdownRow[]> {
    const rows = await this.db.execute<{
      plan_id: string;
      plan_name: string;
      member_count: string;
      monthly_revenue_cents: string;
    }>(sql`
      select
        p.id   as plan_id,
        p.name as plan_name,
        count(m.id) as member_count,
        coalesce(round(count(m.id) * (p.price_cents::numeric / p.duration_days * 30)), 0)
          as monthly_revenue_cents
      from membership_plans p
      left join members m
        on m.plan_id = p.id
       and m.deleted_at is null
       and m.status in ('active', 'frozen')
      group by p.id, p.name, p.price_cents, p.duration_days
      order by member_count desc, p.name asc
    `);

    return rows.map((row) => ({
      planId: row.plan_id,
      planName: row.plan_name,
      memberCount: Number(row.member_count),
      monthlyRevenueCents: Number(row.monthly_revenue_cents),
    }));
  }

  async churnedCount(from: Date, to: Date): Promise<number> {
    const rows = await this.db.execute<{ count: string }>(sql`
      select count(*) as count
      from members
      where deleted_at is null
        and status = 'cancelled'
        and updated_at between ${from} and ${to}
    `);

    return Number(rows[0]?.count ?? 0);
  }

  async activeAt(instant: Date): Promise<number> {
    const rows = await this.db.execute<{ count: string }>(sql`
      select count(*) as count
      from members
      where deleted_at is null
        and joined_at <= ${instant}
        and (membership_ends_at is null or membership_ends_at > ${instant})
        and status <> 'cancelled'
    `);

    return Number(rows[0]?.count ?? 0);
  }
}
