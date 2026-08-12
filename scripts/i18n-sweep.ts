import { chromium } from "@playwright/test";

/**
 * Walks every screen in every locale and reports any English left visible.
 *
 * The word list is deliberately drawn from UI chrome, not member data — names
 * and emails are seed data and stay Latin by design.
 */
const SCREENS = ["/dashboard", "/members", "/checkin", "/schedule", "/reports", "/settings"];
const LOCALES = [
  { code: "en", prefix: "" },
  { code: "fa-AF", prefix: "/fa-AF" },
  { code: "ps", prefix: "/ps" },
];

const ENGLISH = [
  "Dashboard","Members","Check-in","Schedule","Reports","Settings","Active","Expired","Frozen",
  "Cancelled","Add member","Search members","Status","Plan","Expires","Last visit","Booked",
  "Completed","No-show","Trainer","Approve","Reject","Withdraw","Opening hours","Kiosks","Team",
  "Busiest hours","Retention","Growth","Traffic","Sign-ups","Cancellations","At risk",
];

async function main() {
  const base = process.argv[2] ?? "http://localhost:3111";
  const browser = await chromium.launch();
  let problems = 0;

  for (const { code, prefix } of LOCALES) {
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 950 } });
    const page = await context.newPage();

    await page.goto(`${prefix}/login`);
    // The first role button inside the demo card.
    await page.locator("section >> button").first().click();
    await page.waitForURL((url) => url.pathname.endsWith("/dashboard"), { timeout: 30_000 });

    for (const screen of SCREENS) {
      await page.goto(`${prefix}${screen}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1100);

      const found = await page.evaluate(
        "(" + JSON.stringify(ENGLISH) + ").filter(function (w) {" +
        "  return document.body.innerText.indexOf(w) !== -1;" +
        "})",
      ) as string[];

      const dir = await page.evaluate("document.documentElement.dir");
      const expected = code === "en" ? "ltr" : "rtl";
      const dirOk = dir === expected;

      if (code === "en") {
        console.log(`  ${code.padEnd(6)} ${screen.padEnd(11)} dir=${dir} (baseline)`);
      } else if (found.length > 0 || !dirOk) {
        problems += 1;
        console.log(`  ${code.padEnd(6)} ${screen.padEnd(11)} dir=${dir} ✗ English: ${found.slice(0, 6).join(", ")}`);
      } else {
        console.log(`  ${code.padEnd(6)} ${screen.padEnd(11)} dir=${dir} ✓ fully localized`);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log(problems === 0 ? "\nNo English leaked into any RTL screen." : `\n${problems} screen(s) still leak English.`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
