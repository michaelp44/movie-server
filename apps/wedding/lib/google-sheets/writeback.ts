import "server-only";

import { google } from "googleapis";
import { getGoogleSheetsConfig } from "@/lib/env";
import { fetchWeddingSheetData } from "./client";
import { mapGuestSheet, mappingConfigFromEnvironment } from "./mapping";
import type { RsvpStatus } from "@/lib/types";

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function writeClient(config: NonNullable<ReturnType<typeof getGoogleSheetsConfig>>) {
  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: [WRITE_SCOPE],
  });
  return google.sheets({ version: "v4", auth });
}

/** Checks production write authorization without modifying spreadsheet content. */
export async function verifyGoogleSheetsWriteAccess(): Promise<void> {
  const config = getGoogleSheetsConfig();
  const sheets = writeClient(config);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: config.sheetId,
    fields: "properties.title",
  });
  const title = metadata.data.properties?.title;
  if (!title) throw new Error("Spreadsheet title could not be read.");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.sheetId,
    requestBody: {
      requests: [{
        updateSpreadsheetProperties: {
          properties: { title },
          fields: "title",
        },
      }],
    },
  });
}

export function columnLetters(index: number): string {
  let value = index + 1;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

export function parseSyncedSourceRowId(sourceRowId: string, allowedTabs: string[]): { sourceTab: string; rowIdentity: string } {
  const sourceTab = allowedTabs.find((tab) => sourceRowId.startsWith(`${tab}:`));
  if (!sourceTab) throw new Error("Invitation source row does not belong to an allowed guest tab.");
  const rowIdentity = sourceRowId.slice(sourceTab.length + 1).trim();
  if (!rowIdentity) throw new Error("Invitation source row identity is missing.");
  return { sourceTab, rowIdentity };
}

export async function writeSyncedInvitationRsvp(input: { sourceRowId: string; status: RsvpStatus; numberConfirmed: number }) {
  const config = getGoogleSheetsConfig();
  const source = parseSyncedSourceRowId(input.sourceRowId, config.guestTabNames);
  return writeRsvpToGoogleSheet({
    sourceTab: source.sourceTab,
    sourceRowId: source.rowIdentity,
    status: input.status,
    numberConfirmed: input.numberConfirmed,
  });
}

function quoteTab(tab: string) { return `'${tab.replace(/'/g, "''")}'`; }

export async function writeRsvpToGoogleSheet(input: { sourceTab: string; sourceRowId: string; status: RsvpStatus; numberConfirmed: number }) {
  const config = getGoogleSheetsConfig();
  if (!config.guestTabNames.includes(input.sourceTab)) throw new Error("Invitation source tab is not an allowed guest tab.");
  const sheetData = await fetchWeddingSheetData();
  const guestSheet = sheetData.guestSheets.find((sheet) => sheet.tabName === input.sourceTab);
  if (!guestSheet) throw new Error("Invitation source tab was not found.");
  const mapped = mapGuestSheet(guestSheet.values, mappingConfigFromEnvironment());
  const invitation = mapped.invitations.find((item) => item.sourceRowId === input.sourceRowId);
  if (!invitation) throw new Error("Invitation source row could not be matched safely.");
  const rsvpHeader = mapped.resolvedHeaders.rsvpStatus;
  const countHeader = mapped.resolvedHeaders.numberConfirmed;
  if (!rsvpHeader || !countHeader) throw new Error("The source tab must contain RSVP and confirmed-count columns.");
  const rsvpColumn = mapped.rawHeaders.indexOf(rsvpHeader);
  const countColumn = mapped.rawHeaders.indexOf(countHeader);
  if (rsvpColumn < 0 || countColumn < 0) throw new Error("RSVP columns could not be resolved.");
  const sheets = writeClient(config);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${quoteTab(input.sourceTab)}!${columnLetters(rsvpColumn)}${invitation.sourceRowNumber}`, values: [[input.status === "confirmed" ? "מגיע" : input.status === "declined" ? "לא מגיע" : input.status === "maybe" ? "אולי" : "ממתין"]] },
        { range: `${quoteTab(input.sourceTab)}!${columnLetters(countColumn)}${invitation.sourceRowNumber}`, values: [[input.numberConfirmed]] },
      ],
    },
  });
}
