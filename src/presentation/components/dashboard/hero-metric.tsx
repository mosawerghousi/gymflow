"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { ArrowUpRight, Clock } from "lucide-react";

import type { CurrentlyInGymDto } from "@/application/dto/checkin.dto";
import { MemberAvatar } from "@/presentation/components/shared/member-avatar";
import { StatusDot } from "@/presentation/components/shared/status-badge";
import { EmptyState, ListSkeleton } from "@/presentation/components/shared/states";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { formatCount } from "@/presentation/lib/format";
import { useCurrentlyInGymQuery } from "@/presentation/store/api/checkins-api";

/**
 * The hero metric: top-left, large, accent-coloured.
 *
 * "Is the gym okay right now?" is answered by this number before the eye moves
 * anywhere else, which is why it is the only 48px figure on the screen and the
 * only place the accent appears at that size.
 */
export function HeroMetric({ initial }: { initial: CurrentlyInGymDto }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const ctx = { locale };
  const { data = initial, isLoading } = useCurrentlyInGymQuery(undefined, {
    pollingInterval: 30_000,
  });

  const roster = data.visitors.slice(0, 6);

  return (
    <Card className="gap-4 lg:col-span-2">
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <StatusDot tone="success" pulse />
              {t("currentlyInGym")}
            </p>

            <p
              data-numeric
              className="mt-2 text-3xl leading-none font-semibold tracking-tight text-primary"
            >
              {formatCount(data.count, ctx)}
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              {data.count === 0 ? t("nobodyYet") : t("trainingNow", { count: data.count })}
            </p>
          </div>

          <Link
            href="/checkin"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {t("desk")} <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {isLoading && data.visitors.length === 0 ? (
          <ListSkeleton rows={3} />
        ) : roster.length === 0 ? (
          <EmptyState
            compact
            title={t("floorEmpty")}
            description={t("floorEmptyHint")}
          />
        ) : (
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {roster.map((visitor) => (
              <li key={visitor.checkinId} className="flex items-center gap-2.5">
                <MemberAvatar name={visitor.fullName} size="sm" />
                <Link
                  href={`/members/${visitor.memberId}`}
                  className="min-w-0 flex-1 truncate text-sm hover:text-primary hover:underline"
                >
                  {visitor.fullName}
                </Link>
                <span
                  data-numeric
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                >
                  <Clock className="size-3" />
                  {visitor.minutesInside}m
                </span>
              </li>
            ))}
          </ul>
        )}

        {data.visitors.length > roster.length ? (
          <p className="text-xs text-muted-foreground">
            +{data.visitors.length - roster.length} more on the floor
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
