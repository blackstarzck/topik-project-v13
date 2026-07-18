export const SUPABASE_DEV_PROJECT_REF: string;
export const SUPABASE_PROD_PROJECT_REF: string;
export const STANDARD_PLAYWRIGHT_TEST_IGNORE: string[];

export type SupabaseLocalTarget = {
  hostname: "localhost" | "127.0.0.1" | "::1";
  kind: "local";
};
export type SupabaseRemoteTarget = {
  environment: "development" | "production";
  kind: "remote";
  ref: string;
};
export type SupabaseTarget = SupabaseLocalTarget | SupabaseRemoteTarget;
export type SupabaseSafetyEnvironment = Record<string, string | undefined>;

export function hasPrivilegedEnvironment(
  env: SupabaseSafetyEnvironment,
): boolean;
export function resolvePublicSupabaseKey(
  env: SupabaseSafetyEnvironment,
): string;
export function parseSupabaseTarget(value: string | undefined): SupabaseTarget;
export function assertPublicRemoteReadTarget(
  env: SupabaseSafetyEnvironment,
): SupabaseRemoteTarget;
export function assertRuntimeSupabaseTarget(
  env: SupabaseSafetyEnvironment,
): SupabaseTarget;
export function assertLiveDevProjectTarget(target: {
  projectRef: string | undefined;
  supabaseUrl: string | undefined;
}): SupabaseRemoteTarget;
export function assertPublicDevMutationTarget(
  env: SupabaseSafetyEnvironment,
  options: { expectedProjectRef: string },
): SupabaseRemoteTarget;
export function assertLocalPublicMutationTarget(
  env: SupabaseSafetyEnvironment,
): SupabaseLocalTarget;
export function assertLocalPrivilegedMutationTarget(
  env: SupabaseSafetyEnvironment,
): SupabaseLocalTarget;
export function assertLoopbackRuntimeTarget(value?: string): string;
export function resolveStandardPlaywrightSafety(
  env: SupabaseSafetyEnvironment,
): { baseUrl: string; testIgnore: string[] };
