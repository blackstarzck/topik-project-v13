import { InstitutionInvitePanel } from "@/components/auth/InstitutionInvitePanel";
import { PublicShell } from "@/components/shared/PublicShell";
import { sanitizeNext } from "@/lib/auth/error-mapping";
import { APP_ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InstitutionInvitePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNext(pickFirst(params.next), APP_ROUTES.dashboard);

  return (
    <PublicShell className="institution-invite-shell">
      <InstitutionInvitePanel nextPath={nextPath} />
    </PublicShell>
  );
}
