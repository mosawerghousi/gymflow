import { DEMO_KIOSK_TOKEN, DEMO_PASSWORD } from "@/presentation/lib/demo";

/**
 * Deterministic seed data (spec §6).
 *
 * Everything is generated from a fixed PRNG seed, so the demo looks the same
 * after every nightly reset and every report renders with meaningful numbers
 * on a first visit.
 */

export const SEED_CONFIG = {
  memberCount: 200,
  /**
   * Longer than the 90-day default report window on purpose: every headline
   * metric shows a period-over-period delta, so the *preceding* window needs
   * real data too, or the demo opens on a nonsense "+11,907%". This covers the
   * 1-year preset and its comparison window.
   */
  checkinHistoryDays: 760,
  /** Sign-ups are spread across this window, weighted towards recent months. */
  joinSpreadDays: 820,
  shiftWeeks: 4,
  password: DEMO_PASSWORD,
  kioskToken: DEMO_KIOSK_TOKEN,
} as const;

/** Mulberry32 — a tiny, fast, reproducible PRNG. */
export function createRandom(seed: number) {
  let state = seed >>> 0;

  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(this.next() * items.length)]!;
    },
    chance(probability: number): boolean {
      return this.next() < probability;
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

export const DEMO_USERS = [
  {
    name: "Avery Bennett",
    email: "admin@gymflow.demo",
    role: "admin" as const,
    isDemo: true,
  },
  {
    name: "Sam Ortega",
    email: "staff@gymflow.demo",
    role: "staff" as const,
    isDemo: true,
  },
  {
    name: "Riley Chen",
    email: "trainer@gymflow.demo",
    role: "trainer" as const,
    isDemo: true,
  },
  // Extra staff so the roster and the staff-hours report have shape.
  { name: "Jordan Blake", email: "jordan@gymflow.demo", role: "staff" as const, isDemo: true },
  { name: "Priya Raman", email: "priya@gymflow.demo", role: "staff" as const, isDemo: true },
  { name: "Marcus Hale", email: "marcus@gymflow.demo", role: "trainer" as const, isDemo: true },
  { name: "Nina Kowalski", email: "nina@gymflow.demo", role: "trainer" as const, isDemo: true },
];

export const DEMO_PLANS = [
  {
    name: "Day Pass",
    description: "Single visit, no commitment.",
    priceCents: 1500,
    durationDays: 1,
  },
  {
    name: "Monthly",
    description: "Full access, rolling month.",
    priceCents: 4900,
    durationDays: 30,
  },
  {
    name: "Quarterly",
    description: "Three months, one payment — about 10% off monthly.",
    priceCents: 13200,
    durationDays: 90,
  },
  {
    name: "Annual",
    description: "Best value for regulars, plus two guest passes.",
    priceCents: 46800,
    durationDays: 365,
  },
];

const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Rowan", "Sage",
  "Elena", "Mateo", "Priya", "Omar", "Yuki", "Nina", "Diego", "Aisha", "Lucas", "Chloe",
  "Ibrahim", "Freya", "Kai", "Leila", "Noah", "Zara", "Felix", "Maya", "Hugo", "Ines",
  "Tomas", "Amara", "Ruben", "Sofia", "Ezra", "Nadia", "Milo", "Iris", "Arjun", "Talia",
];

const LAST_NAMES = [
  "Bennett", "Ortega", "Chen", "Blake", "Raman", "Hale", "Kowalski", "Okafor", "Silva", "Nakamura",
  "Ahmed", "Fischer", "Rossi", "Dubois", "Novak", "Haddad", "Lindqvist", "Moreau", "Kaur", "Vargas",
  "Petrov", "Sullivan", "Mbeki", "Andersen", "Costa", "Ivanov", "Reyes", "Larsen", "Baptiste", "Wu",
];

export function randomName(random: Random): { firstName: string; lastName: string } {
  return {
    firstName: random.pick(FIRST_NAMES),
    lastName: random.pick(LAST_NAMES),
  };
}

export function emailFor(firstName: string, lastName: string, index: number): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`;
}

export function phoneFor(random: Random): string {
  return `+1 555 ${String(random.int(1000, 9999))}`;
}

/**
 * How likely a member is to visit on a given day, by weekday and hour.
 *
 * Weighted towards weekday evenings and weekend mornings, which is what makes
 * the busiest-hours heatmap look like a real gym rather than noise.
 */
export const HOUR_WEIGHTS: readonly number[] = [
  0, 0, 0, 0, 0, 0.3, // 00–05
  1.2, 2.2, 1.6, 0.9, 0.7, 0.8, // 06–11
  1.4, 1.1, 0.7, 0.8, 1.3, 2.6, // 12–17
  3.2, 2.8, 1.7, 0.8, 0.2, 0, // 18–23
];

export const WEEKDAY_WEIGHTS: readonly number[] = [
  0.75, // Sunday
  1.15, // Monday
  1.1, // Tuesday
  1.05, // Wednesday
  1.0, // Thursday
  0.85, // Friday
  0.9, // Saturday
];

/** Picks a visit hour honouring the weights above. */
export function weightedHour(random: Random): number {
  const total = HOUR_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  let threshold = random.next() * total;

  for (let hour = 0; hour < HOUR_WEIGHTS.length; hour += 1) {
    threshold -= HOUR_WEIGHTS[hour]!;
    if (threshold <= 0) return hour;
  }

  return 18;
}

/**
 * Member archetypes, so the at-risk and churn reports have real signal:
 * regulars visit often, lapsed members stopped weeks ago.
 */
export const ATTENDANCE_PROFILES = [
  { name: "regular", weight: 0.3, visitsPerWeek: 4.2, dropOffChance: 0.02 },
  { name: "casual", weight: 0.35, visitsPerWeek: 1.8, dropOffChance: 0.08 },
  { name: "occasional", weight: 0.2, visitsPerWeek: 0.7, dropOffChance: 0.2 },
  { name: "lapsed", weight: 0.15, visitsPerWeek: 0.25, dropOffChance: 0.65 },
] as const;

export function pickProfile(random: Random): (typeof ATTENDANCE_PROFILES)[number] {
  const total = ATTENDANCE_PROFILES.reduce((sum, profile) => sum + profile.weight, 0);
  let threshold = random.next() * total;

  for (const profile of ATTENDANCE_PROFILES) {
    threshold -= profile.weight;
    if (threshold <= 0) return profile;
  }

  return ATTENDANCE_PROFILES[1];
}

export const SHIFT_TEMPLATES = [
  { position: "front_desk" as const, startHour: 6, hours: 8 },
  { position: "front_desk" as const, startHour: 14, hours: 8 },
  { position: "floor" as const, startHour: 9, hours: 6 },
  { position: "training" as const, startHour: 7, hours: 6 },
  { position: "training" as const, startHour: 15, hours: 7 },
  { position: "cleaning" as const, startHour: 20, hours: 2 },
  { position: "management" as const, startHour: 9, hours: 8 },
];
