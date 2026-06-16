# X-01 제품 랜딩 기능명세

## 화면 목적

방문자가 서비스 가치를 보고 가입/로그인으로 이동하게 한다.

## 사용자와 권한

- Audience: public
- 이미 로그인한 사용자
- 권한 기준: public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.

## 진입/이탈 흐름

- Route: `/`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: 루트 `/` 직접 접근 또는 공개 링크.
- 이탈 경로: 히어로의 무료 시작은 A-01, 헤더/내비의 로그인은 A-02, 이용약관/개인정보 링크는 X-13/X-14로 이동한다.
- 화면 내부 동작: 섹션 이동, 미리보기 확인, 혜택 카드 확인을 처리한다.

## 주요 기능

- 가치 제안
- 시작 CTA: 히어로에서 제공
- 로그인 CTA: 헤더/내비에서 제공
- 요금/기능 안내

## 상태/오류

- CTA 링크 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `subscription_plans` | `plan_key`, `name`, `cadence`, `price_cents`, `currency`, `features`, `recommended`, `active` | schema-supported read | 플랜/가격/혜택 표시의 backing table이다. | authenticated read for active plans; writes via operations/billing owner flow | `supabase/migrations/20260602120100_billing.sql`<br>`docs/Wireframe/23-X-01-product-landing/screen-data-summary.md` | 현재 landing source는 직접 DB 호출이 낮고, X-03/X-04에서 같은 backing data를 실제 조회한다. |
| `subscriptions` | `user_id`, `plan_key`, `billing_cadence`, `status`, `current_period_start`, `current_period_end`, `cancel_at` | schema-supported derived-read | 로그인 사용자의 CTA 분기와 현재 구독자 분기에 연결될 수 있다. | owner select; writes via billing service flow | `supabase/migrations/20260602120100_billing.sql`<br>`docs/Wireframe/23-X-01-product-landing/screen-data-summary.md` | public 랜딩의 비로그인 상태에서는 직접 조회하지 않는다. |
| `profiles` | `plan_label` | derived-read | 랜딩의 플랜/권한 CTA 문구 fallback과 사용자 상태 분기에 연결될 수 있다. | public/auth flow; no user-owned row access unless session exists | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | Derived usage inferred from current source/domain docs. |

## 현재 구현 상태

- 현재 public landing source의 직접 DB 의존은 낮다. 다만 billing backing tables는 migration에 존재하며, 가격/구독 상태의 실제 조회 근거는 X-03/X-04와 `src/components/settings/billing-data.ts`에 있다.

## 코드 구현 근거

- `HomePage` - `src/app/page.tsx`
- `LandingHeader` - `src/components/landing/LandingHeader.tsx`
- `Hero` - `src/components/landing/Hero.tsx`
- `FeatureCard` - `src/components/landing/FeatureCard.tsx`
- `ProductPreview` - `src/components/landing/ProductPreview.tsx`

## 미구현/불일치

- Auth 중심 화면은 Supabase Auth 동작과 UI 상태 연결을 함께 확인해야 한다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
