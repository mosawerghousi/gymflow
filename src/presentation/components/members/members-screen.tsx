"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { Link } from "@/i18n/routing";
import { MemberCode } from "@/presentation/components/i18n/bidi";
import { formatCount, formatDate as fmtDate } from "@/presentation/lib/format";
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
  { value: "recent", key: "sortRecent" },
  { value: "name", key: "sortName" },
  { value: "expiring", key: "sortExpiring" },
] as const;

/**
 * The member list.
 *
 * Dense but calm: 44px rows, name as the primary column, status as a dot rather
 * than a badge, and quick actions that stay hidden until a row is hovered or
 * focused.
 */
export function MembersScreen({ canWrite }: { canWrite: boolean }) {
  const t = useTranslations("members");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const locale = useLocale();
  const ctx = { locale };
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
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="ps-9"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            dispatch(statusFilterChanged(value as (typeof MEMBERSHIP_STATUSES)[number] | "all"))
          }
        >
          <SelectTrigger className="w-36" aria-label={t("filterStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {MEMBERSHIP_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {tStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.planId ?? "all"}
          onValueChange={(value) => dispatch(planFilterChanged(value === "all" ? null : value))}
        >
          <SelectTrigger className="w-40" aria-label={t("filterPlan")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPlans")}</SelectItem>
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
          <SelectTrigger className="w-40" aria-label={t("sortLabel")}>
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((sort) => (
              <SelectItem key={sort.key} value={sort.value}>
                {t(sort.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => dispatch(filtersCleared())}>
            <X /> {tCommon("clear")}
          </Button>
        ) : null}

        {canWrite ? (
          <Button className="ms-auto" onClick={() => dispatch(createDialogToggled(true))}>
            <Plus /> {t("addMember")}
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          {isError ? (
            <ErrorState
              title={t("listFailed")}
              description={t("listFailedHint")}
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
                  <TableHeaderCell>{t("columnMember")}</TableHeaderCell>
                  <TableHeaderCell>{t("columnStatus")}</TableHeaderCell>
                  <TableHeaderCell>{t("columnPlan")}</TableHeaderCell>
                  <TableHeaderCell align="right">{t("columnExpires")}</TableHeaderCell>
                  <TableHeaderCell align="right">{t("columnLastVisit")}</TableHeaderCell>
                  <TableHeaderCell align="right" className="w-24">
                    <span className="sr-only">{tCommon("actions")}</span>
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
                          <p className="truncate text-2xs text-muted-foreground">
                            <MemberCode code={member.code} />
                            {member.email ? <> · <MemberCode code={member.email} /></> : null}
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
                          {fmtDate(member.membershipEndsAt, ctx)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell align="right" className="text-sm text-muted-foreground">
                      {member.lastVisitAt ? formatRelative(member.lastVisitAt, tCommon) : tCommon("never")}
                    </TableCell>

                    <TableCell align="right">
                      <RowActions>
                        {canWrite && member.status === "active" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={t("checkInMember", { name: member.fullName })}
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
                            <TooltipContent>{tCommon("open")}</TooltipContent>
                          </Tooltip>
                        ) : null}

                        {canWrite ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={t("editMember", { name: member.fullName })}
                                onClick={() => setEditing(member)}
                              >
                                <Pencil />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{tCommon("edit")}</TooltipContent>
                          </Tooltip>
                        ) : null}

                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/members/${member.id}`}>{tCommon("open")}</Link>
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
              title={hasFilters ? t("noneMatch") : t("noneYet")}
              description={
                hasFilters ? t("noneMatchHint") : t("noneYetHint")
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={() => dispatch(filtersCleared())}>
                    <X /> {t("clearFilters")}
                  </Button>
                ) : canWrite ? (
                  <Button size="sm" onClick={() => dispatch(createDialogToggled(true))}>
                    <Plus /> {t("addMember")}
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
            {tCommon("showingRange", {
              from: formatCount((data.page - 1) * data.pageSize + 1, ctx),
              to: formatCount(Math.min(data.page * data.pageSize, data.total), ctx),
              total: formatCount(data.total, ctx),
            })}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => dispatch(pageChanged(data.page - 1))}
            >
              <ChevronLeft /> {tCommon("previous")}
            </Button>
            <span data-numeric className="px-1">
              {tCommon("pageOf", {
                page: formatCount(data.page, ctx),
                pages: formatCount(data.pageCount, ctx),
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.pageCount}
              onClick={() => dispatch(pageChanged(data.page + 1))}
            >
              {tCommon("next")} <ChevronRight />
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

/** Relative time, phrased and pluralized by the catalogue. */
function formatRelative(
  iso: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  if (days <= 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 30) return t("daysAgo", { count: days });
  if (days < 365) return t("monthsAgo", { count: Math.floor(days / 30) });

  return t("yearsAgo", { count: Math.floor(days / 365) });
}
