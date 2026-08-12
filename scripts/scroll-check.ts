import { chromium } from "@playwright/test";

async function main() {
  const baseURL = process.argv[2] ?? "https://gymflow-beryl.vercel.app";
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByRole("button", { name: "Login as Admin" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  for (const path of ["/dashboard", "/members", "/checkin", "/schedule", "/reports", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const aside = document.querySelector("aside");
      const main = document.querySelector("main");
      return {
        vScroll: de.scrollHeight - de.clientHeight,
        hScroll: de.scrollWidth - de.clientWidth,
        viewportH: de.clientHeight,
        bodyH: document.body.scrollHeight,
        asideH: aside ? Math.round(aside.getBoundingClientRect().height) : null,
        asidePosition: aside ? getComputedStyle(aside).position : null,
        mainH: main ? Math.round(main.getBoundingClientRect().height) : null,
      };
    });

    console.log(
      path.padEnd(11),
      "page scrolls:", String(m.vScroll).padStart(5) + "px",
      "| h-overflow:", String(m.hScroll).padStart(4) + "px",
      "| sidebar:", String(m.asideH).padStart(5) + "px", `(${m.asidePosition})`,
      "| viewport:", m.viewportH,
    );
  }

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
