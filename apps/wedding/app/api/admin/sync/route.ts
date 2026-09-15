import { getAuthenticatedAdmin } from "@/lib/admin";
import { previewWeddingSync, synchronizeWeddingGuests } from "@/lib/sync";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  if (!(await getAuthenticatedAdmin())) return unauthorized();
  try {
    const preview = await previewWeddingSync();
    return Response.json({
      counts: preview.counts,
      guestTabNames: preview.guestTabNames,
      seatingTabName: preview.seatingTabName,
      generatedAt: preview.plan.generatedAt,
      conflicts: preview.plan.conflicts,
      mappingIssues: preview.plan.mappingIssues,
      updates: preview.plan.updates.map((item) => ({ sourceRowId: item.source.sourceRowId, displayName: item.source.displayName, changes: item.changes.map((change) => change.field) })),
      missing: preview.plan.missing.map((item) => ({ id: item.invitation.id, displayName: item.invitation.displayName })),
    });
  } catch (error) {
    console.error("Google Sheets sync preview API failed", error);
    return Response.json({ error: "Google Sheets synchronization is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await getAuthenticatedAdmin())) return unauthorized();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const result = await synchronizeWeddingGuests();
    return Response.json({ report: result.report });
  } catch (error) {
    console.error("Google Sheets sync API failed", error);
    return Response.json({ error: "Google Sheets synchronization is unavailable" }, { status: 503 });
  }
}
