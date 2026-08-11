"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { SHIFT_POSITIONS, SHIFT_POSITION_LABELS } from "@/domain/entities/shift";
import { SessionStatusBadge } from "@/presentation/components/shared/status-badge";
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
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { Textarea } from "@/presentation/components/ui/textarea";
import { cn } from "@/presentation/lib/utils";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCancelShiftMutation,
  useCreateShiftMutation,
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

/** The grid renders one row per hour in this window. */
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const POSITION_COLORS: Record<string, string> = {
  front_desk: "bg-primary/18 border-primary/40 text-primary",
  floor: "bg-sky-500/18 border-sky-500/40 text-sky-300",
  training: "bg-violet-500/18 border-violet-500/40 text-violet-300",
  cleaning: "bg-amber-500/18 border-amber-500/40 text-amber-300",
  management: "bg-rose-500/18 border-rose-500/40 text-rose-300",
};

export interface ScheduleScreenProps {
  currentUserId: string;
  canManageShifts: boolean;
  canResolveSwaps: boolean;
  canRequestSwap: boolean;
  canBookSessions: boolean;
}

/**
 * Weekly calendar grid.
 *
 * Admins drag across an empty column to rough out a shift; the drag itself is
 * tracked in `scheduleSlice` and only becomes a request once the dialog is
 * confirmed. Overlaps are refused by the server and surfaced inline.
 */
