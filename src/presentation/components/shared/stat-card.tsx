import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
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
  /** Set when a rise is bad news (churn, no-shows) so the colour flips. */
  invertTrend?: boolean;
  className?: string;
}

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

  const TrendIcon = isFlat ? ArrowRight : isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground/70" /> : null}
        </div>

        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>

        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {hasTrend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                isGood === null
                  ? "text-muted-foreground"
                  : isGood
                    ? "text-primary"
                    : "text-amber-400",
              )}
            >
              <TrendIcon className="size-3.5" />
              {Math.abs(changePct).toFixed(1)}%
            </span>
          ) : null}

          {hint ? <span className="truncate text-muted-foreground">{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
