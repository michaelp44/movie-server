import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export function createAdminDataClient() {
  return createAdminClient();
}
