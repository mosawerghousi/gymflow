import { randomUUID } from "node:crypto";

import { db } from "../client";
import { demoResets } from "../schema";
import { seedDatabase } from "./seed";

/**
 * Nightly demo reset (spec §6).
 *
 * Rebuilds the seed so the public demo always looks good the next morning,
 * whatever visitors did to it during the day, and records that it ran.
 */
export async function runDemoReset(): Promise<{ durationMs: number; summary: string }> {
  const started = Date.now();
  const result = await seedDatabase(db);
  const durationMs = Date.now() - started;

  const summary = `Reset demo data: ${result.members} members, ${result.checkins} check-ins, ${result.shifts} shifts, ${result.sessions} sessions.`;

  await db.insert(demoResets).values({ id: randomUUID(), durationMs, summary });

  return { durationMs, summary };
}
