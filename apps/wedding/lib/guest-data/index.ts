import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isWeddingDemoEnabled } from "@/lib/env";
import {
  findDemoInvitationById,
  findDemoInvitationByPhone,
  findDemoInvitationByToken,
} from "@/lib/guest-data/demo";
import {
  parseBooleanSetting,
  toInvitationDTO,
  type InvitationQueryRecord,
} from "@/lib/guest-data/mapper";
import { readGuestSession } from "@/lib/guest-session";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { InvitationDTO } from "@/lib/types";

const INVITATION_SELECT =
  "id, display_name, number_invited, number_confirmed, rsvp_status, table_number, guests(first_name, last_name, guest_order)";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECURE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export class GuestDataError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Unable to ${operation}`);
    this.name = "GuestDataError";
    this.cause = cause;
  }
}

type WeddingSupabaseClient = SupabaseClient<Database>;

async function seatingPublishedWithClient(client: WeddingSupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from("site_settings")
    .select("value")
    .eq("key", "seating_published")
    .maybeSingle();

  if (error) {
    throw new GuestDataError("read seating publication state", error);
  }

  return parseBooleanSetting(data?.value);
}

async function invitationRecordById(
  client: WeddingSupabaseClient,
  invitationId: string,
): Promise<InvitationQueryRecord | null> {
  const { data, error } = await client
    .from("invitations")
    .select(INVITATION_SELECT)
    .eq("id", invitationId)
    .maybeSingle();

  if (error) {
    throw new GuestDataError("read invitation", error);
  }

  return data as InvitationQueryRecord | null;
}

async function dtoForId(
  client: WeddingSupabaseClient,
  invitationId: string,
): Promise<InvitationDTO | null> {
  const [record, seatingPublished] = await Promise.all([
    invitationRecordById(client, invitationId),
    seatingPublishedWithClient(client),
  ]);

  return record ? toInvitationDTO(record, seatingPublished) : null;
}

export async function findInvitationByPhone(phone: string): Promise<InvitationDTO | null> {
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) return null;

  if (isWeddingDemoEnabled()) {
    const demo = findDemoInvitationByPhone(normalized);
    return demo ? toInvitationDTO(demo.invitation, true) : null;
  }

  const client = createAdminClient();
  const { data: primary, error: primaryError } = await client
    .from("invitations")
    .select("id")
    .eq("normalized_phone", normalized)
    .maybeSingle();

  if (primaryError) {
    throw new GuestDataError("look up invitation", primaryError);
  }

  let invitationId = primary?.id;

  if (!invitationId) {
    const { data: guest, error: guestError } = await client
      .from("guests")
      .select("invitation_id")
      .eq("normalized_phone", normalized)
      .limit(1)
      .maybeSingle();

    if (guestError) {
      throw new GuestDataError("look up invitation guest", guestError);
    }
    invitationId = guest?.invitation_id;
  }

  return invitationId ? dtoForId(client, invitationId) : null;
}

export async function findInvitationById(invitationId: string): Promise<InvitationDTO | null> {
  if (!UUID_PATTERN.test(invitationId)) return null;

  if (isWeddingDemoEnabled()) {
    const demo = findDemoInvitationById(invitationId);
    return demo ? toInvitationDTO(demo.invitation, true) : null;
  }

  const client = createAdminClient({ optional: true });
  return client ? dtoForId(client, invitationId) : null;
}

export async function findInvitationBySecureToken(token: string): Promise<InvitationDTO | null> {
  if (!SECURE_TOKEN_PATTERN.test(token)) return null;

  if (isWeddingDemoEnabled()) {
    const demo = findDemoInvitationByToken(token);
    return demo ? toInvitationDTO(demo.invitation, true) : null;
  }

  const client = createAdminClient({ optional: true });
  if (!client) return null;
  const { data, error } = await client
    .from("invitations")
    .select("id")
    .eq("secure_token", token)
    .maybeSingle();

  if (error) {
    throw new GuestDataError("look up personalized invitation", error);
  }

  return data?.id ? dtoForId(client, data.id) : null;
}

export async function getCurrentInvitation(): Promise<InvitationDTO | null> {
  const session = await readGuestSession();
  if (!session) return null;
  try {
    return await findInvitationById(session.invitationId);
  } catch (error) {
    console.error("Guest identity lookup failed; continuing without personalization", error);
    return null;
  }
}

export async function isSeatingPublished(): Promise<boolean> {
  if (isWeddingDemoEnabled()) return true;
  const client = createAdminClient({ optional: true });
  return client ? seatingPublishedWithClient(client) : false;
}
