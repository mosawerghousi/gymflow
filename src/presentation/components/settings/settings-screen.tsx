"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Copy,
  Loader2,
  MonitorSmartphone,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import type { PlanDto } from "@/application/dto/settings.dto";
import { WEEKDAYS } from "@/domain/entities/operating-hours";
import { formatCount, formatDate as fmtDate, formatMoney as fmtMoney } from "@/presentation/lib/format";
import { PlanForm } from "@/presentation/components/forms/plan-form";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { EmptyState, ErrorState, ListSkeleton } from "@/presentation/components/shared/states";
import { RoleBadge, StatusDot } from "@/presentation/components/shared/status-badge";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/presentation/components/ui/data-table";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/presentation/components/ui/sheet";
import { Switch } from "@/presentation/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { apiErrorCode, apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCreateKioskTokenMutation,
  useGetOperatingHoursQuery,
  useInviteStaffMutation,
  useListKioskTokensQuery,
  useListPlansAdminQuery,
  useListStaffQuery,
  useRevokeKioskTokenMutation,
  useUpdateOperatingHoursMutation,
  useUpdatePlanMutation,
} from "@/presentation/store/api/reports-api";

export function SettingsScreen({ isDemoAccount }: { isDemoAccount: boolean }) {
  const t = useTranslations("settings");

  return (
    <div className="space-y-5 px-5 pb-10 sm:px-8">
      {isDemoAccount ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/35 bg-warning-subtle px-4 py-3">
          <ShieldAlert className="mt-0.5 size-4.5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-warning">{t("demoGuardTitle")}</p>
            <p className="mt-0.5 text-muted-foreground">
              {t("demoGuardBody")}
            </p>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">{t("tabPlans")}</TabsTrigger>
          <TabsTrigger value="hours">{t("tabHours")}</TabsTrigger>
          <TabsTrigger value="kiosks">{t("tabKiosks")}</TabsTrigger>
          <TabsTrigger value="team">{t("tabTeam")}</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <PlansPanel />
        </TabsContent>
        <TabsContent value="hours">
          <OperatingHoursPanel />
        </TabsContent>
        <TabsContent value="kiosks">
          <KiosksPanel />
        </TabsContent>
        <TabsContent value="team">
          <TeamPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlansPanel() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const ctx = { locale };
  const { data: plans = [], isLoading, isError, refetch } = useListPlansAdminQuery();
  const [updatePlan] = useUpdatePlanMutation();

  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<PlanDto | undefined>();
  const [isFormOpen, setFormOpen] = useState(false);

  function openCreate() {
    setFormMode("create");
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(plan: PlanDto) {
    setFormMode("edit");
    setEditing(plan);
    setFormOpen(true);
  }

  return (
    <>
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>{t("plansTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("plansHint")}
          </p>
          <CardAction>
            <Button size="sm" onClick={openCreate}>
              <Plus /> {t("addPlan")}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="px-0">
          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={4} />
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              title={t("noPlans")}
              description={t("noPlansHint")}
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus /> {t("addPlan")}
                </Button>
              }
            />
          ) : (
            <DataTable minWidth="40rem">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t("columnPlan")}</TableHeaderCell>
                  <TableHeaderCell align="right">{t("columnPrice")}</TableHeaderCell>
                  <TableHeaderCell align="right">{t("columnDuration")}</TableHeaderCell>
                  <TableHeaderCell align="right">{t("columnMembers")}</TableHeaderCell>
                  <TableHeaderCell align="center">{t("columnOnSale")}</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-20">
                    <span className="sr-only">{tCommon("actions")}</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} interactive>
                    <TableCell>
                      <p className="text-sm font-medium">{plan.name}</p>
                      {plan.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {plan.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell align="right" className="text-sm">
                      {fmtMoney(plan.priceCents, ctx)}
                    </TableCell>
                    <TableCell align="right" className="text-sm text-muted-foreground">
                      {tCommon("daysShort", { count: formatCount(plan.durationDays, ctx) })}
                    </TableCell>
                    <TableCell align="right" className="text-sm text-muted-foreground">
                      {formatCount(plan.memberCount, ctx)}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={plan.isActive}
                        aria-label={t("planOnSale", { name: plan.name })}
                        onCheckedChange={async (checked) => {
                          try {
                            await updatePlan({ planId: plan.id, isActive: checked }).unwrap();
                            toast.success(checked ? t("planOnSaleToast") : t("planArchivedToast"));
                          } catch (error) {
                            toast.error(apiErrorMessage(error, t("planUpdateFailed")));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <RowActions>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("editPlan", { name: plan.name })}
                          onClick={() => openEdit(plan)}
                        >
                          <Pencil />
                        </Button>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>

      {/* One PlanForm, both modes. */}
      <PlanForm
        mode={formMode}
        open={isFormOpen}
        onOpenChange={setFormOpen}
        defaultValues={editing}
      />
    </>
  );
}

function OperatingHoursPanel() {
  const t = useTranslations("settings");
  const tDays = useTranslations("weekdays");
  const { data, isLoading, isError, refetch } = useGetOperatingHoursQuery();
  const [save, { isLoading: isSaving }] = useUpdateOperatingHoursMutation();
  const [hours, setHours] = useState(data ?? []);

  useEffect(() => {
    if (data) setHours(data);
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("hoursTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("hoursHint")}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isError ? (
          <ErrorState compact onRetry={() => void refetch()} />
        ) : isLoading ? (
          <ListSkeleton rows={7} />
        ) : (
          <>
            <div className="space-y-1">
              {hours.map((day, index) => (
                <div
                  key={day.dayOfWeek}
                  className="flex flex-wrap items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2"
                >
                  <span className="w-24 text-sm font-medium">
                    {tDays(WEEKDAYS[day.dayOfWeek])}
                  </span>

                  <Switch
                    checked={!day.isClosed}
                    aria-label={t("dayOpen", { day: tDays(WEEKDAYS[day.dayOfWeek]) })}
                    onCheckedChange={(checked) =>
                      setHours(
                        hours.map((entry, i) =>
                          i === index ? { ...entry, isClosed: !checked } : entry,
                        ),
                      )
                    }
                  />

                  {day.isClosed ? (
                    <span className="text-sm text-muted-foreground">{t("closed")}</span>
                  ) : (
                    <>
                      <Input
                        type="time"
                        className="w-32"
                        aria-label={t("opensAt", { day: tDays(WEEKDAYS[day.dayOfWeek]) })}
                        value={day.opensAt}
                        onChange={(event) =>
                          setHours(
                            hours.map((entry, i) =>
                              i === index ? { ...entry, opensAt: event.target.value } : entry,
                            ),
                          )
                        }
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        className="w-32"
                        aria-label={t("closesAt", { day: tDays(WEEKDAYS[day.dayOfWeek]) })}
                        value={day.closesAt}
                        onChange={(event) =>
                          setHours(
                            hours.map((entry, i) =>
                              i === index ? { ...entry, closesAt: event.target.value } : entry,
                            ),
                          )
                        }
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            <Button
              disabled={isSaving || hours.length !== 7}
              onClick={async () => {
                try {
                  await save({ hours }).unwrap();
                  toast.success(t("hoursSaved"));
                } catch (error) {
                  toast.error(apiErrorMessage(error, t("hoursSaveFailed")));
                }
              }}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Check />} {t("saveHours")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KiosksPanel() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data: tokens = [], isLoading, isError, refetch } = useListKioskTokensQuery();
  const [createToken, { isLoading: isCreating }] = useCreateKioskTokenMutation();
  const [revokeToken] = useRevokeKioskTokenMutation();

  const [isPairOpen, setPairOpen] = useState(false);
  const [name, setName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>{t("kiosksTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("kiosksHint")}
          </p>
          <CardAction>
            <Button size="sm" onClick={() => setPairOpen(true)}>
              <Plus /> {t("pairDevice")}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="px-0">
          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={2} />
            </div>
          ) : tokens.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title={t("noKiosks")}
              description={t("noKiosksHint")}
              action={
                <Button size="sm" onClick={() => setPairOpen(true)}>
                  <Plus /> {t("pairDevice")}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {tokens.map((token) => (
                <li key={token.id} className="group/row flex items-center gap-3 px-5 py-3">
                  <StatusDot tone={token.revokedAt ? "neutral" : "success"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {token.name}
                      {token.revokedAt ? (
                        <span className="ms-2 text-xs font-normal text-muted-foreground">
                          {t("revoked")}
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-2xs text-muted-foreground">
                      {token.tokenPrefix}…{" "}
                      {token.lastUsedAt
                        ? `· ${t("lastUsed", { date: fmtDate(token.lastUsedAt, { locale }) })}`
                        : `· ${t("neverUsed")}`}
                    </p>
                  </div>

                  {!token.revokedAt ? (
                    <RowActions>
                      <Button
                        variant="destructive-ghost"
                        size="icon-sm"
                        aria-label={t("revokeKiosk", { name: token.name })}
                        onClick={async () => {
                          try {
                            await revokeToken({ tokenId: token.id }).unwrap();
                            toast.success(t("kioskRevoked"));
                          } catch (error) {
                            toast.error(
                              apiErrorCode(error) === "DEMO_RESTRICTED"
                                ? apiErrorMessage(error)
                                : apiErrorMessage(error, t("kioskRevokeFailed")),
                            );
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </RowActions>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={isPairOpen}
        onOpenChange={(open) => {
          setPairOpen(open);
          if (!open) {
            setFreshToken(null);
            setName("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{t("pairDeviceTitle")}</SheetTitle>
            <SheetDescription>
              {t("pairDeviceHint")}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="kiosk-name">{t("deviceName")}</Label>
              <Input
                id="kiosk-name"
                placeholder={t("deviceNamePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            {freshToken ? (
              <div className="space-y-2 rounded-md border border-primary/40 bg-brand-subtle p-3">
                <p className="text-xs text-muted-foreground">
                  {t("copyNow")}
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">
                    {freshToken}
                  </code>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("copyToken")}
                    onClick={() => {
                      void navigator.clipboard.writeText(freshToken);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }}
                  >
                    {copied ? <Check className="text-success" /> : <Copy />}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-t border-border sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setPairOpen(false)}>
              {freshToken ? tCommon("close") : tCommon("cancel")}
            </Button>
            {!freshToken ? (
              <Button
                disabled={!name || isCreating}
                onClick={async () => {
                  try {
                    const result = await createToken({ name }).unwrap();
                    setFreshToken(result.plaintext);
                    toast.success(t("kioskPaired"));
                  } catch (error) {
                    toast.error(apiErrorMessage(error, t("kioskPairFailed")));
                  }
                }}
              >
                {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                {t("pairDevice")}
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TeamPanel() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { data: staff = [], isLoading, isError, refetch } = useListStaffQuery();
  const [invite, { isLoading: isInviting }] = useInviteStaffMutation();

  const [isOpen, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "staff", password: "" });

  return (
    <>
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>{t("teamTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("teamHint")}
          </p>
          <CardAction>
            <Button size="sm" onClick={() => setOpen(true)}>
              <UserPlus /> {t("addTeamMember")}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="px-0">
          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={4} />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {staff.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                  <MemberAvatar name={member.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {member.isDemo ? (
                    <span className="text-2xs text-muted-foreground uppercase">{tCommon("yes")}</span>
                  ) : null}
                  <RoleBadge role={member.role} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{t("addTeamMemberTitle")}</SheetTitle>
            <SheetDescription>{t("addTeamMemberHint")}</SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await invite(form).unwrap();
                toast.success(t("teamMemberAdded", { name: form.name }));
                setForm({ name: "", email: "", role: "staff", password: "" });
                setOpen(false);
              } catch (error) {
                toast.error(apiErrorMessage(error, t("teamMemberFailed")));
              }
            }}
          >
            <div className="flex-1 space-y-4 px-4 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">{t("name")}</Label>
                <Input
                  id="staff-name"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-email">{t("email")}</Label>
                <Input
                  id="staff-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-role">{t("role")}</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm({ ...form, role: value })}
                >
                  <SelectTrigger id="staff-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                    <SelectItem value="staff">{t("roleStaff")}</SelectItem>
                    <SelectItem value="trainer">{t("roleTrainer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-password">{t("tempPassword")}</Label>
                <Input
                  id="staff-password"
                  type="password"
                  minLength={8}
                  required
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
              </div>
            </div>

            <SheetFooter className="border-t border-border sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isInviting}>
                {isInviting ? <Loader2 className="animate-spin" /> : <UserPlus />}
                {t("addTeamMember")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

