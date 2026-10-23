import { getAuthenticatedAdmin, listAdminRsvpInvitations } from "@/lib/admin";

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await getAuthenticatedAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const invitations = await listAdminRsvpInvitations();
  const rows = [
    ["Invitation", "Phone", "Invited", "Confirmed", "RSVP status", "RSVP source", "RSVP updated", "RSVP note", "Last message status", "Last message sent"],
    ...invitations.map((item) => [
      item.displayName,
      item.normalizedPhone ?? item.primaryPhone,
      item.numberInvited,
      item.numberConfirmed,
      item.rsvpStatus,
      item.rsvpSource,
      item.rsvpUpdatedAt,
      item.rsvpNote,
      item.lastDelivery?.status,
      item.lastDelivery?.sentAt,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding-rsvp.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