export function ScheduleScreen(props: ScheduleScreenProps) {
  const dispatch = useAppDispatch();
  const { weekStart, draft, isDragging, selectedShiftId, isShiftDialogOpen, mineOnly } =
    useAppSelector((state) => state.schedule);

  // `weekStart` starts at a fixed epoch value so server and client render the
  // same markup; the real week is set on mount.
  useEffect(() => {
    if (weekStart === "1970-01-05") {
      dispatch(jumpedToToday(new Date().toISOString()));
    }
  }, [weekStart, dispatch]);

  const { from, to, days } = useMemo(() => weekWindow(weekStart), [weekStart]);

  const { data, isLoading } = useGetScheduleQuery({
    from: from.toISOString(),
    to: to.toISOString(),
    mine: mineOnly,
  });

  const [createShift, { isLoading: isCreating }] = useCreateShiftMutation();
  const [cancelShift] = useCancelShiftMutation();
  const [requestSwap] = useRequestSwapMutation();
  const [resolveSwap] = useResolveSwapMutation();
  const [updateSession] = useUpdateSessionMutation();

  const [draftForm, setDraftForm] = useState({ position: "front_desk", notes: "" });

  const selectedShift = data?.shifts.find((shift) => shift.id === selectedShiftId) ?? null;
  const staff = data?.staff ?? [];

  async function commitDraft() {
    if (!draft) return;

    const day = days[draft.dayIndex];
    if (!day) return;

    const startHour = Math.min(draft.startHour, draft.endHour);
    const endHour = Math.max(draft.startHour, draft.endHour) + 1;

    try {
      await createShift({
        userId: draft.userId,
        startsAt: atHour(day, startHour).toISOString(),
        endsAt: atHour(day, endHour).toISOString(),
        position: draftForm.position,
        notes: draftForm.notes || null,
      }).unwrap();

      toast.success("Shift scheduled.");
      dispatch(shiftDialogClosed());
      setDraftForm({ position: "front_desk", notes: "" });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not create the shift."));
    }
  }

  return (
    <div className="space-y-4 px-5 py-6 sm:px-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous week"
            onClick={() => dispatch(weekShifted(-1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next week"
            onClick={() => dispatch(weekShifted(1))}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch(jumpedToToday(new Date().toISOString()))}
          >
            Today
          </Button>
        </div>

        <p className="text-sm font-medium tabular-nums">
          {formatDate(days[0])} – {formatDate(days[6])}
        </p>

        <Button
          variant={mineOnly ? "default" : "outline"}
          size="sm"
          onClick={() => dispatch(mineOnlyToggled(!mineOnly))}
        >
          <CalendarDays /> My shifts only
        </Button>

        <Button asChild variant="outline" size="sm" className="ml-auto">
          <a
            href={`/api/export/ical?from=${from.toISOString()}&to=${to.toISOString()}${mineOnly ? "&mine=true" : ""}`}
          >
            <Download /> Export .ics
          </a>
        </Button>
      </div>

      {props.canManageShifts ? (
        <p className="text-xs text-muted-foreground">
          Drag down an empty column to rough out a shift, then pick who works it.
        </p>
      ) : null}

      {/* Grid */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-[32rem] w-full" />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[72rem]">
                {/* Day header */}
                <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-border">
                  <div />
                  {days.map((day, index) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-l border-border px-2 py-2 text-center",
                        isToday(day) && "bg-primary/5",
                      )}
                    >
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {DAY_LABELS[index]}
                      </p>
                      <p className="text-sm font-semibold tabular-nums">{day.getUTCDate()}</p>
                    </div>
                  ))}
                </div>

                {/* Hour rows */}
                <div
                  className="relative"
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
                      className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-border last:border-0"
                    >
                      <div className="px-2 py-1 text-right text-xs text-muted-foreground tabular-nums">
                        {String(hour).padStart(2, "0")}:00
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
                            role={props.canManageShifts ? "button" : undefined}
                            tabIndex={props.canManageShifts ? 0 : undefined}
                            aria-label={
                              props.canManageShifts
                                ? `Create a shift on ${DAY_LABELS[dayIndex]} at ${hour}:00`
                                : undefined
                            }
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
                            onKeyDown={(event) => {
                              if (!props.canManageShifts) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                dispatch(
                                  dragStarted({
                                    userId: staff[0]?.id ?? props.currentUserId,
                                    dayIndex,
                                    startHour: hour,
                                    endHour: hour + 1,
                                  }),
                                );
                                dispatch(dragEnded());
                              }
                            }}
                            className={cn(
                              "min-h-11 border-l border-border transition-colors",
                              props.canManageShifts && "cursor-pointer hover:bg-muted/40",
                              inDraft && "bg-primary/20",
                              isToday(day) && !inDraft && "bg-primary/[0.03]",
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}

                  {/* Shift blocks, positioned over the grid */}
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-[4rem_repeat(7,minmax(0,1fr))]">
                    <div />
                    {days.map((day) => {
                      // Shifts that run at the same time are packed into
                      // side-by-side lanes, the way a real calendar does it —
                      // otherwise two people on the same slot render on top of
                      // each other and neither name is readable.
                      const dayShifts = packIntoLanes(
                        (data?.shifts ?? []).filter((shift) =>
                          sameDay(new Date(shift.startsAt), day),
                        ),
                        (shift) => new Date(shift.startsAt).getTime(),
                        (shift) => new Date(shift.endsAt).getTime(),
                      );

                      return (
                        <div key={day.toISOString()} className="relative">
                          {/* Shifts occupy everything but a narrow right-hand
                              strip, which is reserved for session markers. */}
                          <div className="absolute inset-y-0 left-0 right-3">
                            {dayShifts.map(({ item: shift, lane, lanes }) => {
                              const geometry = blockGeometry(shift.startsAt, shift.endsAt);
                              if (!geometry) return null;

                              return (
                                <button
                                  key={shift.id}
                                  type="button"
                                  onClick={() => dispatch(shiftSelected(shift.id))}
                                  title={`${shift.userName} · ${SHIFT_POSITION_LABELS[shift.position]} · ${formatTime(shift.startsAt)}–${formatTime(shift.endsAt)}`}
                                  style={{
                                    ...geometry,
                                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                                    width: `calc(${100 / lanes}% - 4px)`,
                                  }}
                                  className={cn(
                                    "pointer-events-auto absolute flex flex-col items-start justify-start overflow-hidden rounded-md border px-1 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-90",
                                    POSITION_COLORS[shift.position] ?? "bg-muted",
                                    shift.status === "cancelled" && "opacity-40 line-through",
                                  )}
                                >
                                  <span className="block w-full truncate font-semibold">
                                    {lanes >= 3 ? shift.userName.split(" ")[0] : shift.userName}
                                  </span>
                                  {lanes < 3 ? (
                                    <span className="block w-full truncate">
                                      {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}
                                    </span>
                                  ) : null}
                                  {shift.swapStatus === "pending" ? (
                                    <span className="mt-0.5 flex items-center gap-0.5">
                                      <Repeat className="size-2.5" />
                                      {lanes < 3 ? "swap" : null}
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
                                  title={`PT: ${session.memberName} with ${session.trainerName} · ${formatTime(session.startsAt)}`}
                                  className={cn(
                                    "pointer-events-auto absolute right-0.5 w-2 rounded-full border border-emerald-300/60 bg-emerald-400/70",
                                    session.status === "cancelled" && "opacity-30",
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
        {/* Sessions this week */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trainer sessions this week</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {!data || data.sessions.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No sessions booked.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.sessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{session.memberName}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {formatDayTime(session.startsAt)} · {session.trainerName}
                      </p>
                    </div>
                    <SessionStatusBadge status={session.status} />
                    {session.status === "booked" &&
                    (props.canBookSessions || session.trainerId === props.currentUserId) ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await updateSession({
                                sessionId: session.id,
                                status: "completed",
                              }).unwrap();
                              toast.success("Session marked completed.");
                            } catch (error) {
                              toast.error(apiErrorMessage(error, "Could not update."));
                            }
                          }}
                        >
                          Done
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
                              toast.info("Marked as a no-show.");
                            } catch (error) {
                              toast.error(apiErrorMessage(error, "Could not update."));
                            }
                          }}
                        >
                          No-show
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Swap requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending swap requests</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {!data || data.swapRequests.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nothing waiting for cover.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.swapRequests.map((request) => (
                  <li key={request.id} className="space-y-2 py-3">
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{request.requestedByName}</span> needs cover
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDayTime(request.shiftStartsAt)} –{" "}
                        {formatTime(request.shiftEndsAt)}
                        {request.reason ? ` · ${request.reason}` : ""}
                      </p>
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
                            toast.success("Swap approved and the shift reassigned.");
                          } catch (error) {
                            toast.error(apiErrorMessage(error, "Could not approve the swap."));
                          }
                        }}
                        onReject={async () => {
                          try {
                            await resolveSwap({
                              swapRequestId: request.id,
                              decision: "reject",
                            }).unwrap();
                            toast.info("Swap request rejected.");
                          } catch (error) {
                            toast.error(apiErrorMessage(error, "Could not reject the swap."));
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
                            toast.info("Request withdrawn.");
                          } catch (error) {
                            toast.error(apiErrorMessage(error, "Could not withdraw."));
                          }
                        }}
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create-from-drag dialog */}
      <Dialog
        open={isShiftDialogOpen && draft !== null}
        onOpenChange={(open) => {
          if (!open) dispatch(shiftDialogClosed());
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New shift</DialogTitle>
            <DialogDescription>
              {draft
                ? `${DAY_LABELS[draft.dayIndex]} ${String(Math.min(draft.startHour, draft.endHour)).padStart(2, "0")}:00 – ${String(Math.max(draft.startHour, draft.endHour) + 1).padStart(2, "0")}:00`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Who is working</Label>
              <Select
                value={draft?.userId ?? ""}
                onValueChange={(value) =>
                  draft && dispatch(dragStarted({ ...draft, userId: value }))
                }
              >
                <SelectTrigger className="w-full" aria-label="Who is working this shift">
                  <SelectValue placeholder="Pick a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Position</Label>
              <Select
                value={draftForm.position}
                onValueChange={(value) => setDraftForm({ ...draftForm, position: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_POSITIONS.map((position) => (
                    <SelectItem key={position} value={position}>
                      {SHIFT_POSITION_LABELS[position]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift-notes">Notes</Label>
              <Textarea
                id="shift-notes"
                rows={2}
                value={draftForm.notes}
                onChange={(event) => setDraftForm({ ...draftForm, notes: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => dispatch(shiftDialogClosed())}>
              Cancel
            </Button>
            <Button onClick={() => void commitDraft()} disabled={isCreating}>
              {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
              Create shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing-shift dialog */}
      <Dialog
        open={isShiftDialogOpen && selectedShift !== null}
        onOpenChange={(open) => {
          if (!open) dispatch(shiftDialogClosed());
        }}
      >
        <DialogContent>
          {selectedShift ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedShift.userName}</DialogTitle>
                <DialogDescription>
                  {formatDayTime(selectedShift.startsAt)} – {formatTime(selectedShift.endsAt)} ·{" "}
                  {SHIFT_POSITION_LABELS[selectedShift.position]} · {selectedShift.hours}h
                </DialogDescription>
              </DialogHeader>

              {selectedShift.notes ? (
                <p className="text-sm text-muted-foreground">{selectedShift.notes}</p>
              ) : null}

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {props.canRequestSwap && selectedShift.userId === props.currentUserId ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await requestSwap({ shiftId: selectedShift.id }).unwrap();
                        toast.success("Swap requested — an admin will find cover.");
                        dispatch(shiftDialogClosed());
                      } catch (error) {
                        toast.error(apiErrorMessage(error, "Could not request a swap."));
                      }
                    }}
                  >
                    <ArrowLeftRight /> Request swap
                  </Button>
                ) : null}

                {props.canManageShifts && selectedShift.status !== "cancelled" ? (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={async () => {
                      try {
                        await cancelShift({ shiftId: selectedShift.id }).unwrap();
                        toast.success("Shift cancelled.");
                        dispatch(shiftDialogClosed());
                      } catch (error) {
                        toast.error(apiErrorMessage(error, "Could not cancel the shift."));
                      }
                    }}
                  >
                    <Trash2 /> Cancel shift
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
  const [coverUserId, setCoverUserId] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={coverUserId} onValueChange={setCoverUserId}>
        <SelectTrigger className="h-8 w-44 text-xs" aria-label="Choose who covers this shift">
          <SelectValue placeholder="Choose cover" />
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
        Approve
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void onReject()}>
        Reject
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Date helpers — all UTC, matching what the API returns                   */
/* ---------------------------------------------------------------------- */

function weekWindow(weekStart: string) {
  const from = new Date(`${weekStart}T00:00:00.000Z`);
  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(from.getTime() + index * 86_400_000),
  );

  return { from, to: new Date(from.getTime() + 7 * 86_400_000), days };
}

function atHour(day: Date, hour: number): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0, 0),
  );
}

interface Lane<T> {
  item: T;
  lane: number;
  /** How many lanes the overlapping cluster needs, i.e. this block's width. */
  lanes: number;
}

/**
 * Packs items into side-by-side lanes.
 *
 * Items are grouped into clusters of things that actually overlap, and each
 * cluster is widened only as far as it needs to be — so a lone evening shift
 * still spans the full column even if the morning had four people on at once.
 */
function packIntoLanes<T>(
  items: readonly T[],
  startOf: (item: T) => number,
  endOf: (item: T) => number,
): Array<Lane<T>> {
  const sorted = [...items].sort(
    (a, b) => startOf(a) - startOf(b) || endOf(a) - endOf(b),
  );

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

/** Converts a shift's times into a percentage-based position in the grid. */
function blockGeometry(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const startHour = start.getUTCHours() + start.getUTCMinutes() / 60;
  const endHour = end.getUTCHours() + end.getUTCMinutes() / 60;
  const span = DAY_END_HOUR - DAY_START_HOUR;

  const clampedStart = Math.max(startHour, DAY_START_HOUR);
  const clampedEnd = Math.min(endHour <= startHour ? DAY_END_HOUR : endHour, DAY_END_HOUR);

  if (clampedEnd <= clampedStart) return null;

  return {
    top: `${((clampedStart - DAY_START_HOUR) / span) * 100}%`,
    height: `${((clampedEnd - clampedStart) / span) * 100}%`,
  };
}

function sameDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isToday(day: Date): boolean {
  return day.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function formatDate(day?: Date): string {
  if (!day) return "";
  return day.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function formatDayTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${formatTime(iso)}`;
}
