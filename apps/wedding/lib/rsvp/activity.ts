import "server-only";

import { randomUUID } from "node:crypto";

import { fallbackRequest, isFallbackConfigured } from "@/lib/fallback/client";
import { createAdminClient } from "@/lib/supabase/admin";

export type InvitationActivityType = "link_opened" | "rsvp_page_viewed" | "interaction" | "rsvp_saved" | "rsvp_failed";

export async function recordInvitationActivity(input: {
  invitationId: string;
  displayName?: string;
  eventType: InvitationActivityType;
  target?: string;
  details?: Record<string, string | number | boolean>;
}): Promise<boolean> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const displayName = input.displayName?.replace(/\s+/g, " ").trim().slice(0, 120) || null;
  const details = input.details ?? {};
  const writes: Promise<boolean>[] = [];

  if (isFallbackConfigured()) {
    writes.push(fallbackRequest<{ success: boolean }>("/v1/invitation-activity", {
      method: "POST",
      timeoutMs: 2_000,
      body: {
        id,
        invitationId: input.invitationId,
        displayName,
        eventType: input.eventType,
        target: input.target ?? null,
        details,
        createdAt,
      },
    }).then((result) => result.success).catch((error) => {
      console.error("Local invitation activity backup failed", error);
      return false;
    }));
  }

  writes.push((async () => {
    try {
      const db = createAdminClient({ optional: true });
      if (!db) return false;
      const { error } = await db.from("invitation_activity").insert({
        id,
        invitation_id: input.invitationId,
        event_type: input.eventType,
        target: input.target ?? null,
        details,
        created_at: createdAt,
      });
      if (error) {
        console.error("Invitation activity insert failed", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Invitation activity insert failed", error);
      return false;
    }
  })());

  const results = await Promise.all(writes);
  return results.some(Boolean);
}
