import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ADMIN_ROLES, getCurrentProfile } from "@/lib/auth/profile";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();
  // Positive allowlist: any future non-admin role added to the schema must
  // be added to ADMIN_ROLES explicitly to gain access here. Closed-by-default.
  if (!profile || !ADMIN_ROLES.includes(profile.app_role)) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
