"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { cn } from "@/presentation/lib/utils";

/**
 * A 14-day check-in sparkline.
 *
 * Axes are stripped to almost nothing — the shape of the line is the message,
 * and the exact figures live one hover (or one click through to Reports) away.
 * The hidden table is what a screen reader gets instead of the SVG.
 */
export function CheckinSparkline({
  data,
  className,
}: {
  data: Array<{ date: string; count: number }>;
  className?: string;
}) {
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <div className={cn("relative", className)}>
      <div className="h-24" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <Tooltip
              cursor={{ stroke: "var(--color-border-strong)" }}
              labelFormatter={(value: string) => formatDay(value)}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Check-ins"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#sparkFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Check-ins per day over the last {data.length} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Check-ins</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{point.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function formatDay(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
