# Translations

GymFlow ships in three languages, all first-class: **English** (`en`),
**Dari** (`fa-AF`) and **Pashto** (`ps`). Dari and Pashto are right-to-left.

None of the three is a "translation layer" over the others. English has no
privileges at runtime — it is the default locale and the source catalogue, and
that is the whole of its special status.

---

## 1. Where things live

| Path | What it holds |
| --- | --- |
| `messages/en.json` | The source catalogue. Add keys here first. |
| `messages/fa-AF.json` | Dari. |
| `messages/ps.json` | Pashto. |
| `src/i18n/config.ts` | The locale table: direction, Intl tag, digits, calendar, first day of week. |
| `src/i18n/routing.ts` | `Link`, `useRouter`, `redirect` — the locale-aware navigation primitives. |
| `src/i18n/request.ts` | Per-request catalogue loading. |
| `src/presentation/lib/format.ts` | Every date, time, number and currency the user sees. |
| `src/presentation/components/i18n/bidi.tsx` | `<Ltr>`, `<MemberCode>` — bidi isolation. |

Catalogues are namespaced by screen (`members`, `checkin`, `schedule`, …) plus
shared namespaces (`common`, `nav`, `status`, `forms`, `states`, `charts`).
Keys are `camelCase` and describe **meaning**, not the English words:
`floorEmptyHint`, not `checkSomeoneInAndTheyWillAppear`.

---

## 2. The two checks that keep this honest

Both run in `pnpm test`; run them individually while working.

### `pnpm i18n:validate` — the catalogues agree

`scripts/validate-catalogs.mjs` fails the build when a locale is missing a key,
has an empty value, drops or invents an ICU placeholder, or has left a string
identical to the English source. The last rule is the one that catches
half-finished work.

### `pnpm i18n:lint` — nothing hardcoded

`scripts/find-hardcoded-strings.mjs` reads the source and flags user-visible
English that never reached a catalogue: JSX text, visible props
(`title`, `placeholder`, `aria-label`, `name`, …) and Zod messages.

Silence a false positive with a trailing `// i18n-ignore` (or a JSX
`{/* i18n-ignore — why */}`) and say why. The only strings currently ignored are
the **GymFlow wordmark** and the **`Esc` keycap** — a brand name and a physical
key, neither of which is a word to translate.

### `pnpm tsx scripts/i18n-sweep.ts` — what actually rendered

The runtime complement: it signs in and walks every screen in every locale,
asserting `dir` is correct and that no English leaked. Slower, needs a running
server, and only sees states it can reach — which is exactly why the static
scanner exists alongside it.

---

## 3. Glossary

Fixed renderings. Keep these consistent; they are the vocabulary gym staff use
out loud, not literal translations of the English.

| English | Dari (`fa-AF`) | Pashto (`ps`) | Note |
| --- | --- | --- | --- |
| Member | عضو | غړی | |
| Members | اعضا | غړي | |
| Check-in | حضوری | حاضري | The act, not the desk. |
| Check-in desk | میز حضوری | د حاضرۍ میز | |
| Check out | خروج | وتل | |
| Membership | عضویت | غړیتوب | |
| Plan | پلان | پلان | Loanword in both; staff say "plan". |
| Trainer | مربی | روزونکی | |
| Shift | شفت | شفټ | Loanword in both. |
| Session | جلسه | ناسته | A one-to-one trainer booking. |
| Swap request | درخواست تبادله | د بدلون غوښتنه | |
| Expired | منقضی | نېټه تېره | |
| Frozen | مسدود | بند | A paused membership, not cancelled. |
| Active | فعال | فعال | |
| At risk | در معرض خطر | په خطر کې | Hasn't visited lately. |
| Kiosk | کیوسک | کیوسک | Loanword in both. |
| Front desk | پذیرش | پیشلوري | |
| Owner / Staff / Trainer | مالک / کارمند / مربی | مالک / کارمند / روزونکی | The three roles. |

**Pashto is not Dari.** They share a script and a good deal of vocabulary, and
translating one by copying the other is the most common way this goes wrong.
`چنګاښ` (Pashto) and `سرطان` (Dari) are the same month.

---

## 4. Numbers, dates and calendars

Never call `Intl` or `toLocaleDateString` in a component. Everything goes
through `src/presentation/lib/format.ts`, which is the only file that knows
about digits and calendars.

- **Digits** — Dari and Pashto render Eastern Arabic-Indic (`۰۱۲۳۴۵۶۷۸۹`) via
  the `nu-arabext` extension. `toLatinDigits()` converts back for anything that
  must round-trip to the server.
- **Calendar** — Afghan locales default to the Solar Hijri calendar. The month
  names come from CLDR and are already the Afghan set (`حمل ثور جوزا` for Dari,
  `وری غویی غبرګولی` for Pashto) — **not** the Iranian `فروردین اردیبهشت`. No
  overrides are needed, and adding any would be a regression.
- `intlLocale()` in `src/i18n/config.ts` always emits `ca-` explicitly. Omitting
  it silently falls back to the locale's CLDR default, which made the "Gregorian"
  setting do nothing.
