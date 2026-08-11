"use client";

import { useState } from "react";
import {
  CalendarPlus,
  Check,
  Copy,
  Loader2,
  Pause,
  Pencil,
  Play,
  QrCode,
  Trash2,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MemberForm } from "@/presentation/components/forms/member-form";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/presentation/components/shared/states";
import { MembershipStatus, StatusDot } from "@/presentation/components/shared/status-badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/presentation/components/ui/tooltip";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useChangeMembershipStatusMutation,
  useDeleteMemberMutation,
  useGetMemberQrCodeQuery,
  useGetMemberQuery,
  useListPlansQuery,
  useRenewMembershipMutation,
} from "@/presentation/store/api/members-api";

/**
 * The member profile.
 *
 * An identity header carries who they are and their state; everything else is
 * behind tabs so the screen is never a wall of fields.
 */
export function MemberProfile({
  memberId,
  canWrite,
  canDelete,
}: {
  memberId: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { data, isLoading, isError, refetch } = useGetMemberQuery(memberId);
  const { data: plans = [] } = useListPlansQuery();

  const [renew, { isLoading: isRenewing }] = useRenewMembershipMutation();
  const [changeStatus, { isLoading: isChangingStatus }] = useChangeMembershipStatusMutation();
  const [deleteMember] = useDeleteMemberMutation();

  const [isRenewOpen, setRenewOpen] = useState(false);
  const [isQrOpen, setQrOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [copied, setCopied] = useState(false);

  if (isError) {
    return (
      <div className="px-5 py-6 sm:px-8">
        <Card className="py-0">
          <CardContent className="px-0">
            <ErrorState
              title="This profile did not load"
              onRetry={() => void refetch()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-5 px-5 py-6 sm:px-8">
        <Card>
          <CardContent className="flex gap-5">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ChartSkeleton height="14rem" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { member, attendance, auditTrail, isInsideNow } = data;
  const busy = isRenewing || isChangingStatus;

  async function runStatusChange(action: "freeze" | "unfreeze" | "cancel") {
    try {
      await changeStatus({ memberId, action }).unwrap();
      toast.success(
        action === "freeze"
          ? "Membership frozen."
          : action === "unfreeze"
            ? "Resumed — the paused days were credited back."
            : "Membership cancelled.",
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not update the membership."));
    }
  }

  return (
    <div className="space-y-5 px-5 pb-10 sm:px-8">
      {/* Identity header */}
      <Card>
        <CardContent className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <MemberAvatar name={member.fullName} size="xl" />

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight">{member.fullName}</h2>
                <MembershipStatus status={member.status} variant="solid" />
                {isInsideNow ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-subtle px-2 py-1 text-2xs font-medium text-primary uppercase">
                    <StatusDot tone="success" pulse /> In the gym
                  </span>
                ) : null}
              </div>

              {/* The member code is the thing staff read out loud — make it copyable. */}
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(member.code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1600);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs transition-colors hover:border-border-strong"
                    >
                      {member.code}
                      {copied ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3 text-muted-foreground" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? "Copied" : "Copy member code"}</TooltipContent>
                </Tooltip>

                <Button variant="ghost" size="sm" onClick={() => setQrOpen(true)}>
                  <QrCode /> Member card
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                {member.planName ?? "No plan"}
                {member.membershipEndsAt
                  ? ` · ends ${formatDate(member.membershipEndsAt)}`
                  : ""}
                {member.daysUntilExpiry !== null && member.daysUntilExpiry >= 0
                  ? ` (${member.daysUntilExpiry} days)`
                  : ""}
              </p>
            </div>
          </div>

          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>

              {member.status === "frozen" ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void runStatusChange("unfreeze")}
                >
                  <Play /> Unfreeze
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy || member.status === "cancelled"}
                  onClick={() => void runStatusChange("freeze")}
                >
                  <Pause /> Freeze
                </Button>
              )}

              {/* One primary action on the screen. */}
              <Button onClick={() => setRenewOpen(true)} disabled={busy}>
                <CalendarPlus /> Renew
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="membership">Membership</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Total visits" value={member.totalVisits} />
            <Metric label="Visits · 30 days" value={member.visitsLast30Days} />
            <Metric
              label="Member since"
              value={formatDate(member.joinedAt)}
              isText
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
              <p className="text-sm text-muted-foreground">
                {attendance.length === 0
                  ? "No visits recorded in the last 90 days."
                  : `${attendance.reduce((sum, day) => sum + day.count, 0)} visits over the last 90 days.`}
              </p>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <EmptyState
                  compact
                  title="No attendance yet"
                  description="Visits will chart here once this member starts checking in."
                />
              ) : (
                <>
                  <div className="h-52" aria-hidden>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={attendance} margin={{ top: 4, right: 4, left: -24 }}>
                        <defs>
                          <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--color-border)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value: string) => value.slice(5)}
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={28}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          width={36}
                        />
                        <ChartTooltip
                          contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          name="Visits"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          fill="url(#attendanceFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <table className="sr-only">
                    <caption>Visits per day over the last 90 days</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((day) => (
                        <tr key={day.date}>
                          <th scope="row">{day.date}</th>
                          <td>{day.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="membership">
          <Card>
            <CardHeader>
              <CardTitle>Membership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <Field label="Plan" value={member.planName ?? "No plan"} />
                <Field label="Status" value={<MembershipStatus status={member.status} />} />
                <Field
                  label="Started"
                  value={member.membershipStartsAt ? formatDate(member.membershipStartsAt) : "—"}
                />
                <Field
                  label="Ends"
                  value={member.membershipEndsAt ? formatDate(member.membershipEndsAt) : "—"}
                />
                <Field label="Email" value={member.email ?? "—"} />
                <Field label="Phone" value={member.phone ?? "—"} />
              </dl>

              {canDelete && !member.isDeleted ? (
                <div className="flex items-center justify-between gap-4 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Remove this member</p>
                    <p className="text-xs text-muted-foreground">
                      Their history is kept, so past reports stay accurate.
                    </p>
                  </div>
                  <Button
                    variant="destructive-ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await deleteMember({ memberId }).unwrap();
                        toast.success("Member removed.");
                      } catch (error) {
                        toast.error(apiErrorMessage(error, "Could not remove the member."));
                      }
                    }}
                  >
                    <Trash2 /> Remove
                  </Button>
                </div>
              ) : null}

              {canWrite && member.status !== "cancelled" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => void runStatusChange("cancel")}
                >
                  <UserRoundX /> Cancel membership
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
              <p className="text-sm text-muted-foreground">
                Everything that has happened to this record.
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton rows={4} />
              ) : auditTrail.length === 0 ? (
                <EmptyState
                  compact
                  title="Nothing recorded yet"
                  description="Renewals, freezes and edits will be listed here."
                />
              ) : (
                <ol className="space-y-0">
                  {auditTrail.map((entry, index) => (
                    <li key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border-strong" />
                        {index < auditTrail.length - 1 ? (
                          <span className="w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm">{entry.summary}</p>
                        <p data-numeric className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {member.notes ? (
                <p className="text-sm whitespace-pre-wrap">{member.notes}</p>
              ) : (
                <EmptyState
                  compact
                  title="No notes"
                  description="Anything the desk should know goes here."
                  action={
                    canWrite ? (
                      <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                        <Pencil /> Add a note
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Renew */}
      <Dialog open={isRenewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew membership</DialogTitle>
            <DialogDescription>
              Days still left on the current term carry over — a renewal never costs a member
              time they have already paid for.
            </DialogDescription>
          </DialogHeader>

          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans
                .filter((plan) => plan.isActive)
                .map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} — {plan.durationDays} days · {formatMoney(plan.priceCents)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedPlanId || isRenewing}
              onClick={async () => {
                try {
                  const updated = await renew({ memberId, planId: selectedPlanId }).unwrap();
                  toast.success(`Renewed through ${formatDate(updated.membershipEndsAt ?? "")}.`);
                  setRenewOpen(false);
                } catch (error) {
                  toast.error(apiErrorMessage(error, "Could not renew the membership."));
                }
              }}
            >
              {isRenewing ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
              Renew
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QrDialog
        memberId={memberId}
        open={isQrOpen}
        onOpenChange={setQrOpen}
        name={member.fullName}
      />

      {/* The same MemberForm the list uses — edit mode here. */}
      <MemberForm
        mode="edit"
        open={isEditOpen}
        onOpenChange={setEditOpen}
        defaultValues={member}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  isText = false,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p
          data-numeric
          className={isText ? "text-sm font-medium" : "text-xl font-semibold tracking-tight"}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function QrDialog({
  memberId,
  open,
  onOpenChange,
  name,
}: {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
}) {
  const { data, isLoading } = useGetMemberQrCodeQuery(memberId, { skip: !open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{name}&apos;s member card</DialogTitle>
          <DialogDescription>
            Scan this at the kiosk to check in, or print it onto a card.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {isLoading || !data ? (
            <Skeleton className="size-56 rounded-lg" />
          ) : (
            <>
              <div
                className="rounded-lg bg-white p-3"
                // Generated server-side from the member code alone — no user
                // input reaches this markup.
                dangerouslySetInnerHTML={{ __html: data.svg }}
              />
              <p data-numeric className="font-mono text-base font-semibold tracking-wider">
                {data.payload}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${new Date(iso).toISOString().slice(11, 16)}`;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
