import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "./env";
import type { Database } from "./types";

export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(env.url, env.publishableKey);
}
