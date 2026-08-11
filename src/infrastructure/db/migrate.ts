import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

/**
 * Applies the Drizzle migrations, then the hand-written SQL in
 * `migrations/manual/` — the Postgres exclusion constraints Drizzle cannot
 * express (spec §5: shifts and trainer sessions must not overlap).
 */
async function main() {
  const { sql } = await import("./client");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const migrationsFolder = join(process.cwd(), "src/infrastructure/db/migrations");

  console.log("Applying Drizzle migrations…");
  await migrate(drizzle(sql), { migrationsFolder });

  const manualFolder = join(migrationsFolder, "manual");
  const files = (await readdir(manualFolder).catch(() => [])).filter((file) =>
    file.endsWith(".sql"),
  );

  for (const file of files.sort()) {
    console.log(`Applying ${file}…`);
    const statement = await readFile(join(manualFolder, file), "utf8");
    await sql.unsafe(statement);
  }

  console.log("Migrations complete.");
  await sql.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
