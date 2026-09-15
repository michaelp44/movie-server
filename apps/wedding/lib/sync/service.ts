import "server-only";

import {
  applySeatingSheet,
  fetchWeddingSheetData,
  mapGuestSheet,
  mappingConfigFromEnvironment,
} from "@/lib/google-sheets";

import { applySyncPlan } from "./apply";
import { buildSyncPlan, countsForPlan } from "./planner";
import { SupabaseSyncRepository } from "./supabase-repository";
import type { SyncPlan, SyncRepository } from "./types";

export interface SyncPreview {
  plan: SyncPlan;
  counts: ReturnType<typeof countsForPlan>;
  guestTabNames: string[];
  seatingTabName?: string;
}

export async function previewWeddingSync(
  repository: SyncRepository = new SupabaseSyncRepository(),
  logPreview = true,
): Promise<SyncPreview> {
  const data = await fetchWeddingSheetData();
  const config = mappingConfigFromEnvironment();
  const perTab = data.guestSheets.map(({ tabName, values }) => {
    const mapped = mapGuestSheet(values, config);
    return {
      ...mapped,
      invitations: mapped.invitations.map((invitation) => ({
        ...invitation,
        sourceTab: tabName,
        sourceRowId: `${tabName}:${invitation.sourceRowId}`,
      })),
      issues: mapped.issues.map((issue) => ({ ...issue, message: `${tabName}: ${issue.message}` })),
    };
  });
  const mapped = applySeatingSheet({
    invitations: perTab.flatMap((result) => result.invitations),
    issues: perTab.flatMap((result) => result.issues),
    resolvedHeaders: {},
    rawHeaders: [],
  }, data.seatingValues, config);
  const existing = await repository.loadInvitations();
  const plan = buildSyncPlan(mapped.invitations, existing, mapped.issues);
  if (logPreview) await repository.startRun?.("preview", plan);
  return {
    plan,
    counts: countsForPlan(plan),
    guestTabNames: data.guestSheets.map((sheet) => sheet.tabName),
    seatingTabName: data.seatingTabName,
  };
}

export async function synchronizeWeddingGuests(repository: SyncRepository = new SupabaseSyncRepository()) {
  const preview = await previewWeddingSync(repository, false);
  const report = await applySyncPlan(preview.plan, repository);
  return { ...preview, report };
}
