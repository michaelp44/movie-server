import { describe, expect, it } from "vitest";

import {
  applySeatingSheet,
  mapGuestSheet,
  normalizeSheetPhone,
} from "@/lib/google-sheets";

describe("Google Sheets mapping", () => {
  it.each([
    "0501234567",
    "050-123-4567",
    "050 123 4567",
    "+972501234567",
    "972501234567",
  ])("normalizes %s to one canonical phone", (phone) => {
    expect(normalizeSheetPhone(phone)).toBe("+972501234567");
  });

  it("maps by raw headers regardless of column position", () => {
    const result = mapGuestSheet([
      ["סטטוס הגעה", "כמות מוזמנים", "שם להזמנה", "קבוצה", "טלפון", "מספר מאושרים", "עמודת הערות"],
      ["כן", "2", "דניאל ונועה", "חברים", "050-123-4567", "2", "טקסט שנשמר במקור"],
    ], { aliases: { guestGroup: ["קבוצה"] } });

    expect(result.issues).toEqual([]);
    expect(result.invitations[0]).toMatchObject({
      displayName: "דניאל ונועה",
      normalizedPhone: "+972501234567",
      numberInvited: 2,
      numberConfirmed: 2,
      rsvpStatus: "confirmed",
      guestGroup: "חברים",
    });
    expect(result.invitations[0]?.sourcePayload["עמודת הערות"]).toBe("טקסט שנשמר במקור");
  });

  it("supports exact configurable headers", () => {
    const result = mapGuestSheet(
      [["Household", "Whatsapp", "Seats"], ["משפחת כהן", "972501234567", "4"]],
      { columns: { displayName: "Household", primaryPhone: "Whatsapp", numberInvited: "Seats" } },
    );
    expect(result.invitations[0]?.numberInvited).toBe(4);
    expect(result.resolvedHeaders.displayName).toBe("Household");
  });

  it("detects the real workbook header row and its current Hebrew columns", () => {
    const result = mapGuestSheet([
      ["רשימת מוזמנים"],
      ["הסבר לפני הטבלה"],
      [],
      ["שם ההזמנה / משפחה", "כמות פוטנציאלית", "קבוצה", "אישור הגעה", "מגיעים בפועל", "טלפון", "שולחן"],
      ["דניאל ונועה", "2", "חברים", "מגיע", "2", "050-123-4567", "14"],
    ]);

    expect(result.issues).toEqual([]);
    expect(result.invitations[0]).toMatchObject({
      sourceRowNumber: 5,
      displayName: "דניאל ונועה",
      numberInvited: 2,
      numberConfirmed: 2,
      rsvpStatus: "confirmed",
      tableNumber: "14",
    });
  });

  it("keeps real-sheet invitations that do not have a phone yet", () => {
    const result = mapGuestSheet([
      ["שם ההזמנה / משפחה", "כמות פוטנציאלית", "טלפון"],
      ["משפחת ישראלי", "4", ""],
    ]);

    expect(result.issues).toEqual([]);
    expect(result.invitations[0]).toMatchObject({
      displayName: "משפחת ישראלי",
      primaryPhone: null,
      normalizedPhone: null,
      numberInvited: 4,
      sourceRowId: "name:משפחת ישראלי",
    });
  });

  it("keeps an invitation with an invalid phone but reports it for review", () => {
    const result = mapGuestSheet([
      ["שם ההזמנה / משפחה", "טלפון"],
      ["משפחת ישראלי", "1234"],
    ]);

    expect(result.invitations[0]).toMatchObject({
      displayName: "משפחת ישראלי",
      primaryPhone: "1234",
      normalizedPhone: null,
    });
    expect(result.issues).toEqual([expect.objectContaining({ code: "invalid_phone", rowNumber: 2 })]);
  });

  it("overlays a separate seating tab without requiring fixed columns", () => {
    const guests = mapGuestSheet([
      ["טלפון", "שם להזמנה"],
      ["0501234567", "דניאל ונועה"],
    ]);
    const result = applySeatingSheet(guests, [
      ["שולחן", "שם להזמנה"],
      ["14", "דניאל ונועה"],
    ]);
    expect(result.invitations[0]?.tableNumber).toBe("14");
    expect(result.issues).toEqual([]);
  });

  it("matches a prefixed multi-tab source ID to the raw ID in the seating tab", () => {
    const guests = mapGuestSheet([
      ["מזהה", "טלפון", "שם להזמנה"],
      ["family-17", "0501234567", "דניאל ונועה"],
    ]);
    const invitation = guests.invitations[0]!;
    invitation.sourceTab = "אורחים";
    invitation.sourceRowId = `אורחים:${invitation.sourceRowId}`;

    const result = applySeatingSheet(guests, [
      ["מזהה", "שולחן"],
      ["family-17", "14"],
    ]);

    expect(result.invitations[0]?.tableNumber).toBe("14");
    expect(result.issues).toEqual([]);
  });

  it("does not assign seating by an ambiguous display name", () => {
    const first = mapGuestSheet([
      ["טלפון", "שם להזמנה"],
      ["0501234567", "משפחת כהן"],
    ]).invitations[0]!;
    const second = mapGuestSheet([
      ["טלפון", "שם להזמנה"],
      ["0521234567", "משפחת כהן"],
    ]).invitations[0]!;

    const result = applySeatingSheet({
      invitations: [first, second],
      issues: [],
      resolvedHeaders: {},
      rawHeaders: [],
    }, [
      ["שם להזמנה", "שולחן"],
      ["משפחת כהן", "14"],
    ]);

    expect(result.invitations.every((invitation) => invitation.tableNumber === null)).toBe(true);
    expect(result.issues).toEqual([expect.objectContaining({ code: "ambiguous_seating", rowNumber: 2 })]);
  });

  it("rejects contradictory table rows for the same invitation", () => {
    const guests = mapGuestSheet([
      ["טלפון", "שם להזמנה"],
      ["0501234567", "דניאל ונועה"],
    ]);
    const result = applySeatingSheet(guests, [
      ["טלפון", "שולחן"],
      ["0501234567", "14"],
      ["0501234567", "18"],
    ]);

    expect(result.invitations[0]?.tableNumber).toBeNull();
    expect(result.issues).toEqual([expect.objectContaining({ code: "ambiguous_seating", rowNumber: 3 })]);
  });

  it("reports duplicates instead of silently overwriting them", () => {
    const result = mapGuestSheet([
      ["שם", "טלפון"],
      ["אורח ראשון", "0501234567"],
      ["אורח כפול", "+972501234567"],
    ]);
    expect(result.invitations).toHaveLength(1);
    expect(result.issues.some((issue) => issue.code === "duplicate_identity")).toBe(true);
  });
});
