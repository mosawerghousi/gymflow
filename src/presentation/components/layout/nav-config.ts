import {
  CalendarRange,
  LayoutDashboard,
  LineChart,
  ScanLine,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission, UserRole } from "@/domain/entities/user";

export interface NavUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isDemo: boolean;
  permissions: readonly Permission[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden unless the signed-in user holds this permission. */
  requires?: Permission;
  exact?: boolean;
  /** Shown in the ⌘K palette. */
  keywords?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    keywords: ["home", "overview", "today"],
  },
  {
    href: "/members",
    label: "Members",
    icon: Users,
    requires: "members:read",
    keywords: ["people", "roster", "membership"],
  },
  {
    href: "/checkin",
    label: "Check-in desk",
    icon: ScanLine,
    requires: "checkins:write",
    keywords: ["front desk", "entry", "scan"],
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: CalendarRange,
    requires: "shifts:read:own",
    keywords: ["shifts", "roster", "calendar", "sessions"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: LineChart,
    requires: "reports:read:limited",
    keywords: ["analytics", "churn", "stats", "insights"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    requires: "settings:read",
    keywords: ["plans", "hours", "kiosk", "staff", "team"],
  },
];

export function visibleNavItems(user: Pick<NavUser, "permissions">): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.requires || user.permissions.includes(item.requires),
  );
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Front desk",
  trainer: "Trainer",
};

/** Matches a pathname to its nav item, for the topbar title. */
export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
