import "server-only";

import { z } from "zod";

export class EnvironmentConfigurationError extends Error {
  readonly issues: string[];

  constructor(scope: string, issues: string[]) {
    super(`Missing or invalid ${scope} configuration: ${issues.join(", ")}`);
    this.name = "EnvironmentConfigurationError";
    this.issues = issues;
  }
}

type OptionalConfig = { optional: true };

const supabaseUrlSchema = z.string().url().refine(
  (value) => {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".supabase.co");
  },
  "must be a Supabase URL",
);

const publicSupabaseSchema = z.object({
  url: supabaseUrlSchema,
  anonKey: z.string().min(20),
});

const adminSupabaseSchema = publicSupabaseSchema.extend({
  serviceRoleKey: z.string().min(20),
});

const googleSheetsSchema = z.object({
  sheetId: z.string().trim().min(10),
  guestTabNames: z.array(z.string().trim().min(1)).min(1),
  seatingTabName: z.string().trim().min(1).optional(),
  serviceAccountEmail: z.string().email(),
  privateKey: z.string().includes("PRIVATE KEY"),
});

function invalidFields(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.path.join(".") || issue.message);
}

function parseConfig<T>(
  scope: string,
  schema: z.ZodType<T>,
  value: unknown,
  optional: boolean,
): T | null {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  if (optional) {
    return null;
  }

  throw new EnvironmentConfigurationError(scope, invalidFields(result.error));
}

function publicSupabaseValues() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseAdminConfig extends PublicSupabaseConfig {
  serviceRoleKey: string;
}

export interface GoogleSheetsConfig {
  sheetId: string;
  guestTabNames: string[];
  seatingTabName?: string;
  serviceAccountEmail: string;
  privateKey: string;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig;
export function getPublicSupabaseConfig(options: OptionalConfig): PublicSupabaseConfig | null;
export function getPublicSupabaseConfig(options?: OptionalConfig): PublicSupabaseConfig | null {
  return parseConfig(
    "public Supabase",
    publicSupabaseSchema,
    publicSupabaseValues(),
    options?.optional === true,
  );
}

export function getSupabaseAdminConfig(): SupabaseAdminConfig;
export function getSupabaseAdminConfig(options: OptionalConfig): SupabaseAdminConfig | null;
export function getSupabaseAdminConfig(options?: OptionalConfig): SupabaseAdminConfig | null {
  return parseConfig(
    "Supabase admin",
    adminSupabaseSchema,
    {
      ...publicSupabaseValues(),
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    options?.optional === true,
  );
}

export function isPublicSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig({ optional: true }) !== null;
}

export function isSupabaseAdminConfigured(): boolean {
  return getSupabaseAdminConfig({ optional: true }) !== null;
}

export function getGuestSessionSecret(): string {
  const result = z.string().min(32).safeParse(process.env.GUEST_SESSION_SECRET);

  if (!result.success) {
    throw new EnvironmentConfigurationError("guest session", ["GUEST_SESSION_SECRET"]);
  }

  return result.data;
}

export function getRateLimitHashSecret(): string {
  const value = process.env.RATE_LIMIT_HASH_SECRET ?? process.env.GUEST_SESSION_SECRET;
  const result = z.string().min(32).safeParse(value);

  if (!result.success) {
    throw new EnvironmentConfigurationError("rate limit", [
      "RATE_LIMIT_HASH_SECRET (or GUEST_SESSION_SECRET)",
    ]);
  }

  return result.data;
}

export function getGoogleSheetsConfig(): GoogleSheetsConfig;
export function getGoogleSheetsConfig(options: OptionalConfig): GoogleSheetsConfig | null;
export function getGoogleSheetsConfig(options?: OptionalConfig): GoogleSheetsConfig | null {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const guestTabNames = (process.env.GOOGLE_SHEET_TAB_NAMES ?? process.env.GOOGLE_SHEET_TAB_NAME ?? "")
    .split(",")
    .map((tab) => tab.trim())
    .filter(Boolean);

  return parseConfig(
    "Google Sheets",
    googleSheetsSchema,
    {
      sheetId: process.env.GOOGLE_SHEET_ID,
      guestTabNames,
      seatingTabName: process.env.GOOGLE_SHEET_SEATING_TAB_NAME || undefined,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey,
    },
    options?.optional === true,
  );
}

export function isGoogleSheetsConfigured(): boolean {
  return getGoogleSheetsConfig({ optional: true }) !== null;
}

export function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wedding.my-rem.com";
  const result = z.string().url().safeParse(value);

  if (!result.success) {
    throw new EnvironmentConfigurationError("site URL", ["NEXT_PUBLIC_SITE_URL"]);
  }

  return result.data.replace(/\/$/, "");
}

/** Demo fixtures can never be enabled in a production build. */
export function isWeddingDemoEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WEDDING_DEMO_MODE === "true";
}

export function isGuestIdentificationConfigured(): boolean {
  return isWeddingDemoEnabled() || isSupabaseAdminConfigured();
}
