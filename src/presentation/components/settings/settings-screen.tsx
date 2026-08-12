"use client";

import { useEffect, useState } from "react";
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
  return (
    <div className="space-y-5 px-5 pb-10 sm:px-8">
      {isDemoAccount ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/35 bg-warning-subtle px-4 py-3">
          <ShieldAlert className="mt-0.5 size-4.5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-warning">Demo guardrails are on</p>
            <p className="mt-0.5 text-muted-foreground">
              Create plans, invite staff and edit hours freely. Revoking a kiosk token and
              changing passwords are blocked so the public demo keeps working, and a nightly job
              restores the seed.
            </p>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="hours">Opening hours</TabsTrigger>
          <TabsTrigger value="kiosks">Kiosks</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
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
          <CardTitle>Membership plans</CardTitle>
          <p className="text-sm text-muted-foreground">
            Archiving a plan takes it off sale without touching terms already bought.
          </p>
          <CardAction>
            <Button size="sm" onClick={openCreate}>
              <Plus /> Add plan
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
              title="No plans yet"
              description="Create the first plan so members have something to buy."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus /> Add plan
                </Button>
              }
            />
          ) : (
            <DataTable minWidth="40rem">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  <TableHeaderCell align="right">Price</TableHeaderCell>
                  <TableHeaderCell align="right">Duration</TableHeaderCell>
                  <TableHeaderCell align="right">Members</TableHeaderCell>
                  <TableHeaderCell align="center">On sale</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-20">
                    <span className="sr-only">Actions</span>
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
                      {formatMoney(plan.priceCents)}
                    </TableCell>
                    <TableCell align="right" className="text-sm text-muted-foreground">
                      {plan.durationDays}d
                    </TableCell>
                    <TableCell align="right" className="text-sm text-muted-foreground">
                      {plan.memberCount}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={plan.isActive}
                        aria-label={`${plan.name} on sale`}
                        onCheckedChange={async (checked) => {
                          try {
                            await updatePlan({ planId: plan.id, isActive: checked }).unwrap();
                            toast.success(checked ? "Plan is on sale." : "Plan archived.");
                          } catch (error) {
                            toast.error(apiErrorMessage(error, "Could not update the plan."));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <RowActions>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${plan.name}`}
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
  const { data, isLoading, isError, refetch } = useGetOperatingHoursQuery();
  const [save, { isLoading: isSaving }] = useUpdateOperatingHoursMutation();
  const [hours, setHours] = useState(data ?? []);

  useEffect(() => {
    if (data) setHours(data);
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opening hours</CardTitle>
        <p className="text-sm text-muted-foreground">
          Shifts and sessions are scheduled against these.
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
                  <span className="w-24 text-sm font-medium capitalize">
                    {WEEKDAYS[day.dayOfWeek]}
                  </span>

                  <Switch
                    checked={!day.isClosed}
                    aria-label={`${WEEKDAYS[day.dayOfWeek]} open`}
                    onCheckedChange={(checked) =>
                      setHours(
                        hours.map((entry, i) =>
                          i === index ? { ...entry, isClosed: !checked } : entry,
                        ),
                      )
                    }
                  />

                  {day.isClosed ? (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  ) : (
                    <>
                      <Input
                        type="time"
                        className="w-32"
                        aria-label={`${WEEKDAYS[day.dayOfWeek]} opens at`}
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
                        aria-label={`${WEEKDAYS[day.dayOfWeek]} closes at`}
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
                  toast.success("Opening hours saved.");
                } catch (error) {
                  toast.error(apiErrorMessage(error, "Could not save the hours."));
                }
              }}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Check />} Save hours
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KiosksPanel() {
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
          <CardTitle>Paired kiosks</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each device holds a token that lets it create check-ins — and nothing else.
          </p>
          <CardAction>
            <Button size="sm" onClick={() => setPairOpen(true)}>
              <Plus /> Pair device
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
              title="No kiosks paired"
              description="Pair a tablet by the door and members can check themselves in."
              action={
                <Button size="sm" onClick={() => setPairOpen(true)}>
                  <Plus /> Pair device
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
                          revoked
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-2xs text-muted-foreground">
                      {token.tokenPrefix}…{" "}
                      {token.lastUsedAt
                        ? `· last used ${new Date(token.lastUsedAt).toLocaleDateString("en-GB")}`
                        : "· never used"}
                    </p>
                  </div>

                  {!token.revokedAt ? (
                    <RowActions>
                      <Button
                        variant="destructive-ghost"
                        size="icon-sm"
                        aria-label={`Revoke ${token.name}`}
                        onClick={async () => {
                          try {
                            await revokeToken({ tokenId: token.id }).unwrap();
                            toast.success("Kiosk revoked.");
                          } catch (error) {
                            toast.error(
                              apiErrorCode(error) === "DEMO_RESTRICTED"
                                ? apiErrorMessage(error)
                                : apiErrorMessage(error, "Could not revoke the kiosk."),
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
            <SheetTitle>Pair a device</SheetTitle>
            <SheetDescription>
              The token is shown once. Paste it into the kiosk screen on that device.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="kiosk-name">Device name</Label>
              <Input
                id="kiosk-name"
                placeholder="Front door iPad"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            {freshToken ? (
              <div className="space-y-2 rounded-md border border-primary/40 bg-brand-subtle p-3">
                <p className="text-xs text-muted-foreground">
                  Copy this now — it is never shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">
                    {freshToken}
                  </code>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Copy token"
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
              {freshToken ? "Done" : "Cancel"}
            </Button>
            {!freshToken ? (
              <Button
                disabled={!name || isCreating}
                onClick={async () => {
                  try {
                    const result = await createToken({ name }).unwrap();
                    setFreshToken(result.plaintext);
                    toast.success("Kiosk paired — copy the token now.");
                  } catch (error) {
                    toast.error(apiErrorMessage(error, "Could not pair the device."));
                  }
                }}
              >
                {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                Pair kiosk
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TeamPanel() {
  const { data: staff = [], isLoading, isError, refetch } = useListStaffQuery();
  const [invite, { isLoading: isInviting }] = useInviteStaffMutation();

  const [isOpen, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "staff", password: "" });

  return (
    <>
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Team</CardTitle>
          <p className="text-sm text-muted-foreground">
            Roles decide what each person can reach.
          </p>
          <CardAction>
            <Button size="sm" onClick={() => setOpen(true)}>
              <UserPlus /> Add member
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
                    <span className="text-2xs text-muted-foreground uppercase">demo</span>
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
            <SheetTitle>Add a team member</SheetTitle>
            <SheetDescription>They can sign in as soon as you save.</SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await invite(form).unwrap();
                toast.success(`${form.name} can now sign in.`);
                setForm({ name: "", email: "", role: "staff", password: "" });
                setOpen(false);
              } catch (error) {
                toast.error(apiErrorMessage(error, "Could not add the team member."));
              }
            }}
          >
            <div className="flex-1 space-y-4 px-4 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm({ ...form, role: value })}
                >
                  <SelectTrigger id="staff-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — everything</SelectItem>
                    <SelectItem value="staff">Staff — desk and members</SelectItem>
                    <SelectItem value="trainer">Trainer — own sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-password">Temporary password</Label>
                <Input
                  id="staff-password"
                  type="password"
                  minLength={8}
                  required
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
            </div>

            <SheetFooter className="border-t border-border sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isInviting}>
                {isInviting ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Add member
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
