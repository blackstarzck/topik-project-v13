import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnv } from "./env";
import type { Database } from "./types";

export async function createSupabaseServerClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.publishableKey, {
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
          // setAll fails in Server Components — middleware refreshes
          // sessions, so silent failure here is OK.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export function createSupabaseServiceRoleClient() {
  const env = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-side writes");
  }

  return createClient<Database, "public">(env.url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
