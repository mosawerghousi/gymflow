import { Badge } from "@/presentation/components/ui/badge";
import { cn } from "@/presentation/lib/utils";

/**
 * One colour per membership state, used identically on the list, the profile,
 * the desk and the kiosk so a red badge always means the same thing.
 */
const MEMBERSHIP_STYLES: Record<string, string> = {
  active: "border-primary/30 bg-primary/12 text-primary",
  frozen: "border-sky-500/30 bg-sky-500/12 text-sky-300",
  expired: "border-amber-500/30 bg-amber-500/12 text-amber-300",
  cancelled: "border-destructive/30 bg-destructive/12 text-destructive",
};

const MEMBERSHIP_LABELS: Record<string, string> = {
  active: "Active",
  frozen: "Frozen",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function MembershipStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", MEMBERSHIP_STYLES[status] ?? "", className)}
    >
      {MEMBERSHIP_LABELS[status] ?? status}
    </Badge>
  );
}

const SESSION_STYLES: Record<string, string> = {
  booked: "border-sky-500/30 bg-sky-500/12 text-sky-300",
  completed: "border-primary/30 bg-primary/12 text-primary",
  no_show: "border-amber-500/30 bg-amber-500/12 text-amber-300",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const SESSION_LABELS: Record<string, string> = {
  booked: "Booked",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export function SessionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", SESSION_STYLES[status] ?? "")}>
      {SESSION_LABELS[status] ?? status}
    </Badge>
  );
}

const ROLE_STYLES: Record<string, string> = {
  admin: "border-violet-500/30 bg-violet-500/12 text-violet-300",
  staff: "border-sky-500/30 bg-sky-500/12 text-sky-300",
  trainer: "border-primary/30 bg-primary/12 text-primary",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", ROLE_STYLES[role] ?? "")}>
      {role}
    </Badge>
  );
}
