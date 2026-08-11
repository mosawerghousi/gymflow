<div align="center">
  <img src="public/brand/logo.svg" alt="GymFlow" width="260" />
</div>

# Architecture

GymFlow is organised in four layers with one rule holding them together:

> **Outer layers depend on inner layers. Never the reverse.**

```
┌─────────────────────────────────────────────────────────────┐
│  presentation      Next.js routes, React components, Redux  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  infrastructure   Drizzle, Auth.js, QR, iCal, bcrypt   │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │  application    use cases · ports · DTOs        │   │  │
│  │  │  ┌───────────────────────────────────────────┐  │   │  │
│  │  │  │  domain    entities · value objects       │  │   │  │
│  │  │  │            errors · invariants            │  │   │  │
│  │  │  └───────────────────────────────────────────┘  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│         composition  ← wires infrastructure into             │
│                        application at the edge               │
└─────────────────────────────────────────────────────────────┘
```

Arrows only ever point inward. `domain` imports nothing but itself; `application`
imports `domain`; `infrastructure` implements `application`'s interfaces;
`presentation` reaches the use cases through `composition`, never through a
repository.

---

## The layers

### `/src/domain` — the rules

Zero framework imports. No React, no Next, no Drizzle, no Zod. If you deleted
every other folder, this one would still compile and its tests would still pass.

| Folder | Holds |
|---|---|
| `entities/` | `Member`, `Shift`, `TrainerSession`, `Checkin`, `User`, `MembershipPlan`, `ShiftSwapRequest`, `KioskToken`, `OperatingHours`, `AuditLogEntry` |
| `value-objects/` | `MemberCode`, `TimeRange`, `MembershipStatus`, `EmailAddress`, `DateRange` |
| `errors/` | `DomainError` and its subtypes — the only errors business logic throws |

Entities are classes that guard their own invariants. A few that carry weight:

- **`Member.canCheckIn(now)`** — the single source of truth for "may this person
  come in?". It returns a verdict with a reason, so the desk, the kiosk and the
  API all show the same message. Expiry is *derived*: a row that still says
  `active` but whose term ended yesterday reports `expired`.
- **`Member.unfreeze(now)`** — credits the paused days back onto the end date. A
  member never loses time they paid for.
- **`Member.renew(...)`** — stacks onto the remaining term rather than
  restarting from today.
- **`TimeRange`** — a half-open interval `[start, end)`. That is what makes
  09:00–13:00 and 13:00–17:00 legal neighbours while a genuine overlap is not,
  matching the Postgres exclusion constraint exactly.
- **`Shift.assertNoConflict(...)`** / **`TrainerSession.assertNoConflict(...)`** —
  overlap refusal, testable without a database.
- **`deriveAvailability(...)`** — trainer availability is *computed* from shifts
  minus booked sessions. It is never stored, so it cannot drift from the roster.

### `/src/application` — the use cases

Depends only on `domain`.

| Folder | Holds |
|---|---|
| `use-cases/` | One exported factory per operation: `makeCheckInMember`, `makeCreateShift`, `makeRenewMembership`, … |
| `ports/` | Interfaces the outside world must satisfy: `MemberRepository`, `ReportRepository`, `Clock`, `IdGenerator`, `PasswordHasher`, `QrCodeGenerator`, `CalendarExporter` |
| `dto/` | Zod schemas for input, plain TypeScript interfaces for output |
| `policies/` | Cross-cutting rules such as the demo-mode guardrails |
| `mappers/` | Entity → DTO translation |

Use cases receive their dependencies through **factory injection**:

```ts
export function makeCheckInMember(deps: CheckInMemberDeps) {
  return async function checkInMember(actor: User, input: CheckInInput) { … };
}
```

`deps` is typed as *interfaces*. There is no `import { db }` anywhere under
`/application` — that is the rule the layer exists to enforce.

Authorization is decided by the domain too: `actor.assertCan("checkins:write")`
consults the permission table on the `User` entity, so a role check is never
scattered through a route handler.

### `/src/infrastructure` — the implementations

Depends on `application` + `domain`.

| Folder | Holds |
|---|---|
| `db/` | Drizzle schema, migrations, and one repository class per port |
| `auth/` | Auth.js v5 config (kept database-free so middleware can bundle it) |
| `services/` | `SystemClock`, `UuidGenerator`, `BcryptPasswordHasher`, `Sha256TokenGenerator`, `QrCodeService`, `ICalExporter` |

Two rules cannot be expressed in TypeScript and live in
`db/migrations/manual/0001_overlap_constraints.sql` instead:

```sql
ALTER TABLE shifts ADD CONSTRAINT shifts_no_overlap
  EXCLUDE USING gist (user_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status <> 'cancelled');
```

