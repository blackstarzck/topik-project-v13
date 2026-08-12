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

export function createSupabasePublicServerClient() {
  const env = getPublicEnv();

  return createClient<Database, "public">(env.url, env.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export type SupabasePublicServerClient = ReturnType<
  typeof createSupabasePublicServerClient
>;
