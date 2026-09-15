"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminDataClient, requireAdmin } from "@/lib/admin";
import { normalizeSheetPhone } from "@/lib/google-sheets";
import { synchronizeWeddingGuests } from "@/lib/sync";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import { parseTableNumber } from "@/lib/table";

function withNotice(path: string, notice: string): never {
  redirect(`${path}?notice=${encodeURIComponent(notice)}`);
}

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const invitationSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    displayName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30),
    numberInvited: z.coerce.number().int().min(1).max(30),
    numberConfirmed: z.coerce.number().int().min(0).max(30),
    rsvpStatus: z.enum(["pending", "confirmed", "declined", "maybe"]),
    tableNumber: z.string().trim().max(30).optional(),
    guestGroup: z.string().trim().max(80).optional(),
  })
  .refine((value) => value.numberConfirmed <= value.numberInvited, {
    message: "מספר המאשרים לא יכול להיות גדול ממספר המוזמנים.",
  });

export async function saveInvitationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = invitationSchema.safeParse({
    id: formData.get("id"),
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    numberInvited: formData.get("numberInvited"),
    numberConfirmed: formData.get("numberConfirmed"),
    rsvpStatus: formData.get("rsvpStatus"),
    tableNumber: formData.get("tableNumber"),
    guestGroup: formData.get("guestGroup"),
  });
  if (!parsed.success) withNotice("/admin/guests", parsed.error.issues[0]?.message ?? "הפרטים אינם תקינים.");
  const normalizedPhone = parsed.data.phone ? normalizeSheetPhone(parsed.data.phone) : null;
  if (parsed.data.phone && !normalizedPhone) withNotice("/admin/guests", "מספר הטלפון אינו מספר ישראלי תקין.");
  const tableNumber = parsed.data.tableNumber ? parseTableNumber(parsed.data.tableNumber) : null;
  if (parsed.data.tableNumber && !tableNumber) withNotice("/admin/guests", "מספר השולחן חייב להיות בין 1 ל-999.");

  const db = createAdminDataClient();
  if (tableNumber) {
    const tableResult = await db.from("wedding_tables").upsert(
      { table_number: tableNumber },
      { onConflict: "table_number", ignoreDuplicates: true },
    );
    assertNoError(tableResult.error);
  }
  const values = {
    display_name: parsed.data.displayName,
    primary_phone: parsed.data.phone || null,
    normalized_phone: normalizedPhone,
    number_invited: parsed.data.numberInvited,
    number_confirmed: parsed.data.numberConfirmed,
    rsvp_status: parsed.data.rsvpStatus,
    table_number: tableNumber,
    guest_group: parsed.data.guestGroup || null,
    updated_at: new Date().toISOString(),
  };
  const result = parsed.data.id
    ? await db.from("invitations").update(values).eq("id", parsed.data.id)
    : await db.from("invitations").insert({
        ...values,
        secure_token: randomBytes(32).toString("base64url"),
        source_row_id: null,
        missing_from_source: false,
      });
  assertNoError(result.error);
  revalidatePath("/admin");
  revalidatePath("/admin/guests");
  withNotice("/admin/guests", parsed.data.id ? "ההזמנה עודכנה." : "ההזמנה נוספה.");
}

const tableSchema = z.object({
  tableNumber: z.string().trim().min(1).max(30),
  name: z.string().trim().max(80).optional(),
  capacity: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]),
});

export async function saveTableAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = tableSchema.safeParse({
    tableNumber: formData.get("tableNumber"),
    name: formData.get("name"),
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) withNotice("/admin/tables", "פרטי השולחן אינם תקינים.");
  const tableNumber = parseTableNumber(parsed.data.tableNumber);
  if (!tableNumber) withNotice("/admin/tables", "מספר השולחן חייב להיות בין 1 ל-999.");
  const db = createAdminDataClient();
  const { error } = await db.from("wedding_tables").upsert(
    {
      table_number: tableNumber,
      name: parsed.data.name || null,
      capacity: parsed.data.capacity === "" ? null : parsed.data.capacity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "table_number" },
  );
  assertNoError(error);
  revalidatePath("/admin/tables");
  withNotice("/admin/tables", "השולחן נשמר.");
}

export async function setSiteFlagAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!["seating_published", "gallery_published"].includes(key)) throw new Error("Invalid setting key.");
  const enabled = formData.get("enabled") === "true";
  const db = createAdminDataClient();
  const { error } = await db
    .from("site_settings")
    .upsert({ key, value: enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });
  assertNoError(error);
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  withNotice("/admin/settings", enabled ? "הפרסום הופעל." : "הפרסום הושהה.");
}

export async function moderatePhotoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const decision = z.enum(["approve", "reject"]).parse(formData.get("decision"));
  const db = createAdminDataClient();
  const { error } = await db
    .from("photo_uploads")
    .update({
      approved: decision === "approve",
      rejected: decision === "reject",
      moderated_at: new Date().toISOString(),
      moderated_by: admin.id,
    })
    .eq("id", id);
  assertNoError(error);
  revalidatePath("/admin/photos");
  revalidatePath("/photos");
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const db = createAdminDataClient();
  const { data, error } = await db.from("photo_uploads").select("storage_path").eq("id", id).single();
  assertNoError(error);
  const storageResult = await db.storage.from(WEDDING_MEDIA_BUCKET).remove([String(data?.storage_path)]);
  assertNoError(storageResult.error);
  const deleteResult = await db.from("photo_uploads").delete().eq("id", id);
  assertNoError(deleteResult.error);
  revalidatePath("/admin/photos");
  revalidatePath("/photos");
}

export async function moderateGuestbookAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const approved = formData.get("approved") === "true";
  const db = createAdminDataClient();
  const { error } = await db.from("guestbook_messages").update({
    approved,
    rejected: !approved,
    moderated_at: new Date().toISOString(),
    moderated_by: admin.id,
  }).eq("id", id);
  assertNoError(error);
  revalidatePath("/admin/guestbook");
}

export async function deleteSongRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const db = createAdminDataClient();
  const { error } = await db.from("song_requests").delete().eq("id", id);
  assertNoError(error);
  revalidatePath("/admin/songs");
}

export async function runGuestSyncAction(formData: FormData): Promise<void> {
  await requireAdmin();
  if (formData.get("confirmation") !== "apply") throw new Error("A preview confirmation is required.");
  let report;
  try {
    ({ report } = await synchronizeWeddingGuests());
  } catch (error) {
    console.error("Google Sheets synchronization failed", error);
    withNotice("/admin/sync", "לא הצלחנו לקרוא או לסנכרן את הגיליון. בדקו את החיבור וההרשאות ונסו שוב.");
  }
  revalidatePath("/admin", "layout");
  withNotice(
    "/admin/sync",
    `${report.processed} הזמנות עובדו · ${report.added} חדשות · ${report.updated} עודכנו · ${report.errors} שגיאות`,
  );
}

export async function rotateInvitationTokenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const db = createAdminDataClient();
  const { error } = await db
    .from("invitations")
    .update({ secure_token: randomBytes(32).toString("base64url"), updated_at: new Date().toISOString() })
    .eq("id", id);
  assertNoError(error);
  revalidatePath("/admin/qr");
  withNotice("/admin/qr", "הקישור האישי הוחלף. הקישור הישן אינו פעיל עוד.");
}
