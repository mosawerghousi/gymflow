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
  /** A key under the `nav` namespace, resolved by the rendering component. */
  labelKey: string;
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
    labelKey: "dashboard",
    icon: LayoutDashboard,
    exact: true,
    keywords: ["home", "overview", "today"],
  },
  {
    href: "/members",
    labelKey: "members",
    icon: Users,
    requires: "members:read",
    keywords: ["people", "roster", "membership"],
  },
  {
    href: "/checkin",
    labelKey: "checkin",
    icon: ScanLine,
    requires: "checkins:write",
    keywords: ["front desk", "entry", "scan"],
  },
  {
    href: "/schedule",
    labelKey: "schedule",
    icon: CalendarRange,
    requires: "shifts:read:own",
    keywords: ["shifts", "roster", "calendar", "sessions"],
  },
  {
    href: "/reports",
    labelKey: "reports",
    icon: LineChart,
    requires: "reports:read:limited",
    keywords: ["analytics", "churn", "stats", "insights"],
  },
  {
    href: "/settings",
    labelKey: "settings",
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

/** Keys under the `roles` namespace. */
export const ROLE_KEYS: Record<UserRole, string> = {
  admin: "admin",
  staff: "staff",
  trainer: "trainer",
};

/** Matches a pathname to its nav item, for the topbar title. */
export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
