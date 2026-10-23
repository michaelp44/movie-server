export const IPLAN_HEADERS = [
  "הזמנה לכבוד",
  "מס' אורחים שהוזמנו",
  "צד",
  "קבוצה",
  "סלולרי",
  "טלפון רגיל",
  "אימייל",
  "עיר",
  "רחוב",
  "מיקוד",
  "תא דואר",
  "צ'ק צפוי",
] as const;

export interface IplanInvitationSource {
  displayName: string;
  numberInvited: number;
  guestGroup: string | null;
  phone: string | null;
  sourceTab: string | null;
}

function safeExcelText(value: string | null): string {
  return value?.trim() ?? "";
}

export function formatIsraeliMobileForIplan(value: string | null): string {
  const text = (value ?? "").trim().replace(/^=/, "");
  const digits = text.replace(/\D/g, "");
  const local = digits.startsWith("972") ? `0${digits.slice(3)}` : /^5\d{8}$/.test(digits) ? `0${digits}` : digits;
  if (/^05\d{8}$/.test(local)) return `${local.slice(0, 3)}-${local.slice(3)}`;
  return text;
}

export function inferIplanSide(sourceTab: string | null): "חתן" | "כלה" | "" {
  if (sourceTab?.includes("מיכאל")) return "חתן";
  if (sourceTab?.includes("שובל")) return "כלה";
  return "";
}

export function invitationToIplanRow(invitation: IplanInvitationSource): Array<string | number> {
  return [
    safeExcelText(invitation.displayName),
    invitation.numberInvited,
    inferIplanSide(invitation.sourceTab),
    safeExcelText(invitation.guestGroup),
    formatIsraeliMobileForIplan(invitation.phone),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];
}

export function createIplanWorkbook(invitations: IplanInvitationSource[]): XLSX.WorkBook {
  const rows: Array<Array<string | number>> = [
    ["", "שיוך", "", "", "פרטי התקשרות", "", "", "כתובת", "", "", "", ""],
    [...IPLAN_HEADERS],
    ...invitations.map(invitationToIplanRow),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!merges"] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
    { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } },
    { s: { r: 0, c: 7 }, e: { r: 0, c: 10 } },
  ];
  worksheet["!cols"] = [
    { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 20 },
    { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 14 },
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "הזמנות");
  workbook.Workbook = { Views: [{ RTL: true }] };
  return workbook;
}
import * as XLSX from "@e965/xlsx";
