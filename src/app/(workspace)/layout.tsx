import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/app/WorkspaceShell";
import { getSessionAndProfile } from "@/lib/auth/profile";

// All workspace routes require an authenticated session, so they cannot be
// prerendered statically. Forcing dynamic also prevents `pnpm build` from
// evaluating server components without Supabase env vars during prerender.
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionAndProfile();
  if (!session) redirect("/login");

  return <WorkspaceShell>{children}</WorkspaceShell>;
}
