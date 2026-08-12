"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  Repeat,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { SHIFT_POSITIONS } from "@/domain/entities/shift";
import {
  formatCount,
  formatDayMonth,
  formatDayNumber,
  formatHour,
  formatTime as fmtTime,
  formatWeekday,
  weekDaysFrom,
} from "@/presentation/lib/format";
import { SessionForm } from "@/presentation/components/forms/session-form";
import { ShiftForm } from "@/presentation/components/forms/shift-form";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { EmptyState, ErrorState } from "@/presentation/components/shared/states";
import { SessionStatus } from "@/presentation/components/shared/status-badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { cn } from "@/presentation/lib/utils";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCancelShiftMutation,
  useGetScheduleQuery,
  useRequestSwapMutation,
  useResolveSwapMutation,
  useUpdateSessionMutation,
} from "@/presentation/store/api/schedule-api";
import { useAppDispatch, useAppSelector } from "@/presentation/store/hooks";
import {
  dragCancelled,
  dragEnded,
  dragMoved,
  dragStarted,
  jumpedToToday,
  mineOnlyToggled,
  shiftDialogClosed,
  shiftSelected,
  weekShifted,
} from "@/presentation/store/schedule-slice";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
/** Generous rows — a 44px grid row is unreadable once two people overlap. */
const ROW_HEIGHT = 56;

/** Muted fills, colour-coded by role; the accent arrives on hover. */
const POSITION_STYLES: Record<string, string> = {
  front_desk: "bg-chart-1/12 border-chart-1/35 text-chart-1 hover:border-primary",
  floor: "bg-chart-2/14 border-chart-2/35 text-chart-2 hover:border-primary",
  training: "bg-warning/12 border-warning/35 text-warning hover:border-primary",
  cleaning: "bg-surface-3 border-border-strong text-muted-foreground hover:border-primary",
  management: "bg-danger/10 border-danger/30 text-danger hover:border-primary",
};

export interface ScheduleScreenProps {
  currentUserId: string;
  canManageShifts: boolean;
  canResolveSwaps: boolean;
  canRequestSwap: boolean;
  canBookSessions: boolean;
}

/**
 * The weekly roster.
 *
 * Admins drag down an empty column to rough out a shift — the drag paints a
 * ghost block and changes the cursor so it feels physical — and the shared
 * ShiftForm opens pre-filled with what they drew. Conflicts come back from the
 * server and are shown inline, in red, on the block that clashes.
 */
