import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ScanLine,
  TrendingDown,
  UserPlus,
  Users,
} from "lucide-react";

import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { MembershipStatusBadge } from "@/presentation/components/shared/status-badge";
import { StatCard } from "@/presentation/components/shared/stat-card";
import { PageHeader } from "@/presentation/components/layout/page-header";
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
 * The landing screen.
 *
 * This is a read-only overview, so it fetches on the server and renders as a
 * Server Component — no store hydration needed. The interactive screens
 * (desk, schedule, reports) are the ones that go through RTK Query.
 */
export default async function DashboardPage() {
  const actor = await requireActor();
  const now = new Date();

  const weekFrom = new Date(now);
  weekFrom.setUTCHours(0, 0, 0, 0);
  const weekTo = new Date(weekFrom.getTime() + 7 * 86_400_000);

  const canSeeReports = actor.can("reports:read:limited");

  const [overview, inGym, schedule, atRisk] = await Promise.all([
    canSeeReports ? useCases.getReportOverview(actor, { days: 30 }) : Promise.resolve(null),
    actor.can("checkins:read")
      ? useCases.getCurrentlyInGym(actor)
      : Promise.resolve({ count: 0, visitors: [] }),
    useCases.getSchedule(actor, {
      from: weekFrom,
      to: weekTo,
      mine: actor.role === "trainer",
    }),
    canSeeReports
      ? useCases.getAtRiskMembers(actor, { inactiveDays: 30, limit: 5 })
      : Promise.resolve([]),
  ]);

  const upcomingShifts = schedule.shifts
    .filter((shift) => shift.status !== "cancelled" && new Date(shift.endsAt) > now)
    .slice(0, 5);

  const upcomingSessions = schedule.sessions
    .filter((session) => session.status === "booked" && new Date(session.endsAt) > now)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Good ${greeting(now)}, ${actor.name.split(" ")[0]}`}
        description={`Here is how the gym is running as of ${formatTime(now)} UTC.`}
        actions={
          actor.can("checkins:write") ? (
            <Button asChild>
              <Link href="/checkin">
                <ScanLine /> Open check-in desk
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="space-y-6 px-5 py-6 sm:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Currently in gym"
            value={inGym.count}
            hint={inGym.count === 1 ? "member checked in" : "members checked in"}
            icon={Activity}
          />

          {overview ? (
            <>
              <StatCard
                label="Active members"
                value={overview.membership.active}
                hint={`${overview.membership.total} total on file`}
                icon={Users}
              />
              <StatCard
                label="Sign-ups (30d)"
                value={overview.signups.value}
                changePct={overview.signups.changePct}
                hint="vs. previous 30 days"
                icon={UserPlus}
              />
              <StatCard
                label="Cancellations (30d)"
                value={overview.churn.value}
                changePct={overview.churn.changePct}
                invertTrend
                hint={`${overview.churnRatePct.toFixed(1)}% churn rate`}
                icon={TrendingDown}
              />
            </>
          ) : (
            <StatCard
              label="Your sessions this week"
              value={upcomingSessions.length}
              hint="booked and still upcoming"
              icon={CalendarClock}
            />
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Who is in the gym right now */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">In the gym now</CardTitle>
              <CardAction>
                <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                  {inGym.count}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent>
              {inGym.visitors.length === 0 ? (
                <EmptyLine>Nobody is checked in right now.</EmptyLine>
              ) : (
                <ul className="divide-y divide-border">
                  {inGym.visitors.slice(0, 8).map((visitor) => (
                    <li
                      key={visitor.checkinId}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{visitor.fullName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {visitor.memberCode}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {visitor.minutesInside}m
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* This week's roster */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Coming up this week</CardTitle>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/schedule">
                    Schedule <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Shifts
                </p>
                {upcomingShifts.length === 0 ? (
                  <EmptyLine>No shifts scheduled.</EmptyLine>
                ) : (
                  <ul className="space-y-2">
                    {upcomingShifts.map((shift) => (
                      <li key={shift.id} className="text-sm">
                        <span className="font-medium">{shift.userName}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {formatDayTime(shift.startsAt)} – {formatTime(new Date(shift.endsAt))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Trainer sessions
                </p>
                {upcomingSessions.length === 0 ? (
                  <EmptyLine>No sessions booked.</EmptyLine>
                ) : (
                  <ul className="space-y-2">
                    {upcomingSessions.map((session) => (
                      <li key={session.id} className="text-sm">
                        <span className="font-medium">{session.memberName}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {formatDayTime(session.startsAt)} · {session.trainerName}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {atRisk.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">At-risk members</CardTitle>
              <CardDescription>Paid up, but not through the door in 30 days.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/reports">
                    All reports <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {atRisk.map((member) => (
                  <li
                    key={member.memberId}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/members/${member.memberId}`}
                        className="truncate text-sm font-medium hover:text-primary hover:underline"
                      >
                        {member.fullName}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {member.memberCode}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {member.daysSinceLastVisit === null
                        ? "never visited"
                        : `${member.daysSinceLastVisit} days ago`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {overview ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Membership mix</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {(["active", "frozen", "expired", "cancelled"] as const).map((status) => (
                <div
                  key={status}
                  className="flex min-w-32 flex-1 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <MembershipStatusBadge status={status} />
                  <span className="text-lg font-semibold tabular-nums">
                    {overview.membership[status]}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-muted-foreground">{children}</p>;
}

function greeting(now: Date): string {
  const hour = now.getUTCHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatTime(date: Date): string {
  return date.toISOString().slice(11, 16);
}

function formatDayTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return `${day} ${date.toISOString().slice(11, 16)}`;
}
