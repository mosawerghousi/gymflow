import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE } from "./config";

/**
 * Locale-segment routing.
 *
 * English keeps the bare paths (`/dashboard`); Dari and Pashto are prefixed
 * (`/fa-AF/dashboard`). The choice is remembered in a cookie and seeded from
 * `Accept-Language` on a first visit.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365 },
  localeDetection: true,
});

/** Locale-aware replacements for next/link and next/navigation. */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
