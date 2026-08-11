"use client";

import { Activity, Download, Flame, TrendingDown, UserPlus, Users } from "lucide-react";
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
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
      <div className="sticky top-14 z-20 border-b border-border bg-background/90 px-5 py-3 backdrop-blur-sm sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Report date range"
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
                {preset.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {overview.data
              ? `${formatDate(overview.data.range.from)} – ${formatDate(overview.data.range.to)}`
              : "—"}
          </p>

          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <a href={`/api/export/csv?report=checkins&days=${days}`}>
              <Download /> Export CSV
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
                  title="The headline figures did not load"
                  onRetry={() => void overview.refetch()}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <StatCard
                label="Active members"
                value={overview.data.membership.active}
                hint={`${overview.data.membership.total} on file`}
                icon={Users}
              />
              <StatCard
                label="Sign-ups"
                value={overview.data.signups.value}
                changePct={overview.data.signups.changePct}
                hint="vs. previous period"
                icon={UserPlus}
              />
              <StatCard
                label="Cancellations"
                value={overview.data.churn.value}
                changePct={overview.data.churn.changePct}
                invertTrend
                hint={`${overview.data.churnRatePct.toFixed(1)}% churn`}
                icon={TrendingDown}
              />
              <StatCard
                label="Check-ins"
                value={overview.data.checkins.value}
                changePct={overview.data.checkins.changePct}
                hint={`${overview.data.averageVisitsPerActiveMember} per active member`}
                icon={Activity}
              />
            </>
          )}
        </section>

        <Tabs defaultValue="traffic">
          <TabsList>
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
            <TabsTrigger value="growth">Growth</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>

          {/* Traffic — the heatmap is the centrepiece. */}
          <TabsContent value="traffic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="size-4 text-primary" /> Busiest hours
                </CardTitle>
                <CardDescription>
                  {busiest.data?.peak
                    ? `The floor peaks ${DAY_LABELS[busiest.data.peak.dayOfWeek]} at ${String(busiest.data.peak.hour).padStart(2, "0")}:00 — ${busiest.data.peak.count} check-ins in this window. Staff that slot first.`
                    : "Not enough check-ins yet to find a peak."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {busiest.isLoading ? (
                  <ChartSkeleton height="15rem" />
                ) : busiest.isError || !busiest.data ? (
                  <ErrorState compact onRetry={() => void busiest.refetch()} />
                ) : (
                  <Heatmap data={busiest.data.matrix} />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Check-ins per day</CardTitle>
                  <CardDescription>
                    {trends.data ? describeSeries(trends.data.checkins, "visits") : "—"}
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
                        caption="Check-ins per day"
                        rows={trends.data.checkins}
                        valueLabel="Check-ins"
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By hour of day</CardTitle>
                  <CardDescription>
                    {busiest.data
                      ? `Evenings carry the load — ${eveningShare(busiest.data.byHour)}% of visits land after 17:00.`
                      : "—"}
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
                <CardTitle>Sign-ups vs. cancellations</CardTitle>
                <CardDescription>
                  {overview.data
                    ? `${overview.data.signups.value} joined and ${overview.data.churn.value} cancelled — a net ${overview.data.signups.value - overview.data.churn.value >= 0 ? "gain" : "loss"} of ${Math.abs(overview.data.signups.value - overview.data.churn.value)} members.`
                    : "—"}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/export/csv?report=signups&days=${days}`}>
                      <Download /> CSV
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
                      caption="Sign-ups per day"
                      rows={trends.data.signups}
                      valueLabel="Sign-ups"
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Members by plan</CardTitle>
                <CardDescription>
                  {overview.data && overview.data.plans.length > 0
                    ? `${topPlan(overview.data.plans)} carries the most members.`
                    : "—"}
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
                              {plan.memberCount} · {formatMoney(plan.monthlyRevenueCents)}/mo
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
                <CardTitle>At-risk members</CardTitle>
                <CardDescription>
                  {atRisk.data
                    ? atRisk.data.length === 0
                      ? "Nobody has drifted — every active member has been in within 30 days."
                      : `${atRisk.data.length} paid-up members have not been in for 30 days. This is the call list.`
                    : "—"}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/export/csv?report=at-risk&days=${days}`}>
                      <Download /> CSV
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
                    title="Nobody is at risk"
                    description="Every active member has visited in the last 30 days."
                  />
                ) : (
                  <DataTable minWidth="42rem">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Member</TableHeaderCell>
                        <TableHeaderCell>Email</TableHeaderCell>
                        <TableHeaderCell align="right">Last visit</TableHeaderCell>
                        <TableHeaderCell align="right">Plan ends</TableHeaderCell>
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
                                <p className="font-mono text-2xs text-muted-foreground">
                                  {member.memberCode}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {member.email ?? "—"}
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
                                ? "never"
                                : `${member.daysSinceLastVisit}d ago`}
                            </span>
                          </TableCell>
                          <TableCell align="right" className="text-sm text-muted-foreground">
                            {member.membershipEndsAt ? formatDate(member.membershipEndsAt) : "—"}
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
                  <CardTitle>Staff hours</CardTitle>
                  <CardDescription>
                    {staffHours.data
                      ? `${staffHours.data.totalScheduledHours} hours rostered across ${staffHours.data.rows.length} people.`
                      : "—"}
                  </CardDescription>
                  <CardAction>
                    <Button asChild variant="ghost" size="sm">
                      <a href={`/api/export/csv?report=staff-hours&days=${days}`}>
                        <Download /> CSV
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
                <CardTitle>Trainer performance</CardTitle>
                <CardDescription>
                  {trainers.data && trainers.data.rows.length > 0
                    ? describeTrainers(trainers.data.rows)
                    : "No sessions in this window."}
                </CardDescription>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/export/csv?report=trainer-performance&days=${days}`}>
                      <Download /> CSV
                    </a>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                {trainers.isLoading ? (
                  <TableSkeleton rows={4} columns={5} />
                ) : !trainers.data || trainers.data.rows.length === 0 ? (
                  <EmptyState
                    title="No sessions yet"
                    description="Book a trainer session and completion rates will appear here."
                  />
                ) : (
                  <DataTable minWidth="44rem">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Trainer</TableHeaderCell>
                        <TableHeaderCell align="right">Booked</TableHeaderCell>
                        <TableHeaderCell align="right">Completed</TableHeaderCell>
                        <TableHeaderCell align="right">No-show</TableHeaderCell>
                        <TableHeaderCell>Completion</TableHeaderCell>
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
                            {row.booked}
                          </TableCell>
                          <TableCell align="right" className="text-sm">
                            {row.completed}
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
                                {row.completionRate.toFixed(0)}%
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
function Heatmap({ data }: { data: number[][] }) {
  const max = Math.max(1, ...data.flat());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]" aria-hidden>
        <div className="mb-1 grid grid-cols-[2.75rem_repeat(24,minmax(0,1fr))] gap-0.5">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="text-center text-2xs text-muted-foreground">
              {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
            </div>
          ))}
        </div>

        {data.map((row, dayIndex) => (
          <div
            key={dayIndex}
            className="mb-0.5 grid grid-cols-[2.75rem_repeat(24,minmax(0,1fr))] gap-0.5"
          >
            <div className="pr-2 text-right text-2xs text-muted-foreground">
              {DAY_LABELS[dayIndex]}
            </div>
            {row.map((count, hour) => (
              <div
                key={hour}
                title={`${DAY_LABELS[dayIndex]} ${String(hour).padStart(2, "0")}:00 — ${count} check-ins`}
                className="aspect-square rounded-[3px] bg-primary"
                style={{ opacity: count === 0 ? 0.06 : 0.18 + (count / max) * 0.82 }}
              />
            ))}
          </div>
        ))}

        <div className="mt-3 flex items-center justify-end gap-1.5 text-2xs text-muted-foreground">
          <span>Quiet</span>
          {[0.06, 0.3, 0.55, 0.78, 1].map((opacity) => (
            <span key={opacity} className="size-3 rounded-[3px] bg-primary" style={{ opacity }} />
          ))}
          <span>Busy</span>
        </div>
      </div>

      <table className="sr-only">
        <caption>Check-ins by day of week and hour of day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {Array.from({ length: 24 }, (_, hour) => (
              <th key={hour} scope="col">
                {String(hour).padStart(2, "0")}:00
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, dayIndex) => (
            <tr key={dayIndex}>
              <th scope="row">{DAY_LABELS[dayIndex]}</th>
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
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
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

function describeSeries(points: Array<{ count: number }>, noun: string): string {
  const total = points.reduce((sum, point) => sum + point.count, 0);

  if (points.length < 4) return `${total} ${noun} in this window.`;

  const half = Math.floor(points.length / 2);
  const earlier = points.slice(0, half).reduce((sum, p) => sum + p.count, 0);
  const later = points.slice(half).reduce((sum, p) => sum + p.count, 0);

  if (earlier === 0) return `${total} ${noun} in this window.`;

  const change = Math.round(((later - earlier) / earlier) * 100);

  if (Math.abs(change) < 5) {
    return `${total} ${noun}, steady across the window.`;
  }

  return `${total} ${noun} — the second half was ${Math.abs(change)}% ${change > 0 ? "busier" : "quieter"} than the first.`;
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
): string {
  const withSessions = rows.filter((row) => row.completionRate > 0 || row.noShow > 0);

  if (withSessions.length === 0) return "No completed sessions in this window.";

  const best = [...withSessions].sort((a, b) => b.completionRate - a.completionRate)[0]!;
  const noShows = rows.reduce((sum, row) => sum + row.noShow, 0);

  return `${best.name} leads on completion at ${best.completionRate.toFixed(0)}%. ${noShows} no-show${noShows === 1 ? "" : "s"} across the team.`;
}

function formatMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}
