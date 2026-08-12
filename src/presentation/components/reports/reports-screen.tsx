"use client";

import { Activity, Download, Flame, TrendingDown, UserPlus, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MemberCode } from "@/presentation/components/i18n/bidi";
import {
  formatCount,
  formatDate as fmtDate,
  formatHour,
  formatMoney as fmtMoney,
} from "@/presentation/lib/format";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { StatCard } from "@/presentation/components/shared/stat-card";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  StatCardSkeleton,
  TableSkeleton,
} from "@/presentation/components/shared/states";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/presentation/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { cn } from "@/presentation/lib/utils";
import { useAppDispatch, useAppSelector } from "@/presentation/store/hooks";
import {
  useReportAtRiskQuery,
  useReportBusiestHoursQuery,
  useReportOverviewQuery,
  useReportStaffHoursQuery,
  useReportTrainerPerformanceQuery,
  useReportTrendsQuery,
} from "@/presentation/store/api/reports-api";
import { reportRangePresetChanged } from "@/presentation/store/ui-slice";

const PRESETS = [
  { days: 30, key: "range30" },
  { days: 90, key: "range90" },
  { days: 180, key: "range180" },
  { days: 365, key: "range365" },
] as const;

/** Index 0 = Sunday, matching the SQL `dow` the heatmap is bucketed by. */
const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Restrained palette: accent for the series that matters, greys for the rest. */
const CHART_TOOLTIP = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
} as const;

const AXIS_TICK = { fontSize: 11, fill: "var(--color-muted-foreground)" } as const;

/**
 * Reports.
 *
 * Every card leads with a one-line insight before the chart, so the numbers are
 * read rather than merely displayed. The date range is global and sticky — one
 * control drives every widget on the screen.
 */