The domain checks overlap so the UI can show a friendly message; the database
holds the line when two admins save at the same instant.

**All report aggregation happens in SQL.** `DrizzleReportRepository` returns
finished numbers — churn, busiest hours, staff hours, trainer completion rates.
Nothing pulls rows into JavaScript to fold them, so a 200-member demo and a
20,000-member gym cost the same round trip.

### `/src/presentation` — Next.js and Redux

| Folder | Holds |
|---|---|
| `../app/` | Routes, layouts and `/api/*` route handlers |
| `components/` | React components, grouped by feature |
| `store/` | Redux Toolkit slices and the RTK Query API |
| `lib/` | `http.ts` (the domain-error → HTTP mapping), `utils.ts`, demo constants |

> **One deviation from the brief:** the spec places routes at
> `/presentation/app`. Next.js only resolves the App Router at `app/` or
> `src/app/` — it is not configurable. Routes therefore live at `src/app` and
> the rest of the presentation layer at `src/presentation`. Everything else
> follows the specified structure.

Route handlers are thin by construction:

```ts
export const POST = route(async (request: Request) => {
  const actor = await requireActor();              // authenticate
  const input = await parseBody(request, schema);  // validate (Zod DTO)
  return created(await useCases.checkInMember(actor, input)); // delegate
});
```

`route()` catches anything thrown and maps it: `ValidationError` → 400,
`UnauthorizedError` → 401, `ForbiddenError` / `DemoRestrictedError` → 403,
`NotFoundError` → 404, `ConflictError` → 409. No business logic appears in a
route handler or a component.

### `/src/composition` — the root

The only module that knows both worlds. It instantiates every Drizzle
repository and every service, then hands them to every use-case factory:

```ts
export const useCases = {
  checkInMember: makeCheckInMember(container),
  createShift:   makeCreateShift(container),
  …
} as const;
```

Swapping Postgres for something else means editing `container.ts` and nothing
above it.

---

## State management

Redux Toolkit is used deliberately, not everywhere.

**RTK slices** hold state the server has no opinion about:

| Slice | Owns |
|---|---|
| `checkinSlice` | Desk query, keyboard highlight index, last outcome, session feed |
| `scheduleSlice` | Visible week, drag-to-create draft, open dialog |
| `memberSlice` | Search, status/plan filters, sort, page |
| `kioskSlice` | Device pairing, keypad buffer, result screen |
| `uiSlice` | Sidebar, mobile nav, report range |

**RTK Query** is the API layer for every client-initiated read and write, against
the `/api/*` route handlers. Tag invalidation is what keeps the UI coherent — a
check-in invalidates `Checkin`, `CurrentlyInGym`, `Report` and the member list in
one line, and the counter in the corner updates itself.

**Server Components** fetch directly through the composition root for read-only
screens (the dashboard). Where a screen is interactive, the store is created
**per mount** by `StoreProvider` via a `useRef`, never as a module-level
singleton — a singleton on the server would leak one request's data into
another's.

---

## Testing

| Layer | How it is tested |
|---|---|
| `domain` | Vitest, direct. `member.test.ts`, `time-range.test.ts` |
| `application` | Vitest against **in-memory repository fakes** — the real use cases, no database, no mocking framework |
| End to end | Playwright: login → check-in → report, plus role visibility, every report endpoint, every export, and the overlap refusal |

The fakes in `tests/unit/fakes/in-memory-repositories.ts` implement the same
ports as the Drizzle classes. That is the payoff of the dependency rule: the
check-in use case can be exercised in under a millisecond.

```bash
pnpm test       # 46 unit tests
pnpm test:e2e   # 25 Playwright tests
```

---

## Request lifecycle

A front-desk check-in, end to end:

```
Browser  ─ RTK Query mutation ──────────────────────────────────┐
                                                                │
POST /api/checkins                                              │
  route()            catch → HTTP status                        │
  requireActor()     session → domain User                      │
  parseBody(Zod)     validate the DTO                           │
       │                                                        │
  useCases.checkInMember(actor, input)          ← composition   │
       │                                                        │
    actor.assertCan("checkins:write")           ← domain        │
    members.findById(id)                        ← port          │
    member.canCheckIn(now)                      ← domain rule   │
       ├── refused → ConflictError ─────────────────► 409 ──────┤
       │                                                        │
    checkins.create(...)                        ← port          │
    audit.append(...)                           ← port          │
       │                                                        │
  201 + CheckInResultDto ───────────────────────────────────────┘
       │
  Tag invalidation → the "in gym" counter refetches itself
```

The interesting part is where the decision is made: `member.canCheckIn(now)`, in
the innermost layer, with no knowledge of HTTP, Postgres or React.
