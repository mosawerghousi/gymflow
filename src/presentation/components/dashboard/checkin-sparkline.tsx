"use client";

import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { formatCount, formatDayMonth } from "@/presentation/lib/format";
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
  const t = useTranslations("charts");
  const locale = useLocale();
  const ctx = { locale };
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <div className={cn("relative flex flex-col", className)}>
      {/* Grows to fill its card so the row does not end in dead space. */}
      <div className="h-full min-h-28 flex-1" aria-hidden>
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
              labelFormatter={(value: string) => formatDay(value, ctx)}
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
              name={t("checkins")}
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#sparkFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{t("checkinsPerDay", { days: data.length })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("date")}</th>
            <th scope="col">{t("checkins")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDayMonth(point.date, ctx)}</th>
              <td>{formatCount(point.count, ctx)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t("total")}</th>
            <td>{formatCount(total, ctx)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function formatDay(value: string, ctx: { locale: string }): string {
  return formatDayMonth(value, ctx);
}
