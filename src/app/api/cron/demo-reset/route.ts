import { NextResponse } from "next/server";

import { runDemoReset } from "@/infrastructure/db/seed/demo-reset";
import { route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Nightly demo reset (spec §6).
 *
 * Vercel Cron calls this with the project's `CRON_SECRET` as a bearer token;
 * the check is skipped only when no secret is configured, i.e. locally.
 */
export const GET = route(async (request: Request) => {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid cron credentials." } },
        { status: 401 },
      );
    }
  }

  const summary = await runDemoReset();

  return NextResponse.json({ ok: true, ...summary });
});
