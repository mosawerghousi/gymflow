"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { WEEKDAYS } from "@/domain/entities/operating-hours";
import { RoleBadge } from "@/presentation/components/shared/status-badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Switch } from "@/presentation/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/presentation/components/ui/tabs";
import { apiErrorCode, apiErrorMessage } from "@/presentation/store/api/base-api";
import {
  useCreateKioskTokenMutation,
  useCreatePlanMutation,
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
    <div className="px-5 py-6 sm:px-8">
      {isDemoAccount ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/8 px-4 py-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-400">Demo guardrails are on</p>
            <p className="mt-0.5 text-muted-foreground">
              You can create plans, invite staff and edit hours. Revoking a kiosk token and
              changing passwords are blocked so the public demo keeps working, and a nightly
              job restores the seed data.
            </p>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="hours">Opening hours</TabsTrigger>
          <TabsTrigger value="kiosks">Kiosks</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
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
        <TabsContent value="staff">
          <StaffPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlansPanel() {
  const { data: plans = [] } = useListPlansAdminQuery();
  const [createPlan, { isLoading }] = useCreatePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();

  const [form, setForm] = useState({ name: "", priceCents: "4900", durationDays: "30" });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membership plans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-4 py-3 font-medium">Price</th>
                  <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                  <th scope="col" className="px-4 py-3 font-medium">Members</th>
                  <th scope="col" className="px-4 py-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{plan.name}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(plan.priceCents)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {plan.durationDays} days
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {plan.memberCount}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={plan.isActive}
                        aria-label={`${plan.name} active`}
                        onCheckedChange={async (checked) => {
                          try {
                            await updatePlan({ planId: plan.id, isActive: checked }).unwrap();
                            toast.success(checked ? "Plan is on sale." : "Plan archived.");
                          } catch (error) {
                            toast.error(apiErrorMessage(error, "Could not update the plan."));
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await createPlan({
                  name: form.name,
                  priceCents: Number(form.priceCents),
                  durationDays: Number(form.durationDays),
                }).unwrap();
                toast.success("Plan created.");
                setForm({ name: "", priceCents: "4900", durationDays: "30" });
              } catch (error) {
                toast.error(apiErrorMessage(error, "Could not create the plan."));
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-price">Price (cents)</Label>
              <Input
                id="plan-price"
                type="number"
                min={0}
                required
                value={form.priceCents}
                onChange={(event) => setForm({ ...form, priceCents: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-duration">Duration (days)</Label>
              <Input
                id="plan-duration"
                type="number"
                min={1}
                required
                value={form.durationDays}
                onChange={(event) => setForm({ ...form, durationDays: event.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Plus />} Create plan
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function OperatingHoursPanel() {
  const { data } = useGetOperatingHoursQuery();
  const [save, { isLoading }] = useUpdateOperatingHoursMutation();
  const [hours, setHours] = useState(data ?? []);

  useEffect(() => {
    if (data) setHours(data);
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Opening hours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hours.map((day, index) => (
          <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-sm font-medium capitalize">{WEEKDAYS[day.dayOfWeek]}</span>

            <Switch
              checked={!day.isClosed}
              aria-label={`${WEEKDAYS[day.dayOfWeek]} open`}
              onCheckedChange={(checked) =>
                setHours(
                  hours.map((entry, i) => (i === index ? { ...entry, isClosed: !checked } : entry)),
                )
              }
            />

            <Input
              type="time"
              className="w-32"
              aria-label={`${WEEKDAYS[day.dayOfWeek]} opens at`}
              value={day.opensAt}
              disabled={day.isClosed}
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
              disabled={day.isClosed}
              onChange={(event) =>
                setHours(
                  hours.map((entry, i) =>
                    i === index ? { ...entry, closesAt: event.target.value } : entry,
                  ),
                )
              }
            />
          </div>
        ))}

        <Button
          disabled={isLoading || hours.length !== 7}
          onClick={async () => {
            try {
              await save({ hours }).unwrap();
              toast.success("Opening hours saved.");
            } catch (error) {
              toast.error(apiErrorMessage(error, "Could not save the hours."));
            }
          }}
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <Check />} Save hours
        </Button>
      </CardContent>
    </Card>
  );
}

function KiosksPanel() {
  const { data: tokens = [] } = useListKioskTokensQuery();
  const [createToken, { isLoading }] = useCreateKioskTokenMutation();
  const [revokeToken] = useRevokeKioskTokenMutation();

  const [name, setName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paired kiosks</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each device holds a token that lets it create check-ins and nothing else.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {token.name}
                    {token.revokedAt ? (
                      <span className="ml-2 text-xs text-destructive">revoked</span>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {token.tokenPrefix}…{" "}
                    {token.lastUsedAt
                      ? `· last used ${new Date(token.lastUsedAt).toLocaleDateString("en-GB")}`
                      : "· never used"}
                  </p>
                </div>

                {!token.revokedAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pair a device</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kiosk-name">Device name</Label>
            <Input
              id="kiosk-name"
              placeholder="Front door iPad"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!name || isLoading}
            onClick={async () => {
              try {
                const result = await createToken({ name }).unwrap();
                setFreshToken(result.plaintext);
                setName("");
                toast.success("Kiosk paired — copy the token now.");
              } catch (error) {
                toast.error(apiErrorMessage(error, "Could not pair the device."));
              }
            }}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Plus />} Pair kiosk
          </Button>

          {freshToken ? (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/8 p-3">
              <p className="text-xs text-muted-foreground">
                Copy this now — it is only shown once.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">
                  {freshToken}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy token"
                  onClick={() => {
                    void navigator.clipboard.writeText(freshToken);
                    toast.success("Token copied.");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StaffPanel() {
  const { data: staff = [] } = useListStaffQuery();
  const [invite, { isLoading }] = useInviteStaffMutation();

  const [form, setForm] = useState({ name: "", email: "", role: "staff", password: "" });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {staff.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                {member.isDemo ? (
                  <span className="text-xs text-muted-foreground">demo</span>
                ) : null}
                <RoleBadge role={member.role} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a team member</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await invite(form).unwrap();
                toast.success(`${form.name} can now sign in.`);
                setForm({ name: "", email: "", role: "staff", password: "" });
              } catch (error) {
                toast.error(apiErrorMessage(error, "Could not add the team member."));
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="staff-name">Name</Label>
              <Input
                id="staff-name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value })}
              >
                <SelectTrigger id="staff-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-password">Temporary password</Label>
              <Input
                id="staff-password"
                type="password"
                minLength={8}
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Plus />} Add member
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
