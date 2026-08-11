"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { MembershipStatusBadge } from "@/presentation/components/shared/status-badge";
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

/** How long to wait after the last keystroke before searching. */
const SEARCH_DEBOUNCE_MS = 180;

/**
 * The front-desk screen.
 *
 * Type a name or code, arrow through the matches, hit Enter to check someone
 * in. Search state lives in `checkinSlice`; every read and write goes through
 * RTK Query, which keeps the "in gym" counter in step automatically via tags.
 */
export function CheckInDesk() {
  const dispatch = useAppDispatch();
  const { query, highlightedIndex, lastResult, lastError, feed } = useAppSelector(
    (state) => state.checkin,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);

  const { data: results = [], isFetching } = useSearchDeskQuery(
    { query: debouncedQuery },
    { skip: debouncedQuery.trim().length === 0 },
  );

  const { data: inGym } = useCurrentlyInGymQuery(undefined, {
    // The roster is a live surface — refresh it while the desk is open.
    pollingInterval: 30_000,
  });

  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation();
  const [checkOut] = useCheckOutMutation();

  const safeIndex = results.length > 0 ? Math.min(highlightedIndex, results.length - 1) : 0;

  async function performCheckIn(memberId: string) {
    try {
      const result = await checkIn({ memberId, method: "manual" }).unwrap();

      dispatch(checkInSucceeded(result));

      if (result.outcome === "already_inside") {
        toast.info(`${result.member.fullName} is already checked in.`);
      } else {
        toast.success(`${result.member.fullName} checked in.`);
      }

      inputRef.current?.focus();
    } catch (error) {
      const details = apiErrorDetails(error);

      dispatch(
        checkInFailed({
          message: apiErrorMessage(error, "Check-in failed."),
          memberName: typeof details?.memberName === "string" ? details.memberName : undefined,
          memberCode: typeof details?.memberCode === "string" ? details.memberCode : undefined,
        }),
      );

      toast.error(apiErrorMessage(error, "Check-in failed."));
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
      else if (target) toast.error(target.blockedReason ?? "This member cannot check in.");
    } else if (event.key === "Escape") {
      dispatch(deskCleared());
    }
  }

  return (
    <div className="grid gap-6 px-5 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => dispatch(deskQueryChanged(event.target.value))}
            onKeyDown={onKeyDown}
            placeholder="Search by name, member code, email or phone…"
            aria-label="Search members to check in"
            className="h-14 pl-12 text-base md:text-base"
          />
          {isFetching ? (
            <Loader2 className="absolute top-1/2 right-12 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2"
              onClick={() => {
                dispatch(deskCleared());
                inputRef.current?.focus();
              }}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          <kbd className="rounded border border-border px-1.5 py-0.5 font-sans">↑</kbd>{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-sans">↓</kbd> to move ·{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-sans">Enter</kbd> to check
          in · <kbd className="rounded border border-border px-1.5 py-0.5 font-sans">Esc</kbd> to
          clear
        </p>

        {/* Outcome banner */}
        {lastError ? (
          <Banner tone="error" icon={AlertTriangle} title="Check-in blocked">
            {lastError.message}
          </Banner>
        ) : lastResult ? (
          <Banner
            tone={lastResult.outcome === "already_inside" ? "info" : "success"}
            icon={CheckCircle2}
            title={
              lastResult.outcome === "already_inside"
                ? `${lastResult.member.fullName} is already inside`
                : `${lastResult.member.fullName} is in`
            }
          >
            <span className="font-mono">{lastResult.member.code}</span>
            {lastResult.member.planName ? ` · ${lastResult.member.planName}` : ""}
            {lastResult.warnings.length > 0 ? ` · ${lastResult.warnings.join(" ")}` : ""}
          </Banner>
        ) : null}

        {/* Results */}
        {debouncedQuery.trim().length > 0 ? (
          results.length === 0 && !isFetching ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No member matches “{debouncedQuery}”.
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
                        : toast.error(member.blockedReason ?? "Cannot check in.")
                    }
                    disabled={isCheckingIn}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-colors",
                      index === safeIndex
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card hover:border-primary/30",
                      !member.canCheckIn && "opacity-80",
                    )}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {member.fullName
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{member.fullName}</span>
                        <MembershipStatusBadge status={member.status} />
                        {member.isInsideNow ? (
                          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                            inside
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        <span className="font-mono">{member.code}</span>
                        {member.planName ? ` · ${member.planName}` : ""}
                        {member.lastVisitAt
                          ? ` · last visit ${formatDate(member.lastVisitAt)}`
                          : " · never visited"}
                      </span>
                      {!member.canCheckIn && member.blockedReason ? (
                        <span className="mt-1 block text-xs text-amber-400">
                          {member.blockedReason}
                        </span>
                      ) : null}
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-lg px-3 py-2 text-sm font-medium",
                        member.canCheckIn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
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
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <UserRound className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Start typing to find a member and check them in.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right rail */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In the gym</CardTitle>
            <CardAction>
              <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-sm font-semibold text-primary tabular-nums">
                {inGym?.count ?? 0}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {!inGym || inGym.visitors.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nobody is checked in.</p>
            ) : (
              <ul className="divide-y divide-border">
                {inGym.visitors.map((visitor) => (
                  <li key={visitor.checkinId} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/members/${visitor.memberId}`}
                        className="block truncate text-sm font-medium hover:text-primary hover:underline"
                      >
                        {visitor.fullName}
                      </Link>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span className="tabular-nums">{visitor.minutesInside}m</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Check out ${visitor.fullName}`}
                      onClick={async () => {
                        try {
                          await checkOut({ checkinId: visitor.checkinId }).unwrap();
                          toast.success(`${visitor.fullName} checked out.`);
                        } catch (error) {
                          toast.error(apiErrorMessage(error, "Check-out failed."));
                        }
                      }}
                    >
                      <LogOut className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {feed.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Check-ins from this session appear here.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {feed.map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        event.kind === "success"
                          ? "bg-primary"
                          : event.kind === "blocked"
                            ? "bg-destructive"
                            : "bg-sky-400",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{event.memberName}</span>
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

function Banner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "success" | "error" | "info";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    success: "border-primary/40 bg-primary/8 text-primary",
    error: "border-destructive/40 bg-destructive/8 text-destructive",
    info: "border-sky-500/40 bg-sky-500/8 text-sky-400",
  };

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", tones[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-foreground/80">{children}</p>
      </div>
    </div>
  );
}

/** Keeps the desk from firing a search on every keystroke. */
function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
