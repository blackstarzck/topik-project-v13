# X-04 구독 관리 기능명세

## 화면 목적

사용자가 현재 구독 상태 셸을 확인하게 한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/subscription`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: B-01 멤버십/구독 관리, G-01 설정 언어, X-05 프로필 편집, X-03 구독 CTA.
- 이탈 경로: 플랜 변경은 X-03 페이월로 이동하고, 영수증/결제 내역은 외부 또는 같은 화면 상태로 처리한다.
- 화면 내부 동작: 현재 구독, 결제 수단, 결제 내역, 정책 안내, 재시도 상태를 확인한다.

## 주요 기능

- 현재 플랜
- 관리 CTA
- 결제 deferred 안내

## 상태/오류

- 구독 데이터 없음

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `plan_label`, `status` | read | 구독 상태 셸 화면에 사용한다. 실제 결제 테이블은 아직 없다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | Billing table is deferred; only profiles.plan_label/status is current evidence. |

## 현재 구현 상태

- 실제 subscription table은 deferred scope라 DATA-GAP으로 남긴다.

## 코드 구현 근거

- `SubscriptionPage` - `src/app/(workspace)/subscription/page.tsx`
- `SubscriptionShell`, `loadSubscription`, `loadHistory` - `src/components/settings/SubscriptionShell.tsx`
- `fetchMySubscription`, `fetchActivePlans`, `fetchPaymentHistory`, `formatAmountCents` - `src/components/settings/billing-data.ts`

## 미구현/불일치

- Billing 전용 테이블과 결제 연동은 현재 migration에 없으므로 deferred scope로 기록한다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
