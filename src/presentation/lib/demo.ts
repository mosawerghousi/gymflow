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
  /** Key under the `roles` namespace. */
  labelKey: string;
  email: string;
  password: string;
  /** Key under the `auth` namespace. */
  blurbKey: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: "admin",
    labelKey: "adminShort",
    email: "admin@gymflow.demo",
    password: DEMO_PASSWORD,
    blurbKey: "demoAdminBlurb",
  },
  {
    role: "staff",
    labelKey: "staffShort",
    email: "staff@gymflow.demo",
    password: DEMO_PASSWORD,
    blurbKey: "demoStaffBlurb",
  },
  {
    role: "trainer",
    labelKey: "trainerShort",
    email: "trainer@gymflow.demo",
    password: DEMO_PASSWORD,
    blurbKey: "demoTrainerBlurb",
  },
];

/** The kiosk device token seeded for the demo, so /kiosk works out of the box. */
export const DEMO_KIOSK_TOKEN = "gfk_demo_front_door_kiosk";
