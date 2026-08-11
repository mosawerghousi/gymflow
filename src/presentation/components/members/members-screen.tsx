"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { MEMBERSHIP_STATUSES } from "@/domain/value-objects/membership-status";
import { MembershipStatusBadge } from "@/presentation/components/shared/status-badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
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
  useCreateMemberMutation,
  useListMembersQuery,
  useListPlansQuery,
} from "@/presentation/store/api/members-api";
import { useAppDispatch, useAppSelector } from "@/presentation/store/hooks";
import {
  createDialogToggled,
  filtersCleared,
  pageChanged,
  planFilterChanged,
  searchChanged,
  sortChanged,
  statusFilterChanged,
} from "@/presentation/store/member-slice";

const SORTS = [
  { value: "recent", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  { value: "expiring", label: "Expiring soonest" },
] as const;

/**
 * Paginated, searchable member list.
 *
 * Filters live in `memberSlice` (client state) and feed straight into the RTK
 * Query key, so changing a filter refetches without any manual effect.
 */
export function MembersScreen({ canWrite }: { canWrite: boolean }) {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.members);
  const debouncedSearch = useDebounced(filters.search, 250);

  const { data, isLoading, isFetching } = useListMembersQuery({
    page: filters.page,
    pageSize: filters.pageSize,
    search: debouncedSearch || undefined,
    status: filters.status,
    planId: filters.planId ?? undefined,
    sort: filters.sort,
  });

  const { data: plans = [] } = useListPlansQuery();

  const hasFilters =
    filters.search !== "" || filters.status !== "all" || filters.planId !== null;

  return (
    <div className="space-y-4 px-5 py-6 sm:px-8">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => dispatch(searchChanged(event.target.value))}
            placeholder="Search members…"
            aria-label="Search members"
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            dispatch(statusFilterChanged(value as (typeof MEMBERSHIP_STATUSES)[number] | "all"))
          }
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {MEMBERSHIP_STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.planId ?? "all"}
          onValueChange={(value) => dispatch(planFilterChanged(value === "all" ? null : value))}
        >
          <SelectTrigger className="w-44" aria-label="Filter by plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sort}
          onValueChange={(value) => dispatch(sortChanged(value as (typeof SORTS)[number]["value"]))}
        >
          <SelectTrigger className="w-44" aria-label="Sort members">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((sort) => (
              <SelectItem key={sort.value} value={sort.value}>
                {sort.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => dispatch(filtersCleared())}>
            <X /> Clear
          </Button>
        ) : null}

        {canWrite ? (
          <Button className="ml-auto" onClick={() => dispatch(createDialogToggled(true))}>
            <Plus /> New member
          </Button>
        ) : null}
      </div>

      {/* Table */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Member</th>
                  <th scope="col" className="px-4 py-3 font-medium">Code</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                  <th scope="col" className="px-4 py-3 font-medium">Expires</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last visit</th>
                </tr>
              </thead>
              <tbody className={cn(isFetching && !isLoading && "opacity-60 transition-opacity")}>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : data && data.items.length > 0 ? (
                  data.items.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/members/${member.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {member.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{member.email ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {member.code}
                      </td>
                      <td className="px-4 py-3">
                        <MembershipStatusBadge status={member.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {member.planName ?? "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {member.membershipEndsAt ? (
                          <span
                            className={cn(
                              member.daysUntilExpiry !== null &&
                                member.daysUntilExpiry <= 7 &&
                                member.daysUntilExpiry >= 0 &&
                                "text-amber-400",
                            )}
                          >
                            {formatDate(member.membershipEndsAt)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {member.lastVisitAt ? formatDate(member.lastVisitAt) : "never"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">
                      No members match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p className="tabular-nums">
            {data.total === 0
              ? "No members"
              : `${(data.page - 1) * data.pageSize + 1}–${Math.min(
                  data.page * data.pageSize,
                  data.total,
                )} of ${data.total}`}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => dispatch(pageChanged(data.page - 1))}
            >
              <ChevronLeft /> Previous
            </Button>
            <span className="tabular-nums">
              {data.page} / {data.pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.pageCount}
              onClick={() => dispatch(pageChanged(data.page + 1))}
            >
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      <CreateMemberDialog />
    </div>
  );
}

function CreateMemberDialog() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.members.isCreateOpen);
  const { data: plans = [] } = useListPlansQuery();
  const [createMember, { isLoading }] = useCreateMemberMutation();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    planId: "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    try {
      const member = await createMember({
        firstName: form.firstName,
        lastName: form.lastName,
        ...(form.email ? { email: form.email } : {}),
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.planId ? { planId: form.planId } : {}),
      }).unwrap();

      toast.success(`${member.fullName} added as ${member.code}.`);
      setForm({ firstName: "", lastName: "", email: "", phone: "", planId: "" });
      dispatch(createDialogToggled(false));
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not create the member."));
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => dispatch(createDialogToggled(open))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New member</DialogTitle>
          <DialogDescription>
            A member code is assigned automatically. Choosing a plan starts their term today.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                required
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                required
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Select
              value={form.planId}
              onValueChange={(value) => setForm({ ...form, planId: value })}
            >
              <SelectTrigger id="plan" className="w-full">
                <SelectValue placeholder="No plan yet" />
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter((plan) => plan.isActive)
                  .map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — {plan.durationDays} days
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => dispatch(createDialogToggled(false))}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Plus />}
              Create member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
    year: "numeric",
    timeZone: "UTC",
  });
}
