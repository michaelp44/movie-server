import "server-only";

import { createServerClient as createSsrClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicSupabaseConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Creates a request-scoped Supabase client for admin authentication. */
export async function createServerClient() {
  const config = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createSsrClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write response cookies. A Server Action,
          // Route Handler or proxy refresh will persist them when required.
        }
      },
    },
  });
}
