import type { MappedInvitation, MappingIssue } from "@/lib/google-sheets";

import type {
  ExistingInvitation,
  SyncChange,
  SyncConflict,
  SyncManagedField,
  SyncPlan,
} from "./types";

const managedFields: SyncManagedField[] = [
  "displayName",
  "primaryPhone",
  "normalizedPhone",
  "numberInvited",
  "numberConfirmed",
  "rsvpStatus",
  "tableNumber",
  "guestGroup",
];

function changesFor(source: MappedInvitation, existing: ExistingInvitation): SyncChange[] {
  return managedFields.flatMap((field) => {
    const before = existing[field];
    const after = source[field];
    return before === after ? [] : [{ field, before, after }];
  });
}

function uniqueIndex(
  existing: ExistingInvitation[],
  select: (invitation: ExistingInvitation) => string | null,
): { values: Map<string, ExistingInvitation>; duplicates: Set<string> } {
  const values = new Map<string, ExistingInvitation>();
  const duplicates = new Set<string>();
  for (const invitation of existing) {
    const key = select(invitation);
    if (!key) continue;
    if (values.has(key)) duplicates.add(key);
    else values.set(key, invitation);
  }
  return { values, duplicates };
}

export function buildSyncPlan(
  source: MappedInvitation[],
  existing: ExistingInvitation[],
  mappingIssues: MappingIssue[] = [],
  now = new Date(),
): SyncPlan {
  const bySourceId = uniqueIndex(existing, (item) => item.sourceRowId);
  const byPhone = uniqueIndex(existing, (item) => item.normalizedPhone);
  const matchedIds = new Set<string>();
  const sourceIds = new Set<string>();
  const sourcePhones = new Set<string>();
  const conflicts: SyncConflict[] = [];
  const additions: SyncPlan["additions"] = [];
  const updates: SyncPlan["updates"] = [];
  const unchanged: SyncPlan["unchanged"] = [];

  for (const row of source) {
    if (sourceIds.has(row.sourceRowId) || sourcePhones.has(row.normalizedPhone)) {
      conflicts.push({
        sourceRowNumber: row.sourceRowNumber,
        sourceRowId: row.sourceRowId,
        message: "Duplicate invitation identity in the source data.",
      });
      continue;
    }
    sourceIds.add(row.sourceRowId);
    sourcePhones.add(row.normalizedPhone);

    if (bySourceId.duplicates.has(row.sourceRowId) || byPhone.duplicates.has(row.normalizedPhone)) {
      conflicts.push({
        sourceRowNumber: row.sourceRowNumber,
        sourceRowId: row.sourceRowId,
        message: "The source row matches duplicate identities in the database.",
      });
      continue;
    }
    const sourceIdMatch = bySourceId.values.get(row.sourceRowId);
    const phoneMatch = byPhone.values.get(row.normalizedPhone);
    if (sourceIdMatch && phoneMatch && sourceIdMatch.id !== phoneMatch.id) {
      conflicts.push({
        sourceRowNumber: row.sourceRowNumber,
        sourceRowId: row.sourceRowId,
        message: "The source row ID and phone number match two different invitations.",
      });
      continue;
    }
    const match = sourceIdMatch ?? phoneMatch;
    if (!match) {
      additions.push({ kind: "add", source: row });
      continue;
    }
    matchedIds.add(match.id);
    const changes = changesFor(row, match);
    if (changes.length || match.missingFromSource) {
      updates.push({ kind: "update", id: match.id, source: row, changes });
    } else {
      unchanged.push({ kind: "unchanged", id: match.id, source: row });
    }
  }

  const missing = existing
    .filter(
      (item) =>
        item.sourceRowId &&
        !matchedIds.has(item.id) &&
        !sourceIds.has(item.sourceRowId) &&
        !sourcePhones.has(item.normalizedPhone),
    )
    .map((invitation) => ({ kind: "missing" as const, invitation }));

  return {
    additions,
    updates,
    unchanged,
    missing,
    conflicts,
    mappingIssues,
    generatedAt: now.toISOString(),
    sourceCount: source.length,
  };
}

export function countsForPlan(plan: SyncPlan) {
  return {
    processed: plan.sourceCount,
    added: plan.additions.length,
    updated: plan.updates.length,
    unchanged: plan.unchanged.length,
    missing: plan.missing.length,
    conflicts: plan.conflicts.length,
    errors: plan.mappingIssues.length,
  };
}
