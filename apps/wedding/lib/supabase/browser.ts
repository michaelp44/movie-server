"use client";

import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";

let browserClient: ReturnType<typeof createSsrBrowserClient<Database>> | undefined;

/** Browser client is intentionally limited to the public/anon Supabase key. */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public environment variables are not configured");
  }

  browserClient ??= createSsrBrowserClient<Database>(url, anonKey);
  return browserClient;
}
