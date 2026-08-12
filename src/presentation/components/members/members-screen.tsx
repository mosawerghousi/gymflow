"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ScanLine,
  Search,
  SlidersHorizontal,
  UserRoundPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { MemberSummaryDto } from "@/application/dto/member.dto";
import { MEMBERSHIP_STATUSES } from "@/domain/value-objects/membership-status";
import { MemberForm } from "@/presentation/components/forms/member-form";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { EmptyState, ErrorState, TableSkeleton } from "@/presentation/components/shared/states";
import { MembershipStatus } from "@/presentation/components/shared/status-badge";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/presentation/components/ui/tooltip";
import { cn } from "@/presentation/lib/utils";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import { useCheckInMutation } from "@/presentation/store/api/checkins-api";
import { useListMembersQuery, useListPlansQuery } from "@/presentation/store/api/members-api";
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
 * The member list.
 *
 * Dense but calm: 44px rows, name as the primary column, status as a dot rather
 * than a badge, and quick actions that stay hidden until a row is hovered or
 * focused.
 */
export function MembersScreen({ canWrite }: { canWrite: boolean }) {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.members);
  const debouncedSearch = useDebounced(filters.search, 250);

  const { data, isLoading, isFetching, isError, refetch } = useListMembersQuery({
    page: filters.page,
    pageSize: filters.pageSize,
    search: debouncedSearch || undefined,
    status: filters.status,
    planId: filters.planId ?? undefined,
    sort: filters.sort,
  });

  const { data: plans = [] } = useListPlansQuery();
  const [checkIn] = useCheckInMutation();

  // The same MemberForm serves both modes; only the mode and the seed differ.
  const [editing, setEditing] = useState<MemberSummaryDto | null>(null);

  const hasFilters =
    filters.search !== "" || filters.status !== "all" || filters.planId !== null;

  return (
    <div className="space-y-4 px-5 pb-10 sm:px-8">
      {/* Filter bar — search leads, top-left. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => dispatch(searchChanged(event.target.value))}
            placeholder="Search members…"
            aria-label="Search members"
            className="ps-9"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            dispatch(statusFilterChanged(value as (typeof MEMBERSHIP_STATUSES)[number] | "all"))
          }
        >
          <SelectTrigger className="w-36" aria-label="Filter by status">
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
          <SelectTrigger className="w-40" aria-label="Filter by plan">
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
          <SelectTrigger className="w-40" aria-label="Sort members">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
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
          <Button className="ms-auto" onClick={() => dispatch(createDialogToggled(true))}>
            <Plus /> Add member
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          {isError ? (
            <ErrorState
              title="The member list did not load"
              description="The server did not answer. Your filters are still here — try again."
              onRetry={() => void refetch()}
            />
          ) : isLoading ? (
            <TableSkeleton rows={10} columns={6} />
          ) : data && data.items.length > 0 ? (
            <DataTable
              minWidth="56rem"
              className={cn(isFetching && "opacity-60 transition-opacity duration-150")}
            >
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Member</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  <TableHeaderCell align="right">Expires</TableHeaderCell>
                  <TableHeaderCell align="right">Last visit</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-24">
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {data.items.map((member) => (
                  <TableRow key={member.id} interactive>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <MemberAvatar name={member.fullName} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/members/${member.id}`}
                            className="block truncate text-sm font-medium hover:text-primary hover:underline"
                          >
                            {member.fullName}
                          </Link>
                          <p className="truncate font-mono text-2xs text-muted-foreground">
                            {member.code}
                            {member.email ? ` · ${member.email}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <MembershipStatus status={member.status} />
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {member.planName ?? "—"}
                    </TableCell>

                    <TableCell align="right" className="text-sm">
                      {member.membershipEndsAt ? (
                        <span
                          className={cn(
                            "text-muted-foreground",
                            member.daysUntilExpiry !== null &&
                              member.daysUntilExpiry >= 0 &&
                              member.daysUntilExpiry <= 7 &&
                              "font-medium text-warning",
                          )}
                        >
                          {formatDate(member.membershipEndsAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell align="right" className="text-sm text-muted-foreground">
                      {member.lastVisitAt ? formatRelative(member.lastVisitAt) : "never"}
                    </TableCell>

                    <TableCell align="right">
                      <RowActions>
                        {canWrite && member.status === "active" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Check in ${member.fullName}`}
                                onClick={async () => {
                                  try {
                                    const result = await checkIn({
                                      memberId: member.id,
                                      method: "manual",
                                    }).unwrap();
                                    toast.success(
                                      result.outcome === "already_inside"
                                        ? `${member.fullName} is already inside.`
                                        : `${member.fullName} checked in.`,
                                    );
                                  } catch (error) {
                                    toast.error(apiErrorMessage(error, "Check-in failed."));
                                  }
                                }}
                              >
                                <ScanLine />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Check in</TooltipContent>
                          </Tooltip>
                        ) : null}

                        {canWrite ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Edit ${member.fullName}`}
                                onClick={() => setEditing(member)}
                              >
                                <Pencil />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        ) : null}

                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/members/${member.id}`}>Open</Link>
                        </Button>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <EmptyState
              icon={UserRoundPlus}
              title={hasFilters ? "No members match those filters" : "No members yet"}
              description={
                hasFilters
                  ? "Try a broader search, or clear the filters to see everyone."
                  : "Add the first member and they will show up here."
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={() => dispatch(filtersCleared())}>
                    <X /> Clear filters
                  </Button>
                ) : canWrite ? (
                  <Button size="sm" onClick={() => dispatch(createDialogToggled(true))}>
                    <Plus /> Add member
                  </Button>
                ) : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {data && data.items.length > 0 ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p data-numeric>
            {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
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
            <span data-numeric className="px-1">
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

      {/* One component, both modes — no create/edit twins anywhere. */}
      <MemberForm
        mode="create"
        open={filters.isCreateOpen}
        onOpenChange={(open) => dispatch(createDialogToggled(open))}
      />

      <MemberForm
        mode="edit"
        open={editing !== null}
        defaultValues={editing ?? undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
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
    year: "2-digit",
    timeZone: "UTC",
  });
}

function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;

  return `${Math.floor(days / 365)}y ago`;
}
