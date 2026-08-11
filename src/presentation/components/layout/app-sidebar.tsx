"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  MonitorSmartphone,
  ScanLine,
  Settings,
  Users,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import type { ComponentType } from "react";

import type { Permission, UserRole } from "@/domain/entities/user";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";
import { useAppDispatch, useAppSelector } from "@/presentation/store/hooks";
import { mobileNavToggled } from "@/presentation/store/ui-slice";

export interface NavUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isDemo: boolean;
  permissions: readonly Permission[];
}

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Hidden unless the signed-in user holds this permission. */
  requires?: Permission;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/members", label: "Members", icon: Users, requires: "members:read" },
  { href: "/checkin", label: "Check-in desk", icon: ScanLine, requires: "checkins:write" },
  { href: "/schedule", label: "Schedule", icon: CalendarRange, requires: "shifts:read:own" },
  { href: "/reports", label: "Reports", icon: LineChart, requires: "reports:read:limited" },
  { href: "/settings", label: "Settings", icon: Settings, requires: "settings:read" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Front desk",
  trainer: "Trainer",
};

export function AppSidebar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const isMobileNavOpen = useAppSelector((state) => state.ui.isMobileNavOpen);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requires || user.permissions.includes(item.requires),
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {visibleItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => dispatch(mobileNavToggled(false))}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <item.icon className="size-4.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}

      <Link
        href="/kiosk"
        target="_blank"
        className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <MonitorSmartphone className="size-4.5 shrink-0" />
        Kiosk mode
        <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60">new tab</span>
      </Link>
    </nav>
  );

  const footer = (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]}
            {user.isDemo ? " · demo" : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={() => void signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <GymFlowLogo iconClassName="size-7" wordmarkClassName="text-lg" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
          onClick={() => dispatch(mobileNavToggled(!isMobileNavOpen))}
        >
          {isMobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      {isMobileNavOpen ? (
        <div className="flex flex-col border-b border-border bg-sidebar lg:hidden">
          {nav}
          {footer}
        </div>
      ) : null}

      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" className="rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <GymFlowLogo />
          </Link>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
