import "server-only";

import { randomUUID } from "node:crypto";

import { fallbackRequest, isFallbackConfigured } from "@/lib/fallback/client";
import { weddingMessage, weddingMessageMediaUrl, whatsappRecipient, type WeddingMessageKind } from "@/lib/rsvp/messages";
import { createAdminClient } from "@/lib/supabase/admin";

export type CampaignAudience = "all_contactable" | "pending_rsvp" | "confirmed" | "declined";
export type CampaignGuestSide = "michael" | "shoval" | "unassigned";

const sideSourceTabs: Record<Exclude<CampaignGuestSide, "unassigned">, string> = {
  michael: "מוזמנים - מיכאל",
  shoval: "מוזמנים - שובל",
};

export function guestSideFromSourceTab(sourceTab: string | null): CampaignGuestSide {
  if (sourceTab === sideSourceTabs.michael) return "michael";
  if (sourceTab === sideSourceTabs.shoval) return "shoval";
  return "unassigned";
}

export function campaignSideLabel(side: CampaignGuestSide | null) {
  return side === "michael" ? "הצד של מיכאל" : side === "shoval" ? "הצד של שובל" : side === "unassigned" ? "ללא שיוך צד" : "כל הצדדים";
}

export function parseCampaignGroupSelection(selection: string): { groupFilter: string | null; sideFilter: CampaignGuestSide | null } | null {
  if (selection === "all") return { groupFilter: null, sideFilter: null };
  if (selection === "uncategorized") return { groupFilter: "", sideFilter: null };
  const uncategorized = selection.match(/^uncategorized:(michael|shoval|unassigned)$/);
  if (uncategorized) return { groupFilter: "", sideFilter: uncategorized[1] as CampaignGuestSide };
  const grouped = selection.match(/^group:(michael|shoval|unassigned):(.+)$/);
  if (!grouped) return null;
  try {
    const name = decodeURIComponent(grouped[2]).trim();
    return name ? { groupFilter: name, sideFilter: grouped[1] as CampaignGuestSide } : null;
  } catch {
    return null;
  }
}

export function campaignAudienceLabel(audience: CampaignAudience) {
  return ({ all_contactable: "כל בעלי המספר התקין", pending_rsvp: "ממתינים לתשובה", confirmed: "אישרו הגעה", declined: "לא מגיעים" } as const)[audience];
}

export function campaignGroupLabel(group: string | null, side: CampaignGuestSide | null = null) {
  const groupLabel = group === null ? "כל הקטגוריות" : group === "" ? "ללא קטגוריה" : group;
  return `${groupLabel} · ${campaignSideLabel(side)}`;
}

export function campaignRecipientMatches(audience: CampaignAudience, groupFilter: string | null, status: string, group: string | null, sideFilter: CampaignGuestSide | null = null, sourceTab: string | null = null) {
  const expectedStatus = audience === "pending_rsvp" ? "pending" : audience;
  const statusMatches = audience === "all_contactable" || status === expectedStatus;
  const normalizedGroup = group?.trim() || "";
  const sideMatches = sideFilter === null || guestSideFromSourceTab(sourceTab) === sideFilter;
  return statusMatches && sideMatches && (groupFilter === null || normalizedGroup === groupFilter);
}

export async function listCampaignGuestGroups() {
  const db = createAdminClient();
  const { data, error } = await db.from("invitations").select("guest_group, source_tab").eq("missing_from_source", false);
  if (error) throw new Error(error.message);
  const counts = new Map<string, { name: string; side: CampaignGuestSide; count: number }>();
  for (const row of data ?? []) {
    const group = row.guest_group?.trim() ?? "";
    const side = guestSideFromSourceTab(row.source_tab);
    const key = `${side}\u0000${group}`;
    const current = counts.get(key) ?? { name: group, side, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "he") || a.side.localeCompare(b.side));
}

export function nextCampaignDelaySeconds(minimum: number, maximum: number, random = Math.random()) {
  const min = Math.max(30, Math.floor(minimum));
  const max = Math.max(min, Math.floor(maximum));
  return min + Math.floor(random * (max - min + 1));
}

export async function campaignCandidates(audience: CampaignAudience, kind: WeddingMessageKind, guestGroupFilter: string | null = null, guestSideFilter: CampaignGuestSide | null = null) {
  const db = createAdminClient();
  let query = db.from("invitations")
    .select("id, display_name, normalized_phone, secure_token, table_number, rsvp_status, contact_opt_out")
    .not("normalized_phone", "is", null)
    .eq("contact_opt_out", false)
    .eq("missing_from_source", false);
  if (audience !== "all_contactable") query = query.eq("rsvp_status", audience === "pending_rsvp" ? "pending" : audience);
  if (guestGroupFilter === "") query = query.or("guest_group.is.null,guest_group.eq.");
  else if (guestGroupFilter !== null) query = query.eq("guest_group", guestGroupFilter);
  if (guestSideFilter === "michael" || guestSideFilter === "shoval") query = query.eq("source_tab", sideSourceTabs[guestSideFilter]);
  else if (guestSideFilter === "unassigned") query = query.is("source_tab", null);
  const { data, error } = await query.order("display_name");
  if (error) throw new Error(error.message);
  const valid = (data ?? []).filter((item) => item.normalized_phone && whatsappRecipient(item.normalized_phone));
  if (!valid.length) return [];
  const { data: sent, error: sentError } = await db.from("message_deliveries")
    .select("invitation_id")
    .eq("message_kind", kind)
    .eq("status", "sent")
    .in("invitation_id", valid.map((item) => item.id));
  if (sentError) throw new Error(sentError.message);
  const sentIds = new Set((sent ?? []).map((item) => item.invitation_id));
  return valid.filter((item) => !sentIds.has(item.id));
}

