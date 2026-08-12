import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, localeMeta } from "./config";

/**
 * Loads the catalogue for the active request.
 *
 * Catalogues are namespaced by feature and merged here, so a screen only ever
 * asks for its own namespace.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "UTC",
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
        time: { hour: "2-digit", minute: "2-digit", hour12: false },
      },
      number: {
        integer: { maximumFractionDigits: 0 },
        percent: { style: "percent", maximumFractionDigits: 1 },
      },
    },
    // A missing key must never reach a user as a blank space; it renders the
    // key path so it is obvious in review, and is logged.
    onError(error) {
      if (process.env.NODE_ENV !== "production") console.error("[i18n]", error.message);
    },
    getMessageFallback({ namespace, key }) {
      return `⟪${[namespace, key].filter(Boolean).join(".")}⟫`;
    },
  };
});

export { localeMeta };
