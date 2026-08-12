"use client";

import { AlertTriangle, RotateCcw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { cn } from "@/presentation/lib/utils";

/**
 * The three states every screen owes the user.
 *
 * Skeletons mirror the shape of the thing that is loading, empty states always
 * carry one clear next step, and errors say what failed and offer a retry —
 * never a blank panel.
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
          <Icon className="size-5" />
        </span>
      ) : null}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  className,
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("states");
  const tCommon = useTranslations("common");

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <AlertTriangle className="size-5" />
      </span>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title ?? t("errorTitle")}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description ?? t("errorBody")}
        </p>
      </div>

      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          <RotateCcw /> {tCommon("retry")}
        </Button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeletons — each mirrors the layout it stands in for                        */
/* -------------------------------------------------------------------------- */

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex h-11 items-center gap-3 px-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          {Array.from({ length: columns - 1 }).map((__, cellIndex) => (
            <Skeleton
              key={cellIndex}
              className="h-3"
              style={{ width: `${[28, 14, 16, 14, 12][cellIndex % 5]}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="gap-0 py-4" aria-hidden>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton({ height = "16rem" }: { height?: string }) {
  return (
    <div className="flex items-end gap-1.5" style={{ height }} aria-hidden>
      {Array.from({ length: 28 }).map((_, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-sm"
          // A gently varying silhouette reads as "a chart is coming" rather
          // than as a broken grey block.
          style={{ height: `${30 + ((index * 37) % 60)}%` }}
        />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
