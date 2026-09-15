import { getAuthenticatedAdmin } from "@/lib/admin";
import { previewWeddingSync, synchronizeWeddingGuests } from "@/lib/sync";

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function unauthorized() {
  return privateJson({ error: "Unauthorized" }, 401);
}

export async function GET() {
  if (!(await getAuthenticatedAdmin())) return unauthorized();
  try {
    const preview = await previewWeddingSync();
    return privateJson({
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
    return privateJson({ error: "Google Sheets synchronization is unavailable" }, 503);
  }
}

export async function POST(request: Request) {
  if (!(await getAuthenticatedAdmin())) return unauthorized();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return privateJson({ error: "Invalid origin" }, 403);
  try {
    const result = await synchronizeWeddingGuests();
    return privateJson({ report: result.report });
  } catch (error) {
    console.error("Google Sheets sync API failed", error);
    return privateJson({ error: "Google Sheets synchronization is unavailable" }, 503);
  }
}
