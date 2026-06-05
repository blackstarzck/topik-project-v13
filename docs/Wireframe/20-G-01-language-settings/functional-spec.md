# G-01 설정 언어 기능명세

## 화면 목적

사용자가 앱 표시 언어를 바꾸게 한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/settings/language`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: B-01 홈 대시보드의 설정 진입.
- 이탈 경로: 멤버십/결제 진입은 X-04 구독 관리로 이동하며, 기본 저장 후에는 같은 화면에 머문다.
- 화면 내부 동작: UI 언어, 지역, 학습 콘텐츠 언어 선호를 선택하고 저장한다.

## 주요 기능

- 언어 선택
- 저장
- 현재 언어 표시

## 상태/오류

- 지원하지 않는 언어, 저장 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `ui_locale`, `updated_at` | read/write | 앱 표시 언어를 저장한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |

## 현재 구현 상태

- profiles.ui_locale만 변경한다.

## 코드 구현 근거

- `LanguageSettingsPage` - `src/app/(workspace)/settings/language/page.tsx`
- `LanguageForm`, `handleFinish`, `restoreRecommended` - `src/components/settings/LanguageForm.tsx`
- `fetchLearningSettings` - `src/components/settings/learning-settings-data.ts`
- `useUpdateLocale`, `updateLocale`, `updateLearningSettings` - `src/lib/settings/mutations.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
