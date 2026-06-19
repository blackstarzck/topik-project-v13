import { ClaimAffiliationRedirect } from "@/components/auth/ClaimAffiliationRedirect";
import { sanitizeNext } from "@/lib/auth/error-mapping";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_NEXT = "/auth/post-auth?intent=sign-up";

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClaimAffiliationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNext(pickFirst(params.next), DEFAULT_NEXT);

  return <ClaimAffiliationRedirect nextPath={nextPath} />;
}
