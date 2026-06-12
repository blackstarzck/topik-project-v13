/**
 * Client-safe role constants. Kept separate from `profile.ts` because
 * `profile.ts` imports server-only modules (`@/lib/supabase/server`,
 * `@/lib/auth/session`), which cannot be bundled into client components.
 * Server-side auth checks and user-facing gates read from here so there is
 * exactly one source of truth.
 */

export type AppRole =
  | "learner"
  | "content_admin"
  | "org_admin"
  | "platform_admin";

export const ADMIN_ROLES: readonly AppRole[] = [
  "content_admin",
  "org_admin",
  "platform_admin",
];
