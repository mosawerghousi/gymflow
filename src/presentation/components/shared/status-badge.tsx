"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/presentation/lib/utils";

/**
 * Status is shown as a small coloured dot plus a label, not a loud badge — in a
 * 200-row table a wall of filled pills reads as noise, while a dot column scans
 * instantly.
 *
 * The mapping is domain-driven and identical everywhere: emerald = in / active,
 * amber = paused, red = blocked, grey = inert.
 */

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const DOT_TONES: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-chart-2",
  neutral: "bg-muted-foreground",
};

const TEXT_TONES: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-foreground",
  neutral: "text-muted-foreground",
};

const SOLID_TONES: Record<Tone, string> = {
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-surface-3 text-foreground",
  neutral: "bg-surface-3 text-muted-foreground",
};

/** Status → tone plus the key under the `status` namespace. */
const MEMBERSHIP: Record<string, { tone: Tone; key: string }> = {
  active: { tone: "success", key: "active" },
  frozen: { tone: "warning", key: "frozen" },
  expired: { tone: "danger", key: "expired" },
  cancelled: { tone: "neutral", key: "cancelled" },
};

const SESSION: Record<string, { tone: Tone; key: string }> = {
  booked: { tone: "info", key: "booked" },
  completed: { tone: "success", key: "completed" },
  no_show: { tone: "danger", key: "noShow" },
  cancelled: { tone: "neutral", key: "cancelled" },
};

export function StatusDot({
  tone,
  className,
  pulse = false,
}: {
  tone: Tone;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)}>
      {pulse ? (
        <span
          className={cn("absolute inset-0 animate-ping rounded-full opacity-60", DOT_TONES[tone])}
        />
      ) : null}
      <span className={cn("relative size-2 rounded-full", DOT_TONES[tone])} />
    </span>
  );
}

export function MembershipStatus({
  status,
  className,
  variant = "dot",
}: {
  status: string;
  className?: string;
  /** `dot` for tables and lists, `solid` where the status is the whole point. */
  variant?: "dot" | "solid";
}) {
  const t = useTranslations("status");
  const entry = MEMBERSHIP[status] ?? { tone: "neutral" as Tone, key: "" };
  const label = entry.key ? t(entry.key) : status;

  if (variant === "solid") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
          SOLID_TONES[entry.tone],
          className,
        )}
      >
        <StatusDot tone={entry.tone} />
        {label}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <StatusDot tone={entry.tone} />
      <span className={entry.tone === "neutral" ? "text-muted-foreground" : undefined}>
        {label}
      </span>
    </span>
  );
}

export function SessionStatus({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("status");
  const entry = SESSION[status] ?? { tone: "neutral" as Tone, key: "" };

  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <StatusDot tone={entry.tone} />
      <span className={TEXT_TONES[entry.tone]}>{entry.key ? t(entry.key) : status}</span>
    </span>
  );
}

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const t = useTranslations("roles");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {t(`${role}Short`)}
    </span>
  );
}

/** Kept for call sites that still want the old name. */
export { MembershipStatus as MembershipStatusBadge, SessionStatus as SessionStatusBadge };
