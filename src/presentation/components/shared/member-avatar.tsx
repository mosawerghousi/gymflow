import { cn } from "@/presentation/lib/utils";

/**
 * Members have no photo in the schema, so identity is carried by initials on a
 * tint derived from the name — stable per person, so the same member is the
 * same colour on every screen and the eye can track them down a list.
 */

const TINTS = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/20 text-chart-2",
  "bg-warning-subtle text-warning",
  "bg-danger-subtle text-danger",
  "bg-surface-3 text-foreground",
] as const;

const SIZES = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
  xl: "size-16 text-lg",
  "2xl": "size-24 text-2xl",
} as const;

export function MemberAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZES[size],
        TINTS[hash(name) % TINTS.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Deterministic, so a member keeps their colour across renders and sessions. */
function hash(value: string): number {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }

  return result;
}
