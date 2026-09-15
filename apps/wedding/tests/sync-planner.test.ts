import { describe, expect, it } from "vitest";

import type { MappedInvitation } from "@/lib/google-sheets";
import { applySyncPlan, buildSyncPlan, type ExistingInvitation, type SyncRepository } from "@/lib/sync";

function source(overrides: Partial<MappedInvitation> = {}): MappedInvitation {
  return {
    sourceRowId: "sheet-1",
    sourceRowNumber: 2,
    displayName: "דניאל ונועה",
    primaryPhone: "0501234567",
    normalizedPhone: "+972501234567",
    numberInvited: 2,
    numberConfirmed: 2,
    rsvpStatus: "confirmed",
    tableNumber: "14",
    guestGroup: "friends",
    sourcePayload: {},
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingInvitation> = {}): ExistingInvitation {
  return {
    id: "db-1",
    sourceRowId: "sheet-1",
    displayName: "דניאל ונועה",
    primaryPhone: "0501234567",
    normalizedPhone: "+972501234567",
    numberInvited: 2,
    numberConfirmed: 1,
    rsvpStatus: "confirmed",
    tableNumber: null,
    guestGroup: "friends",
    ...overrides,
  };
}

describe("sync plan", () => {
  it("creates a field-level update and preserves database identity", () => {
    const plan = buildSyncPlan([source()], [existing()], [], new Date("2026-01-01T00:00:00Z"));
    expect(plan.additions).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.id).toBe("db-1");
    expect(plan.updates[0]?.changes.map((change) => change.field)).toEqual(["numberConfirmed", "tableNumber"]);
  });

  it("matches an existing invitation by canonical phone when source ID is newly introduced", () => {
    const plan = buildSyncPlan([source()], [existing({ sourceRowId: null })]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.additions).toHaveLength(0);
  });

  it("flags missing source-managed records but not manually-created records", () => {
    const plan = buildSyncPlan([], [existing(), existing({ id: "manual", sourceRowId: null, normalizedPhone: "+972522222222" })]);
    expect(plan.missing.map((item) => item.invitation.id)).toEqual(["db-1"]);
  });

  it("reports cross-identity conflicts without flagging the involved records as missing", () => {
    const plan = buildSyncPlan(
      [source()],
      [existing(), existing({ id: "db-2", sourceRowId: "sheet-2", normalizedPhone: "+972501234567" })],
    );
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.missing).toHaveLength(0);
  });
});

describe("sync apply", () => {
  it("never deletes missing records and records operation errors", async () => {
    const calls: string[] = [];
    const repository: SyncRepository = {
      loadInvitations: async () => [],
      insertInvitation: async () => { calls.push("insert"); },
      updateInvitation: async () => { throw new Error("update failed"); },
      flagMissing: async () => { calls.push("flag"); },
    };
    const plan = buildSyncPlan(
      [source({ sourceRowId: "new", normalizedPhone: "+972533333333" }), source()],
      [existing(), existing({ id: "missing", sourceRowId: "old", normalizedPhone: "+972544444444" })],
    );
    const report = await applySyncPlan(plan, repository);
    expect(calls).toEqual(["insert", "flag"]);
    expect(report.operationErrors).toHaveLength(1);
    expect(report.errors).toBe(1);
    expect("deleteInvitation" in repository).toBe(false);
  });
});
