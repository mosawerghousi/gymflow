import { expect, test } from "@playwright/test";

/**
 * Exercises every report endpoint and export the spec calls for, as an admin.
 *
 * The UI smoke covers the happy path a visitor sees; this one makes sure no
 * report or download 500s on real data.
 */
test.describe("reports and exports", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Login as Admin" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  const REPORTS = [
    "/api/reports/overview?days=90",
    "/api/reports/trends?days=90",
    "/api/reports/busiest-hours?days=90",
    "/api/reports/at-risk?inactiveDays=30&limit=25",
    "/api/reports/staff-hours?days=90",
    "/api/reports/trainer-performance?days=90",
  ];

  for (const endpoint of REPORTS) {
    test(`GET ${endpoint} returns data`, async ({ page }) => {
      const response = await page.request.get(endpoint);

      expect(response.status(), await response.text()).toBe(200);
      expect(await response.json()).toBeTruthy();
    });
  }

  test("every report has non-empty seed data behind it", async ({ page }) => {
    const overview = await (await page.request.get("/api/reports/overview?days=90")).json();

    expect(overview.membership.total).toBeGreaterThan(100);
    expect(overview.membership.active).toBeGreaterThan(0);
    expect(overview.checkins.value).toBeGreaterThan(0);
    expect(overview.plans.length).toBeGreaterThan(0);

    const busiest = await (await page.request.get("/api/reports/busiest-hours?days=90")).json();
    expect(busiest.peak).not.toBeNull();
    expect(busiest.matrix).toHaveLength(7);

    const staffHours = await (await page.request.get("/api/reports/staff-hours?days=90")).json();
    expect(staffHours.totalScheduledHours).toBeGreaterThan(0);
  });

  const EXPORTS = [
    { url: "/api/export/csv?report=members", type: "text/csv" },
    { url: "/api/export/csv?report=checkins&days=90", type: "text/csv" },
    { url: "/api/export/csv?report=signups&days=90", type: "text/csv" },
    { url: "/api/export/csv?report=at-risk&days=90", type: "text/csv" },
    { url: "/api/export/csv?report=staff-hours&days=90", type: "text/csv" },
    { url: "/api/export/csv?report=trainer-performance&days=90", type: "text/csv" },
    { url: "/api/export/csv?report=busiest-hours&days=90", type: "text/csv" },
  ];

  for (const { url, type } of EXPORTS) {
    test(`GET ${url} downloads a file`, async ({ page }) => {
      const response = await page.request.get(url);

      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["content-type"]).toContain(type);

      const body = await response.text();
      expect(body.split("\r\n").length).toBeGreaterThan(1);
    });
  }

  test("the iCal export is a valid calendar", async ({ page }) => {
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 14 * 86_400_000).toISOString();

    const response = await page.request.get(`/api/export/ical?from=${from}&to=${to}`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");

    const body = await response.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("END:VCALENDAR");
  });

  test("creating an overlapping shift is refused with a clear message", async ({ page }) => {
    const schedule = await (
      await page.request.get(
        `/api/schedule?from=${new Date(Date.now() - 7 * 86_400_000).toISOString()}&to=${new Date(
          Date.now() + 14 * 86_400_000,
        ).toISOString()}`,
      )
    ).json();

    const existing = schedule.shifts.find((shift: { status: string }) => shift.status !== "cancelled");
    expect(existing).toBeTruthy();

    const response = await page.request.post("/api/shifts", {
      data: {
        userId: existing.userId,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
        position: "floor",
      },
    });

    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "CONFLICT" } });
  });

  test("a member can be renewed, frozen and unfrozen", async ({ page }) => {
    const list = await (await page.request.get("/api/members?pageSize=1&status=active")).json();
    const member = list.items[0];
    expect(member).toBeTruthy();

    const plans = await (await page.request.get("/api/plans")).json();
    const plan = plans.find((candidate: { isActive: boolean }) => candidate.isActive);

    const renewed = await page.request.post(`/api/members/${member.id}/membership`, {
      data: { action: "renew", planId: plan.id },
    });
    expect(renewed.status()).toBe(200);

    const frozen = await page.request.post(`/api/members/${member.id}/membership`, {
      data: { action: "freeze" },
    });
    expect(frozen.status()).toBe(200);
    expect((await frozen.json()).status).toBe("frozen");

    // A frozen member must not be able to check in.
    const blocked = await page.request.post("/api/checkins", {
      data: { memberId: member.id, method: "manual" },
    });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).error.details.reason).toBe("frozen");

    const unfrozen = await page.request.post(`/api/members/${member.id}/membership`, {
      data: { action: "unfreeze" },
    });
    expect(unfrozen.status()).toBe(200);
    expect((await unfrozen.json()).status).toBe("active");
  });
});
