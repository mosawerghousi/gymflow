"use client";

import { useState } from "react";
import { Check, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import {
  MembershipStatus,
  RoleBadge,
  SessionStatus,
  StatusDot,
} from "@/presentation/components/shared/status-badge";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  TableSkeleton,
} from "@/presentation/components/shared/states";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Checkbox } from "@/presentation/components/ui/checkbox";
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
import { Textarea } from "@/presentation/components/ui/textarea";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/presentation/components/ui/data-table";

/**
 * The internal style guide (`/styleguide`).
 *
 * Everything here renders the real components — if a token or a variant drifts,
 * this page shows it before a screen does.
 */
export function Styleguide() {
  const [checked, setChecked] = useState(true);

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-5 py-8 sm:px-8">
      <Section
        title="Colour"
        note="Three elevation steps, one accent, and a semantic trio that maps onto the domain."
      >
        <div className="space-y-6">
          <SwatchRow
            label="Surfaces"
            swatches={[
              { name: "surface-0", className: "bg-background", hint: "App background" },
              { name: "surface-1", className: "bg-surface-1", hint: "Cards" },
              { name: "surface-2", className: "bg-surface-2", hint: "Inputs, popovers" },
              { name: "surface-3", className: "bg-surface-3", hint: "Overlays" },
            ]}
          />

          <SwatchRow
            label="Accent — rationed"
            swatches={[
              { name: "primary", className: "bg-primary", hint: "Primary action" },
              { name: "brand-strong", className: "bg-brand-strong", hint: "Hover" },
              { name: "brand-muted", className: "bg-brand-muted", hint: "Selection" },
              { name: "brand-subtle", className: "bg-brand-subtle", hint: "Tint" },
            ]}
          />

          <SwatchRow
            label="Semantic"
            swatches={[
              { name: "success", className: "bg-success", hint: "Checked in / active" },
              { name: "warning", className: "bg-warning", hint: "Frozen / expiring" },
              { name: "danger", className: "bg-danger", hint: "Expired / no-show" },
              { name: "muted-foreground", className: "bg-muted-foreground", hint: "Inert" },
            ]}
          />

          <SwatchRow
            label="Text ramp"
            swatches={[
              { name: "foreground", className: "bg-foreground", hint: "Content" },
              {
                name: "secondary-foreground",
                className: "bg-secondary-foreground",
                hint: "Labels",
              },
              { name: "muted-foreground", className: "bg-muted-foreground", hint: "Meta" },
            ]}
          />
        </div>
      </Section>

      <Section title="Typography" note="Inter. A strict scale — nothing between these steps.">
        <div className="space-y-4">
          {[
            { cls: "text-2xl font-semibold tracking-tight", label: "32 · Stat value", sample: "162" },
            { cls: "text-xl font-semibold tracking-tight", label: "24 · Panel headline", sample: "Currently in gym" },
            { cls: "text-lg font-semibold tracking-tight", label: "20 · Page title", sample: "Members" },
            { cls: "text-base", label: "16 · Section lead", sample: "Find a member and check them in." },
            { cls: "text-sm", label: "14 · Body default", sample: "Jordan Reed renewed the Monthly plan." },
            { cls: "text-xs text-muted-foreground", label: "12 · Label & meta", sample: "LAST VISIT" },
            { cls: "text-2xs font-mono text-muted-foreground", label: "11 · Dense table meta", sample: "GF-000123" },
          ].map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline gap-4 border-b border-border pb-3">
              <span className="w-48 shrink-0 text-xs text-muted-foreground">{row.label}</span>
              <span className={row.cls}>{row.sample}</span>
            </div>
          ))}

          <p className="pt-2 text-sm text-muted-foreground">
            Figures use <code className="rounded bg-surface-2 px-1 font-mono text-xs">tabular-nums</code>{" "}
            everywhere, so a live counter does not shuffle its own width:{" "}
            <span data-numeric className="font-medium text-foreground">
              1,248 → 1,249
            </span>
          </p>
        </div>
      </Section>

      <Section title="Buttons" note="One accent button per view. Everything else stays quiet.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button>
              <Plus /> Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">
              <Trash2 /> Destructive
            </Button>
            <Button variant="destructive-ghost">Remove</Button>
            <Button variant="link">Link</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra large</Button>
            <Button size="icon" aria-label="Add">
              <Plus />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Section>

      <Section title="Inputs" note="Labels above, inline validation, one focus treatment.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sg-text">Full name</Label>
            <Input id="sg-text" defaultValue="Jordan Reed" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sg-search">With an adornment</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="sg-search" className="pl-9" placeholder="Search members…" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sg-invalid">Invalid</Label>
            <Input id="sg-invalid" aria-invalid defaultValue="not-an-email" />
            <p className="text-xs text-danger">Enter a valid email address.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sg-select">Select</Label>
            <Select defaultValue="monthly">
              <SelectTrigger id="sg-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly — 30 days</SelectItem>
                <SelectItem value="quarterly">Quarterly — 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sg-notes">Notes</Label>
            <Textarea id="sg-notes" rows={2} placeholder="Prefers morning sessions." />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              Checkbox
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch defaultChecked /> Switch
            </label>
          </div>
        </div>
      </Section>

      <Section title="Status" note="A dot and a label. Filled treatment only where status is the content.">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-6">
            {["active", "frozen", "expired", "cancelled"].map((status) => (
              <MembershipStatus key={status} status={status} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {["active", "frozen", "expired", "cancelled"].map((status) => (
              <MembershipStatus key={status} status={status} variant="solid" />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {["booked", "completed", "no_show", "cancelled"].map((status) => (
              <SessionStatus key={status} status={status} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 text-sm">
              <StatusDot tone="success" pulse /> Live indicator
            </span>
            <RoleBadge role="admin" />
            <RoleBadge role="staff" />
            <RoleBadge role="trainer" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {["Jordan Reed", "Priya Raman", "Marcus Hale", "Nina Kowalski"].map((name) => (
              <span key={name} className="flex items-center gap-2">
                <MemberAvatar name={name} />
                <span className="text-sm">{name}</span>
              </span>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Cards & table" note="44px rows, sticky header, actions on hover or focus.">
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <DataTable minWidth="34rem">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Member</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell align="right">Last visit</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-20 sr-only">
                    Actions
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { name: "Jordan Reed", code: "GF-000012", status: "active", visit: "2 days ago" },
                  { name: "Priya Raman", code: "GF-000048", status: "frozen", visit: "3 weeks ago" },
                  { name: "Marcus Hale", code: "GF-000091", status: "expired", visit: "never" },
                ].map((row) => (
                  <TableRow key={row.code} interactive>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <MemberAvatar name={row.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{row.name}</p>
                          <p className="font-mono text-2xs text-muted-foreground">{row.code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MembershipStatus status={row.status} />
                    </TableCell>
                    <TableCell align="right" className="text-sm text-muted-foreground">
                      {row.visit}
                    </TableCell>
                    <TableCell align="right">
                      <RowActions>
                        <Button size="icon-sm" variant="ghost" aria-label="Check in">
                          <Check />
                        </Button>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </CardContent>
        </Card>
      </Section>

      <Section title="Motion" note="One deliberate moment: the check-in, the most repeated action in the app.">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => toast.success("Jordan Reed checked in.")}
          >
            Fire a success toast
          </Button>
          <CheckInDemo />
        </div>
      </Section>

      <Section title="States" note="Every screen owes the user all three.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="py-0">
            <CardContent className="p-0">
              <EmptyState
                compact
                icon={Users}
                title="No members yet"
                description="Add the first member and they will show up here."
                action={
                  <Button size="sm">
                    <Plus /> Add member
                  </Button>
                }
              />
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardContent className="p-0">
              <ErrorState compact onRetry={() => toast.info("Retried.")} />
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardContent className="p-4">
              <ListSkeleton rows={3} />
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="py-0">
            <CardContent className="px-0 py-2">
              <TableSkeleton rows={4} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <ChartSkeleton height="9rem" />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}

/** Replays the check-in flourish so it can be judged without a real member. */
function CheckInDemo() {
  const [key, setKey] = useState(0);

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={() => setKey((value) => value + 1)}>
        Replay check-in
      </Button>

      <div
        key={key}
        className={
          key > 0
            ? "flex items-center gap-3 rounded-lg border border-success/40 bg-success-subtle px-4 py-2.5 animate-[var(--animate-check-in)]"
            : "flex items-center gap-3 rounded-lg border border-border px-4 py-2.5"
        }
      >
        <MemberAvatar name="Jordan Reed" size="sm" />
        <div className="text-sm">
          <p className="font-medium">Jordan Reed</p>
          <p className="text-xs text-muted-foreground">Checked in · Monthly</p>
        </div>
        {key > 0 ? <Check className="size-4 text-success" /> : null}
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1 border-b border-border pb-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SwatchRow({
  label,
  swatches,
}: {
  label: string;
  swatches: Array<{ name: string; className: string; hint: string }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-secondary-foreground">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {swatches.map((swatch) => (
          <div key={swatch.name} className="space-y-1.5">
            <div
              className={`h-14 rounded-md border border-border ${swatch.className}`}
              aria-hidden
            />
            <p className="font-mono text-2xs text-foreground">{swatch.name}</p>
            <p className="text-2xs text-muted-foreground">{swatch.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
