import { chromium } from "@playwright/test";

async function main() {
  const baseURL = process.argv[2] ?? "https://gymflow-beryl.vercel.app";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  await page.goto("/login");
  await page.getByRole("button", { name: "Login as Admin" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  const cookies = await page.context().cookies();
  console.log(JSON.stringify({ Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") }));

  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