export function ScheduleScreen(props: ScheduleScreenProps) {
  const t = useTranslations("schedule");
  const tCommon = useTranslations("common");
  const tPos = useTranslations("positions");
  const locale = useLocale();
  const ctx = { locale };
  const dispatch = useAppDispatch();
  const { weekStart, draft, isDragging, selectedShiftId, isShiftDialogOpen, mineOnly } =
    useAppSelector((state) => state.schedule);

  // Seeded to a fixed epoch so server and client agree; corrected on mount.
  useEffect(() => {
    if (weekStart === "1970-01-05") {
      dispatch(jumpedToToday(new Date().toISOString()));
    }
  }, [weekStart, dispatch]);

  const { from, to, days } = useMemo(() => weekWindow(weekStart, locale), [weekStart, locale]);

  const { data, isLoading, isError, refetch } = useGetScheduleQuery({
    from: from.toISOString(),
    to: to.toISOString(),
    mine: mineOnly,
  });

  const [cancelShift] = useCancelShiftMutation();
  const [requestSwap] = useRequestSwapMutation();
  const [resolveSwap] = useResolveSwapMutation();
  const [updateSession] = useUpdateSessionMutation();

  const [isShiftFormOpen, setShiftFormOpen] = useState(false);
  const [isSessionFormOpen, setSessionFormOpen] = useState(false);
  const [conflictShiftId, setConflictShiftId] = useState<string | null>(null);

  const selectedShift = data?.shifts.find((shift) => shift.id === selectedShiftId) ?? null;
  const staff = data?.staff ?? [];
  const trainers = staff.filter((member) => member.role === "trainer");

  const nowMarker = useNowMarker(days);

  /** A finished drag becomes the ShiftForm's default values. */
  const draftDefaults = useMemo(() => {
    if (!draft) return undefined;

    const day = days[draft.dayIndex];
    if (!day) return undefined;

    const startHour = Math.min(draft.startHour, draft.endHour);
    const endHour = Math.max(draft.startHour, draft.endHour) + 1;
    const date = day.toISOString().slice(0, 10);

    return {
      userId: draft.userId,
      startsAt: `${date}T${String(startHour).padStart(2, "0")}:00:00.000Z`,
      endsAt: `${date}T${String(endHour).padStart(2, "0")}:00:00.000Z`,
    };
  }, [draft, days]);

  useEffect(() => {
    if (isShiftDialogOpen && draft) setShiftFormOpen(true);
  }, [isShiftDialogOpen, draft]);

  return (
    <div className="space-y-4 px-5 pb-10 sm:px-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("previousWeek")}
            onClick={() => dispatch(weekShifted(-1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("nextWeek")}
            onClick={() => dispatch(weekShifted(1))}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch(jumpedToToday(new Date().toISOString()))}
          >
            {tCommon("today")}
          </Button>
        </div>

        <p data-numeric className="text-sm font-medium">
          {formatDayMonth(days[0]!, ctx)} – {formatDayMonth(days[6]!, ctx)}
        </p>

        <Button
          variant={mineOnly ? "secondary" : "ghost"}
          size="sm"
          onClick={() => dispatch(mineOnlyToggled(!mineOnly))}
        >
          <CalendarDays /> {t("onlyMine")}
        </Button>

        <div className="ms-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a
              href={`/api/export/ical?from=${from.toISOString()}&to=${to.toISOString()}${mineOnly ? "&mine=true" : ""}`}
            >
              <Download /> {t("exportIcs")}
            </a>
          </Button>

          {props.canBookSessions && trainers.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setSessionFormOpen(true)}>
              <UserPlus /> {t("bookSession")}
            </Button>
          ) : null}

          {props.canManageShifts ? (
            <Button
              size="sm"
              onClick={() => {
                dispatch(shiftDialogClosed());
                setShiftFormOpen(true);
              }}
            >
              <CalendarPlus /> {t("addShift")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Legend + drag hint */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {SHIFT_POSITIONS.map((position) => (
          <span key={position} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "size-2.5 rounded-sm border",
                POSITION_STYLES[position]?.split(" hover:")[0],
              )}
            />
            {tPos(position)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-1 rounded-full bg-success" />
          {t("trainerSession")}
        </span>
        {props.canManageShifts ? (
          <span className="ms-auto">{t("dragHint")}</span>
        ) : null}
      </div>

      {/* Grid */}
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          {isError ? (
            <ErrorState title={t("scheduleFailed")} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="space-y-px p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[64rem]">
                {/* Day header */}
                <div className="sticky top-0 z-10 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border bg-card">
                  <div />
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-s border-border px-2 py-2.5 text-center",
                        isToday(day) && "bg-brand-subtle",
                      )}
                    >
                      <p className="text-2xs font-medium tracking-wide text-secondary-foreground uppercase">
                        {formatWeekday(day, ctx)}
                      </p>
                      <p
                        data-numeric
                        className={cn(
                          "text-sm font-semibold",
                          isToday(day) && "text-primary",
                        )}
                      >
                        {formatDayNumber(day, ctx)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Hour rows + blocks */}
                <div
                  className={cn("relative", isDragging && "cursor-ns-resize select-none")}
                  onMouseUp={() => {
                    if (isDragging) dispatch(dragEnded());
                  }}
                  onMouseLeave={() => {
                    if (isDragging) dispatch(dragCancelled());
                  }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      style={{ height: ROW_HEIGHT }}
                      className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border last:border-0"
                    >
                      <div
                        data-numeric
                        className="pt-1 pe-2 text-end text-2xs text-muted-foreground"
                      >
                        {formatHour(hour, ctx)}
                      </div>

                      {days.map((day, dayIndex) => {
                        const inDraft =
                          draft !== null &&
                          draft.dayIndex === dayIndex &&
                          hour >= Math.min(draft.startHour, draft.endHour) &&
                          hour <= Math.max(draft.startHour, draft.endHour);

                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            // Deliberately not focusable: 112 tab stops would be
                            // hostile to keyboard users, and "Add shift" opens
                            // the very same form.
                            aria-hidden
                            onMouseDown={() => {
                              if (!props.canManageShifts) return;
                              dispatch(
                                dragStarted({
                                  userId: staff[0]?.id ?? props.currentUserId,
                                  dayIndex,
                                  startHour: hour,
                                  endHour: hour,
                                }),
                              );
                            }}
                            onMouseEnter={() => {
                              if (isDragging) dispatch(dragMoved(hour));
                            }}
                            className={cn(
                              "border-s border-border transition-colors duration-150",
                              props.canManageShifts && "cursor-cell hover:bg-surface-2",
                              // The ghost block the drag paints.
                              inDraft &&
                                "border-y border-dashed border-primary/60 bg-brand-muted",
                              isToday(day) && !inDraft && "bg-brand-subtle/40",
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}

                  {/* Current-time indicator */}
                  {nowMarker ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-20"
                      style={{ top: nowMarker.top }}
                    >
                      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
                        <div className="flex items-center justify-end pe-1">
                          <span
                            data-numeric
                            className="rounded bg-danger px-1 py-0.5 text-2xs font-medium text-danger-foreground"
                          >
                            {nowMarker.label}
                          </span>
                        </div>
                        {days.map((day, index) => (
                          <div key={day.toISOString()} className="relative">
                            {index === nowMarker.dayIndex ? (
                              <div className="absolute inset-x-0 top-0 h-px bg-danger">
                                <span className="absolute -top-1 start-0 size-2 rounded-full bg-danger" />
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Shift and session blocks */}
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
                    <div />
                    {days.map((day) => {
                      const dayShifts = packIntoLanes(
                        (data?.shifts ?? []).filter((shift) =>
                          sameDay(new Date(shift.startsAt), day),
                        ),
                        (shift) => new Date(shift.startsAt).getTime(),
                        (shift) => new Date(shift.endsAt).getTime(),
                      );

                      return (
                        <div key={day.toISOString()} className="relative">
                          <div className="absolute inset-y-0 start-0 end-2.5">
                            {dayShifts.map(({ item: shift, lane, lanes }) => {
                              const geometry = blockGeometry(shift.startsAt, shift.endsAt);
                              if (!geometry) return null;

                              const isConflicting = conflictShiftId === shift.id;

                              return (
                                <button
                                  key={shift.id}
                                  type="button"
                                  onClick={() => dispatch(shiftSelected(shift.id))}
                                  title={`${shift.userName} · ${tPos(shift.position)} · ${fmtTime(shift.startsAt, ctx)}–${fmtTime(shift.endsAt, ctx)}`}
                                  style={{
                                    ...geometry,
                                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                                    width: `calc(${100 / lanes}% - 4px)`,
                                  }}
                                  className={cn(
                                    "pointer-events-auto absolute flex flex-col items-start justify-start overflow-hidden rounded-md border px-1.5 py-1 text-start text-2xs leading-tight",
                                    "transition-[border-color,background-color] duration-150",
                                    POSITION_STYLES[shift.position] ?? "bg-surface-3 border-border",
                                    shift.status === "cancelled" && "opacity-40 line-through",
                                    isConflicting && "border-danger bg-danger-subtle text-danger",
                                  )}
                                >
                                  <span className="block w-full truncate font-semibold">
                                    {lanes >= 3
                                      ? (shift.userName.split(" ")[0] ?? shift.userName)
                                      : shift.userName}
                                  </span>
                                  {lanes < 3 ? (
                                    <span data-numeric className="block w-full truncate opacity-90">
                                      {fmtTime(shift.startsAt, ctx)}–{fmtTime(shift.endsAt, ctx)}
                                    </span>
                                  ) : null}
                                  {shift.swapStatus === "pending" ? (
                                    <span className="mt-0.5 flex items-center gap-0.5">
                                      <Repeat className="size-2.5" />
                                      {lanes < 3 ? t("cover") : null}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>

                          {(data?.sessions ?? [])
                            .filter((session) => sameDay(new Date(session.startsAt), day))
                            .map((session) => {
                              const geometry = blockGeometry(session.startsAt, session.endsAt);
                              if (!geometry) return null;

                              return (
                                <div
                                  key={session.id}
                                  style={geometry}
                                  title={`${session.memberName} · ${session.trainerName} · ${fmtTime(session.startsAt, ctx)}`}
                                  className={cn(
                                    "pointer-events-auto absolute end-0.5 w-1.5 rounded-full bg-success",
                                    session.status === "cancelled" && "opacity-25",
                                    session.status === "no_show" && "bg-danger",
                                  )}
                                />
                              );
                            })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("trainerSessions")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("bookedThisWeek")}</p>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {!data || data.sessions.length === 0 ? (
              <EmptyState
                compact
                icon={UserPlus}
                title={t("noSessions")}
                description={t("noSessionsHint")}
                action={
                  props.canBookSessions && trainers.length > 0 ? (
                    <Button size="sm" variant="secondary" onClick={() => setSessionFormOpen(true)}>
                      <UserPlus /> {t("bookSession")}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.sessions.map((session) => (
                  <li key={session.id} className="group/row flex items-center gap-2.5 py-2.5">
                    <MemberAvatar name={session.memberName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{session.memberName}</p>
                      <p data-numeric className="truncate text-xs text-muted-foreground">
                        {formatWeekday(session.startsAt, ctx)} {fmtTime(session.startsAt, ctx)} · {session.trainerName}
                      </p>
                    </div>
                    <SessionStatus status={session.status} />
                    {session.status === "booked" &&
                    (props.canBookSessions || session.trainerId === props.currentUserId) ? (
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await updateSession({
                                sessionId: session.id,
                                status: "completed",
                              }).unwrap();
                              toast.success(t("markedCompleted"));
                            } catch (error) {
                              toast.error(apiErrorMessage(error, t("updateFailed")));
                            }
                          }}
                        >
                          {t("markDone")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await updateSession({
                                sessionId: session.id,
                                status: "no_show",
                              }).unwrap();
                              toast.info(t("markedNoShow"));
                            } catch (error) {
                              toast.error(apiErrorMessage(error, t("updateFailed")));
                            }
                          }}
                        >
                          {t("markNoShow")}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("coverRequests")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("coverRequestsHint")}</p>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {!data || data.swapRequests.length === 0 ? (
              <EmptyState
                compact
                icon={ArrowLeftRight}
                title={t("nothingWaiting")}
                description={t("nothingWaitingHint")}
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.swapRequests.map((request) => (
                  <li key={request.id} className="space-y-2.5 py-3">
                    <div className="flex items-start gap-2.5">
                      <MemberAvatar name={request.requestedByName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm">
                          {t("needsCover", { name: request.requestedByName })}
                        </p>
                        <p data-numeric className="text-xs text-muted-foreground">
                          {formatWeekday(request.shiftStartsAt, ctx)}{" "}
                          {fmtTime(request.shiftStartsAt, ctx)} – {fmtTime(request.shiftEndsAt, ctx)}
                        </p>
                        {request.reason ? (
                          <p className="mt-1 text-xs text-muted-foreground">{request.reason}</p>
                        ) : null}
                      </div>
                    </div>

                    {props.canResolveSwaps ? (
                      <SwapResolver
                        staff={staff.filter((member) => member.id !== request.requestedByUserId)}
                        onApprove={async (coverUserId) => {
                          try {
                            await resolveSwap({
                              swapRequestId: request.id,
                              decision: "approve",
                              coverUserId,
                            }).unwrap();
                            toast.success(t("swapApproved"));
                          } catch (error) {
                            setConflictShiftId(request.shiftId);
                            setTimeout(() => setConflictShiftId(null), 4000);
                            toast.error(apiErrorMessage(error, t("swapApproveFailed")));
                          }
                        }}
                        onReject={async () => {
                          try {
                            await resolveSwap({
                              swapRequestId: request.id,
                              decision: "reject",
                            }).unwrap();
                            toast.info(t("swapRejected"));
                          } catch (error) {
                            toast.error(apiErrorMessage(error, t("swapRejectFailed")));
                          }
                        }}
                      />
                    ) : request.requestedByUserId === props.currentUserId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await resolveSwap({
                              swapRequestId: request.id,
                              decision: "withdraw",
                            }).unwrap();
                            toast.info(t("swapWithdrawn"));
                          } catch (error) {
                            toast.error(apiErrorMessage(error, t("swapWithdrawFailed")));
                          }
                        }}
                      >
                        {t("withdraw")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* The shared ShiftForm — create mode, pre-filled from the drag. */}
      <ShiftForm
        mode="create"
        open={isShiftFormOpen}
        staff={staff}
        defaultValues={draftDefaults}
        onOpenChange={(open) => {
          setShiftFormOpen(open);
          if (!open) dispatch(shiftDialogClosed());
        }}
      />

      <SessionForm
        mode="create"
        open={isSessionFormOpen}
        trainers={trainers}
        onOpenChange={setSessionFormOpen}
      />

      {/* Existing shift */}
      <Dialog
        open={selectedShift !== null && !isShiftFormOpen}
        onOpenChange={(open) => {
          if (!open) dispatch(shiftDialogClosed());
        }}
      >
        <DialogContent>
          {selectedShift ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <MemberAvatar name={selectedShift.userName} size="sm" />
                  {selectedShift.userName}
                </DialogTitle>
                <DialogDescription data-numeric>
                  {t("shiftDetail", {
                    start: `${formatWeekday(selectedShift.startsAt, ctx)} ${fmtTime(selectedShift.startsAt, ctx)}`,
                    end: fmtTime(selectedShift.endsAt, ctx),
                    position: tPos(selectedShift.position),
                    hours: formatCount(selectedShift.hours, ctx),
                  })}
                </DialogDescription>
              </DialogHeader>

              {selectedShift.notes ? (
                <p className="text-sm text-muted-foreground">{selectedShift.notes}</p>
              ) : null}

              <DialogFooter className="sm:justify-between">
                {props.canManageShifts && selectedShift.status !== "cancelled" ? (
                  <Button
                    variant="destructive-ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await cancelShift({ shiftId: selectedShift.id }).unwrap();
                        toast.success(t("shiftCancelled"));
                        dispatch(shiftDialogClosed());
                      } catch (error) {
                        toast.error(apiErrorMessage(error, t("cancelShiftFailed")));
                      }
                    }}
                  >
                    <Trash2 /> {t("cancelShift")}
                  </Button>
                ) : (
                  <span />
                )}

                {props.canRequestSwap && selectedShift.userId === props.currentUserId ? (
                  <Button
                    onClick={async () => {
                      try {
                        await requestSwap({ shiftId: selectedShift.id }).unwrap();
                        toast.success(t("coverRequested"));
                        dispatch(shiftDialogClosed());
                      } catch (error) {
                        toast.error(apiErrorMessage(error, t("coverRequestFailed")));
                      }
                    }}
                  >
                    <ArrowLeftRight /> {t("requestCover")}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SwapResolver({
  staff,
  onApprove,
  onReject,
}: {
  staff: Array<{ id: string; name: string; role: string }>;
  onApprove: (coverUserId: string) => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const t = useTranslations("schedule");
  const [coverUserId, setCoverUserId] = useState("");
  const label = t("chooseCoverLabel");
  const placeholder = t("chooseCover");

  return (
    <div className="flex flex-wrap items-center gap-2 ps-10">
      <Select value={coverUserId} onValueChange={setCoverUserId}>
        <SelectTrigger className="h-8 w-40 text-xs" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {staff.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button size="sm" disabled={!coverUserId} onClick={() => void onApprove(coverUserId)}>
        {t("approve")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void onReject()}>
        {t("reject")}
      </Button>
    </div>
  );
}

/** Positions the "now" line, if the current instant falls inside this week. */
function useNowMarker(days: Date[]) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return null;

  const dayIndex = days.findIndex((day) => sameDay(day, now));
  if (dayIndex === -1) return null;

  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;
  if (hour < DAY_START_HOUR || hour > DAY_END_HOUR) return null;

  return {
    dayIndex,
    top: (hour - DAY_START_HOUR) * ROW_HEIGHT,
    label: now.toISOString().slice(11, 16),
  };
}

interface Lane<T> {
  item: T;
  lane: number;
  lanes: number;
}

/**
 * Packs overlapping items into side-by-side lanes, clustering so a lone evening
 * shift still spans the full column even if the morning had four people on.
 */
function packIntoLanes<T>(
  items: readonly T[],
  startOf: (item: T) => number,
  endOf: (item: T) => number,
): Array<Lane<T>> {
  const sorted = [...items].sort((a, b) => startOf(a) - startOf(b) || endOf(a) - endOf(b));

  const packed: Array<Lane<T>> = [];
  let cluster: Array<Lane<T>> = [];
  let laneEnds: number[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const closeCluster = () => {
    for (const entry of cluster) entry.lanes = laneEnds.length;
    packed.push(...cluster);
    cluster = [];
    laneEnds = [];
    clusterEnd = Number.NEGATIVE_INFINITY;
  };

  for (const item of sorted) {
    const start = startOf(item);
    const end = endOf(item);

    if (cluster.length > 0 && start >= clusterEnd) closeCluster();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    clusterEnd = Math.max(clusterEnd, end);
    cluster.push({ item, lane, lanes: 1 });
  }

  if (cluster.length > 0) closeCluster();

  return packed;
}

/**
 * The visible week.
 *
 * Column order follows the locale's first day — Saturday in Afghanistan — while
 * the query window still spans the same seven days.
 */
function weekWindow(weekStart: string, locale: string) {
  const days = weekDaysFrom(weekStart, locale);
  const from = days[0]!;

  return { from, to: new Date(from.getTime() + 7 * 86_400_000), days };
}

function blockGeometry(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const startHour = start.getUTCHours() + start.getUTCMinutes() / 60;
  const endHour = end.getUTCHours() + end.getUTCMinutes() / 60;

  const clampedStart = Math.max(startHour, DAY_START_HOUR);
  const clampedEnd = Math.min(endHour <= startHour ? DAY_END_HOUR : endHour, DAY_END_HOUR);

  if (clampedEnd <= clampedStart) return null;

  return {
    top: (clampedStart - DAY_START_HOUR) * ROW_HEIGHT,
    height: (clampedEnd - clampedStart) * ROW_HEIGHT,
  };
}

function sameDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isToday(day: Date): boolean {
  return day.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}



