import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { runEscalations, runRetention, runSubscriptionJobs, runSuggestionRefresh } from "@/lib/jobs";

export const maxDuration = 300;

/**
 * Scheduled jobs, called by GitHub Actions (.github/workflows/cron.yml) with
 * `Authorization: Bearer $CRON_SECRET`.
 *   hourly      – escalate complaints waiting over a day
 *   daily       – subscription reminders, locking notices, purge, 12-month retention
 *   suggestions – refresh stale AI suggestion pools (a few branches per run)
 */
async function handle(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${env().CRON_SECRET}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { job } = await ctx.params;
  switch (job) {
    case "hourly":
      return NextResponse.json(await runEscalations());
    case "daily":
      return NextResponse.json({ ...(await runSubscriptionJobs()), ...(await runRetention()) });
    case "suggestions":
      return NextResponse.json(await runSuggestionRefresh(10));
    default:
      return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }
}

export const GET = handle;
export const POST = handle;
