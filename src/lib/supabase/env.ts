import { z } from "zod";

function isAllowedUrl(value: string): boolean {
  if (value.startsWith("https://")) return true;
  // Development-only exception for local Supabase. Production and test
  // continue to require https. See Phase 7 Task 0.
  if (process.env.NODE_ENV === "development") {
    return (
      value.startsWith("http://127.0.0.1") ||
      value.startsWith("http://localhost")
    );
  }
  return false;
}

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" })
    .refine(isAllowedUrl, {
      message:
        "NEXT_PUBLIC_SUPABASE_URL must use https (or http://127.0.0.1 / http://localhost in development)",
    }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, { message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be non-empty" }),
});

export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

export function getPublicEnv(): PublicSupabaseEnv {
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `${path}: ${issue.message}`;
    });
    throw new Error(
      `Invalid Supabase public environment variables:\n${messages.join("\n")}`,
    );
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
