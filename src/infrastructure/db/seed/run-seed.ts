import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main() {
  // Imported after dotenv so DATABASE_URL is present when the client is built.
  const { db, sql } = await import("../client");
  const { seedDatabase } = await import("./seed");

  console.log("Seeding GymFlow demo data…");
  const started = Date.now();
  const summary = await seedDatabase(db);

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s:`);
  for (const [key, value] of Object.entries(summary)) {
    console.log(`  ${key.padEnd(14)} ${value}`);
  }

  await sql.end();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
