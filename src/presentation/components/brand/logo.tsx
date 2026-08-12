import { cn } from "@/presentation/lib/utils";

/**
 * The GymFlow mark: two weight plates whose bar flows into a pulse line.
 *
 * Rendered inline rather than as an <img> so it inherits currentColor and the
 * gradient stays crisp at every size.
 */
export function GymFlowIcon({
  className,
  gradientId = "gf-mark",
}: {
  className?: string;
  gradientId?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8", className)}
      role="img"
      aria-label="GymFlow" // i18n-ignore — the brand name
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect x="4" y="20" width="7" height="24" rx="3.5" fill={`url(#${gradientId})`} />
      <rect x="13" y="14" width="9" height="36" rx="4.5" fill={`url(#${gradientId})`} />
      <rect x="53" y="20" width="7" height="24" rx="3.5" fill={`url(#${gradientId})`} />
      <rect x="42" y="14" width="9" height="36" rx="4.5" fill={`url(#${gradientId})`} />
      <path
        d="M22 32 H27 L30.5 22.5 L35 41.5 L38.5 32 H42"
        stroke={`url(#${gradientId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GymFlowLogo({
  className,
  iconClassName,
  wordmarkClassName,
  gradientId,
}: {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  gradientId?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <GymFlowIcon className={cn("size-8 shrink-0", iconClassName)} gradientId={gradientId} />
      <span
        className={cn(
          "text-xl font-bold tracking-tight text-foreground",
          wordmarkClassName,
        )}
      >
        Gym<span className="text-primary">Flow</span> {/* i18n-ignore — brand wordmark */}
      </span>
    </span>
  );
}
