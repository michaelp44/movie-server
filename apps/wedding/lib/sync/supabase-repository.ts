import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getGoogleSheetsConfig } from "@/lib/env";
import type { MappedInvitation } from "@/lib/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { Json } from "@/lib/types";

import { countsForPlan } from "./planner";
import type { ExistingInvitation, SyncApplyError, SyncCounts, SyncPlan, SyncRepository } from "./types";

function jsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function sourcePayload(source: MappedInvitation, fallbackSourceTab: string) {
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(source.sourcePayload))
    .digest("hex");

  return {
    source_row_id: source.sourceRowId,
    display_name: source.displayName,
    primary_phone: source.primaryPhone,
    normalized_phone: source.normalizedPhone,
    number_invited: source.numberInvited,
    number_confirmed: source.numberConfirmed,
    rsvp_status: source.rsvpStatus,
    table_number: source.tableNumber,
    guest_group: source.guestGroup,
    source_tab: source.sourceTab ?? fallbackSourceTab,
    source_payload: jsonValue(source.sourcePayload),
    source_hash: sourceHash,
    missing_from_source: false,
    sync_managed: true,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseSyncRepository implements SyncRepository {
  private readonly source = getGoogleSheetsConfig();

  constructor(private readonly client: SupabaseClient<Database> = createAdminClient()) {}

  private async ensureTable(tableNumber: string | null): Promise<void> {
    if (!tableNumber) return;
    const { error } = await this.client
      .from("wedding_tables")
      .upsert({ table_number: tableNumber }, { onConflict: "table_number", ignoreDuplicates: true });
    assertNoError(error);
  }

  async loadInvitations(): Promise<ExistingInvitation[]> {
    const { data, error } = await this.client
      .from("invitations")
      .select(
        "id, source_row_id, display_name, primary_phone, normalized_phone, number_invited, number_confirmed, rsvp_status, table_number, guest_group, missing_from_source",
      );
    assertNoError(error);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      sourceRowId: row.source_row_id ? String(row.source_row_id) : null,
      displayName: String(row.display_name ?? ""),
      primaryPhone: row.primary_phone ? String(row.primary_phone) : null,
      normalizedPhone: row.normalized_phone ? String(row.normalized_phone) : null,
      numberInvited: Number(row.number_invited ?? 0),
      numberConfirmed: Number(row.number_confirmed ?? 0),
      rsvpStatus: row.rsvp_status,
      tableNumber: row.table_number ? String(row.table_number) : null,
      guestGroup: row.guest_group ? String(row.guest_group) : null,
      missingFromSource: Boolean(row.missing_from_source),
    })) as ExistingInvitation[];
  }

  async insertInvitation(source: MappedInvitation): Promise<void> {
    await this.ensureTable(source.tableNumber);
    const { error } = await this.client.from("invitations").insert(sourcePayload(source, this.source.guestTabNames[0]!));
    assertNoError(error);
  }

  async updateInvitation(id: string, source: MappedInvitation): Promise<void> {
    await this.ensureTable(source.tableNumber);
    const { error } = await this.client.from("invitations").update(sourcePayload(source, this.source.guestTabNames[0]!)).eq("id", id);
    assertNoError(error);
  }

  async flagMissing(id: string): Promise<void> {
    const { error } = await this.client
      .from("invitations")
      .update({ missing_from_source: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    assertNoError(error);
  }

  async startRun(mode: "preview" | "apply", plan: SyncPlan): Promise<string | undefined> {
    const counts = countsForPlan(plan);
    const { data, error } = await this.client
      .from("sync_runs")
      .insert({
        mode,
        status: mode === "preview" ? "completed" : "running",
        source_sheet_id: this.source.sheetId,
        source_tab: this.source.guestTabNames.join(", "),
        processed_count: counts.processed,
        addition_count: counts.added,
        update_count: counts.updated,
        unchanged_count: counts.unchanged,
        conflict_count: counts.conflicts,
        missing_count: counts.missing,
        error_count: counts.errors,
        report: jsonValue({ conflicts: plan.conflicts, mappingIssues: plan.mappingIssues }),
        started_at: new Date().toISOString(),
        completed_at: mode === "preview" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    assertNoError(error);
    const runId = data?.id ? String(data.id) : undefined;
    if (!runId) return undefined;

    const items: Database["public"]["Tables"]["sync_run_items"]["Insert"][] = [
      ...plan.additions.map((item) => ({
        sync_run_id: runId,
        source_row_id: item.source.sourceRowId,
        action: "addition" as const,
        display_name: item.source.displayName,
        source_payload: jsonValue(item.source.sourcePayload),
      })),
      ...plan.updates.map((item) => ({
        sync_run_id: runId,
        invitation_id: item.id,
        source_row_id: item.source.sourceRowId,
        action: "update" as const,
        display_name: item.source.displayName,
        changes: jsonValue(item.changes),
        source_payload: jsonValue(item.source.sourcePayload),
      })),
      ...plan.unchanged.map((item) => ({
        sync_run_id: runId,
        invitation_id: item.id,
        source_row_id: item.source.sourceRowId,
        action: "unchanged" as const,
        display_name: item.source.displayName,
      })),
      ...plan.missing.map((item) => ({
        sync_run_id: runId,
        invitation_id: item.invitation.id,
        source_row_id: item.invitation.sourceRowId,
        action: "missing" as const,
        display_name: item.invitation.displayName,
      })),
      ...plan.conflicts.map((item) => ({
        sync_run_id: runId,
        source_row_id: item.sourceRowId ?? null,
        action: "conflict" as const,
        changes: jsonValue(item),
        error: item.message,
      })),
      ...plan.mappingIssues.map((item) => ({
        sync_run_id: runId,
        source_row_id: item.rowNumber ? `row:${item.rowNumber}` : null,
        action: "error" as const,
        changes: jsonValue(item),
        error: item.message,
      })),
    ];
    if (items.length) {
      const { error: itemError } = await this.client.from("sync_run_items").insert(items);
      assertNoError(itemError);
    }
    return runId;
  }

  async finishRun(
    runId: string,
    report: SyncCounts & { operationErrors?: SyncApplyError[] },
  ): Promise<void> {
    const { error } = await this.client
      .from("sync_runs")
      .update({
        status: report.errors ? "completed_with_errors" : "completed",
        processed_count: report.processed,
        addition_count: report.added,
        update_count: report.updated,
        unchanged_count: report.unchanged,
        conflict_count: report.conflicts,
        missing_count: report.missing,
        error_count: report.errors,
        report: jsonValue(report),
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    assertNoError(error);
  }

  async failRun(runId: string, errorValue: unknown): Promise<void> {
    const { error } = await this.client
      .from("sync_runs")
      .update({
        status: "failed",
        error: errorValue instanceof Error ? errorValue.message : "Unknown synchronization error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    assertNoError(error);
  }
}
