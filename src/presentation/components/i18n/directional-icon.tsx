"use client";

import { useLocale } from "next-intl";
import type { ComponentType } from "react";

import { isRtl } from "@/i18n/config";
import { cn } from "@/presentation/lib/utils";

/**
 * Mirrors an icon that points somewhere.
 *
 * Arrows, chevrons and "next/previous" affordances flip in RTL because they
 * encode direction of travel. Logos, media controls, clocks and check marks do
 * not — those must never be passed through this.
 */
export function DirectionalIcon({
  icon: Icon,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  const locale = useLocale();

  return <Icon className={cn(isRtl(locale) && "-scale-x-100", className)} />;
}
