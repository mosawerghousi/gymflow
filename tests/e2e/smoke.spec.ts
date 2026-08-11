import { expect, test, type Page } from "@playwright/test";

/**
 * The smoke path the spec calls for: log in, check a member in, load a report.
 *
 * It runs against whatever `E2E_BASE_URL` points at, so the same test verifies
 * a local build and the production deployment.
 */

async function loginAs(page: Page, role: "Admin" | "Staff" | "Trainer") {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to GymFlow" })).toBeVisible();

  await page.getByRole("button", { name: `Login as ${role}` }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("GymFlow smoke", () => {
  test("login page shows the demo credentials", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("Try the demo")).toBeVisible();
    await expect(page.getByText("admin@gymflow.demo")).toBeVisible();
    await expect(page.getByText("staff@gymflow.demo")).toBeVisible();
    await expect(page.getByText("trainer@gymflow.demo")).toBeVisible();
    await expect(page.getByText("demo1234").first()).toBeVisible();
  });

  test("admin: login → check in a member → view a report", async ({ page }) => {
    await loginAs(page, "Admin");
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();

    // --- Check-in ---
    await page.getByRole("link", { name: "Check-in desk" }).first().click();
    await page.waitForURL(/\/checkin/);

    const search = page.getByRole("textbox", { name: "Search members to check in" });
    await search.fill("GF-0000");

    const firstResult = page.getByRole("option").first();
    await expect(firstResult).toBeVisible({ timeout: 20_000 });

    // Pick someone the domain will actually let in.
    const allowed = page.getByRole("option").filter({ hasText: "Check in" }).first();
    await expect(allowed).toBeVisible();
    await allowed.click();

    // Either they were checked in, or they were already inside — both prove
    // the whole path works end to end.
    await expect(
      page.getByText(/is in$|is already inside/).first(),
    ).toBeVisible({ timeout: 20_000 });

    // --- Reports ---
    await page.getByRole("link", { name: "Reports" }).first().click();
    await page.waitForURL(/\/reports/);

    await expect(page.getByText("Active members")).toBeVisible();
    await expect(page.getByText("Check-ins", { exact: true }).first()).toBeVisible();

    // The busiest-hours heatmap is the report most likely to break on empty data.
    await page.getByRole("tab", { name: "Busiest hours" }).click();
    await expect(page.getByText("Check-ins by hour of day")).toBeVisible({ timeout: 20_000 });
  });

  test("admin: members list loads and a profile opens", async ({ page }) => {
    await loginAs(page, "Admin");

    await page.getByRole("link", { name: "Members" }).first().click();
    await page.waitForURL(/\/members/);

    const firstMember = page.locator("table tbody tr a").first();
    await expect(firstMember).toBeVisible({ timeout: 20_000 });

    const name = (await firstMember.textContent())?.trim() ?? "";
    await firstMember.click();

    await page.waitForURL(/\/members\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Attendance — last 90 days")).toBeVisible();
  });

  test("admin: the weekly schedule renders", async ({ page }) => {
    await loginAs(page, "Admin");

    await page.getByRole("link", { name: "Schedule" }).first().click();
    await page.waitForURL(/\/schedule/);

    await expect(page.getByText("Trainer sessions this week")).toBeVisible({ timeout: 20_000 });

    // The seven day columns of the weekly grid.
    await expect(page.getByText("Mon", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sun", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pending swap requests")).toBeVisible();
  });

  test("staff: sees the desk but not settings", async ({ page }) => {
    await loginAs(page, "Staff");

    await expect(page.getByRole("link", { name: "Check-in desk" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });

  test("trainer: sees their schedule but not the check-in desk", async ({ page }) => {
    await loginAs(page, "Trainer");

    await expect(page.getByRole("link", { name: "Schedule" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Check-in desk" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });

  test("kiosk asks to be paired when it has no token", async ({ page }) => {
    await page.goto("/kiosk");

    await expect(page.getByRole("heading", { name: "Pair this kiosk" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Kiosk device token" })).toBeVisible();
  });

  test("the API refuses an unauthenticated read", async ({ request }) => {
    const response = await request.get("/api/members");

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
});
