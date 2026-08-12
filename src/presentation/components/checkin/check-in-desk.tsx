"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Clock,
  CornerDownLeft,
  Loader2,
  LogOut,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Link } from "@/i18n/routing";
import { MemberCode } from "@/presentation/components/i18n/bidi";
import { formatCount } from "@/presentation/lib/format";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { EmptyState, ListSkeleton } from "@/presentation/components/shared/states";
import { MembershipStatus, StatusDot } from "@/presentation/components/shared/status-badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { cn } from "@/presentation/lib/utils";
import { apiErrorDetails, apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCheckInMutation,
  useCheckOutMutation,
  useCurrentlyInGymQuery,
  useSearchDeskQuery,
} from "@/presentation/store/api/checkins-api";
import {
  checkInFailed,
  checkInSucceeded,
  deskCleared,
  deskQueryChanged,
  highlightMoved,
  highlightSet,
} from "@/presentation/store/checkin-slice";
import { useAppDispatch, useAppSelector } from "@/presentation/store/hooks";

const SEARCH_DEBOUNCE_MS = 160;
/** How long the success row keeps its sweep before settling. */
const SWEEP_MS = 1400;

/**
 * The front desk.
 *
 * Keyboard-first by design: the search is auto-focused and oversized, results
 * are touch-sized rows, and Enter checks in the top result. Success gets the
 * one deliberate motion moment in the app — a green sweep and an accent flash
 * — because this is the interaction a desk performs hundreds of times a day.
 */
