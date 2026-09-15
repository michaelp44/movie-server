import {
  type HeaderAliases,
  type MappedInvitation,
  type MappingIssue,
  type MappingResult,
  type RsvpStatus,
  type SheetField,
  type SheetMappingConfig,
  sheetFields,
} from "./types";
import { normalizeIsraeliPhone } from "@/lib/phone";

export const defaultHeaderAliases: HeaderAliases = {
  sourceRowId: [
    "source_row_id",
    "source id",
    "row id",
    "id",
    "מזהה",
    "מזהה שורה",
  ],
  displayName: [
    "display_name",
    "invitation name",
    "guest name",
    "guest names",
    "name",
    "שם להזמנה",
    "שם הזמנה",
    "שם ההזמנה / משפחה",
    "שמות מוזמנים",
    "שם אורח",
    "שם",
  ],
  primaryPhone: [
    "primary_phone",
    "phone number",
    "phone",
    "mobile",
    "מספר טלפון",
    "טלפון ראשי",
    "טלפון",
    "נייד",
  ],
  numberInvited: [
    "number_invited",
    "invited count",
    "invited",
    "party size",
    "מספר מוזמנים",
    "כמות מוזמנים",
    "כמות פוטנציאלית",
    "הוזמנו",
  ],
  numberConfirmed: [
    "number_confirmed",
    "confirmed count",
    "confirmed",
    "attending",
    "מספר מאושרים",
    "כמות מאושרים",
    "מגיעים בפועל",
    "אישרו",
    "מגיעים",
  ],
  rsvpStatus: [
    "rsvp_status",
    "rsvp",
    "attendance status",
    "status",
    "סטטוס הגעה",
    "אישור הגעה",
    "סטטוס",
  ],
  tableNumber: [
    "table_number",
    "table number",
    "table",
    "seat",
    "מספר שולחן",
    "שולחן",
  ],
  guestGroup: [
    "guest_group",
    "guest group",
    "category",
    "side",
    "family side",
    "קבוצת אורחים",
    "קטגוריה",
    "צד",
    "משפחה",
  ],
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("he")
    .replace(/[\s_\-–—/\\]+/g, " ")
    .replace(/[.:()\[\]{}'\"׳״?]+/g, "")
    .trim();
}

function cleanCell(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim();
}

/** Returns an E.164-like Israeli canonical value, for example +972501234567. */
export function normalizeSheetPhone(input: unknown): string | null {
  return normalizeIsraeliPhone(cleanCell(input));
}

function parseCount(
  value: string,
  fallback: number,
  field: SheetField,
  rowNumber: number,
  issues: MappingIssue[],
): number {
  if (!value) return fallback;
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 30) {
    issues.push({
      rowNumber,
      field,
      code: "invalid_number",
      message: `Row ${rowNumber}: ${field} must be an integer between 0 and 30.`,
    });
    return fallback;
  }
  return parsed;
}

export function normalizeRsvpStatus(value: unknown): RsvpStatus {
  const normalized = cleanCell(value).toLocaleLowerCase("he");
  if (
    ["confirmed", "yes", "attending", "approved", "כן", "מגיע", "מגיעים", "אישר", "אישרו"].includes(
      normalized,
    )
  ) {
    return "confirmed";
  }
  if (["declined", "no", "not attending", "לא", "לא מגיע", "לא מגיעים"].includes(normalized)) {
    return "declined";
  }
  if (["maybe", "unsure", "אולי", "מתלבט", "מתלבטים"].includes(normalized)) return "maybe";
  return "pending";
}

function mergedAliases(config: SheetMappingConfig): HeaderAliases {
  return Object.fromEntries(
    sheetFields.map((field) => [
      field,
      [...(config.aliases?.[field] ?? []), ...defaultHeaderAliases[field]],
    ]),
  ) as unknown as HeaderAliases;
}

function resolveHeaders(
  headers: string[],
  config: SheetMappingConfig,
  issues: MappingIssue[],
  required: readonly SheetField[] = [],
): Partial<Record<SheetField, string>> {
  const aliases = mergedAliases(config);
  const normalizedToRaw = new Map<string, string[]>();
  for (const rawHeader of headers) {
    const key = normalizeHeader(rawHeader);
    if (!key) continue;
    normalizedToRaw.set(key, [...(normalizedToRaw.get(key) ?? []), rawHeader]);
  }

  const resolved: Partial<Record<SheetField, string>> = {};
  for (const field of sheetFields) {
    const exact = config.columns?.[field];
    const candidates = exact ? [exact] : aliases[field];
    const matches = new Set<string>();
    for (const candidate of candidates) {
      for (const match of normalizedToRaw.get(normalizeHeader(candidate)) ?? []) matches.add(match);
    }
    if (matches.size > 1) {
      issues.push({
        field,
        code: "ambiguous_header",
        message: `Multiple headers match ${field}: ${[...matches].join(", ")}. Configure an exact column override.`,
      });
    }
    const [firstMatch] = [...matches];
    if (firstMatch) resolved[field] = firstMatch;
  }

  for (const requiredField of required) {
    if (!resolved[requiredField]) {
      issues.push({
        field: requiredField,
        code: "missing_header",
        message: `A header for ${requiredField} could not be resolved.`,
      });
    }
  }
  return resolved;
}

function rowsToObjects(
  headers: string[],
  values: string[][],
  firstRowNumber: number,
): Array<{ rowNumber: number; values: Record<string, string> }> {
  return values.flatMap((row, index) => {
    const source = Object.fromEntries(headers.map((header, column) => [header, cleanCell(row[column])])) as Record<
      string,
      string
    >;
    return Object.values(source).some(Boolean) ? [{ rowNumber: index + firstRowNumber, values: source }] : [];
  });
}

function findHeaderRow(
  values: string[][],
  config: SheetMappingConfig,
  accepts: (resolved: Partial<Record<SheetField, string>>) => boolean,
): number {
  const searchLimit = Math.min(values.length, 25);
  for (let index = 0; index < searchLimit; index += 1) {
    const headers = (values[index] ?? []).map(cleanCell);
    const resolved = resolveHeaders(headers, config, []);
    if (accepts(resolved)) return index;
  }
  return 0;
}

function cell(
  source: Record<string, string>,
  resolved: Partial<Record<SheetField, string>>,
  field: SheetField,
): string {
  const header = resolved[field];
  return header ? source[header] ?? "" : "";
}

export function mapGuestSheet(values: string[][], config: SheetMappingConfig = {}): MappingResult {
  const headerIndex = findHeaderRow(
    values,
    config,
    (resolved) => Boolean(resolved.displayName && resolved.primaryPhone),
  );
  const rawHeaders = (values[headerIndex] ?? []).map(cleanCell);
  const issues: MappingIssue[] = [];
  const resolvedHeaders = resolveHeaders(rawHeaders, config, issues, ["displayName", "primaryPhone"]);
  if (!resolvedHeaders.displayName || !resolvedHeaders.primaryPhone) {
    return { invitations: [], issues, resolvedHeaders, rawHeaders };
  }

  const invitations: MappedInvitation[] = [];
  const seen = new Map<string, number>();
  for (const row of rowsToObjects(rawHeaders, values.slice(headerIndex + 1), headerIndex + 2)) {
    const displayName = cell(row.values, resolvedHeaders, "displayName");
    const primaryPhone = cell(row.values, resolvedHeaders, "primaryPhone");
    if (!displayName && !primaryPhone) continue;
    if (!displayName || !primaryPhone) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "missing_identity",
        message: `Row ${row.rowNumber}: both invitation name and phone are required.`,
      });
      continue;
    }
    const normalizedPhone = normalizeSheetPhone(primaryPhone);
    if (!normalizedPhone) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "primaryPhone",
        code: "invalid_phone",
        message: `Row ${row.rowNumber}: the phone number is not a valid Israeli number.`,
      });
      continue;
    }
    const explicitSourceId = cell(row.values, resolvedHeaders, "sourceRowId");
    const sourceRowId = explicitSourceId || `phone:${normalizedPhone}`;
    const prior = seen.get(sourceRowId) ?? seen.get(`phone:${normalizedPhone}`);
    if (prior) {
      issues.push({
        rowNumber: row.rowNumber,
        code: "duplicate_identity",
        message: `Rows ${prior} and ${row.rowNumber} resolve to the same invitation identity.`,
      });
      continue;
    }
    seen.set(sourceRowId, row.rowNumber);
    seen.set(`phone:${normalizedPhone}`, row.rowNumber);

    const numberInvited = parseCount(
      cell(row.values, resolvedHeaders, "numberInvited"),
      1,
      "numberInvited",
      row.rowNumber,
      issues,
    );
    const rsvpStatus = normalizeRsvpStatus(cell(row.values, resolvedHeaders, "rsvpStatus"));
    const numberConfirmed = parseCount(
      cell(row.values, resolvedHeaders, "numberConfirmed"),
      rsvpStatus === "confirmed" ? numberInvited : 0,
      "numberConfirmed",
      row.rowNumber,
      issues,
    );
    invitations.push({
      sourceRowId,
      sourceRowNumber: row.rowNumber,
      displayName,
      primaryPhone,
      normalizedPhone,
      numberInvited,
      numberConfirmed: Math.min(numberConfirmed, numberInvited),
      rsvpStatus,
      tableNumber: cell(row.values, resolvedHeaders, "tableNumber") || null,
      guestGroup: cell(row.values, resolvedHeaders, "guestGroup") || null,
      sourcePayload: row.values,
    });
  }

  return { invitations, issues, resolvedHeaders, rawHeaders };
}

