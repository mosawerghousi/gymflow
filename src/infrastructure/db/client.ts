import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * A single pooled Postgres connection per server instance.
 *
 * Next.js reloads modules in development, so the client is cached on
 * `globalThis` to avoid exhausting Neon's connection limit on every HMR pass.
 * `max: 1` keeps a serverless instance to one socket, which is what the free
 * tier is happiest with.
 */

declare global {
  var __gymflowSql: ReturnType<typeof postgres> | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local locally, or to the Vercel project settings.",
    );
  }

  return url;
}

function createClient() {
  return postgres(connectionString(), {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
}

export const sql = globalThis.__gymflowSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__gymflowSql = sql;
}

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