export async function processNextCampaignRecipient(now = new Date()) {
  if (!isFallbackConfigured()) return { outcome: "unavailable" as const };
  const db = createAdminClient();
  const { data: campaigns, error } = await db.from("message_campaigns")
    .select("id, message_kind, audience, guest_group_filter, guest_side_filter, min_delay_seconds, max_delay_seconds")
    .in("status", ["queued", "running"])
    .lte("next_run_at", now.toISOString())
    .order("next_run_at")
    .limit(1);
  if (error) throw new Error(error.message);
  const campaign = campaigns?.[0];
  if (!campaign) return { outcome: "idle" as const };

  const { data: recipients, error: recipientError } = await db.from("message_campaign_recipients")
    .select("id, invitation_id, attempt_count")
    .eq("campaign_id", campaign.id)
    .eq("status", "queued")
    .order("created_at")
    .limit(1);
  if (recipientError) throw new Error(recipientError.message);
  const recipientRow = recipients?.[0];
  if (!recipientRow) {
    await db.from("message_campaigns").update({ status: "completed", completed_at: now.toISOString(), next_run_at: null, updated_at: now.toISOString() }).eq("id", campaign.id);
    return { outcome: "completed" as const, campaignId: campaign.id };
  }
  const claimed = await db.from("message_campaign_recipients").update({ status: "sending", attempt_count: recipientRow.attempt_count + 1, updated_at: now.toISOString() }).eq("id", recipientRow.id).eq("status", "queued").select("id").maybeSingle();
  if (claimed.error) throw new Error(claimed.error.message);
  if (!claimed.data) return { outcome: "busy" as const };

  const { data: invitation, error: invitationError } = await db.from("invitations")
    .select("id, display_name, normalized_phone, secure_token, table_number, contact_opt_out, rsvp_status, guest_group, source_tab")
    .eq("id", recipientRow.invitation_id).maybeSingle();
  if (invitationError) throw new Error(invitationError.message);
  const recipient = invitation?.normalized_phone ? whatsappRecipient(invitation.normalized_phone) : null;
  if (!invitation || !recipient || invitation.contact_opt_out || !campaignRecipientMatches(campaign.audience, campaign.guest_group_filter, invitation.rsvp_status, invitation.guest_group, campaign.guest_side_filter, invitation.source_tab)) {
    await db.from("message_campaign_recipients").update({ status: "skipped", last_error: "Recipient no longer matches the campaign audience.", processed_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", recipientRow.id);
  } else {
    const priorDelivery = await db.from("message_deliveries").select("id").eq("invitation_id", invitation.id).eq("message_kind", campaign.message_kind).eq("status", "sent").limit(1).maybeSingle();
    if (priorDelivery.error) throw new Error(priorDelivery.error.message);
    if (priorDelivery.data) {
      await db.from("message_campaign_recipients").update({ status: "skipped", last_error: "This message type was already sent.", processed_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", recipientRow.id);
    } else {
    const body = weddingMessage({ kind: campaign.message_kind, displayName: invitation.display_name, secureToken: invitation.secure_token, tableNumber: invitation.table_number });
    const deliveryId = randomUUID();
    const inserted = await db.from("message_deliveries").insert({ id: deliveryId, invitation_id: invitation.id, channel: "whatsapp_web", message_kind: campaign.message_kind, status: "pending", message_body: body });
    if (inserted.error) throw new Error(inserted.error.message);
    try {
      const result = await fallbackRequest<{ messageId: string }>("/v1/whatsapp/send", { method: "POST", timeoutMs: 20_000, body: { operationId: deliveryId, recipient, message: body, mediaUrl: weddingMessageMediaUrl(campaign.message_kind) } });
      const sentAt = new Date().toISOString();
      await db.from("message_deliveries").update({ status: "sent", provider_message_id: result.messageId, sent_at: sentAt, updated_at: sentAt }).eq("id", deliveryId);
      await db.from("message_campaign_recipients").update({ status: "sent", delivery_id: deliveryId, processed_at: sentAt, updated_at: sentAt }).eq("id", recipientRow.id);
    } catch (sendError) {
      const failedAt = new Date().toISOString();
      await db.from("message_deliveries").update({ status: "failed", error_code: "LOCAL_AGENT_UNAVAILABLE", error_message: "החיבור המקומי ל-WhatsApp אינו זמין.", failed_at: failedAt, updated_at: failedAt }).eq("id", deliveryId);
      await db.from("message_campaign_recipients").update({ status: "failed", delivery_id: deliveryId, last_error: sendError instanceof Error ? sendError.message.slice(0, 500) : "Send failed", processed_at: failedAt, updated_at: failedAt }).eq("id", recipientRow.id);
    }
    }
  }
  const delay = nextCampaignDelaySeconds(campaign.min_delay_seconds, campaign.max_delay_seconds);
  await db.from("message_campaigns").update({ status: "running", started_at: now.toISOString(), next_run_at: new Date(Date.now() + delay * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", campaign.id);
  return { outcome: "processed" as const, campaignId: campaign.id, delay };
}
