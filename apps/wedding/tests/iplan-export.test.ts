import * as XLSX from "@e965/xlsx";
import { describe, expect, it } from "vitest";
import { createIplanWorkbook, formatIsraeliMobileForIplan, inferIplanSide, invitationToIplanRow } from "@/lib/iplan-export";

describe("iPlan export", () => {
  it("formats canonical Israeli mobile numbers", () => {
    expect(formatIsraeliMobileForIplan("+972503062269")).toBe("050-3062269");
    expect(formatIsraeliMobileForIplan("0503062269")).toBe("050-3062269");
    expect(formatIsraeliMobileForIplan("503062269")).toBe("050-3062269");
    expect(formatIsraeliMobileForIplan("=+972 50-306-2269")).toBe("050-3062269");
  });

  it("maps the source sheet to the wedding side", () => {
    expect(inferIplanSide("מוזמנים - מיכאל")).toBe("חתן");
    expect(inferIplanSide("מוזמנים - שובל")).toBe("כלה");
    expect(inferIplanSide(null)).toBe("");
  });

  it("creates a twelve-column iPlan row and leaves unavailable fields empty", () => {
    const row = invitationToIplanRow({
      displayName: "פרנסיס ודוד לוין",
      numberInvited: 2,
      guestGroup: "אחר",
      phone: null,
      sourceTab: "מוזמנים - מיכאל",
    });
    expect(row).toHaveLength(12);
    expect(row.slice(0, 5)).toEqual(["פרנסיס ודוד לוין", 2, "חתן", "אחר", ""]);
    expect(row.slice(5)).toEqual(["", "", "", "", "", "", ""]);
  });

  it("writes text fields as literal workbook values", () => {
    const row = invitationToIplanRow({
      displayName: "=HYPERLINK(\"bad\")",
      numberInvited: 1,
      guestGroup: "+group",
      phone: null,
      sourceTab: null,
    });
    expect(row[0]).toBe("=HYPERLINK(\"bad\")");
    expect(row[3]).toBe("+group");
  });

  it("creates a legacy Excel workbook matching the iPlan template", () => {
    const workbook = createIplanWorkbook([{
      displayName: "ישראל ישראלי",
      numberInvited: 2,
      guestGroup: "חברים",
      phone: "+972501234567",
      sourceTab: "מוזמנים - שובל",
    }]);
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xls" });
    const reopened = XLSX.read(bytes, { type: "buffer" });
    expect(reopened.SheetNames).toEqual(["הזמנות"]);
    expect(XLSX.utils.sheet_to_json(reopened.Sheets["הזמנות"], { header: 1, raw: true })).toEqual([
      ["", "שיוך", "", "", "פרטי התקשרות", "", "", "כתובת", "", "", "", ""],
      ["הזמנה לכבוד", "מס' אורחים שהוזמנו", "צד", "קבוצה", "סלולרי", "טלפון רגיל", "אימייל", "עיר", "רחוב", "מיקוד", "תא דואר", "צ'ק צפוי"],
      ["ישראל ישראלי", 2, "כלה", "חברים", "050-1234567", "", "", "", "", "", "", ""],
    ]);
  });
});
