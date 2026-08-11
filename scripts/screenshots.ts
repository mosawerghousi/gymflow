import { chromium, type Page } from "@playwright/test";

/**
 * Captures the README screenshots against a running deployment.
 *
 *   pnpm tsx scripts/screenshots.ts https://gymflow-beryl.vercel.app
 */
const AUTHED = ["dashboard", "checkin", "members", "schedule", "reports", "settings", "styleguide"];

async function settle(page: Page, ms = 1600) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

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
  await settle(page, 800);
  await page.screenshot({ path: "docs/screenshots/login.png" });

  await page.getByRole("button", { name: "Login as Admin" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  for (const name of AUTHED) {
    await page.goto(`/${name}`);
    await settle(page);
    await page.screenshot({ path: `docs/screenshots/${name}.png` });
    console.log("captured", name);
  }

  // The heatmap sits on the Traffic tab, which is the default — capture the
  // busiest-hours card on its own for the README.
  await page.goto("/reports");
  await settle(page);
  await page.screenshot({ path: "docs/screenshots/reports-heatmap.png" });

  // A member profile, for the tabbed identity header.
  await page.goto("/members");
  await settle(page);
  await page.locator("table tbody tr a").first().click();
  await page.waitForURL(/\/members\/[0-9a-f-]{36}/);
  await settle(page);
  await page.screenshot({ path: "docs/screenshots/member-profile.png" });

  // Light mode, so the README shows the theme is real.
  const lightContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: await context.storageState(),
  });
  await lightContext.addInitScript(() => window.localStorage.setItem("theme", "light"));

  const lightPage = await lightContext.newPage();
  await lightPage.goto("/dashboard");
  await settle(lightPage);
  await lightPage.screenshot({ path: "docs/screenshots/dashboard-light.png" });
  console.log("captured dashboard-light");

  // The kiosk, already paired with the seeded device token.
  await context.addInitScript(() =>
    window.localStorage.setItem("gymflow.kiosk.token", "gfk_demo_front_door_kiosk"),
  );
  const kiosk = await context.newPage();
  await kiosk.goto("/kiosk");
  await settle(kiosk, 1200);
  await kiosk.screenshot({ path: "docs/screenshots/kiosk.png" });

  console.log("done");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
