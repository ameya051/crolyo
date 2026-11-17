import { createHash, timingSafeEqual } from "node:crypto";
import { reconcileSubscriptions } from "@/lib/billing/reconcile";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Vercel's Hobby ceiling with Fluid compute. The job stops starting new work
// well before this (RUN_BUDGET_MS) and resumes on the next 15-minute run.
export const maxDuration = 300;

const RUN_BUDGET_MS = 240_000;

/** Constant-time check of the bearer token; fails closed if CRON_SECRET is unset. */
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  // Hash both sides so the buffers are equal length, as timingSafeEqual requires.
  const given = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  const expected = createHash("sha256").update(`Bearer ${cronSecret}`).digest();
  return timingSafeEqual(given, expected);
}

/** Called by the Vercel schedule in vercel.json; see lib/billing/reconcile.ts. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    logger.warn("billing.reconcile.unauthorized", {});
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const summary = await reconcileSubscriptions({ deadline: Date.now() + RUN_BUDGET_MS });
    if (summary.incomplete) logger.warn("billing.reconcile.incomplete", summary);
    logger.info("billing.reconcile.completed", summary);
    return Response.json(summary);
  } catch (error) {
    logger.error("billing.reconcile.run_failed", error);
    return Response.json({ error: "Reconciliation failed." }, { status: 500 });
  }
}
