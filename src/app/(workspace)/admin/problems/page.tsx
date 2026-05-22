import type { Metadata } from "next";
import { requireContentAdmin } from "@/lib/auth/admin-guard";
import { listAdminProblems } from "@/lib/admin/server";
import { AdminProblemTable } from "@/components/admin/AdminProblemTable";

export const metadata: Metadata = { title: "문제 관리 — TALKPIK" };

export default async function AdminProblemsPage() {
  await requireContentAdmin();
  const initialRows = await listAdminProblems({});
  return (
    <main style={{ padding: 24 }}>
      <h1>문제 관리</h1>
      <AdminProblemTable initialRows={initialRows} />
    </main>
  );
}
