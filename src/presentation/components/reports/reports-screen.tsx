"use client";

import {
  Activity,
  Download,
  TrendingDown,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "@/presentation/components/shared/stat-card";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
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

const CHART_TOOLTIP = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

const AXIS_TICK = { fontSize: 11, fill: "var(--color-muted-foreground)" } as const;

export function ReportsScreen({ canSeeStaffHours }: { canSeeStaffHours: boolean }) {
  const dispatch = useAppDispatch();
  const days = useAppSelector((state) => state.ui.reportRangeDays);

  const { data: overview, isLoading: overviewLoading } = useReportOverviewQuery({ days });
  const { data: trends } = useReportTrendsQuery({ days });
  const { data: busiest } = useReportBusiestHoursQuery({ days });
  const { data: atRisk = [] } = useReportAtRiskQuery({ inactiveDays: 30, limit: 25 });
  const { data: staffHours } = useReportStaffHoursQuery({ days }, { skip: !canSeeStaffHours });
  const { data: trainers } = useReportTrainerPerformanceQuery({ days });

  return (
    <div className="space-y-6 px-5 py-6 sm:px-8">
      {/* Range picker */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => dispatch(reportRangePresetChanged(preset.days))}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                days === preset.days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/csv?report=signups&days=${days}`}>
              <Download /> Sign-ups CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/csv?report=at-risk&days=${days}`}>
              <Download /> At-risk CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/csv?report=checkins&days=${days}`}>
              <Download /> Check-ins CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Headline metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewLoading || !overview ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))
        ) : (
          <>
            <StatCard
              label="Active members"
              value={overview.membership.active}
              hint={`${overview.membership.total} on file`}
              icon={Users}
            />
            <StatCard
              label="Sign-ups"
              value={overview.signups.value}
              changePct={overview.signups.changePct}
              hint="vs. previous period"
              icon={UserPlus}
            />
            <StatCard
              label="Cancellations"
              value={overview.churn.value}
              changePct={overview.churn.changePct}
              invertTrend
              hint={`${overview.churnRatePct.toFixed(1)}% churn`}
              icon={TrendingDown}
            />
            <StatCard
              label="Check-ins"
              value={overview.checkins.value}
              changePct={overview.checkins.changePct}
              hint={`${overview.averageVisitsPerActiveMember} per active member`}
              icon={Activity}
            />
          </>
        )}
      </section>

      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="traffic">Busiest hours</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Trends */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Check-ins per day</CardTitle>
            </CardHeader>
            <CardContent>
              {!trends ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends.checkins} margin={{ top: 4, right: 8, left: -20 }}>
                      <defs>
                        <linearGradient id="checkinFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => value.slice(5)}
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={32}
                      />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
                      <Tooltip contentStyle={CHART_TOOLTIP} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Check-ins"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        fill="url(#checkinFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sign-ups vs. cancellations</CardTitle>
              </CardHeader>
              <CardContent>
                {!trends ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trends.signups.map((point, index) => ({
                          date: point.date,
                          signups: point.count,
                          cancellations: trends.cancellations[index]?.count ?? 0,
                        }))}
                        margin={{ top: 4, right: 8, left: -20 }}
                      >
                        <CartesianGrid stroke="var(--color-border)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value: string) => value.slice(5)}
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={32}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <Tooltip contentStyle={CHART_TOOLTIP} />
                        <Line
                          type="monotone"
                          dataKey="signups"
                          name="Sign-ups"
                          stroke="var(--color-chart-1)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="cancellations"
                          name="Cancellations"
                          stroke="var(--color-chart-5)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Members by plan</CardTitle>
              </CardHeader>
              <CardContent>
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="h-44 w-44 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={overview.plans.filter((plan) => plan.memberCount > 0)}
                            dataKey="memberCount"
                            nameKey="planName"
                            innerRadius={44}
                            outerRadius={70}
                            paddingAngle={2}
                          >
                            {overview.plans.map((_, index) => (
                              <Cell
                                key={index}
                                fill={`var(--color-chart-${(index % 5) + 1})`}
                                stroke="var(--color-card)"
                              />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={CHART_TOOLTIP} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <ul className="min-w-0 flex-1 space-y-2 text-sm">
                      {overview.plans.map((plan, index) => (
                        <li key={plan.planId} className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: `var(--color-chart-${(index % 5) + 1})` }}
                          />
                          <span className="min-w-0 flex-1 truncate">{plan.planName}</span>
                          <span className="tabular-nums">{plan.memberCount}</span>
                          <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                            {formatMoney(plan.monthlyRevenueCents)}/mo
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Busiest hours */}
        <TabsContent value="traffic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Busiest hours</CardTitle>
              {busiest?.peak ? (
                <p className="text-sm text-muted-foreground">
                  Peak: {DAY_LABELS[busiest.peak.dayOfWeek]} at{" "}
                  {String(busiest.peak.hour).padStart(2, "0")}:00 — {busiest.peak.count} check-ins.
                </p>
              ) : null}
            </CardHeader>
            <CardContent>
              {!busiest ? <Skeleton className="h-64 w-full" /> : <Heatmap data={busiest.matrix} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Check-ins by hour of day</CardTitle>
            </CardHeader>
            <CardContent>
              {!busiest ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={busiest.byHour} margin={{ top: 4, right: 8, left: -20 }}>
                      <CartesianGrid stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(hour: number) => `${String(hour).padStart(2, "0")}`}
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
                      <Tooltip contentStyle={CHART_TOOLTIP} />
                      <Bar dataKey="count" name="Check-ins" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retention */}
        <TabsContent value="retention">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">At-risk members</CardTitle>
              <p className="text-sm text-muted-foreground">
                Paid up, but no visit in the last 30 days — the list worth calling.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-y border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-medium">Member</th>
                      <th scope="col" className="px-4 py-3 font-medium">Code</th>
                      <th scope="col" className="px-4 py-3 font-medium">Last visit</th>
                      <th scope="col" className="px-4 py-3 font-medium">Plan ends</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRisk.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                          Nobody is at risk right now.
                        </td>
                      </tr>
                    ) : (
                      atRisk.map((member) => (
                        <tr key={member.memberId} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5">
                            <a
                              href={`/members/${member.memberId}`}
                              className="font-medium hover:text-primary hover:underline"
                            >
                              {member.fullName}
                            </a>
                            <p className="text-xs text-muted-foreground">{member.email ?? "—"}</p>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {member.memberCode}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                            {member.daysSinceLastVisit === null
                              ? "never"
                              : `${member.daysSinceLastVisit} days ago`}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                            {member.membershipEndsAt ? formatDate(member.membershipEndsAt) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="space-y-6">
          {canSeeStaffHours ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Staff hours</CardTitle>
                {staffHours ? (
                  <CardDescription className="tabular-nums">
                    {staffHours.totalScheduledHours} hours scheduled in this window.
                  </CardDescription>
                ) : null}
                <CardAction>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/export/csv?report=staff-hours&days=${days}`}>
                      <Download /> CSV
                    </a>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {!staffHours ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={staffHours.rows}
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
                        <Tooltip contentStyle={CHART_TOOLTIP} />
                        <Bar
                          dataKey="scheduledHours"
                          name="Scheduled"
                          fill="var(--color-chart-2)"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey="completedHours"
                          name="Completed"
                          fill="var(--color-chart-1)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trainer performance</CardTitle>
              <CardAction>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/export/csv?report=trainer-performance&days=${days}`}>
                    <Download /> CSV
                  </a>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="border-y border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-medium">Trainer</th>
                      <th scope="col" className="px-4 py-3 font-medium">Booked</th>
                      <th scope="col" className="px-4 py-3 font-medium">Completed</th>
                      <th scope="col" className="px-4 py-3 font-medium">No-show</th>
                      <th scope="col" className="px-4 py-3 font-medium">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!trainers || trainers.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                          No sessions in this window.
                        </td>
                      </tr>
                    ) : (
                      trainers.rows.map((row) => (
                        <tr key={row.trainerId} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 font-medium">{row.name}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.booked}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.completed}</td>
                          <td className="px-4 py-2.5 tabular-nums">{row.noShow}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${row.completionRate}%` }}
                                />
                              </div>
                              <span className="tabular-nums">{row.completionRate.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Day × hour grid; opacity encodes volume relative to the busiest cell. */
function Heatmap({ data }: { data: number[][] }) {
  const max = Math.max(1, ...data.flat());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[42rem]">
        <div className="mb-1 grid grid-cols-[3rem_repeat(24,minmax(0,1fr))] gap-0.5">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="text-center text-[9px] text-muted-foreground tabular-nums"
            >
              {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
            </div>
          ))}
        </div>

        {data.map((row, dayIndex) => (
          <div
            key={dayIndex}
            className="mb-0.5 grid grid-cols-[3rem_repeat(24,minmax(0,1fr))] gap-0.5"
          >
            <div className="pr-2 text-right text-xs text-muted-foreground">
              {DAY_LABELS[dayIndex]}
            </div>
            {row.map((count, hour) => (
              <div
                key={hour}
                title={`${DAY_LABELS[dayIndex]} ${String(hour).padStart(2, "0")}:00 — ${count} check-ins`}
                className="aspect-square rounded-[2px] bg-primary transition-opacity"
                style={{ opacity: count === 0 ? 0.05 : 0.15 + (count / max) * 0.85 }}
              />
            ))}
          </div>
        ))}

        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {[0.05, 0.3, 0.55, 0.8, 1].map((opacity) => (
            <span
              key={opacity}
              className="size-3 rounded-[2px] bg-primary"
              style={{ opacity }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function formatMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
