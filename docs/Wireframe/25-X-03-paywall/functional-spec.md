# X-03 페이월 기능명세

## 화면 목적

제한된 기능 접근 시 현재 플랜과 업그레이드 선택지를 보여준다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/paywall`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: R-02, F-M1, R-01 등 유료 기능 잠금 지점.
- 이탈 경로: 구독 CTA는 X-04 구독 관리로 이동하고, 결제 연동은 deferred로 안내한다. 학습 복귀는 B-01로 이동한다.
- 화면 내부 동작: 요금제, 혜택, 결제 주기, 선택 상태와 오류를 확인한다.

## 주요 기능

- 현재 플랜
- 업그레이드 CTA
- 제한 안내

## 상태/오류

- 결제 연동 없음, 플랜 정보 없음

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `subscription_plans` | `plan_key`, `name`, `cadence`, `price_cents`, `currency`, `features`, `recommended`, `active` | read | 페이월 플랜/가격 카드에 사용한다. | authenticated read for active plans; writes via operations/billing owner flow | `supabase/migrations/20260602120100_billing.sql`<br>`src/components/settings/billing-data.ts` | 실제 checkout provider write flow는 deferred다. |
| `subscriptions` | `user_id`, `plan_key`, `billing_cadence`, `status`, `current_period_start`, `current_period_end`, `cancel_at` | read | 기존 구독자 분기와 현재 구독 상태 안내에 사용한다. | owner select; writes via billing service flow | `supabase/migrations/20260602120100_billing.sql`<br>`src/components/settings/billing-data.ts` | 실제 checkout provider write flow는 deferred다. |
| `profiles` | `plan_label`, `status` | fallback read | 기존 권한/상태 표시와 fallback 분기에 연결될 수 있다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | Billing backing tables exist; profiles is not the only current evidence. |

## 현재 구현 상태

- billing backing tables(`subscription_plans`, `subscriptions`, `payment_history`)는 migration에 있다. X-03은 `subscription_plans`와 `subscriptions`를 읽고, 실제 결제 provider checkout/write flow는 deferred다.

## 코드 구현 근거

- `PaywallPage` - `src/app/(workspace)/paywall/page.tsx`
- `PaywallShell`, `handleSelect` - `src/components/settings/PaywallShell.tsx`
- `fetchMySubscription`, `fetchActivePlans`, `formatPlanPrice` - `src/components/settings/billing-data.ts`

## 미구현/불일치

- 실제 결제 provider checkout/write flow와 카드 결제 write-back은 deferred scope다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
