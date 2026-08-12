import { intlLocale, isRtl, localeMeta, type Locale } from "@/i18n/config";

/**
 * Locale-aware formatting.
 *
 * Every number and date a user sees goes through here — never through manual
 * string slicing — so Dari and Pashto get Eastern Arabic-Indic digits
 * (۰۱۲۳۴۵۶۷۸۹) and Solar Hijri dates without any call site knowing about it.
 *
 * Storage is always UTC Gregorian; conversion happens only here.
 */

export type CalendarPreference = "gregory" | "persian";

export interface FormatContext {
  locale: string;
  /** Overrides the locale's default calendar, per the user's setting. */
  calendar?: CalendarPreference;
}

/** The calendar actually in force for a locale + preference. */
export function activeCalendar(ctx: FormatContext): CalendarPreference {
  return ctx.calendar ?? localeMeta(ctx.locale).defaultCalendar;
}

/* -------------------------------------------------------------------------- */
/* Numbers                                                                     */
/* -------------------------------------------------------------------------- */

export function formatNumber(
  value: number,
  ctx: FormatContext,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(ctx.locale), options).format(value);
}

/** A count, always an integer, in the locale's digits. */
export function formatCount(value: number, ctx: FormatContext): string {
  return formatNumber(value, ctx, { maximumFractionDigits: 0 });
}

export function formatPercent(value: number, ctx: FormatContext, fractionDigits = 1): string {
  return new Intl.NumberFormat(intlLocale(ctx.locale), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

export function formatMoney(cents: number, ctx: FormatContext): string {
  return new Intl.NumberFormat(intlLocale(ctx.locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Converts Eastern Arabic-Indic digits back to ASCII.
 *
 * The kiosk keypad shows ۰۱۲۳ but a member code must reach the API as 000123,
 * so anything typed or tapped is normalized on the way out.
 */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)); // Extended
}

/** Renders an ASCII digit string in the locale's numerals, digit for digit. */
export function toLocaleDigits(value: string, ctx: FormatContext): string {
  if (localeMeta(ctx.locale).numberingSystem === "latn") return value;

  return value.replace(/[0-9]/g, (digit) =>
    String.fromCharCode(0x06f0 + Number(digit)),
  );
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

function dateFormatter(ctx: FormatContext, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(
    intlLocale(ctx.locale, { calendar: activeCalendar(ctx) }),
    { timeZone: "UTC", ...options },
  );
}

/**
 * Assembles a date as day–month–year.
 *
 * CLDR's Persian-calendar patterns put the year first and, for Pashto, prepend
 * the `AP` era — `AP ۱۴۰۵ زمری ۲۱`. The parts are right, so both RTL locales
 * get them reordered day–month–year with the era dropped. English keeps its own
 * pattern untouched.
 */
function formatOrdered(
  value: Date,
  ctx: FormatContext,
  options: Intl.DateTimeFormatOptions,
): string {
  const formatter = dateFormatter(ctx, options);

  if (!isRtl(ctx.locale)) return formatter.format(value);

  const parts = formatter.formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return [pick("weekday"), pick("day"), pick("month"), pick("year")]
    .filter(Boolean)
    .join(" ");
}

/** e.g. `12 Aug 2026` · `۲۱ اسد ۱۴۰۵` */
export function formatDate(value: Date | string, ctx: FormatContext): string {
  return formatOrdered(asDate(value), ctx, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateLong(value: Date | string, ctx: FormatContext): string {
  return formatOrdered(asDate(value), ctx, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Day and month only — for calendar headers and chart ticks. */
export function formatDayMonth(value: Date | string, ctx: FormatContext): string {
  return formatOrdered(asDate(value), ctx, { day: "numeric", month: "short" });
}

/** 24-hour clock, in the locale's digits. */
export function formatTime(value: Date | string, ctx: FormatContext): string {
  return dateFormatter(ctx, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(asDate(value));
}

export function formatDateTime(value: Date | string, ctx: FormatContext): string {
  return `${formatDate(value, ctx)} · ${formatTime(value, ctx)}`;
}

/** Short weekday, e.g. `Mon` · `دوشنبه`. */
export function formatWeekday(value: Date | string, ctx: FormatContext): string {
  return dateFormatter(ctx, { weekday: "short" }).format(asDate(value));
}

/** The day number alone, for the calendar column headers. */
export function formatDayNumber(value: Date | string, ctx: FormatContext): string {
  return dateFormatter(ctx, { day: "numeric" }).format(asDate(value));
}

/** An hour label such as `06:00` · `۰۶:۰۰`. */
export function formatHour(hour: number, ctx: FormatContext): string {
  return toLocaleDigits(`${String(hour).padStart(2, "0")}:00`, ctx);
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/* -------------------------------------------------------------------------- */
/* Week layout                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The seven days of the week starting on the locale's first day.
 *
 * Afghanistan starts the week on Saturday, so the schedule grid reorders its
 * columns rather than always running Monday–Sunday.
 */
export function weekDaysFrom(weekStartIso: string, locale: string): Date[] {
  const monday = new Date(`${weekStartIso}T00:00:00.000Z`);
  const offset = (localeMeta(locale).firstDayOfWeek - 1 + 7) % 7;
  const start = new Date(monday.getTime() + (offset === 6 ? -2 : offset) * 86_400_000);

  return Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * 86_400_000));
}

/** Locale type re-exported so call sites need one import. */
export type { Locale };
