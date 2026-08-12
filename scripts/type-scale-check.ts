import { chromium } from "@playwright/test";

/** Measures rendered type at increasing nesting depth, to prove nothing compounds. */
async function main() {
  const base = process.argv[2] ?? "http://localhost:3111";
  const browser = await chromium.launch();

  const SELECTORS = [":root", "body", "h1", "h2", "label", ".text-xs", "code"];

  for (const [label, path] of [
    ["en", "/login"],
    ["fa-AF", "/fa-AF/login"],
    ["ps", "/ps/login"],
  ]) {
    const page = await browser.newPage({ baseURL: base, viewport: { width: 1440, height: 900 } });
    await page.goto(path);
    await page.waitForTimeout(700);

    const sizes = await page.evaluate(
      "(" +
        JSON.stringify(SELECTORS) +
        ").map(function (s) {" +
        "  var el = s === ':root' ? document.documentElement : document.querySelector(s);" +
        "  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10 : null;" +
        "})",
    );

    console.log(
      label.padEnd(6) +
        SELECTORS.map((s, i) => `${s}=${(sizes as number[])[i]}`).join("  "),
    );
    await page.close();
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
