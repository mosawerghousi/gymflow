import { chromium } from "@playwright/test";

/**
 * Captures the README screenshots against a running deployment.
 *
 *   pnpm tsx scripts/screenshots.ts https://gymflow-beryl.vercel.app
 */
const SHOTS = [
  { path: "/login", name: "login", auth: false },
  { path: "/dashboard", name: "dashboard", auth: true },
  { path: "/checkin", name: "checkin", auth: true },
  { path: "/members", name: "members", auth: true },
  { path: "/schedule", name: "schedule", auth: true },
  { path: "/reports", name: "reports", auth: true },
];

async function main() {
  const baseURL = process.argv[2] ?? "http://localhost:3111";

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  const page = await context.newPage();

  await page.goto("/login");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "docs/screenshots/login.png" });

  await page.getByRole("button", { name: "Login as Admin" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  for (const shot of SHOTS.filter((s) => s.auth)) {
    await page.goto(shot.path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `docs/screenshots/${shot.name}.png` });
    console.log("captured", shot.name);
  }

  // The reports heatmap sits behind a tab.
  await page.goto("/reports");
  await page.waitForTimeout(1200);
  await page.getByRole("tab", { name: "Busiest hours" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "docs/screenshots/reports-heatmap.png" });

  // The kiosk, already paired with the seeded device token.
  await context.addInitScript(
    () => window.localStorage.setItem("gymflow.kiosk.token", "gfk_demo_front_door_kiosk"),
  );
  const kiosk = await context.newPage();
  await kiosk.goto("/kiosk");
  await kiosk.waitForTimeout(1200);
  await kiosk.screenshot({ path: "docs/screenshots/kiosk.png" });

  console.log("done");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
