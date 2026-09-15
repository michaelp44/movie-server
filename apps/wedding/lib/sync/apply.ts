import { countsForPlan } from "./planner";
import type { SyncApplyError, SyncApplyReport, SyncPlan, SyncRepository } from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown synchronization error";
}

export async function applySyncPlan(plan: SyncPlan, repository: SyncRepository): Promise<SyncApplyReport> {
  const startedAt = new Date().toISOString();
  const runId = await repository.startRun?.("apply", plan);
  const operationErrors: SyncApplyError[] = [];
  let added = 0;
  let updated = 0;
  let missing = 0;

  try {
    for (const item of plan.additions) {
      try {
        await repository.insertInvitation(item.source);
        added += 1;
      } catch (error) {
        operationErrors.push({
          operation: "add",
          identity: item.source.sourceRowId,
          message: errorMessage(error),
        });
      }
    }
    for (const item of plan.updates) {
      try {
        await repository.updateInvitation(item.id, item.source);
        updated += 1;
      } catch (error) {
        operationErrors.push({ operation: "update", identity: item.id, message: errorMessage(error) });
      }
    }
    // Deliberately never delete. A source omission only sets a review flag.
    for (const item of plan.missing) {
      if (item.invitation.missingFromSource) {
        missing += 1;
        continue;
      }
      try {
        await repository.flagMissing(item.invitation.id);
        missing += 1;
      } catch (error) {
        operationErrors.push({
          operation: "flag_missing",
          identity: item.invitation.id,
          message: errorMessage(error),
        });
      }
    }

    const planned = countsForPlan(plan);
    const report: SyncApplyReport = {
      ...planned,
      added,
      updated,
      missing,
      errors: planned.errors + operationErrors.length,
      runId,
      mode: "apply",
      startedAt,
      completedAt: new Date().toISOString(),
      operationErrors,
    };
    if (runId) await repository.finishRun?.(runId, report);
    return report;
  } catch (error) {
    if (runId) await repository.failRun?.(runId, error);
    throw error;
  }
}
