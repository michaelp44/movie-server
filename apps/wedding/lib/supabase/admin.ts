import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

type OptionalClient = { optional: true };

function fetchWithFailoverTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(3_500);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

export function createAdminClient(): SupabaseClient<Database>;
export function createAdminClient(options: OptionalClient): SupabaseClient<Database> | null;
export function createAdminClient(options?: OptionalClient): SupabaseClient<Database> | null {
  const config = options?.optional
    ? getSupabaseAdminConfig({ optional: true })
    : getSupabaseAdminConfig();

  if (!config) {
    return null;
  }

  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "shoval-michael-wedding-server" },
      fetch: fetchWithFailoverTimeout,
    },
  });
}
