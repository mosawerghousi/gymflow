"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MonitorSmartphone, PanelLeftClose, PanelLeftOpen, Palette } from "lucide-react";

import { GymFlowIcon, GymFlowLogo } from "@/presentation/components/brand/logo";
import { visibleNavItems, type NavUser } from "@/presentation/components/layout/nav-config";
import { Button } from "@/presentation/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/presentation/components/ui/tooltip";
import { cn } from "@/presentation/lib/utils";
import { useAppDispatch, useAppSelector } from "@/presentation/store/hooks";
import { sidebarToggled } from "@/presentation/store/ui-slice";

const COLLAPSE_KEY = "gymflow.sidebar.collapsed";

/**
 * The left rail.
 *
 * Active state is an accent indicator bar rather than a filled pill — the
 * accent stays scarce, and the eye reads position rather than a block of
 * colour. Collapse preference survives reloads.
 */
export function AppSidebar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const isCollapsed = useAppSelector((state) => state.ui.isSidebarCollapsed);
  const [hydrated, setHydrated] = useState(false);

  // Restore the stored preference once, on the client.
  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_KEY);
    if (stored === "true") dispatch(sidebarToggled(true));
    setHydrated(true);
  }, [dispatch]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(COLLAPSE_KEY, String(isCollapsed));
  }, [isCollapsed, hydrated]);

  const items = visibleNavItems(user);

  return (
    <aside
      data-collapsed={isCollapsed}
      className={cn(
        "hidden h-full shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-[var(--ease-out-quick)] lg:flex",
        isCollapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center",
          isCollapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <Link href="/dashboard" aria-label="GymFlow — dashboard" className="rounded-md">
          {isCollapsed ? <GymFlowIcon className="size-7" /> : <GymFlowLogo />}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors duration-150",
                isCollapsed ? "justify-center px-0" : "px-3",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {/* The active indicator: a 2px accent bar, not a filled pill. */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-150",
                  isActive ? "opacity-100" : "opacity-0",
                  isCollapsed && "left-0.5",
                )}
              />
              <item.icon
                className={cn("size-4.5 shrink-0", isActive && "text-primary")}
              />
              {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );

          return isCollapsed ? (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}

        <div className="mt-auto flex flex-col gap-0.5 pt-3">
          <SecondaryLink
            href="/kiosk"
            icon={MonitorSmartphone}
            label="Kiosk mode"
            isCollapsed={isCollapsed}
            external
          />
          {user.role === "admin" ? (
            <SecondaryLink
              href="/styleguide"
              icon={Palette}
              label="Style guide"
              isCollapsed={isCollapsed}
            />
          ) : null}
        </div>
      </nav>

      <div className={cn("border-t border-sidebar-border p-2", isCollapsed && "px-1")}>
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          className={cn("w-full", isCollapsed ? "justify-center" : "justify-start")}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => dispatch(sidebarToggled(!isCollapsed))}
        >
          {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!isCollapsed ? <span>Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}

function SecondaryLink({
  href,
  icon: Icon,
  label,
  isCollapsed,
  external = false,
}: {
  href: string;
  icon: typeof MonitorSmartphone;
  label: string;
  isCollapsed: boolean;
  external?: boolean;
}) {
  const link = (
    <Link
      href={href}
      {...(external ? { target: "_blank" } : {})}
      className={cn(
        "flex items-center gap-3 rounded-md py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground",
        isCollapsed ? "justify-center px-0" : "px-3",
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      {!isCollapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );

  return isCollapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : (
    link
  );
}
