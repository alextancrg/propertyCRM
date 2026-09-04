import { NextRequest, NextResponse } from "next/server";
import { runRentReminders } from "@/lib/reminders";
import { transitionFutureLeases } from "@/lib/leaseTransition";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target (see vercel.json `crons`). Vercel invokes this with a GET
 * request every day at 01:00 UTC (09:00 MYT). Runs the rent-reminder engine as
 * a system actor: all active leases are considered and no monthly quota is
 * enforced (the alerts themselves are still subject to Twilio's rules).
 *
 * Security: if a CRON_SECRET env var is configured, the request must carry the
 * `Authorization: Bearer <CRON_SECRET>` header that Vercel attaches to cron
 * requests, so the endpoint can't be triggered publicly. If CRON_SECRET is not
 * set, the endpoint runs unauthenticated (fine for a private project, but set
 * CRON_SECRET in production for safety).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }
  }

  // Start any future tenancy whose previous lease is up (before running rent
  // reminders so the new lease is considered in the same run).
  const transitions = await transitionFutureLeases(new Date());

  const result = await runRentReminders(new Date());
  return NextResponse.json({ ok: true, transitions, ...result });
}
