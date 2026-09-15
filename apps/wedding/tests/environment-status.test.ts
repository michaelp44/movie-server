import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isGuestIdentificationConfigured,
  isGoogleSheetsConfigured,
  isPublicSupabaseConfigured,
  isSupabaseAdminConfigured,
} from "@/lib/env";

const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WEDDING_DEMO_MODE",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SHEET_TAB_NAMES",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
] as const;

const originalValues = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function clearIntegrationEnvironment() {
  for (const key of keys) delete process.env[key];
}

beforeEach(clearIntegrationEnvironment);

afterEach(() => {
  clearIntegrationEnvironment();
  for (const key of keys) {
    const value = originalValues[key];
    if (value !== undefined) process.env[key] = value;
  }
});

describe("integration availability", () => {
  it("keeps public guest controls unavailable when Supabase is missing or partial", () => {
    expect(isPublicSupabaseConfigured()).toBe(false);
    expect(isSupabaseAdminConfigured()).toBe(false);
    expect(isGuestIdentificationConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(isPublicSupabaseConfigured()).toBe(false);
    expect(isSupabaseAdminConfigured()).toBe(false);
  });

  it("reports public and service-role capabilities independently", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-with-at-least-twenty-characters";

    expect(isPublicSupabaseConfigured()).toBe(true);
    expect(isSupabaseAdminConfigured()).toBe(false);
    expect(isGuestIdentificationConfigured()).toBe(false);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-with-at-least-twenty-characters";
    expect(isSupabaseAdminConfigured()).toBe(true);
    expect(isGuestIdentificationConfigured()).toBe(true);
  });

  it("requires the complete Google Sheets service-account configuration", () => {
    expect(isGoogleSheetsConfigured()).toBe(false);
    process.env.GOOGLE_SHEET_ID = "sheet-id-with-enough-characters";
    process.env.GOOGLE_SHEET_TAB_NAMES = "אורחים";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "wedding-sync@example.iam.gserviceaccount.com";
    expect(isGoogleSheetsConfigured()).toBe(false);

    process.env.GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----";
    expect(isGoogleSheetsConfigured()).toBe(true);
  });
});
