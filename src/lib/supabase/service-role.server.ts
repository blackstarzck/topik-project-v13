// Server-only by convention. The project intentionally does not depend on the
// `server-only` package; a static boundary test restricts importers to explicit
// route handlers and server-action modules.

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "./env";
import type { Database } from "./types";

export function createSupabaseServiceRoleClient() {
  const env = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for server-side system operations",
    );
  }

  return createClient<Database, "public">(env.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
