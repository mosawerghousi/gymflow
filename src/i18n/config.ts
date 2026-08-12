/**
 * Locale configuration.
 *
 * Kept free of framework imports so middleware, server components, client
 * components and the catalogue validator can all share one source of truth.
 */

export const LOCALES = ["en", "fa-AF", "ps"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The cookie next-intl reads and writes when someone switches. */
export const LOCALE_COOKIE = "GYMFLOW_LOCALE";

export interface LocaleMeta {
  /** How the language names itself — never translated, never a flag. */
  nativeName: string;
  /** English name, for `aria-label` and the html `lang` attribute. */
  englishName: string;
  dir: "ltr" | "rtl";
  /** BCP-47 tag handed to `Intl`. */
  intlTag: string;
  /** Adds `-u-nu-arabext` so `Intl` emits ۰۱۲۳ rather than 0123. */
  numberingSystem: "latn" | "arabext";
  /** The default calendar shown to this locale. */
  defaultCalendar: "gregory" | "persian";
  /** 0 = Sunday … 6 = Saturday. Afghanistan starts the week on Saturday. */
  firstDayOfWeek: number;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    nativeName: "English",
    englishName: "English",
    dir: "ltr",
    intlTag: "en-GB",
    numberingSystem: "latn",
    defaultCalendar: "gregory",
    firstDayOfWeek: 1, // Monday
  },
  "fa-AF": {
    nativeName: "دری",
    englishName: "Dari",
    dir: "rtl",
    intlTag: "fa-AF",
    numberingSystem: "arabext",
    defaultCalendar: "persian",
    firstDayOfWeek: 6, // Saturday
  },
  ps: {
    nativeName: "پښتو",
    englishName: "Pashto",
    dir: "rtl",
    intlTag: "ps-AF",
    numberingSystem: "arabext",
    defaultCalendar: "persian",
    firstDayOfWeek: 6, // Saturday
  },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function localeMeta(locale: string): LocaleMeta {
  return LOCALE_META[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function isRtl(locale: string): boolean {
  return localeMeta(locale).dir === "rtl";
}

/**
 * The `Intl` tag with numbering system and calendar applied, e.g.
 * `fa-AF-u-ca-persian-nu-arabext`.
 */
export function intlLocale(
  locale: string,
  options: { calendar?: "gregory" | "persian" } = {},
): string {
  const meta = localeMeta(locale);
  const calendar = options.calendar ?? meta.defaultCalendar;

  // The calendar is always stated explicitly: fa-AF's CLDR default is already
  // persian, so omitting it would silently ignore a user who chose Gregorian.
  const extensions = [`ca-${calendar}`];
  if (meta.numberingSystem !== "latn") extensions.push(`nu-${meta.numberingSystem}`);

  return `${meta.intlTag}-u-${extensions.join("-")}`;
}
