#!/usr/bin/env node
/**
 * Catalogue validator.
 *
 * "Everything is translated" is enforced here rather than asserted: the build
 * fails if any locale's key set diverges from English, a value is blank, an ICU
 * placeholder set differs, or a translation was left identical to the English
 * source where that would be suspicious.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "messages";
const BASE = "en";

const load = (locale) => JSON.parse(readFileSync(join(DIR, `${locale}.json`), "utf8"));

/** Flattens to dotted paths so two catalogues can be compared key for key. */
function flatten(value, prefix = "", out = {}) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) flatten(entry, path, out);
    else out[path] = entry;
  }
  return out;
}

/**
 * `{name}` and `{count, plural, …}` → the set of argument names.
 *
 * The trailing `[,}]` matters: without it the literal text inside a plural
 * branch — `one {expires in # day}` — is misread as an argument called
 * "expires".
 */
function placeholders(message) {
  if (typeof message !== "string") return new Set();
  return new Set([...message.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((match) => match[1]));
}

/** Strips ICU arguments so only translatable prose is left. */
function prose(message) {
  return String(message)
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\b(CSV|GymFlow|Next\.js|Redux|Drizzle|Postgres|Toolkit|ics)\b/gi, " ");
}

const locales = readdirSync(DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

const base = flatten(load(BASE));
const baseKeys = Object.keys(base);

let failures = 0;
const report = (locale, kind, detail) => {
  failures += 1;
  console.error(`  ✗ [${locale}] ${kind}: ${detail}`);
};

console.log(`Validating ${locales.length} catalogues against ${BASE} (${baseKeys.length} keys)\n`);

for (const locale of locales) {
  if (locale === BASE) continue;

  const target = flatten(load(locale));
  const targetKeys = new Set(Object.keys(target));
  let localeFailures = failures;

  for (const key of baseKeys) {
    if (!targetKeys.has(key)) {
      report(locale, "missing key", key);
      continue;
    }

    const value = target[key];

    if (typeof value !== "string" || value.trim() === "") {
      report(locale, "empty value", key);
      continue;
    }

    const expected = placeholders(base[key]);
    const actual = placeholders(value);

    for (const name of expected) {
      if (!actual.has(name)) report(locale, "lost placeholder", `${key} — missing {${name}}`);
    }
    for (const name of actual) {
      if (!expected.has(name)) report(locale, "unknown placeholder", `${key} — extra {${name}}`);
    }
  }

  for (const key of targetKeys) {
    if (!(key in base)) report(locale, "orphan key", key);
  }

  // A translation identical to English is usually an untranslated string —
  // unless there is nothing to translate. Acronyms, product names, sample
  // addresses and pure-placeholder strings are legitimately the same.
  const EXEMPT = new Set([
    "common.appName",
    "common.dash",
    "common.csv",
    "common.pageOf",
    "auth.builtWith",
    "auth.emailPlaceholder",
    "forms.emailPlaceholder",
    "schedule.exportIcs",
  ]);

  const untranslated = baseKeys.filter(
    (key) =>
      !EXEMPT.has(key) &&
      typeof target[key] === "string" &&
      target[key] === base[key] &&
      // Only flag it if there is actual prose that should have changed.
      /[A-Za-z]{3}/.test(prose(base[key])),
  );

  for (const key of untranslated) report(locale, "left in English", key);

  if (failures === localeFailures) {
    console.log(`  ✓ ${locale} — ${targetKeys.size} keys, all translated`);
  }
}

console.log("");

if (failures > 0) {
  console.error(`${failures} catalogue problem(s) found.`);
  process.exit(1);
}

console.log("All catalogues complete and consistent.");
