import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
import { Link } from "@/i18n/routing";
import { MemberCode } from "@/presentation/components/i18n/bidi";
import { formatCount, formatTime, formatWeekday } from "@/presentation/lib/format";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("dashboard") };
}

export const dynamic = "force-dynamic";

/**
 * The "is the gym okay right now?" screen.
 *
 * Laid out on a modified F-pattern: the live occupancy counter sits top-left
 * where the eye lands, supporting metrics run across, and everything below is
 * a shortlist that drills down on click rather than a full table on load.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const ctx = { locale };

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
        title={t(greetingKey(now), { name: actor.name.split(" ")[0] ?? actor.name })}
        description={t("subtitle")}
        actions={
          actor.can("checkins:write") ? (
            <Button asChild>
              <Link href="/checkin">
                <ScanLine /> {t("openDesk")}
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
                label={t("activeMembers")}
                value={formatCount(overview.membership.active, ctx)}
                hint={t("onFile", { count: formatCount(overview.membership.total, ctx) })}
                icon={Users}
              />
              <StatCard
                label={t("signups30")}
                value={formatCount(overview.signups.value, ctx)}
                changePct={overview.signups.changePct}
                hint={t("vsPrevious30")}
                icon={UserPlus}
              />
            </>
          ) : (
            <StatCard
              label={t("yourSessions")}
              value={schedule.sessions.filter((s) => s.status === "booked").length}
              hint={t("bookedThisWeek")}
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
                <CardTitle>{t("checkins14")}</CardTitle>
                <CardDescription>
                  {describeTrend(trends.checkins, t, ctx)}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/reports">
                      {t("openReports")} <ArrowRight />
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
              <CardTitle>{t("onShift")}</CardTitle>
              <CardDescription>{t("onShiftHint")}</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/schedule" aria-label={t("openSchedule")}>
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
                  title={t("nothingScheduled")}
                  description={t("nothingScheduledHint")}
                />
              ) : (
                <ul className="space-y-2.5">
                  {todaysShifts.map((shift) => (
                    <li key={shift.id} className="flex items-center gap-2.5">
                      <MemberAvatar name={shift.userName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{shift.userName}</p>
                        <p data-numeric className="text-xs text-muted-foreground">
                          {formatWeekday(shift.startsAt, ctx)} {formatTime(shift.startsAt, ctx)} – {formatTime(shift.endsAt, ctx)}
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
                <CardTitle>{t("expiringSoon")}</CardTitle>
                <CardDescription>{t("expiringSoonHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                {expiringSoon.length === 0 ? (
                  <EmptyState
                    compact
                    icon={CalendarClock}
                    title={t("nothingExpiring")}
                    description={t("nothingExpiringHint")}
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
                          <MemberCode code={member.code} className="text-2xs text-muted-foreground" />
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
                            ? tCommon("today")
                            : tCommon("daysShort", { count: formatCount(member.daysUntilExpiry ?? 0, ctx) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("atRisk")}</CardTitle>
                <CardDescription>{t("atRiskHint")}</CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/reports" aria-label={t("openReports")}>
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
                    title={t("everyoneShowingUp")}
                    description={t("everyoneShowingUpHint")}
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
                          <MemberCode code={member.memberCode} className="text-2xs text-muted-foreground" />
                        </div>
                        <span data-numeric className="shrink-0 text-xs text-muted-foreground">
                          {member.daysSinceLastVisit === null
                            ? tCommon("never")
                            : tCommon("daysAgo", { count: member.daysSinceLastVisit })}
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
                <CardTitle>{t("membershipMix")}</CardTitle>
                <CardDescription>
                  {t("membershipMixHint", {
                    active: formatCount(overview.membership.active, ctx),
                    total: formatCount(overview.membership.total, ctx),
                  })}
                </CardDescription>
                <CardAction>
                  <StatCardInline
                    label={t("cancellations30")}
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
                      {formatCount(overview.membership[status], ctx)}
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
function describeTrend(
  points: Array<{ count: number }>,
  t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>,
  ctx: { locale: string },
): string {
  if (points.length < 4) return t("trendNotEnough");

  const half = Math.floor(points.length / 2);
  const earlier = points.slice(0, half).reduce((sum, p) => sum + p.count, 0);
  const later = points.slice(half).reduce((sum, p) => sum + p.count, 0);
  const total = formatCount(earlier + later, ctx);

  if (earlier === 0) return t("trendSteady", { total });

  const change = Math.round(((later - earlier) / earlier) * 100);

  if (Math.abs(change) < 5) return t("trendSteady", { total });

  return t(change > 0 ? "trendBusier" : "trendQuieter", {
    total,
    change: formatCount(Math.abs(change), ctx),
  });
}

function greetingKey(now: Date): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  const hour = now.getUTCHours();
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}