export function ReportsScreen({ canSeeStaffHours }: { canSeeStaffHours: boolean }) {
  const t = useTranslations("reports");
  const tCommon = useTranslations("common");
  const tDays = useTranslations("weekdays");
  const locale = useLocale();
  const ctx = { locale };
  const dispatch = useAppDispatch();
  const days = useAppSelector((state) => state.ui.reportRangeDays);

  const overview = useReportOverviewQuery({ days });
  const trends = useReportTrendsQuery({ days });
  const busiest = useReportBusiestHoursQuery({ days });
  const atRisk = useReportAtRiskQuery({ inactiveDays: 30, limit: 25 });
  const staffHours = useReportStaffHoursQuery({ days }, { skip: !canSeeStaffHours });
  const trainers = useReportTrainerPerformanceQuery({ days });

  return (
    <div className="pb-10">
      {/* Global, sticky range picker — one filter, every widget. */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 py-3 backdrop-blur-sm sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t("rangeLabel")}
            className="flex rounded-md border border-border p-0.5"
          >
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                aria-pressed={days === preset.days}
                onClick={() => dispatch(reportRangePresetChanged(preset.days))}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  days === preset.days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(preset.key)}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {overview.data
              ? `${fmtDate(overview.data.range.from, ctx)} – ${fmtDate(overview.data.range.to, ctx)}`
              : tCommon("dash")}
          </p>

          <Button asChild variant="ghost" size="sm" className="ms-auto">
            <a href={`/api/export/csv?report=checkins&days=${days}`}>
              <Download /> {tCommon("exportCsv")}
            </a>
          </Button>
        </div>
      </div>

      <div className="space-y-5 px-5 pt-5 sm:px-8">
        {/* Headline metrics */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overview.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
          ) : overview.isError || !overview.data ? (
            <Card className="py-0 sm:col-span-2 xl:col-span-4">
              <CardContent className="px-0">
                <ErrorState
                  title={t("headlineFailed")}
                  onRetry={() => void overview.refetch()}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <StatCard
                label={t("activeMembers")}
                value={formatCount(overview.data.membership.active, ctx)}
                hint={tCommon("members", { count: overview.data.membership.total })}
                icon={Users}
              />
              <StatCard
                label={t("signups")}
                value={formatCount(overview.data.signups.value, ctx)}
                changePct={overview.data.signups.changePct}
                hint={t("vsPrevious")}
                icon={UserPlus}
              />
              <StatCard
                label={t("cancellations")}
                value={formatCount(overview.data.churn.value, ctx)}
                changePct={overview.data.churn.changePct}
                invertTrend
                hint={t("churnRate", { rate: formatCount(overview.data.churnRatePct, ctx) })}
                icon={TrendingDown}
              />
              <StatCard
                label={t("checkins")}
                value={formatCount(overview.data.checkins.value, ctx)}
                changePct={overview.data.checkins.changePct}
                hint={t("perActiveMember", { count: formatCount(overview.data.averageVisitsPerActiveMember, ctx) })}
                icon={Activity}
              />
            </>
          )}
        </section>

        <Tabs defaultValue="traffic">
          <TabsList>
            <TabsTrigger value="traffic">{t("tabTraffic")}</TabsTrigger>
            <TabsTrigger value="growth">{t("tabGrowth")}</TabsTrigger>
            <TabsTrigger value="retention">{t("tabRetention")}</TabsTrigger>
            <TabsTrigger value="team">{t("tabTeam")}</TabsTrigger>
          </TabsList>

          {/* Traffic — the heatmap is the centrepiece. */}
          <TabsContent value="traffic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="size-4 text-primary" /> {t("busiestHours")}
                </CardTitle>
                <CardDescription>
                  {busiest.data?.peak
                    ? t("busiestPeak", {
                        day: tDays(WEEKDAY_KEYS[busiest.data.peak.dayOfWeek]!),
                        time: formatHour(busiest.data.peak.hour, ctx),
                        count: formatCount(busiest.data.peak.count, ctx),
                      })
                    : t("busiestNoPeak")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {busiest.isLoading ? (
                  <ChartSkeleton height="15rem" />
                ) : busiest.isError || !busiest.data ? (
                  <ErrorState compact onRetry={() => void busiest.refetch()} />
                ) : (
                  <Heatmap data={busiest.data.matrix} ctx={ctx} />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("checkinsPerDay")}</CardTitle>
                  <CardDescription>
                    {trends.data ? describeSeries(trends.data.checkins, t, ctx) : tCommon("dash")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trends.isLoading ? (
                    <ChartSkeleton height="14rem" />
                  ) : !trends.data ? (
                    <ErrorState compact onRetry={() => void trends.refetch()} />
                  ) : (
                    <>
                      <div className="h-56" aria-hidden>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={trends.data.checkins}
                            margin={{ top: 4, right: 8, left: -24 }}
                          >
                            <defs>
                              <linearGradient id="checkinFill" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                  offset="0%"
                                  stopColor="var(--color-primary)"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="var(--color-primary)"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="var(--color-border)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(value: string) => value.slice(5)}
                              tick={AXIS_TICK}
                              tickLine={false}
                              axisLine={false}
                              minTickGap={36}
                            />
                            <YAxis
                              tick={AXIS_TICK}
                              tickLine={false}
                              axisLine={false}
                              width={36}
                            />
                            <Tooltip contentStyle={CHART_TOOLTIP} />
                            <Area
                              type="monotone"
                              dataKey="count"
                              name="Check-ins"
                              stroke="var(--color-primary)"
                              strokeWidth={2}
                              fill="url(#checkinFill)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <SeriesTable
                        caption={t("seriesCaption", { label: t("checkins") })}
                        rows={trends.data.checkins}
                        valueLabel={t("checkins")}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("byHourOfDay")}</CardTitle>
                  <CardDescription>
                    {busiest.data
                      ? t("eveningShare", {
                          percent: formatCount(eveningShare(busiest.data.byHour), ctx),
                          time: formatHour(17, ctx),
                        })
                      : tCommon("dash")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {busiest.isLoading ? (
                    <ChartSkeleton height="14rem" />
                  ) : !busiest.data ? (
                    <ErrorState compact onRetry={() => void busiest.refetch()} />
                  ) : (
                    <div className="h-56" aria-hidden>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={busiest.data.byHour}
                          margin={{ top: 4, right: 8, left: -24 }}
                        >
                          <CartesianGrid stroke="var(--color-border)" vertical={false} />
                          <XAxis
                            dataKey="hour"
                            tickFormatter={(hour: number) => String(hour).padStart(2, "0")}
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            interval={2}
                          />
                          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
                          <Tooltip contentStyle={CHART_TOOLTIP} cursor={{ fill: "var(--color-surface-2)" }} />
                          <Bar
                            dataKey="count"
                            name="Check-ins"
                            fill="var(--color-primary)"
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Growth */}
          <TabsContent value="growth" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("signupsVsCancellations")}</CardTitle>
                <CardDescription>
                  {overview.data
                    ? t(
                        overview.data.signups.value - overview.data.churn.value >= 0
                          ? "netGain"
                          : "netLoss",
                        {
                          signups: formatCount(overview.data.signups.value, ctx),
                          churn: formatCount(overview.data.churn.value, ctx),
                          net: formatCount(
                            Math.abs(overview.data.signups.value - overview.data.churn.value),
                            ctx,
                          ),
                        },
                      )
                    : tCommon("dash")}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/export/csv?report=signups&days=${days}`}>
                      <Download /> {tCommon("csv")}
                    </a>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {trends.isLoading ? (
                  <ChartSkeleton height="15rem" />
                ) : !trends.data ? (
                  <ErrorState compact onRetry={() => void trends.refetch()} />
                ) : (
                  <>
                    <div className="h-60" aria-hidden>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={joinSeries(trends.data)}
                          margin={{ top: 4, right: 8, left: -24 }}
                        >
                          <CartesianGrid stroke="var(--color-border)" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value: string) => value.slice(5)}
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={36}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            width={36}
                          />
                          <Tooltip contentStyle={CHART_TOOLTIP} />
                          <Line
                            type="monotone"
                            dataKey="signups"
                            name="Sign-ups"
                            stroke="var(--color-primary)"
                            strokeWidth={2}
                            dot={false}
                          />
                          {/* Cancellations are the one place danger is meaningful. */}
                          <Line
                            type="monotone"
                            dataKey="cancellations"
                            name="Cancellations"
                            stroke="var(--color-danger)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <SeriesTable
                      caption={t("seriesCaption", { label: t("signups") })}
                      rows={trends.data.signups}
                      valueLabel={t("signups")}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("membersByPlan")}</CardTitle>
                <CardDescription>
                  {overview.data && overview.data.plans.length > 0
                    ? t("topPlan", { plan: topPlan(overview.data.plans) })
                    : tCommon("dash")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview.isLoading || !overview.data ? (
                  <ChartSkeleton height="9rem" />
                ) : (
                  <ul className="space-y-3">
                    {overview.data.plans.map((plan) => {
                      const max = Math.max(
                        1,
                        ...overview.data!.plans.map((entry) => entry.memberCount),
                      );

                      return (
                        <li key={plan.planId} className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span>{plan.planName}</span>
                            <span data-numeric className="text-muted-foreground">
                              {formatCount(plan.memberCount, ctx)} ·{" "}
                              {t("perMonth", { amount: fmtMoney(plan.monthlyRevenueCents, ctx) })}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-200"
                              style={{ width: `${(plan.memberCount / max) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Retention */}
          <TabsContent value="retention">
            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b py-4">
                <CardTitle>{t("atRiskTitle")}</CardTitle>
                <CardDescription>
                  {atRisk.data
                    ? atRisk.data.length === 0
                      ? t("atRiskNone")
                      : t("atRiskSome", { count: formatCount(atRisk.data.length, ctx) })
                    : tCommon("dash")}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/export/csv?report=at-risk&days=${days}`}>
                      <Download /> {tCommon("csv")}
                    </a>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                {atRisk.isLoading ? (
                  <TableSkeleton rows={8} columns={4} />
                ) : atRisk.isError ? (
                  <ErrorState onRetry={() => void atRisk.refetch()} />
                ) : (atRisk.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={t("atRiskEmpty")}
                    description={t("atRiskEmptyHint")}
                  />
                ) : (
                  <DataTable minWidth="42rem">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{t("columnMember")}</TableHeaderCell>
                        <TableHeaderCell>{t("columnEmail")}</TableHeaderCell>
                        <TableHeaderCell align="right">{t("columnLastVisit")}</TableHeaderCell>
                        <TableHeaderCell align="right">{t("columnPlanEnds")}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(atRisk.data ?? []).map((member) => (
                        <TableRow key={member.memberId} interactive>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <MemberAvatar name={member.fullName} size="sm" />
                              <div className="min-w-0">
                                <a
                                  href={`/members/${member.memberId}`}
                                  className="block truncate text-sm font-medium hover:text-primary hover:underline"
                                >
                                  {member.fullName}
                                </a>
                                <MemberCode code={member.memberCode} className="text-2xs text-muted-foreground" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {member.email ? <MemberCode code={member.email} /> : tCommon("dash")}
                          </TableCell>
                          <TableCell align="right" className="text-sm">
                            <span
                              className={
                                member.daysSinceLastVisit === null
                                  ? "text-danger"
                                  : "text-muted-foreground"
                              }
                            >
                              {member.daysSinceLastVisit === null
                                ? tCommon("never")
                                : tCommon("daysAgo", { count: member.daysSinceLastVisit })}
                            </span>
                          </TableCell>
                          <TableCell align="right" className="text-sm text-muted-foreground">
                            {member.membershipEndsAt ? fmtDate(member.membershipEndsAt, ctx) : tCommon("dash")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </DataTable>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team */}
          <TabsContent value="team" className="space-y-4">
            {canSeeStaffHours ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t("staffHours")}</CardTitle>
                  <CardDescription>
                    {staffHours.data
                      ? t("staffHoursSummary", {
                          hours: formatCount(staffHours.data.totalScheduledHours, ctx),
                          people: formatCount(staffHours.data.rows.length, ctx),
                        })
                      : tCommon("dash")}
                  </CardDescription>
                  <CardAction>
                    <Button asChild variant="ghost" size="sm">
                      <a href={`/api/export/csv?report=staff-hours&days=${days}`}>
                        <Download /> {tCommon("csv")}
                      </a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {staffHours.isLoading ? (
                    <ChartSkeleton height="14rem" />
                  ) : !staffHours.data ? (
                    <ErrorState compact onRetry={() => void staffHours.refetch()} />
                  ) : (
                    <div className="h-56" aria-hidden>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={staffHours.data.rows}
                          layout="vertical"
                          margin={{ top: 4, right: 16, left: 8 }}
                        >
                          <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={110}
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip contentStyle={CHART_TOOLTIP} cursor={{ fill: "var(--color-surface-2)" }} />
                          <Bar
                            dataKey="scheduledHours"
                            name="Scheduled"
                            fill="var(--color-chart-2)"
                            radius={[0, 3, 3, 0]}
                          />
                          <Bar
                            dataKey="completedHours"
                            name="Completed"
                            fill="var(--color-primary)"
                            radius={[0, 3, 3, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b py-4">
                <CardTitle>{t("trainerPerformance")}</CardTitle>
                <CardDescription>
                  {trainers.data && trainers.data.rows.length > 0
                    ? describeTrainers(trainers.data.rows, t, ctx)
                    : t("trainerNoSessions")}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/export/csv?report=trainer-performance&days=${days}`}>
                      <Download /> {tCommon("csv")}
                    </a>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                {trainers.isLoading ? (
                  <TableSkeleton rows={4} columns={5} />
                ) : !trainers.data || trainers.data.rows.length === 0 ? (
                  <EmptyState
                    title={t("noSessionsYet")}
                    description={t("noSessionsYetHint")}
                  />
                ) : (
                  <DataTable minWidth="44rem">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{t("columnTrainer")}</TableHeaderCell>
                        <TableHeaderCell align="right">{t("columnBooked")}</TableHeaderCell>
                        <TableHeaderCell align="right">{t("columnCompleted")}</TableHeaderCell>
                        <TableHeaderCell align="right">{t("columnNoShow")}</TableHeaderCell>
                        <TableHeaderCell>{t("columnCompletion")}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trainers.data.rows.map((row) => (
                        <TableRow key={row.trainerId} interactive>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <MemberAvatar name={row.name} size="sm" />
                              <span className="text-sm font-medium">{row.name}</span>
                            </div>
                          </TableCell>
                          <TableCell align="right" className="text-sm">
                            {formatCount(row.booked, ctx)}
                          </TableCell>
                          <TableCell align="right" className="text-sm">
                            {formatCount(row.completed, ctx)}
                          </TableCell>
                          <TableCell align="right" className="text-sm">
                            <span className={row.noShow > 0 ? "text-warning" : undefined}>
                              {row.noShow}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${row.completionRate}%` }}
                                />
                              </div>
                              <span data-numeric className="text-sm text-muted-foreground">
                                {formatCount(Math.round(row.completionRate), ctx)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </DataTable>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * Day × hour grid; opacity encodes volume against the busiest cell.
 * The visually-hidden table underneath is what a screen reader gets.
 */
function Heatmap({ data, ctx }: { data: number[][]; ctx: { locale: string } }) {
  const t = useTranslations("reports");
  const tDays = useTranslations("weekdays");
  const max = Math.max(1, ...data.flat());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]" aria-hidden>
        <div className="mb-1 grid grid-cols-[2.75rem_repeat(24,minmax(0,1fr))] gap-0.5">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="text-center text-2xs text-muted-foreground">
              {hour % 3 === 0 ? formatHour(hour, ctx).slice(0, 2) : ""}
            </div>
          ))}
        </div>

        {data.map((row, dayIndex) => (
          <div
            key={dayIndex}
            className="mb-0.5 grid grid-cols-[2.75rem_repeat(24,minmax(0,1fr))] gap-0.5"
          >
            <div className="pe-2 text-end text-2xs text-muted-foreground">
              {tDays(WEEKDAY_KEYS[dayIndex]!)}
            </div>
            {row.map((count, hour) => (
              <div
                key={hour}
                title={`${tDays(WEEKDAY_KEYS[dayIndex]!)} ${formatHour(hour, ctx)} — ${formatCount(count, ctx)}`}
                className="aspect-square rounded-[3px] bg-primary"
                style={{ opacity: count === 0 ? 0.06 : 0.18 + (count / max) * 0.82 }}
              />
            ))}
          </div>
        ))}

        <div className="mt-3 flex items-center justify-end gap-1.5 text-2xs text-muted-foreground">
          <span>{t("quiet")}</span>
          {[0.06, 0.3, 0.55, 0.78, 1].map((opacity) => (
            <span key={opacity} className="size-3 rounded-[3px] bg-primary" style={{ opacity }} />
          ))}
          <span>{t("busy")}</span>
        </div>
      </div>

      <table className="sr-only">
        <caption>{t("heatmapCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("day")}</th>
            {Array.from({ length: 24 }, (_, hour) => (
              <th key={hour} scope="col">
                {formatHour(hour, ctx)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, dayIndex) => (
            <tr key={dayIndex}>
              <th scope="row">{tDays(WEEKDAY_KEYS[dayIndex]!)}</th>
              {row.map((count, hour) => (
                <td key={hour}>{count}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The accessible fallback that sits beside every line and area chart. */
function SeriesTable({
  caption,
  rows,
  valueLabel,
}: {
  caption: string;
  rows: Array<{ date: string; count: number }>;
  valueLabel: string;
}) {
  const tDate = useTranslations("reports")("date");

  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{tDate}</th>
          <th scope="col">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date}>
            <th scope="row">{row.date}</th>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Pairs the two daily series so Recharts can plot them on one axis. */
function joinSeries(trends: {
  signups: Array<{ date: string; count: number }>;
  cancellations: Array<{ date: string; count: number }>;
}) {
  return trends.signups.map((point, index) => ({
    date: point.date,
    signups: point.count,
    cancellations: trends.cancellations[index]?.count ?? 0,
  }));
}

/* -------------------------------------------------------------------------- */
/* Insight sentences — the line that turns a chart into a finding              */
/* -------------------------------------------------------------------------- */

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

function describeSeries(
  points: Array<{ count: number }>,
  t: Translator,
  ctx: { locale: string },
): string {
  const sum = points.reduce((acc, point) => acc + point.count, 0);
  const total = formatCount(sum, ctx);
  const noun = t("nounVisits");

  if (points.length < 4) return t("seriesTotal", { total, noun });

  const half = Math.floor(points.length / 2);
  const earlier = points.slice(0, half).reduce((acc, p) => acc + p.count, 0);
  const later = points.slice(half).reduce((acc, p) => acc + p.count, 0);

  if (earlier === 0) return t("seriesTotal", { total, noun });

  const change = Math.round(((later - earlier) / earlier) * 100);

  if (Math.abs(change) < 5) return t("seriesSteady", { total, noun });

  return t(change > 0 ? "seriesBusier" : "seriesQuieter", {
    total,
    noun,
    change: formatCount(Math.abs(change), ctx),
  });
}

function eveningShare(byHour: Array<{ hour: number; count: number }>): number {
  const total = byHour.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return 0;

  const evening = byHour
    .filter((entry) => entry.hour >= 17)
    .reduce((sum, entry) => sum + entry.count, 0);

  return Math.round((evening / total) * 100);
}

function topPlan(plans: Array<{ planName: string; memberCount: number }>): string {
  return [...plans].sort((a, b) => b.memberCount - a.memberCount)[0]?.planName ?? "No plan";
}

function describeTrainers(
  rows: Array<{ name: string; completionRate: number; noShow: number }>,
  t: Translator,
  ctx: { locale: string },
): string {
  const withSessions = rows.filter((row) => row.completionRate > 0 || row.noShow > 0);

  if (withSessions.length === 0) return t("trainerNoSessions");

  const best = [...withSessions].sort((a, b) => b.completionRate - a.completionRate)[0]!;

  return t("trainerSummary", {
    name: best.name,
    rate: formatCount(Math.round(best.completionRate), ctx),
    noShows: formatCount(rows.reduce((sum, row) => sum + row.noShow, 0), ctx),
  });
}


