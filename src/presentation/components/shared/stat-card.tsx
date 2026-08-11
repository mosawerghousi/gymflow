import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Card, CardContent } from "@/presentation/components/ui/card";
import { cn } from "@/presentation/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  /** Percentage change vs. the preceding period; `null` when there is no baseline. */
  changePct?: number | null;
  /** Set when a rise is bad news (churn, no-shows) so the reading flips. */
  invertTrend?: boolean;
  className?: string;
}

/**
 * A supporting metric.
 *
 * Deliberately quiet: the value is 32px in plain foreground, not accent — only
 * the hero metric gets colour, so the eye lands there first.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  changePct,
  invertTrend = false,
  className,
}: StatCardProps) {
  const hasTrend = changePct !== undefined && changePct !== null;
  const isFlat = hasTrend && Math.abs(changePct) < 0.05;
  const isUp = hasTrend && changePct > 0;
  const isGood = isFlat ? null : invertTrend ? !isUp : isUp;

  const TrendIcon = isFlat ? ArrowRight : isUp ? ArrowUp : ArrowDown;

  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        </div>

        <p data-numeric className="text-xl leading-none font-semibold tracking-tight">
          {value}
        </p>

        {hasTrend || hint ? (
          <div className="flex items-center gap-2 text-xs">
            {hasTrend ? (
              <span
                data-numeric
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  isGood === null
                    ? "text-muted-foreground"
                    : isGood
                      ? "text-success"
                      : "text-warning",
                )}
              >
                <TrendIcon className="size-3" />
                {Math.abs(changePct).toFixed(1)}%
              </span>
            ) : null}

            {hint ? <span className="truncate text-muted-foreground">{hint}</span> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