function seatingIdentityKeys(
  source: Record<string, string>,
  resolved: Partial<Record<SheetField, string>>,
): string[] {
  const keys: string[] = [];
  const sourceId = cell(source, resolved, "sourceRowId");
  if (sourceId) keys.push(`source:${sourceId}`);
  const normalizedPhone = normalizeSheetPhone(cell(source, resolved, "primaryPhone"));
  if (normalizedPhone) keys.push(`phone:${normalizedPhone}`);
  const name = cell(source, resolved, "displayName").toLocaleLowerCase("he");
  if (name) keys.push(`name:${name}`);
  return keys;
}

export function applySeatingSheet(
  guestResult: MappingResult,
  seatingValues: string[][] | undefined,
  config: SheetMappingConfig = {},
): MappingResult {
  if (!seatingValues?.length) return guestResult;
  const headerIndex = findHeaderRow(
    seatingValues,
    config,
    (resolved) => Boolean(resolved.tableNumber),
  );
  const rawHeaders = (seatingValues[headerIndex] ?? []).map(cleanCell);
  const seatingIssues: MappingIssue[] = [];
  const resolved = resolveHeaders(rawHeaders, config, seatingIssues);
  if (!resolved.tableNumber) {
    seatingIssues.push({
      field: "tableNumber",
      code: "missing_header",
      message: "A table-number header could not be resolved in the seating tab.",
    });
    return { ...guestResult, issues: [...guestResult.issues, ...seatingIssues] };
  }

  const lookup = new Map<string, MappedInvitation>();
  for (const invitation of guestResult.invitations) {
    lookup.set(`source:${invitation.sourceRowId}`, invitation);
    lookup.set(`phone:${invitation.normalizedPhone}`, invitation);
    lookup.set(`name:${invitation.displayName.toLocaleLowerCase("he")}`, invitation);
  }

  const tableBySourceId = new Map<string, string>();
  for (const row of rowsToObjects(rawHeaders, seatingValues.slice(headerIndex + 1), headerIndex + 2)) {
    const table = cell(row.values, resolved, "tableNumber");
    if (!table) continue;
    const match = seatingIdentityKeys(row.values, resolved)
      .map((key) => lookup.get(key))
      .find(Boolean);
    if (!match) {
      seatingIssues.push({
        rowNumber: row.rowNumber,
        code: "unmatched_seating",
        message: `Seating row ${row.rowNumber} could not be matched to an invitation.`,
      });
      continue;
    }
    tableBySourceId.set(match.sourceRowId, table);
  }

  return {
    ...guestResult,
    invitations: guestResult.invitations.map((invitation) => ({
      ...invitation,
      tableNumber: tableBySourceId.get(invitation.sourceRowId) ?? invitation.tableNumber,
    })),
    issues: [...guestResult.issues, ...seatingIssues],
  };
}

export function mappingConfigFromEnvironment(value = process.env.GOOGLE_SHEET_HEADER_ALIASES): SheetMappingConfig {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as { aliases?: unknown; columns?: unknown };
    const config: SheetMappingConfig = {};
    if (parsed.aliases && typeof parsed.aliases === "object") {
      config.aliases = Object.fromEntries(
        Object.entries(parsed.aliases).filter(
          ([field, aliases]) => sheetFields.includes(field as SheetField) && Array.isArray(aliases),
        ),
      ) as SheetMappingConfig["aliases"];
    }
    if (parsed.columns && typeof parsed.columns === "object") {
      config.columns = Object.fromEntries(
        Object.entries(parsed.columns).filter(
          ([field, header]) => sheetFields.includes(field as SheetField) && typeof header === "string",
        ),
      ) as SheetMappingConfig["columns"];
    }
    return config;
  } catch (error) {
    throw new Error("GOOGLE_SHEET_HEADER_ALIASES must be valid JSON.", { cause: error });
  }
}
