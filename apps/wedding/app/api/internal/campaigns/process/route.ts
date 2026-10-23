import { timingSafeEqual } from "node:crypto";

import { processNextCampaignRecipient } from "@/lib/rsvp/campaign-queue";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.WEDDING_CAMPAIGN_WORKER_SECRET || process.env.WEDDING_FALLBACK_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await processNextCampaignRecipient(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Campaign worker failed", error);
    return Response.json({ error: "worker_failed" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
