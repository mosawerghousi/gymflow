"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, ScanLine, Sun, UserRound } from "lucide-react";

import { MemberCode } from "@/presentation/components/i18n/bidi";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { MembershipStatus } from "@/presentation/components/shared/status-badge";
import { visibleNavItems, type NavUser } from "@/presentation/components/layout/nav-config";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/presentation/components/ui/command";
import { useLazySearchDeskQuery } from "@/presentation/store/api/checkins-api";

/**
 * ⌘K — navigate, or find a member and jump straight to their profile.
 *
 * Member search reuses the front-desk endpoint rather than adding a new one, so
 * the palette matches on the same fields the desk does: name, code, email,
 * phone.
 */
export function CommandPalette({ user }: { user: NavUser }) {
  const t = useTranslations("commandPalette");
  const tNav = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, { data: members = [], isFetching }] = useLazySearchDeskQuery();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced member lookup — the palette should feel instant, not chatty.
  useEffect(() => {
    if (!open || query.trim().length < 2) return;

    const timer = setTimeout(() => {
      void search({ query: query.trim(), limit: 6 });
    }, 180);

    return () => clearTimeout(timer);
  }, [query, open, search]);

  function run(action: () => void) {
    setOpen(false);
    setQuery("");
    action();
  }

  const canSearchMembers = user.permissions.includes("checkins:read");

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("title")}
      description={t("description")}
      shouldFilter={false}
    >
      <CommandInput
        placeholder={t("placeholder")}
        value={query}
        onValueChange={setQuery}
      />

      <CommandList>
        <CommandEmpty>
          {isFetching ? t("searching") : t("empty")}
        </CommandEmpty>

        <CommandGroup heading={t("goTo")}>
          {visibleNavItems(user)
            .filter((item) => matches(query, [tNav(item.labelKey), ...(item.keywords ?? [])]))
            .map((item) => (
              <CommandItem
                key={item.href}
                value={item.href}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon className="size-4" />
                <span>{tNav(item.labelKey)}</span>
              </CommandItem>
            ))}
        </CommandGroup>

        {canSearchMembers && members.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("membersGroup")}>
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.id}
                  onSelect={() => run(() => router.push(`/members/${member.id}`))}
                >
                  <MemberAvatar name={member.fullName} size="xs" />
                  <span className="flex-1 truncate">{member.fullName}</span>
                  <MemberCode code={member.code} className="text-2xs text-muted-foreground" />
                  <MembershipStatus status={member.status} className="text-xs" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />

        <CommandGroup heading={t("actions")}>
          {user.permissions.includes("checkins:write") ? (
            <CommandItem value="check-in" onSelect={() => run(() => router.push("/checkin"))}>
              <ScanLine className="size-4" />
              <span>{t("openDesk")}</span>
            </CommandItem>
          ) : null}

          <CommandItem
            value="theme"
            onSelect={() =>
              run(() => setTheme(resolvedTheme === "light" ? "dark" : "light"))
            }
          >
            {resolvedTheme === "light" ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            <span>{t("switchTheme", { theme: resolvedTheme === "light" ? "dark" : "light" })}</span>
          </CommandItem>

          <CommandItem value="profile" onSelect={() => run(() => router.push("/dashboard"))}>
            <UserRound className="size-4" />
            <span>{t("signedInAs", { name: user.name, role: tRoles(user.role) })}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Local filtering, so nav items rank on their keywords as well as their label. */
function matches(query: string, haystack: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;

  return haystack.some((value) => value.toLowerCase().includes(needle));
}
