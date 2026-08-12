import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Authorization probes.
 *
 * Reads the code and trusts nothing: each role is signed in for real and then
 * asked to do things it should not be allowed to do.
 */

async function signIn(page: Page, role: "Admin" | "Staff" | "Trainer") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Login as ${role}` }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  return page.request;
}

async function anyMemberId(api: APIRequestContext): Promise<string> {
  const body = await (await api.get("/api/members?pageSize=1")).json();
  return body.items[0].id;
}

test.describe("authorization", () => {
  test("staff cannot reach admin-only settings endpoints", async ({ page }) => {
    const api = await signIn(page, "Staff");

    // Reading plans is allowed (staff sells them); writing settings is not.
    expect((await api.post("/api/plans", { data: { name: "Sneaky", priceCents: 1, durationDays: 1 } })).status()).toBe(403);
    expect((await api.get("/api/settings/kiosk-tokens")).status()).toBe(403);
    expect((await api.post("/api/settings/kiosk-tokens", { data: { name: "x" } })).status()).toBe(403);
    expect(
      (await api.post("/api/settings/staff", {
        data: { name: "X", email: "sneaky@example.com", role: "admin", password: "password123" },
      })).status(),
    ).toBe(403);
    expect((await api.get("/api/reports/staff-hours?days=30")).status()).toBe(403);
  });

  test("trainer cannot touch members or check people in", async ({ page }) => {
    const api = await signIn(page, "Trainer");

    expect(
      (await api.post("/api/members", { data: { firstName: "A", lastName: "B" } })).status(),
    ).toBe(403);

    const memberId = await anyMemberId(api);

    expect((await api.post("/api/checkins", { data: { memberId, method: "manual" } })).status()).toBe(403);
    expect((await api.delete(`/api/members/${memberId}`)).status()).toBe(403);
    expect((await api.post(`/api/members/${memberId}/membership`, { data: { action: "freeze" } })).status()).toBe(403);
    expect((await api.get("/api/settings/staff")).status()).toBe(403);
  });

  test("staff cannot create or cancel shifts for other people", async ({ page }) => {
    const api = await signIn(page, "Staff");

    const from = new Date().toISOString();
    const to = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const schedule = await (await api.get(`/api/schedule?from=${from}&to=${to}`)).json();
    const someone = schedule.staff[0];

    const start = new Date(Date.now() + 40 * 86_400_000);
    start.setUTCHours(3, 0, 0, 0);

    const response = await api.post("/api/shifts", {
      data: {
        userId: someone.id,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + 4 * 3_600_000).toISOString(),
        position: "front_desk",
      },
    });

    expect(response.status()).toBe(403);
  });

  test("the demo guardrail blocks revoking a kiosk token", async ({ page }) => {
    const api = await signIn(page, "Admin");

    const tokens = await (await api.get("/api/settings/kiosk-tokens")).json();
    const live = tokens.find((t: { revokedAt: string | null }) => t.revokedAt === null);
    expect(live, "a live kiosk token should exist").toBeTruthy();

    const response = await api.delete(`/api/settings/kiosk-tokens/${live.id}`);

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("DEMO_RESTRICTED");
  });

  test("the kiosk endpoint refuses a missing or wrong device token", async ({ request }) => {
    expect(
      (await request.post("/api/kiosk/checkin", { data: { memberCode: "GF-000001", method: "code" } })).status(),
    ).toBe(401);

    expect(
      (await request.post("/api/kiosk/checkin", {
        data: { memberCode: "GF-000001", method: "code" },
        headers: { "x-kiosk-token": "not-a-real-token" },
      })).status(),
    ).toBe(401);
  });

  test("the cron endpoint refuses an unauthenticated call", async ({ request }) => {
    expect((await request.get("/api/cron/demo-reset")).status()).toBe(401);
    expect(
      (await request.get("/api/cron/demo-reset", { headers: { authorization: "Bearer wrong" } })).status(),
    ).toBe(401);
  });

  test("malformed input is rejected, not swallowed", async ({ page }) => {
    const api = await signIn(page, "Admin");

    // Missing required fields.
    expect((await api.post("/api/members", { data: { firstName: "" } })).status()).toBe(400);
    // A non-uuid id must not reach the database.
    expect((await api.get("/api/members/not-a-uuid")).status()).toBe(404);
    // Nonsense range.
    expect((await api.get("/api/reports/overview?days=99999")).status()).toBe(400);
    // Unknown report name.
    expect((await api.get("/api/export/csv?report=passwords")).status()).toBe(400);
  });

  test("SQL metacharacters in search are treated as data", async ({ page }) => {
    const api = await signIn(page, "Admin");

    for (const probe of ["' OR 1=1 --", "'; DROP TABLE members; --", "%", "_", "\\"]) {
      const response = await api.get(`/api/members?search=${encodeURIComponent(probe)}`);
      expect(response.status(), `probe: ${probe}`).toBe(200);
    }

    // The table must still be there afterwards.
    const after = await (await api.get("/api/members?pageSize=1")).json();
    expect(after.total).toBeGreaterThan(100);
  });
});
