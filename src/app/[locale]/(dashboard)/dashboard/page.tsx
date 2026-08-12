import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  ScanLine,
  TrendingDown,
  UserPlus,
  Users,
} from "lucide-react";

import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { CheckinSparkline } from "@/presentation/components/dashboard/checkin-sparkline";
import { HeroMetric } from "@/presentation/components/dashboard/hero-metric";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { StatCard } from "@/presentation/components/shared/stat-card";
import { EmptyState } from "@/presentation/components/shared/states";
import { MembershipStatus } from "@/presentation/components/shared/status-badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The "is the gym okay right now?" screen.
 *
 * Laid out on a modified F-pattern: the live occupancy counter sits top-left
 * where the eye lands, supporting metrics run across, and everything below is
 * a shortlist that drills down on click rather than a full table on load.
 */
export default async function DashboardPage() {
  const actor = await requireActor();
  const now = new Date();

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(dayStart.getTime() + 7 * 86_400_000);

  const canSeeReports = actor.can("reports:read:limited");

  const [overview, trends, inGym, schedule, atRisk, expiring] = await Promise.all([
    canSeeReports ? useCases.getReportOverview(actor, { days: 30 }) : Promise.resolve(null),
    canSeeReports ? useCases.getTrends(actor, { days: 14 }) : Promise.resolve(null),
    actor.can("checkins:read")
      ? useCases.getCurrentlyInGym(actor)
      : Promise.resolve({ count: 0, visitors: [] }),
    useCases.getSchedule(actor, {
      from: dayStart,
      to: weekEnd,
      mine: actor.role === "trainer",
    }),
    canSeeReports
      ? useCases.getAtRiskMembers(actor, { inactiveDays: 30, limit: 5 })
      : Promise.resolve([]),
    actor.can("members:read")
      ? useCases.listMembers(actor, {
          page: 1,
          pageSize: 5,
          sort: "expiring",
          status: "active",
          includeDeleted: false,
        })
      : Promise.resolve(null),
  ]);

  const todaysShifts = schedule.shifts
    .filter((shift) => shift.status !== "cancelled" && new Date(shift.startsAt) < weekEnd)
    .filter((shift) => new Date(shift.endsAt) > now)
    .slice(0, 5);

  const expiringSoon = (expiring?.items ?? []).filter(
    (member) => member.daysUntilExpiry !== null && member.daysUntilExpiry <= 14,
  );

  return (
    <>
      <PageHeader
        title={`Good ${greeting(now)}, ${actor.name.split(" ")[0]}`}
        description="Live occupancy, this week's roster, and who needs a call."
        actions={
          actor.can("checkins:write") ? (
            <Button asChild>
              <Link href="/checkin">
                <ScanLine /> Check-in desk
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="space-y-5 px-5 pb-10 sm:px-8">
        {/* Row 1 — hero metric, then the supporting numbers. */}
        <section className="grid gap-4 lg:grid-cols-4">
          <HeroMetric initial={inGym} />

          {overview ? (
            <>
              <StatCard
                label="Active members"
                value={overview.membership.active}
                hint={`${overview.membership.total} on file`}
                icon={Users}
              />
              <StatCard
                label="Sign-ups · 30d"
                value={overview.signups.value}
                changePct={overview.signups.changePct}
                hint="vs. previous 30 days"
                icon={UserPlus}
              />
            </>
          ) : (
            <StatCard
              label="Your sessions"
              value={schedule.sessions.filter((s) => s.status === "booked").length}
              hint="booked this week"
              icon={CalendarClock}
              className="lg:col-span-2"
            />
          )}
        </section>

        {/* Row 2 — the week's shape. */}
        <section className="grid gap-4 lg:grid-cols-3">
          {trends ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Check-ins, last 14 days</CardTitle>
                <CardDescription>
                  {describeTrend(trends.checkins)}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/reports">
                      Reports <ArrowRight />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1">
                <CheckinSparkline data={trends.checkins} className="h-full" />
              </CardContent>
            </Card>
          ) : null}

          <Card className={trends ? "" : "lg:col-span-3"}>
            <CardHeader>
              <CardTitle>On shift</CardTitle>
              <CardDescription>Still to come this week.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/schedule" aria-label="Open the schedule">
                    <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {todaysShifts.length === 0 ? (
                <EmptyState
                  compact
                  icon={Clock3}
                  title="Nothing scheduled"
                  description="No upcoming shifts in the next seven days."
                />
              ) : (
                <ul className="space-y-2.5">
                  {todaysShifts.map((shift) => (
                    <li key={shift.id} className="flex items-center gap-2.5">
                      <MemberAvatar name={shift.userName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{shift.userName}</p>
                        <p data-numeric className="text-xs text-muted-foreground">
                          {formatDayTime(shift.startsAt)} – {formatTime(shift.endsAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Row 3 — the two lists worth acting on. */}
        {canSeeReports ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Expiring soon</CardTitle>
                <CardDescription>Active plans ending in the next two weeks.</CardDescription>
              </CardHeader>
              <CardContent>
                {expiringSoon.length === 0 ? (
                  <EmptyState
                    compact
                    icon={CalendarClock}
                    title="Nothing expiring"
                    description="No active membership ends in the next fortnight."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {expiringSoon.map((member) => (
                      <li key={member.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                        <MemberAvatar name={member.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/members/${member.id}`}
                            className="block truncate text-sm hover:text-primary hover:underline"
                          >
                            {member.fullName}
                          </Link>
                          <p className="font-mono text-2xs text-muted-foreground">
                            {member.code}
                          </p>
                        </div>
                        <span
                          data-numeric
                          className={
                            (member.daysUntilExpiry ?? 0) <= 3
                              ? "shrink-0 text-xs font-medium text-warning"
                              : "shrink-0 text-xs text-muted-foreground"
                          }
                        >
                          {member.daysUntilExpiry === 0
                            ? "today"
                            : `${member.daysUntilExpiry}d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>At risk</CardTitle>
                <CardDescription>Paid up, but no visit in 30 days.</CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/reports" aria-label="Open reports">
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {atRisk.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Users}
                    title="Everyone is showing up"
                    description="No active member has been away for 30 days."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {atRisk.map((member) => (
                      <li
                        key={member.memberId}
                        className="flex items-center gap-3 py-2.5 first:pt-0"
                      >
                        <MemberAvatar name={member.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/members/${member.memberId}`}
                            className="block truncate text-sm hover:text-primary hover:underline"
                          >
                            {member.fullName}
                          </Link>
                          <p className="font-mono text-2xs text-muted-foreground">
                            {member.memberCode}
                          </p>
                        </div>
                        <span data-numeric className="shrink-0 text-xs text-muted-foreground">
                          {member.daysSinceLastVisit === null
                            ? "never"
                            : `${member.daysSinceLastVisit}d ago`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {overview ? (
          <section>
            <Card>
              <CardHeader>
                <CardTitle>Membership mix</CardTitle>
                <CardDescription>
                  {overview.membership.active} of {overview.membership.total} on file are active.
                </CardDescription>
                <CardAction>
                  <StatCardInline
                    label="Cancellations · 30d"
                    value={overview.churn.value}
                    icon={TrendingDown}
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-4">
                {(["active", "frozen", "expired", "cancelled"] as const).map((status) => (
                  <Link
                    key={status}
                    href={`/members?status=${status}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
                  >
                    <MembershipStatus status={status} className="text-xs" />
                    <span data-numeric className="text-base font-semibold">
                      {overview.membership[status]}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}

function StatCardInline({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof TrendingDown;
}) {
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      {label}
      <span data-numeric className="font-semibold text-foreground">
        {value}
      </span>
    </span>
  );
}

/** The one-line insight that sits under a chart title. */
function describeTrend(points: Array<{ count: number }>): string {
  if (points.length < 4) return "Not enough history yet.";

  const half = Math.floor(points.length / 2);
  const earlier = points.slice(0, half).reduce((sum, p) => sum + p.count, 0);
  const later = points.slice(half).reduce((sum, p) => sum + p.count, 0);
  const total = earlier + later;

  if (earlier === 0) return `${total} visits so far.`;

  const change = Math.round(((later - earlier) / earlier) * 100);

  if (Math.abs(change) < 5) return `${total} visits, holding steady week on week.`;

  return `${total} visits — ${Math.abs(change)}% ${change > 0 ? "busier" : "quieter"} than the week before.`;
}

function greeting(now: Date): string {
  const hour = now.getUTCHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function formatDayTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${formatTime(iso)}`;
}
