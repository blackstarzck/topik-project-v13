import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/lib/routes";
import { getCurrentUser } from "@/lib/auth/session";

// 약관 변경 알림(이메일/인앱) CTA용 공개 진입점.
//   - 로그인 세션이 있으면 → /auth/consent (재동의가 필요하면 동의 폼, 없으면 통과)
//   - 로그인 세션이 없으면 → /login?next=/auth/consent (로그인 후 동의 화면으로 연결)
// /auth/consent 는 보호 라우트라 직접 링크 시 next 없이 /login 으로 떨어지므로,
// 이 공개 bounce 라우트가 로그인→동의 경로를 명시적으로 잇는다.
export const dynamic = "force-dynamic";

export default async function TermsAgreementEntryPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(APP_ROUTES.authConsent);
  }

  redirect(
    `${APP_ROUTES.login}?next=${encodeURIComponent(APP_ROUTES.authConsent)}`,
  );
}
