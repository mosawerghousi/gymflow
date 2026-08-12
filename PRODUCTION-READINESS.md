# Production readiness review

**Reviewed:** `dev` @ `56e99ee` · against the live Neon database and a real
deployment.

**Verdict: the demo is in good shape. It is _not_ safe to run a real gym on this
deployment as configured** — four blockers below, three of them configuration
rather than code. The domain logic underneath is sound.

---

## Verified working

| Area | Method | Result |
|---|---|---|
| Type safety | `tsc --noEmit` | Clean |
| Lint | `eslint` | Clean |
| Unit tests | Vitest, in-memory fakes | **57 passing** |
| End-to-end | Playwright, real sessions | **34 passing** |
| Dependency audit | `pnpm audit --prod` | **0 vulnerabilities** |
| Authorization | 8 probes, each role signed in for real | All enforced |
| SQL injection | `' OR 1=1 --`, `'; DROP TABLE members; --`, `%`, `_`, `\` through search | Treated as data |
| Overlap prevention | Domain + Postgres `btree_gist` exclusion | Double-booking refused (`23P01`) |
| Query performance | `EXPLAIN ANALYZE` at 18k check-ins | Index scan, 3.4ms |
| Storage headroom | Neon | 18 MB of 512 MB |

Every one of the 33 API routes authenticates. Every use case authorizes through
the domain permission table. Passwords are bcrypt (cost 10); kiosk tokens are
stored as SHA-256 hashes, never plaintext.

---

## Fixed during this review

| Severity | Finding | Fix |
|---|---|---|
| **Critical ×3, High ×6** | `next-auth` beta.25 carried an existence-based auth bypass and a `getToken()` DoS; `drizzle-orm` 0.39 carried a SQL-injection advisory | Upgraded to `next-auth@5.0.0-beta.32` and `drizzle-orm@0.45.2`; pinned patched `postcss`/`sharp` via pnpm overrides. Audit now clean. |
| **High** | `GET /api/members/not-a-uuid` returned **500** — malformed path ids reached Postgres and surfaced a driver error | Every dynamic route validates its id and answers 404 |
| **High** | Members CSV exported **100 of 201** members, silently truncated | Pages through the full list; test asserts row count matches the member total |
| **Medium** | No `error.tsx` — a database outage showed Next's raw error page | Added `error`, `not-found` and `global-error` boundaries |

---

## Blockers before a real gym uses this

### 1. The nightly cron deletes everything — CRITICAL

`vercel.json` schedules `/api/cron/demo-reset` at `0 4 * * *`. It runs
`seedDatabase()`, which issues `DELETE` against **every table** and reseeds.

On a real gym's deployment this destroys all members, check-ins and history
every night at 04:00 UTC.

**Required:** delete the `crons` block from `vercel.json`, and delete
`src/app/api/cron/demo-reset/route.ts` and `src/infrastructure/db/seed/`
(or gate them behind an explicit `DEMO_MODE=true` env var).

### 2. Public demo credentials have admin rights — CRITICAL

`admin@gymflow.demo / demo1234` is printed on the login page and seeded with
full admin permissions. That is correct for a public demo and unacceptable for a
gym holding member contact details.

**Required:** remove `DEMO_ACCOUNTS` from the login page, seed exactly one real
admin, and drop the `is_demo` seed users.

### 3. No rate limiting on login — HIGH

Measured: **20 password guesses in 7.3 seconds, none throttled.** bcrypt cost 10
is the only brake (~350ms/attempt). That is not a defence against a sustained
attack on a known username.

**Required:** rate-limit `/api/auth/callback/credentials` per IP and per
account. Vercel WAF rate limiting, or Upstash Redis if you need it in-app.

### 4. Everything is UTC — HIGH for any gym outside UTC

There is no gym-timezone setting. Check-ins are stamped with the real UTC
instant and the reports bucket by `at time zone 'UTC'`.

A 19:00 check-in in Kabul (UTC+4:30) is stored as 14:30 UTC, so the
busiest-hours heatmap reports the evening peak at **14:30**. "Today's" figures
roll over at 04:30 local, not midnight. Scheduling is internally consistent
(shifts are entered and displayed in UTC), so the roster works — but every
analytic is skewed.

**Required:** a gym timezone in `app_settings`, applied at the display layer and
in the report `at time zone` clauses. Storage stays UTC.

---

## Should fix before launch

| Gap | Why it matters |
|---|---|
| **No password change or reset** | A staff member who suspects their password is known cannot rotate it, and an admin cannot help them without a database edit. |
| **No backup/restore runbook** | Neon's free tier has limited history. A gym's member list needs a documented, tested restore. |
| **No email/SMS** | Renewal reminders and expiry warnings exist as *screens*, not notifications — someone must look. |
| **`at-risk` CSV caps at 500 rows, `checkins` at 5000** | Fixed caps with no indication anything was dropped. Fine at demo scale, misleading at gym scale. |
| **8-hour session, no idle timeout** | A front-desk browser left open stays authenticated all day. |
| **Soft delete only** | No hard delete or data export for a member exercising a GDPR-style erasure request. |

---

## Out of scope by design

Excluded by the original build spec, not oversights: payments and billing, a
member-facing portal, and multi-location support.

---

## Summary

The **core is trustworthy**: business rules live in the domain and are covered by
57 unit tests; overlap is impossible at the database level, not merely
discouraged; authorization is enforced on every route and verified by probes
that sign in as each role and try to escalate; and the audit trail records who
changed what.

The blockers are almost entirely **demo scaffolding that must be removed**, plus
two genuine production features (rate limiting, timezone) that were never in
scope for a portfolio build. None of them requires re-architecting anything.

Rough effort to close blockers 1–4: **one to two days.**
