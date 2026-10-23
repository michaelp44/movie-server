import { describe, expect, it } from "vitest";
import { columnLetters, parseSyncedSourceRowId } from "@/lib/google-sheets/writeback";

describe("Google Sheets RSVP write-back", () => {
  it("converts zero-based columns to A1 letters", () => {
    expect(columnLetters(0)).toBe("A");
    expect(columnLetters(25)).toBe("Z");
    expect(columnLetters(26)).toBe("AA");
    expect(columnLetters(51)).toBe("AZ");
  });

  it("splits a synchronized source into its tab and stable row identity", () => {
    expect(parseSyncedSourceRowId("מוזמנים - מיכאל:name:מיכאל בדיקה", ["מוזמנים - מיכאל", "מוזמנים - שובל"])).toEqual({
      sourceTab: "מוזמנים - מיכאל",
      rowIdentity: "name:מיכאל בדיקה",
    });
  });

  it("rejects sources outside configured guest tabs", () => {
    expect(() => parseSyncedSourceRowId("טאב אחר:name:test", ["מוזמנים - מיכאל"])).toThrow(/allowed guest tab/);
  });
});
