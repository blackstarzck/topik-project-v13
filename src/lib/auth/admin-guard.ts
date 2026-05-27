import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type { Tables } from "../supabase/types";
import { type AppRole } from "./roles";
import { getCurrentProfile } from "./profile";

type ClientFactory = () => Promise<SupabaseServerClient>;

const PLATFORM_ROLES: readonly AppRole[] = ["platform_admin"];
const CONTENT_ROLES: readonly AppRole[] = ["content_admin", "platform_admin"];
const ORG_ROLES: readonly AppRole[] = ["org_admin", "platform_admin"];

async function requireRoleScoped(
  allowed: readonly AppRole[],
  createClient: ClientFactory,
): Promise<Tables<"profiles">> {
  const profile = await getCurrentProfile(createClient);
  if (!profile || !allowed.includes(profile.app_role)) {
    redirect("/dashboard?error=forbidden");
  }
  return profile;
}

export function requirePlatformAdmin(
  createClient: ClientFactory = createSupabaseServerClient,
) {
  return requireRoleScoped(PLATFORM_ROLES, createClient);
}

export function requireContentAdmin(
  createClient: ClientFactory = createSupabaseServerClient,
) {
  return requireRoleScoped(CONTENT_ROLES, createClient);
}

export function requireOrgAdmin(
  createClient: ClientFactory = createSupabaseServerClient,
) {
  return requireRoleScoped(ORG_ROLES, createClient);
}
