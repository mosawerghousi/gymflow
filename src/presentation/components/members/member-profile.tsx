"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { MemberCode } from "@/presentation/components/i18n/bidi";
import {
  formatCount,
  formatDate as fmtDate,
  formatDateTime as fmtDateTime,
  formatMoney as fmtMoney,
} from "@/presentation/lib/format";
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
  const t = useTranslations("members");
  const tCommon = useTranslations("common");
  const tCharts = useTranslations("charts");
  const locale = useLocale();
  const ctx = { locale };
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
              title={t("profileFailed")}
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
          ? t("frozenToast")
          : action === "unfreeze"
            ? t("unfrozenToast")
            : t("cancelledToast"),
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, t("statusFailed")));
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
                    <StatusDot tone="success" pulse /> {t("inTheGym")}
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
                      <MemberCode code={member.code} />
                      {copied ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3 text-muted-foreground" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? t("copied") : t("copyCode")}</TooltipContent>
                </Tooltip>

                <Button variant="ghost" size="sm" onClick={() => setQrOpen(true)}>
                  <QrCode /> {t("memberCard")}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                {member.planName ?? t("fieldPlan")}
                {member.membershipEndsAt
                  ? ` · ${t("endsOn", { date: fmtDate(member.membershipEndsAt, ctx) })}`
                  : ""}
                {member.daysUntilExpiry !== null && member.daysUntilExpiry >= 0
                  ? ` · ${t("expiresIn", { count: member.daysUntilExpiry })}`
                  : ""}
              </p>
            </div>
          </div>

          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setEditOpen(true)}>
                <Pencil /> {tCommon("edit")}
              </Button>

              {member.status === "frozen" ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void runStatusChange("unfreeze")}
                >
                  <Play /> {t("unfreeze")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy || member.status === "cancelled"}
                  onClick={() => void runStatusChange("freeze")}
                >
                  <Pause /> {t("freeze")}
                </Button>
              )}

              {/* One primary action on the screen. */}
              <Button onClick={() => setRenewOpen(true)} disabled={busy}>
                <CalendarPlus /> {t("renew")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          <TabsTrigger value="membership">{t("tabMembership")}</TabsTrigger>
          <TabsTrigger value="activity">{t("tabActivity")}</TabsTrigger>
          <TabsTrigger value="notes">{t("tabNotes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label={t("totalVisits")} value={formatCount(member.totalVisits, ctx)} />
            <Metric label={t("visits30")} value={formatCount(member.visitsLast30Days, ctx)} />
            <Metric
              label={t("memberSince")}
              value={fmtDate(member.joinedAt, ctx)}
              isText
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("attendance")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {attendance.length === 0
                  ? t("attendanceNone")
                  : t("attendanceSummary", {
                      count: formatCount(
                        attendance.reduce((sum, day) => sum + day.count, 0),
                        ctx,
                      ),
                    })}
              </p>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <EmptyState
                  compact
                  title={t("attendanceEmpty")}
                  description={t("attendanceEmptyHint")}
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
                          name={tCharts("visits")}
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          fill="url(#attendanceFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <table className="sr-only">
                    <caption>{t("attendanceTableCaption")}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t("date")}</th>
                        <th scope="col">{t("visitsColumn")}</th>
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
              <CardTitle>{t("tabMembership")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <Field label={t("fieldPlan")} value={member.planName ?? tCommon("dash")} />
                <Field label={t("fieldStatus")} value={<MembershipStatus status={member.status} />} />
                <Field
                  label={t("fieldStarted")}
                  value={member.membershipStartsAt ? fmtDate(member.membershipStartsAt, ctx) : tCommon("dash")}
                />
                <Field
                  label={t("fieldEnds")}
                  value={member.membershipEndsAt ? fmtDate(member.membershipEndsAt, ctx) : tCommon("dash")}
                />
                <Field label={t("fieldEmail")} value={member.email ? <MemberCode code={member.email} /> : tCommon("dash")} />
                <Field label={t("fieldPhone")} value={member.phone ? <MemberCode code={member.phone} /> : tCommon("dash")} />
              </dl>

              {canDelete && !member.isDeleted ? (
                <div className="flex items-center justify-between gap-4 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{t("removeTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("removeHint")}
                    </p>
                  </div>
                  <Button
                    variant="destructive-ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await deleteMember({ memberId }).unwrap();
                        toast.success(t("removedToast"));
                      } catch (error) {
                        toast.error(apiErrorMessage(error, t("removeFailed")));
                      }
                    }}
                  >
                    <Trash2 /> {tCommon("remove")}
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
                  <UserRoundX /> {t("cancelMembership")}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>{t("auditTrail")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("auditTrailHint")}
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton rows={4} />
              ) : auditTrail.length === 0 ? (
                <EmptyState
                  compact
                  title={t("auditEmpty")}
                  description={t("auditEmptyHint")}
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
                          {fmtDateTime(entry.createdAt, ctx)}
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
              <CardTitle>{t("tabNotes")}</CardTitle>
            </CardHeader>
            <CardContent>
              {member.notes ? (
                <p className="text-sm whitespace-pre-wrap">{member.notes}</p>
              ) : (
                <EmptyState
                  compact
                  title={t("notesEmpty")}
                  description={t("notesEmptyHint")}
                  action={
                    canWrite ? (
                      <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                        <Pencil /> {t("addNote")}
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
            <DialogTitle>{t("renewTitle")}</DialogTitle>
            <DialogDescription>
              {t("renewHint")}
            </DialogDescription>
          </DialogHeader>

          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("choosePlan")} />
            </SelectTrigger>
            <SelectContent>
              {plans
                .filter((plan) => plan.isActive)
                .map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {t("planOption", {
                      name: plan.name,
                      days: formatCount(plan.durationDays, ctx),
                      price: fmtMoney(plan.priceCents, ctx),
                    })}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!selectedPlanId || isRenewing}
              onClick={async () => {
                try {
                  const updated = await renew({ memberId, planId: selectedPlanId }).unwrap();
                  toast.success(t("renewedThrough", { date: fmtDate(updated.membershipEndsAt ?? "", ctx) }));
                  setRenewOpen(false);
                } catch (error) {
                  toast.error(apiErrorMessage(error, t("renewFailed")));
                }
              }}
            >
              {isRenewing ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
              {t("renew")}
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
  const t = useTranslations("members");
  const { data, isLoading } = useGetMemberQrCodeQuery(memberId, { skip: !open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("memberCardTitle", { name })}</DialogTitle>
          <DialogDescription>
            {t("memberCardHint")}
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



