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
  const { user, profile } = session;

  return (
    <WorkspaceShell
      role={profile.app_role}
      userId={user.id}
      email={user.email}
      planLabel={profile.plan_label}
    >
      {children}
    </WorkspaceShell>
  );
}
