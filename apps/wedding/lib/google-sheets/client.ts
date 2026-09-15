import "server-only";

import { google } from "googleapis";

import type { WeddingSheetData } from "./types";
import { getGoogleSheetsConfig } from "@/lib/env";

const READ_ONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export interface GoogleSheetEnvironment {
  sheetId: string;
  guestTabNames: string[];
  seatingTabName?: string;
  serviceAccountEmail: string;
  privateKey: string;
}

export function getGoogleSheetEnvironment(): GoogleSheetEnvironment {
  const config = getGoogleSheetsConfig();
  return {
    sheetId: config.sheetId,
    guestTabNames: config.guestTabNames,
    seatingTabName: config.seatingTabName,
    serviceAccountEmail: config.serviceAccountEmail,
    privateKey: config.privateKey,
  };
}

function quoteTab(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'!A:ZZ`;
}

export async function fetchWeddingSheetData(
  environment: GoogleSheetEnvironment = getGoogleSheetEnvironment(),
): Promise<WeddingSheetData> {
  const auth = new google.auth.JWT({
    email: environment.serviceAccountEmail,
    key: environment.privateKey,
    scopes: [READ_ONLY_SCOPE],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const tabs = [...environment.guestTabNames, environment.seatingTabName].filter(Boolean) as string[];
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: environment.sheetId,
    ranges: tabs.map(quoteTab),
    majorDimension: "ROWS",
  });
  const ranges = response.data.valueRanges ?? [];
  return {
    guestSheets: environment.guestTabNames.map((tabName, index) => ({
      tabName,
      values: (ranges[index]?.values ?? []) as string[][],
    })),
    seatingValues: environment.seatingTabName
      ? ((ranges[environment.guestTabNames.length]?.values ?? []) as string[][])
      : undefined,
    seatingTabName: environment.seatingTabName,
  };
}
