import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" })
    .refine((value) => value.startsWith("https://"), {
      message: "NEXT_PUBLIC_SUPABASE_URL must use https",
    }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
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