- **Part order** — CLDR's Persian patterns put the year first and prefix Pashto
  dates with the `AP` era. `formatOrdered()` reorders parts to weekday-day-month-year,
  which is how Afghan users read a date.
- **Week start** — Saturday (`firstDayOfWeek: 6`) for both Afghan locales.
- **Storage is always UTC Gregorian.** Conversion happens only at render.

---

## 5. Right-to-left

- Layout uses **CSS logical properties** throughout: `ms-*`/`me-*`, `ps-*`/`pe-*`,
  `start-*`/`end-*`. `scripts/logical-css-sweep.mjs` flags physical ones.
- Direction is set once, on `<html>`, in `src/app/[locale]/layout.tsx`.
- Icons that encode direction (arrows, chevrons) mirror; icons that encode a
  thing (a clock, a user) do not.
- **Bidi isolation** — Latin strings inside RTL text (member codes, emails,
  phone numbers) are wrapped in `<Ltr>` / `<MemberCode>`, which emit
  `<bdi dir="ltr">`. Without this the browser reorders `GY-1043` into `1043-GY`
  next to Arabic-script text.
- Charts are laid out LTR deliberately — a time axis reads left-to-right in
  Afghanistan too — but their labels, tooltips and screen-reader tables are
  localized.

### Typography

Arabic-script text needs more vertical room and a larger optical size than
Latin at the same nominal size. `.font-arabic` in `globals.css` overrides the
type-scale **tokens** once, so every `text-*` utility picks up the adjustment
through `var(--text-*)`.

> This must stay a **token override**, not a `font-size` or `font-size-adjust`
> rule on an element. An earlier version scaled with `calc(1em * …)`, which
> compounded once per nesting level and made deeply nested text enormous.
> `pnpm tsx scripts/type-scale-check.ts` asserts the adjustment is uniform at
> every depth.

Dari renders in **Vazirmatn** (drawn for Persian). Pashto leads with **Noto
Sans Arabic**, whose coverage of ټ ډ ړ ږ ښ ګ ڼ ې ۍ is the design target rather
than an afterthought. Both load in both locales so a stack can fall back
mid-string — a Dari screen still contains Latin emails.

---

## 6. Writing a message

Use ICU for anything that varies. Do not build sentences by concatenation —
Dari and Pashto put the pieces in a different order.

```jsonc
// Right: one message, the grammar stays inside it
"trainingNow": "{count, plural, one {# member is training right now.} other {# members are training right now.}}"

// Wrong: the translator cannot move the number
"trainingNow": "{count} members are training right now."
```

Placeholder names are part of the contract — `validate-catalogs.mjs` fails if a
locale renames, drops or invents one.

---

## 7. Deliberately not translated

- **The style guide** (`/styleguide`) — a developer reference for the design
  system. Its labels name tokens and components ("Small", "Default",
  "Destructive"): English design vocabulary, not product copy. Excluded in
  `find-hardcoded-strings.mjs`.
- **The GymFlow wordmark** and **`Esc`** — a brand name and a physical key.
- **Seed data** (member names, notes) — sample content, not UI.

## 8. `// REVIEW` — wants a native speaker

The Dari and Pashto catalogues are complete and consistent, and the domain
vocabulary above was chosen to match how Afghan gym staff actually speak. These
entries are the ones where a native speaker should have the final word before
this is relied on commercially:

| Key | Why |
| --- | --- |
| `charts.*` | Chart vocabulary ("Sign-ups", "Retention", "Churn") is business jargon with no settled Dari/Pashto equivalent. Currently descriptive rather than idiomatic. |
| `reports.retention`, `reports.churn` | Same. A gym owner may well use the English word. |
| `settings.kioskDevices` | "Kiosk" is a loanword; whether staff say کیوسک or a descriptive phrase is worth checking. |
| `schedule.swapRequest` | Confirm the register — is this too formal for a message between two trainers? |
| `status.frozen` | Must clearly mean *paused*, not *cancelled*. Getting this wrong loses money. |
| `forms.validation.*` | Error copy should sound helpful, not clipped. Machine-plausible translations often land as terse. |
| `auth.*` | Sign-in copy is the first thing anyone reads. |

---

## 9. Adding a language

1. Add the code to `LOCALES` and a `LOCALE_META` entry in `src/i18n/config.ts` —
   direction, Intl tag, numbering system, default calendar, first day of week.
2. Copy `messages/en.json` to `messages/<code>.json` and translate it. Keep the
   key order; it makes diffs reviewable.
3. If the script is not Latin, add a font in `src/presentation/lib/fonts.ts` and,
   if it needs different metrics, a token override block in `globals.css`
   alongside `.font-arabic`.
4. Add the locale to the switcher's list and to `scripts/i18n-sweep.ts`.
5. Run `pnpm test` (catalogue validation and the string scanner are included),
   then the sweep against a running server.

No other file should need to change. If one does, that is a bug in the
abstraction, not a step to add here.
