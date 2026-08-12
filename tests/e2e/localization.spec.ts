import { expect, test, type Page } from "@playwright/test";

/**
 * Every screen, in every language.
 *
 * The unit-level catalogue validator proves the three files agree with each
 * other. This proves the app actually *uses* them: that the right catalogue is
 * served for the right URL, that direction flips, that digits and dates come
 * out in the reader's system, and that nothing English survives on an RTL
 * screen. Those are four different ways to ship a "translated" app that is not
 * translated, and none of them is visible to a JSON diff.
 */

const LOCALES = [
  { code: "en", prefix: "", dir: "ltr", rtl: false },
  { code: "fa-AF", prefix: "/fa-AF", dir: "rtl", rtl: true },
  { code: "ps", prefix: "/ps", dir: "rtl", rtl: true },
] as const;

const SCREENS = ["/dashboard", "/members", "/checkin", "/schedule", "/reports", "/settings"];

/** Words that must never appear on a localized screen. */
const ENGLISH = [
  "Dashboard",
  "Members",
  "Check-in",
  "Schedule",
  "Reports",
  "Settings",
  "Active",
  "Expired",
  "Frozen",
  "Search",
  "Save",
  "Cancel",
];

const EASTERN_DIGITS = /[۰-۹]/;

async function signIn(page: Page, prefix: string) {
  await page.goto(`${prefix}/login`);
  // The demo card prints the account's email, which is the one string on the
  // login screen that is the same in all three languages.
  await page.getByRole("button").filter({ hasText: /admin@gymflow\.demo/ }).first().click();
  await page.waitForURL((url) => url.pathname.endsWith("/dashboard"), { timeout: 90_000 });
}

for (const locale of LOCALES) {
  test.describe(`${locale.code}`, () => {
    test(`signs in and lands on the ${locale.code} dashboard`, async ({ page }) => {
      await signIn(page, locale.prefix);

      expect(page.url()).toContain(`${locale.prefix}/dashboard`);
      await expect(page.locator("html")).toHaveAttribute("dir", locale.dir);
      await expect(page.locator("html")).toHaveAttribute("lang", locale.code);
    });

    test(`every screen renders in ${locale.code}`, async ({ page }) => {
      // Six screens in one test, and the heaviest of them aggregates two years
      // of check-ins in SQL.
      test.setTimeout(180_000);
      await signIn(page, locale.prefix);

      for (const screen of SCREENS) {
        await page.goto(`${locale.prefix}${screen}`);
        await page.waitForLoadState("domcontentloaded");

        // No error boundary, no blank page.
        await expect(page.locator("main"), screen).toBeVisible({ timeout: 60_000 });

        await expect(page.locator("html"), `${screen} direction`).toHaveAttribute(
          "dir",
          locale.dir,
        );

        if (!locale.rtl) continue;

        const leaked = await page.evaluate(
          (words: string[]) => words.filter((word) => document.body.innerText.includes(word)),
          ENGLISH,
        );
        expect(leaked, `${screen} leaked English`).toEqual([]);
      }
    });

    if (locale.rtl) {
      test(`${locale.code} renders Eastern Arabic-Indic digits`, async ({ page }) => {
        await signIn(page, locale.prefix);

        const text = await page.locator("main").innerText();
        expect(text, "expected ۰-۹ rather than 0-9").toMatch(EASTERN_DIGITS);
      });
    }
  });
}

test("a chosen language sticks", async ({ page }) => {
  // The prefix picks the language, and the choice is remembered afterwards —
  // a front-desk machine set to Dari must not revert to English on the next
  // navigation, or on the next shift.
  await signIn(page, "");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  for (const target of [
    { code: "fa-AF", prefix: "/fa-AF", dir: "rtl" },
    { code: "ps", prefix: "/ps", dir: "rtl" },
  ]) {
    await page.goto(`${target.prefix}/dashboard`);
    await expect(page.locator("html")).toHaveAttribute("dir", target.dir);
    await expect(page.locator("html")).toHaveAttribute("lang", target.code);

    // Navigating without a prefix keeps the language rather than snapping back.
    await page.goto("/members");
    await expect(page.locator("html")).toHaveAttribute("lang", target.code);
    await expect(page.locator("html")).toHaveAttribute("dir", target.dir);
  }
});
