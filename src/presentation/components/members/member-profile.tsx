"use client";

import { useState } from "react";
import {
  CalendarPlus,
  Loader2,
  Pause,
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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MembershipStatusBadge } from "@/presentation/components/shared/status-badge";
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
 * The member profile: details, 90-day attendance chart, plan actions,
 * QR member card and the audit trail.
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
  const { data, isLoading } = useGetMemberQuery(memberId);
  const { data: plans = [] } = useListPlansQuery();

  const [renew, { isLoading: isRenewing }] = useRenewMembershipMutation();
  const [changeStatus, { isLoading: isChangingStatus }] = useChangeMembershipStatusMutation();
  const [deleteMember] = useDeleteMemberMutation();

  const [isRenewOpen, setRenewOpen] = useState(false);
  const [isQrOpen, setQrOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  if (isLoading || !data) {
    return (
      <div className="space-y-4 px-5 py-6 sm:px-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
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
            ? "Membership resumed — paused days were credited back."
            : "Membership cancelled.",
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not update the membership."));
    }
  }

  return (
    <div className="space-y-6 px-5 py-6 sm:px-8">
      {/* Summary */}
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/12 text-lg font-semibold text-primary">
              {member.firstName[0]}
              {member.lastName[0]}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{member.fullName}</h2>
                <MembershipStatusBadge status={member.status} />
                {isInsideNow ? (
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                    in the gym
                  </span>
                ) : null}
              </div>

              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <Row label="Member code" value={<span className="font-mono">{member.code}</span>} />
                <Row label="Plan" value={member.planName ?? "No plan"} />
                <Row label="Email" value={member.email ?? "—"} />
                <Row label="Phone" value={member.phone ?? "—"} />
                <Row label="Joined" value={formatDate(member.joinedAt)} />
                <Row
                  label="Expires"
                  value={
                    member.membershipEndsAt
                      ? `${formatDate(member.membershipEndsAt)}${
                          member.daysUntilExpiry !== null
                            ? ` (${member.daysUntilExpiry} days)`
                            : ""
                        }`
                      : "—"
                  }
                />
                <Row label="Total visits" value={String(member.totalVisits)} />
                <Row label="Visits (30d)" value={String(member.visitsLast30Days)} />
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setQrOpen(true)}>
              <QrCode /> Member card
            </Button>

            {canWrite ? (
              <>
                <Button onClick={() => setRenewOpen(true)} disabled={busy}>
                  <CalendarPlus /> Renew
                </Button>

                {member.status === "frozen" ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void runStatusChange("unfreeze")}
                  >
                    <Play /> Unfreeze
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={busy || member.status === "cancelled"}
                    onClick={() => void runStatusChange("freeze")}
                  >
                    <Pause /> Freeze
                  </Button>
                )}

                <Button
                  variant="outline"
                  disabled={busy || member.status === "cancelled"}
                  onClick={() => void runStatusChange("cancel")}
                >
                  <UserRoundX /> Cancel
                </Button>
              </>
            ) : null}

            {canDelete && !member.isDeleted ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={async () => {
                  try {
                    await deleteMember({ memberId }).unwrap();
                    toast.success("Member removed. Their history is kept for reports.");
                  } catch (error) {
                    toast.error(apiErrorMessage(error, "Could not remove the member."));
                  }
                }}
              >
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attendance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Attendance — last 90 days</CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No visits recorded in this window.
              </p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendance} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => value.slice(5)}
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
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
                      stroke="var(--color-chart-1)"
                      strokeWidth={2}
                      fill="url(#attendanceFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit trail */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            {auditTrail.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <ol className="space-y-3">
                {auditTrail.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-border pl-3 text-sm">
                    <p>{entry.summary}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Renew dialog */}
      <Dialog open={isRenewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew membership</DialogTitle>
            <DialogDescription>
              Days still left on the current term are carried over — a renewal never costs a
              member time they have already paid for.
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
                  toast.success(
                    `Renewed through ${formatDate(updated.membershipEndsAt ?? "")}.`,
                  );
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

      <QrDialog memberId={memberId} open={isQrOpen} onOpenChange={setQrOpen} name={member.fullName} />
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
            <Skeleton className="size-56" />
          ) : (
            <>
              <div
                className="rounded-xl bg-white p-3"
                // The SVG is generated server-side by the QR service from the
                // member code alone — no user input reaches this markup.
                dangerouslySetInnerHTML={{ __html: data.svg }}
              />
              <p className="font-mono text-lg font-semibold tracking-wider">{data.payload}</p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{value}</dd>
    </div>
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
  return `${formatDate(iso)} ${new Date(iso).toISOString().slice(11, 16)}`;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
