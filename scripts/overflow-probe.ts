import { chromium } from "@playwright/test";

async function main() {
  const baseURL = process.argv[2] ?? "https://gymflow-beryl.vercel.app";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 900 } });

  await page.goto("/login");
  await page.getByRole("button", { name: "Login as Admin" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await page.goto("/reports");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  // Decisive test: try to scroll the window and see whether it moves.
  const report = await page.evaluate(() => {
    window.scrollTo(0, 99999);
    const de = document.documentElement;
    const main = document.querySelector("main")!;
    const viewportH = de.clientHeight;

    // Anything whose bottom edge sits past the viewport is escaping the frame.
    const escaping: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom > viewportH + 2 && r.height > 40) {
        const inMain = main.contains(el);
        if (!inMain) {
          escaping.push(
            `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 60)} bottom=${Math.round(r.bottom)}`,
          );
        }
      }
    });

    return {
      windowScrolledTo: window.scrollY,
      docScroll: de.scrollHeight - de.clientHeight,
      bodyScrollH: document.body.scrollHeight,
      mainScroll: main.scrollHeight - main.clientHeight,
      mainClientH: main.clientHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(de).overflow,
      escaping: escaping.slice(0, 6),
    };
  });

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