export function CheckInDesk() {
  const t = useTranslations("checkin");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const ctx = { locale };
  const dispatch = useAppDispatch();
  const { query, highlightedIndex, lastResult, lastError, feed } = useAppSelector(
    (state) => state.checkin,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const [sweptId, setSweptId] = useState<string | null>(null);

  const { data: results = [], isFetching } = useSearchDeskQuery(
    { query: debouncedQuery },
    { skip: debouncedQuery.trim().length === 0 },
  );

  const { data: inGym, isLoading: isRosterLoading } = useCurrentlyInGymQuery(undefined, {
    pollingInterval: 30_000,
  });

  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation();
  const [checkOut] = useCheckOutMutation();

  const safeIndex = results.length > 0 ? Math.min(highlightedIndex, results.length - 1) : 0;

  async function performCheckIn(memberId: string) {
    try {
      const result = await checkIn({ memberId, method: "manual" }).unwrap();

      dispatch(checkInSucceeded(result));
      setSweptId(memberId);
      setTimeout(() => setSweptId(null), SWEEP_MS);

      if (result.outcome === "already_inside") {
        toast.info(t("alreadyInsideToast", { name: result.member.fullName }));
      } else {
        toast.success(t("checkedInToast", { name: result.member.fullName }));
      }

      inputRef.current?.focus();
    } catch (error) {
      const details = apiErrorDetails(error);

      dispatch(
        checkInFailed({
          message: apiErrorMessage(error, t("checkInFailed")),
          memberName: typeof details?.memberName === "string" ? details.memberName : undefined,
          memberCode: typeof details?.memberCode === "string" ? details.memberCode : undefined,
        }),
      );
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      dispatch(highlightMoved({ delta: 1, max: results.length }));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      dispatch(highlightMoved({ delta: -1, max: results.length }));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[safeIndex];
      if (target?.canCheckIn) void performCheckIn(target.id);
      else if (target) toast.error(target.blockedReason ?? t("cannotCheckIn"));
    } else if (event.key === "Escape") {
      dispatch(deskCleared());
    }
  }

  return (
    <div className="grid gap-5 px-5 pb-10 sm:px-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-4">
        {/* The giant, auto-focused search. */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => dispatch(deskQueryChanged(event.target.value))}
            onKeyDown={onKeyDown}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="h-16 rounded-xl ps-14 text-base md:text-base"
          />
          {isFetching ? (
            <Loader2 className="absolute top-1/2 end-14 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("clearSearch")}
              className="absolute top-1/2 end-3 -translate-y-1/2"
              onClick={() => {
                dispatch(deskCleared());
                inputRef.current?.focus();
              }}
            >
              <X />
            </Button>
          ) : null}
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Key>↑</Key>
            <Key>↓</Key> {t("hintMove")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Key>
              <CornerDownLeft className="size-2.5" />
            </Key>
            {t("hintCheckIn")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Key>Esc</Key> {t("hintClear")}
          </span>
        </p>

        {/* Outcome banner */}
        {lastError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/45 bg-danger-subtle px-4 py-3.5"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-danger">{t("entryBlocked")}</p>
              <p className="mt-0.5 text-sm text-foreground">{lastError.message}</p>
            </div>
            <Button asChild size="sm" variant="secondary" className="shrink-0">
              <Link href="/members">
                <CalendarPlus /> {tCommon("open")}
              </Link>
            </Button>
          </div>
        ) : lastResult ? (
          <div
            key={lastResult.checkin.id}
            className={cn(
              "flex items-center gap-4 rounded-xl border px-4 py-3.5",
              lastResult.outcome === "already_inside"
                ? "border-border bg-surface-2"
                : "animate-[var(--animate-check-in)] border-success/45 bg-success-subtle",
            )}
          >
            <MemberAvatar name={lastResult.member.fullName} size="lg" />

            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">
                {lastResult.outcome === "already_inside"
                  ? t("alreadyInside", { name: lastResult.member.fullName })
                  : t("isIn", { name: lastResult.member.fullName })}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                <MemberCode code={lastResult.member.code} />
                {lastResult.member.planName ? ` · ${lastResult.member.planName}` : ""}
                {lastResult.warnings.length > 0 ? ` · ${lastResult.warnings.join(" ")}` : ""}
              </p>
            </div>

            {lastResult.outcome === "checked_in" ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                <Check className="size-5" />
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Results */}
        {debouncedQuery.trim().length > 0 ? (
          results.length === 0 && !isFetching ? (
            <Card className="py-0">
              <CardContent className="px-0">
                <EmptyState
                  icon={Search}
                  title={t("noMatch", { query: debouncedQuery })}
                  description={t("noMatchHint")}
                />
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Matching members">
              {results.map((member, index) => (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === safeIndex}
                    onMouseEnter={() => dispatch(highlightSet(index))}
                    onClick={() =>
                      member.canCheckIn
                        ? void performCheckIn(member.id)
                        : toast.error(member.blockedReason ?? t("cannotCheckIn"))
                    }
                    disabled={isCheckingIn}
                    className={cn(
                      "relative flex w-full items-center gap-4 overflow-hidden rounded-xl border px-4 py-3.5 text-start",
                      "transition-colors duration-150",
                      index === safeIndex
                        ? "border-primary/55 bg-surface-2"
                        : "border-border bg-card hover:border-border-strong",
                      !member.canCheckIn && "border-danger/30",
                      sweptId === member.id && "row-sweep",
                    )}
                  >
                    <MemberAvatar name={member.fullName} size="lg" />

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-medium">{member.fullName}</span>
                        {member.isInsideNow ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <StatusDot tone="success" /> {t("inside")}
                          </span>
                        ) : null}
                      </span>

                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <MemberCode code={member.code} />
                        <span aria-hidden>·</span>
                        <MembershipStatus status={member.status} className="text-xs" />
                        {member.planName ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{member.planName}</span>
                          </>
                        ) : null}
                      </span>

                      {!member.canCheckIn && member.blockedReason ? (
                        <span className="mt-1.5 block text-xs text-danger">
                          {member.blockedReason}
                        </span>
                      ) : null}
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-md px-3.5 py-2 text-sm font-medium",
                        member.canCheckIn
                          ? "bg-primary text-primary-foreground"
                          : "bg-danger-subtle text-danger",
                      )}
                    >
                      {member.canCheckIn ? "Check in" : "Blocked"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <Card className="py-0">
            <CardContent className="px-0">
              <EmptyState
                icon={UserRound}
                title={t("ready")}
                description={t("readyHint")}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right rail */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StatusDot tone="success" pulse /> {t("inTheGym")}
            </CardTitle>
            <CardAction>
              <span data-numeric className="text-base font-semibold text-primary">
                {formatCount(inGym?.count ?? 0, ctx)}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {isRosterLoading ? (
              <ListSkeleton rows={4} />
            ) : !inGym || inGym.visitors.length === 0 ? (
              <EmptyState compact title={t("nobodyInside")} />
            ) : (
              <ul className="divide-y divide-border">
                {inGym.visitors.map((visitor) => (
                  <li key={visitor.checkinId} className="group/row flex items-center gap-2.5 py-2">
                    <MemberAvatar name={visitor.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/members/${visitor.memberId}`}
                        className="block truncate text-sm hover:text-primary hover:underline"
                      >
                        {visitor.fullName}
                      </Link>
                      <p
                        data-numeric
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <Clock className="size-3" />
                        {tCommon("minutesShort", { count: formatCount(visitor.minutesInside, ctx) })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("checkOut", { name: visitor.fullName })}
                      className="opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100"
                      onClick={async () => {
                        try {
                          await checkOut({ checkinId: visitor.checkinId }).unwrap();
                          toast.success(t("checkedOutToast", { name: visitor.fullName }));
                        } catch (error) {
                          toast.error(apiErrorMessage(error, t("checkOutFailed")));
                        }
                      }}
                    >
                      <LogOut />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("thisSession")}</CardTitle>
          </CardHeader>
          <CardContent>
            {feed.length === 0 ? (
              <EmptyState compact title={t("nothingYet")} description={t("nothingYetHint")} />
            ) : (
              <ul className="space-y-2.5">
                {feed.map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5 text-sm">
                    <StatusDot
                      tone={
                        event.kind === "success"
                          ? "success"
                          : event.kind === "blocked"
                            ? "danger"
                            : "info"
                      }
                      className="mt-1.5"
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{event.memberName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {event.message}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1.5 font-sans text-2xs text-secondary-foreground">
      {children}
    </kbd>
  );
}

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
