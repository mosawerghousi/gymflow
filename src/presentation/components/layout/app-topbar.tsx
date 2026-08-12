"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { LogOut, Menu, Search } from "lucide-react";

import { Link, usePathname } from "@/i18n/routing";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { LanguageSwitcher } from "@/presentation/components/i18n/language-switcher";
import { CommandPalette } from "@/presentation/components/layout/command-palette";
import {
  ROLE_KEYS,
  activeNavItem,
  visibleNavItems,
  type NavUser,
} from "@/presentation/components/layout/nav-config";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { RoleBadge } from "@/presentation/components/shared/status-badge";
import { ThemeToggle } from "@/presentation/components/theme/theme-toggle";
import { Button } from "@/presentation/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/presentation/components/ui/sheet";
import { cn } from "@/presentation/lib/utils";

/**
 * The topbar: where you are, ⌘K, theme, and who you are signed in as.
 *
 * On tablet and below it also carries the navigation, which moves into a sheet.
 */
export function AppTopbar({ user, title }: { user: NavUser; title?: string }) {
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const tPalette = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  const active = activeNavItem(pathname);
  const heading = title ?? (active ? t(active.labelKey) : "GymFlow");

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
      <MobileNav user={user} />

      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
        {heading}
      </h1>

      {/* The palette trigger doubles as the global search affordance. */}
      <button
        type="button"
        onClick={() =>
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
          )
        }
        className="hidden items-center gap-2 rounded-md border border-border bg-surface-2 py-1.5 pe-1.5 ps-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground sm:flex"
      >
        <Search className="size-3.5" />
        <span className="pe-8">{tPalette("trigger")}</span>
        <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 font-sans text-2xs text-secondary-foreground">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <LanguageSwitcher />
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md p-1 transition-colors duration-150 hover:bg-surface-2"
          >
            <MemberAvatar name={user.name} size="sm" />
            {/* The avatar is aria-hidden, so the name comes from here — an
                aria-label would clash with the visible initials. */}
            <span className="sr-only">{t("accountMenu", { name: user.name })}</span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-2.5">
              <MemberAvatar name={user.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <RoleBadge role={user.role} />
              <span className="text-xs text-muted-foreground">
                {tRoles(ROLE_KEYS[user.role])}
              </span>
              {user.isDemo ? (
                <span className="ms-auto text-2xs text-muted-foreground uppercase">{tRoles("demo")}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-4" />
            {tCommon("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandPalette user={user} />
    </header>
  );
}

function MobileNav({ user }: { user: NavUser }) {
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={tNav("openNavigation")}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-14 justify-center border-b border-border px-4">
          <SheetTitle asChild>
            <GymFlowLogo />
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-0.5 p-2">
          {visibleNavItems(user).map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 start-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <item.icon className={cn("size-4.5", isActive && "text-primary")} />
                {tNav(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
