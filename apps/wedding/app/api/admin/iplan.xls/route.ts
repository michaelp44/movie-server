import * as XLSX from "@e965/xlsx";
import { createAdminDataClient, getAuthenticatedAdmin } from "@/lib/admin";
import { createIplanWorkbook } from "@/lib/iplan-export";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAuthenticatedAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminDataClient();
  const { data, error } = await db
    .from("invitations")
    .select("display_name, number_invited, guest_group, primary_phone, normalized_phone, source_tab")
    .eq("missing_from_source", false)
    .order("display_name")
    .limit(1000);

  if (error) {
    console.error("iPlan export failed", error);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }

  const workbook = createIplanWorkbook((data ?? []).map((invitation) => ({
      displayName: invitation.display_name,
      numberInvited: invitation.number_invited,
      guestGroup: invitation.guest_group,
      phone: invitation.normalized_phone ?? invitation.primary_phone,
      sourceTab: invitation.source_tab,
    })));
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": 'attachment; filename="iplan-wedding-invitations.xls"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
