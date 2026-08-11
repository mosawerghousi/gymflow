import type { UserRole } from "@/domain/entities/user";

/**
 * The seeded demo accounts, shown on the login page (spec §6).
 *
 * These are deliberately public: the app runs on a public URL and the whole
 * point is that anyone can look around. The nightly cron restores the seed.
 */
export const DEMO_PASSWORD = "demo1234";

export interface DemoAccount {
  role: UserRole;
  label: string;
  email: string;
  password: string;
  blurb: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: "admin",
    label: "Admin",
    email: "admin@gymflow.demo",
    password: DEMO_PASSWORD,
    blurb: "Everything: members, scheduling, all reports, settings.",
  },
  {
    role: "staff",
    label: "Staff",
    email: "staff@gymflow.demo",
    password: DEMO_PASSWORD,
    blurb: "Front desk: members, check-ins, own shifts, swap requests.",
  },
  {
    role: "trainer",
    label: "Trainer",
    email: "trainer@gymflow.demo",
    password: DEMO_PASSWORD,
    blurb: "Own schedule and sessions, mark completed or no-show.",
  },
];

/** The kiosk device token seeded for the demo, so /kiosk works out of the box. */
export const DEMO_KIOSK_TOKEN = "gfk_demo_front_door_kiosk";
