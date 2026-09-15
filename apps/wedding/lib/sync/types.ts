import type { MappedInvitation, MappingIssue, RsvpStatus } from "@/lib/google-sheets";

export interface ExistingInvitation {
  id: string;
  sourceRowId: string | null;
  displayName: string;
  primaryPhone: string | null;
  normalizedPhone: string | null;
  numberInvited: number;
  numberConfirmed: number;
  rsvpStatus: RsvpStatus;
  tableNumber: string | null;
  guestGroup: string | null;
  missingFromSource?: boolean;
}

export type SyncManagedField =
  | "displayName"
  | "primaryPhone"
  | "normalizedPhone"
  | "numberInvited"
  | "numberConfirmed"
  | "rsvpStatus"
  | "tableNumber"
  | "guestGroup";

export interface SyncChange {
  field: SyncManagedField;
  before: string | number | null;
  after: string | number | null;
}

export interface SyncAddition {
  kind: "add";
  source: MappedInvitation;
}

export interface SyncUpdate {
  kind: "update";
  id: string;
  source: MappedInvitation;
  changes: SyncChange[];
}

export interface SyncUnchanged {
  kind: "unchanged";
  id: string;
  source: MappedInvitation;
}

export interface SyncMissing {
  kind: "missing";
  invitation: ExistingInvitation;
}

export interface SyncConflict {
  sourceRowNumber?: number;
  sourceRowId?: string;
  message: string;
}

export interface SyncPlan {
  additions: SyncAddition[];
  updates: SyncUpdate[];
  unchanged: SyncUnchanged[];
  missing: SyncMissing[];
  conflicts: SyncConflict[];
  mappingIssues: MappingIssue[];
  generatedAt: string;
  sourceCount: number;
}

export interface SyncCounts {
  processed: number;
  added: number;
  updated: number;
  unchanged: number;
  missing: number;
  conflicts: number;
  errors: number;
}

export interface SyncApplyError {
  operation: "add" | "update" | "flag_missing";
  identity: string;
  message: string;
}

export interface SyncApplyReport extends SyncCounts {
  runId?: string;
  mode: "apply";
  startedAt: string;
  completedAt: string;
  operationErrors: SyncApplyError[];
}

export interface SyncRepository {
  loadInvitations(): Promise<ExistingInvitation[]>;
  insertInvitation(source: MappedInvitation): Promise<void>;
  updateInvitation(id: string, source: MappedInvitation): Promise<void>;
  flagMissing(id: string): Promise<void>;
  startRun?(mode: "preview" | "apply", plan: SyncPlan): Promise<string | undefined>;
  finishRun?(runId: string, report: SyncCounts & { operationErrors?: SyncApplyError[] }): Promise<void>;
  failRun?(runId: string, error: unknown): Promise<void>;
}
