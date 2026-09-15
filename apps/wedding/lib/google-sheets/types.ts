export const sheetFields = [
  "sourceRowId",
  "displayName",
  "primaryPhone",
  "numberInvited",
  "numberConfirmed",
  "rsvpStatus",
  "tableNumber",
  "guestGroup",
] as const;

export type SheetField = (typeof sheetFields)[number];

export type RsvpStatus = "pending" | "confirmed" | "declined" | "maybe";

export type HeaderAliases = Record<SheetField, readonly string[]>;

export interface SheetMappingConfig {
  aliases?: Partial<Record<SheetField, readonly string[]>>;
  /** Exact header overrides take precedence over aliases. */
  columns?: Partial<Record<SheetField, string>>;
}

export interface MappedInvitation {
  /** Added by the multi-tab adapter; pure single-tab mapping may omit it. */
  sourceTab?: string;
  sourceRowId: string;
  sourceRowNumber: number;
  displayName: string;
  primaryPhone: string | null;
  normalizedPhone: string | null;
  numberInvited: number;
  numberConfirmed: number;
  rsvpStatus: RsvpStatus;
  tableNumber: string | null;
  guestGroup: string | null;
  sourcePayload: Record<string, string>;
}

export interface MappingIssue {
  rowNumber?: number;
  field?: SheetField;
  code:
    | "missing_header"
    | "ambiguous_header"
    | "missing_identity"
    | "invalid_phone"
    | "invalid_number"
    | "invalid_table"
    | "duplicate_identity"
    | "ambiguous_seating"
    | "unmatched_seating";
  message: string;
}

export interface MappingResult {
  invitations: MappedInvitation[];
  issues: MappingIssue[];
  resolvedHeaders: Partial<Record<SheetField, string>>;
  rawHeaders: string[];
}

export interface WeddingSheetData {
  guestSheets: Array<{ tabName: string; values: string[][] }>;
  seatingValues?: string[][];
  seatingTabName?: string;
}
