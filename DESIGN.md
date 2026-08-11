<div align="center">
  <img src="public/brand/logo.svg" alt="GymFlow" width="260" />
</div>

# Design system

Live style guide: **[`/styleguide`](https://gymflow-beryl.vercel.app/styleguide)** (internal route, signed-in).

GymFlow should read as a serious operations tool with an athletic edge. The
reference points are Linear (calm, typography-led, whitespace as structure),
Supabase and Raycast (dark-first, one confident accent), and the Stripe and
Vercel dashboards (one hero metric, everything else quiet).

**Personality:** disciplined · fast · energetic · trustworthy.
**Anti-goals:** gradient soup, glassmorphism, stock-photo heroes, cockpit
screens, more than one accent.

---

## 1. Colour

Dark-mode-first. Surfaces are near-black slate — never pure `#000`, which flares
against emerald and kills the sense of depth. Three elevation steps carry the
whole app.

| Token | Role |
|---|---|
| `--surface-0` | App background |
| `--surface-1` | Cards, panels, table bodies |
| `--surface-2` | Inputs, popovers, hover on surface-1 |
| `--surface-3` | Overlays, hover on raised elements |
| `--line` / `--line-strong` | 1px separators; strong on hover and inputs |

Text is a three-step ramp — `--text-primary` for content, `--text-secondary`
for labels, `--text-tertiary` for meta. Anything quieter than tertiary would
fail AA.

### One accent

Emerald is the brand primary and is **rationed**. It is allowed on:

- the primary button (aim for one per view)
- the active navigation indicator
- the hero metric and the primary chart series
- check-in success

It is *not* allowed as decoration, on secondary buttons, or on more than one
chart series at a time. That scarcity is what makes an emerald pixel mean
"this matters".

### Semantics

The semantic trio maps directly onto the domain, so a colour always means the
same thing:

| Token | Domain meaning |
|---|---|
| `--success` | Checked in, membership active |
| `--warning` | Frozen, expiring soon |
| `--danger` | Expired, cancelled, no-show, blocked entry |

Status in dense views is a **small dot + label**, not a filled badge — a table
of 25 loud pills is noise. Filled treatment is reserved for places where the
status *is* the content (profile header, check-in result).

### Light mode

Derived from the same token names, toggled from the topbar. No component reads
a raw colour, so the light theme is a swap of the `:root` block and nothing
else.

---

## 2. Typography

Inter, via `next/font`. A strict scale — if a size is not on this list, it does
not go in the app:

| Token | px | Used for |
|---|---|---|
| `text-xs` | 12 | Labels, meta, table headers |
| `text-sm` | 14 | Body default, table cells, buttons |
| `text-base` | 16 | Section leads, large inputs |
| `text-lg` | 20 | Page titles |
| `text-xl` | 24 | Panel headlines |
| `text-2xl` | 32 | Stat values |
| `text-3xl` / `text-4xl` | 48 / 72 | Hero metric and kiosk only |

`text-2xs` (11px) exists for one job: dense table meta such as member codes.

Hierarchy is done with **size, weight and colour** — not with boxes, rules or
icons. All figures render `tabular-nums` (applied globally to `th`, `td` and
`[data-numeric]`) so columns and live counters do not jitter as they change.

---

## 3. Spacing, radius, borders

- **4px grid.** Spacing comes from Tailwind's scale, which is already 4px-based.
- **One radius family:** `6 / 8 / 12 / 16`. Controls are 8, cards are 12,
  sheets and modals are 16. Full rounding is for avatars and dots only.
- **1px borders, no shadows.** Depth comes from surface steps and hairlines.
  A dashboard full of drop shadows reads as busy long before it reads as deep.

---

## 4. Motion

150–200ms, `ease-out`, and only where it communicates something:

| Where | What |
|---|---|
| Hover / focus | 150ms colour and border transitions |
| Sheets, dialogs, popovers | 200ms enter, ease-out |
| Toasts | slide + fade |
| **Check-in success** | a brief scale + accent flash on the result, and a green sweep across the row |
| Kiosk idle | the logo breathes on a 4s loop |

Page transitions are off. Everything respects `prefers-reduced-motion`.

The check-in gets the one deliberate flourish in the app because it is the
action a front desk performs hundreds of times a day — the moment of feedback
is the product.

---

## 5. Components

Everything comes from the shared set in `src/presentation/components/ui`.
Zero one-off styles; if a screen needs something new, it goes in the set first.

| Component | Notes |
|---|---|
| `Button` | `default` (accent) · `secondary` · `outline` · `ghost` · `destructive` · `destructive-ghost` · `link`. Sizes `sm/default/lg/xl/icon*`. |
| `Input`, `Textarea`, `Select`, `Switch`, `Checkbox` | Labels above, `aria-invalid` drives the error border |
| `Card` | Elevation 1, `CardAction` slot for header actions |
| `DataTable` | 44px rows, sticky header, `RowActions` visible on hover **and** focus |
| `Sheet` | Right-side drawer — the home of every entity form |
| `EntityForm` | The shared create/edit shell (see §6) |
| `MembershipStatus`, `SessionStatus`, `RoleBadge` | Dot + label |
| `MemberAvatar` | Deterministic initials tint |
| `EmptyState`, `ErrorState`, `*Skeleton` | The three required states |
| `CommandPalette` | ⌘K — navigate and find members |

---

## 6. Forms — one component per entity

**Every CRUD entity has exactly one form component, used for both create and
edit.** There are no `CreateMemberDialog` / `EditMemberDialog` twins anywhere.

```tsx
<MemberForm mode="create" onSuccess={…} />
<MemberForm mode="edit" defaultValues={member} onSuccess={…} />
```

- One Zod schema per entity powers both modes.
- Only three things differ between modes: the title, the submit label, and the
  prefilled values.
- Identity fields (member code) are marked read-only **by config** in edit
  mode — never by forking the component.
- Forms render in a right-side sheet from list contexts, and the same component
  is reused verbatim on full pages.

Form UX rules: labels above inputs · inline validation on blur · exactly one
primary button · destructive actions never adjacent to submit · a dirty-state
guard before discarding.

---

## 7. Layout

- **Sidebar:** logo top, icon + label nav, role-aware. Active state is an
  **accent indicator bar**, not a filled pill. Collapse is remembered in
  `localStorage`.
- **Topbar:** page title, ⌘K command palette, theme toggle, user menu with role
  badge.
- **Responsive:** full experience ≥1024px; below that the sidebar becomes a
  sheet and tables scroll horizontally. The kiosk has its own layout entirely.

---

## 8. Accessibility

- WCAG AA contrast in both themes.
- One focus treatment app-wide: a 2px accent ring at 2px offset, applied
  globally via `:focus-visible`.
- Full keyboard path through check-in (search → arrow → Enter) and every form.
- Charts carry an accessible table fallback in a visually-hidden `<table>`.
- Row actions reveal on `focus-within`, not hover alone.
- Target: Lighthouse accessibility ≥ 95 on core pages.
