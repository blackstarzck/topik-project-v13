# sitemap·user-flow 정합성 검증 — 작업 실행 계획 (v1 초안)

> ⚠️ **SUPERSEDED** — 이 v1 초안은 gpt-5.5 검토 반영본 [`sitemap-userflow-conformance-plan-v2.md`](./sitemap-userflow-conformance-plan-v2.md)로 대체됨. 검토 기록: [`sitemap-userflow-conformance-gpt55-review.md`](./sitemap-userflow-conformance-gpt55-review.md). 이력 보존용으로만 유지.
>
> 작성일: 2026-06-15 · 상태: **1차 초안 (gpt-5.5 검토 전)**
> 대상 정본: [`docs/sitemap.md`](../../../../sitemap.md), [`docs/flow/user-flow.md`](../../../../flow/user-flow.md)
> 목적: 두 문서가 정의한 사이트맵·사용자 여정대로 프로젝트가 실제로 구현/개발되어 있는지 **검증**한다. (이 계획은 검증 전용이며, 발견된 불일치 수정은 별도 승인 단계)

---

## 0. 한 줄 요약

업데이트된 두 정본 문서(사이트맵·사용자 흐름)와 실제 코드(`src/app/`, `src/proxy.ts`, `src/lib/routes.ts`, `tests/e2e/`)가 **빠짐없이 일치하는지** 항목별로 대조하고, 각 항목을 "근거(파일·줄·테스트·실행결과) 있는 PASS / 불일치 / 누락 / 문서충돌"로 판정하는 계획.

## 1. 목적과 범위

### 목적
- 두 문서가 주장하는 모든 사실(라우트, 라우트 타입, 접근 권한, 화면 전환 엣지, 모달 호스팅, 인증 흐름, 커버리지 규칙)이 실제 구현과 일치하는지 검증한다.
- 불일치는 "코드 결함"인지 "문서 드리프트(코드는 맞는데 문서가 낡음)"인지 구분해 수정 경로를 라우팅한다.

### 범위 (In-scope)
- user-facing 라우트 존재·타입 (`src/app/`)
- 라우트 가드/접근 권한 (`src/proxy.ts`, `src/lib/routes.ts`)
- 화면 전환 엣지(네비게이션) 배선 (Link/router.push/redirect/server action/sidebar)
- 인증 콜백·에러·post-auth·consent·세션만료 흐름
- 모달 호스팅(C-03, D-M1, D-M2, D-M3, F-M1)
- 문서 간 일관성(sitemap ↔ user-flow ↔ Wireframe/README)
- 기존 e2e 스펙과 흐름 엣지의 커버리지 매핑 + `pnpm test:e2e` 실행

### 비범위 (Out-of-scope) — fail closed
- admin 기능/라우트 (topik-ai 소관, AGENTS.md 비협상 규칙)
- billing/결제 실제 구현 (deferred scope)
- net-new 제품 동작 추가. 불일치가 admin/net-new를 함의하면 **구현하지 말고 보고**한다.

## 2. Docs consulted
- `docs/sitemap.md` — Target React Route Map(33행), Route Audience Map, Overlay/Modal Surfaces, Main Flow mermaid, Coverage Rules
- `docs/flow/user-flow.md` — 사용자 플로우 mermaid(36 노드), 인증 콜백/에러 6 시나리오 표, 11개 `error.code` 매핑
- `docs/Wireframe/README.md` — 화면 인벤토리(커버리지 규칙 대조용)
- `AGENTS.md`, `CLAUDE.md` — 작업 규칙, 범위 경계, 검증 기준, E2E 게이트
- 코드 reference: `src/app/**/page.tsx`, `src/app/**/route.ts`, `src/proxy.ts`, `src/lib/routes.ts`, `tests/e2e/**`

## 3. 사전 조사로 확인된 기반 사실 (grounding)
계획이 추정이 아니라 실제 코드에 근거하도록, 착수 전 다음을 확인했다.

- `src/lib/routes.ts`가 이미 **"sitemap 정렬 라우트의 단일 소스"**로 선언되어 있음 → `PUBLIC_PATHS`(12개), `AUTH_ENTRY_PATHS`, `PROTECTED_ROUTE_CASES`(22개, IA 코드 포함), `SIDEBAR_ITEMS` 보유. → **코드 쪽 정본**으로 활용해 문서와 양방향 diff 가능.
- `src/proxy.ts`(Next.js 미들웨어, 최신 네이밍)가 public/auth-entry/protected 가드 + 만료 세션 시 `/login?reason=session_expired` redirect 구현.
- sitemap의 33개 라우트가 전부 `src/app/`에 파일로 존재(1차 glob 확인). 고로 **단순 존재 여부보다 타입·엣지·가드·인증흐름의 의미 정합성**이 검증의 핵심.
- `tests/e2e/`에 화면별 스펙(`screens/*.spec.ts`)과 흐름 스펙(`flows/*.spec.ts`) 다수 존재 → 커버리지 매핑의 출발점.

## 4. 검증 차원 (두 문서의 주장 유형별)
두 문서는 성격이 다른 주장들을 담고 있어, 차원마다 검증 방법이 다르다.

| 차원 | 정본 출처 | 검증 질문 |
| --- | --- | --- |
| V1 라우트 존재·타입 | sitemap Target Route Map | 모든 IA가 선언된 타입(page/route handler/hosted modal)으로 존재? 코드에만 있고 문서에 없는 **고아 라우트**는? |
| V2 모달 호스팅 | sitemap Overlay/Modal Surfaces | C-03·D-M1·D-M2·D-M3·F-M1이 독립 라우트가 아니라 지정된 부모 라우트에 host? |
| V3 접근 권한·가드 | sitemap Route Audience Map | public 라우트가 전부 `PUBLIC_PATHS`에? user 라우트는 세션 가드? RLS 자기 row? |
| V4 화면 전환 엣지 | 두 문서의 mermaid | 모든 실선(주 CTA/redirect)·점선(보조/인페이지) 엣지가 코드에 배선? |
| V5 인증 심화 흐름 | user-flow 6 시나리오 + 11 error.code + sitemap auth notes | 콜백 분기, 에러 reason 매핑, post-auth 게이트, consent 기록, 세션만료, fragment fallback이 명세대로? |
| V6 문서 간 일관성 | sitemap Coverage Rules | sitemap ↔ user-flow ↔ Wireframe/README의 화면 집합·노드·라우트가 서로 모순 없음? |
| V7 e2e 커버리지 | AGENTS.md E2E 게이트 | 각 엣지/화면/시나리오에 대응하는 e2e가 있나? 빈 구멍은? `pnpm test:e2e` 통과? |

## 5. Phase 단위 실행 계획

### Phase 0 — 기준 추출 (Baseline)
- 두 문서에서 **기계 대조 가능한 정본 리스트**를 추출한다.
  - 라우트 표: `(IA, route, type, audience)` — sitemap 33행
  - 엣지 리스트: `(from, to, label, 실선/점선, 종류=네비게이션/redirect/인페이지)` — 두 mermaid 합산, 중복 제거
  - 모달-호스트 맵: 5개 모달 → 부모 라우트
  - 인증 시나리오 표(6) + `error.code` 맵(11)
- 산출물: 1행=1주장인 **검증 매트릭스** 골격(이후 Phase가 판정 채움).
- 검증: 추출 리스트를 원문과 카운트 대조(라우트 33, 모달 5, 시나리오 6, error.code 11, 엣지 N). 카운트 불일치 시 재추출.

### Phase 1 — 라우트 존재·타입 정합성 (V1, V2)
- sitemap 각 라우트 ↔ `src/app/` 파일(`page.tsx`/`route.ts`) 대조.
- **양방향 diff**: `src/app/` 글로브 결과와 sitemap 라우트 표를 양쪽으로 비교 → 문서에 없는 고아 라우트, 라우트에 없는 문서 항목 검출.
- 타입 확인: page vs route handler(`/auth/callback`, `/auth/sign-out`, `/api/*`) vs **hosted modal**(모달 IA는 자체 page가 없어야 함 — 컴포넌트로 부모 라우트에 존재).
- 동적 세그먼트 확인: `feedback/short/[id]`, `feedback/long/[id]`, `reports/[id]/compare`가 sitemap의 `:id`와 매칭.
- `src/lib/routes.ts`의 `PROTECTED_ROUTE_CASES` IA 코드 ↔ sitemap IA 코드 대조.
- 근거: 라우트별 파일 경로, diff 리스트.

### Phase 2 — 접근 권한·가드 정합성 (V3)
- `PUBLIC_PATHS`(12개) ↔ sitemap Route Audience Map의 public 목록 대조.
- `(workspace)` 그룹 + `PROTECTED_ROUTE_CASES`가 `proxy.ts`에서 미인증 시 `/login` redirect 되는지 확인.
- 인증 entry(`/login`,`/sign-up`)에 로그인 상태로 접근 시 `/dashboard` redirect 확인.
- RLS 자기 row 정책은 **스폿 체크**(공유 엔티티 읽기 화면 일부). 깊은 DB 감사는 비범위, `docs/development/backend-auth.md` 참조로 한정.
- 근거: `PUBLIC_PATHS` 배열 vs public 목록 diff, 가드 위치(`proxy.ts:52,59`).

### Phase 3 — 화면 전환 엣지 정합성 (V4)
- Phase 0의 엣지 리스트 각 항목에 대해 코드 배선 위치를 찾는다(`<Link href>`, `router.push`, `redirect()`, server action, AntD Menu/Sidebar item).
- 분류 처리(**오탐 방지 핵심**):
  - 실선 엣지 = 주 CTA/리다이렉트 → **반드시 존재**해야 함.
  - 점선 엣지 = 보조/in-page 동작(예: `C01 -.-> C01` 필터 변경, `X09 -.-> X09` 토글 저장) → 네비게이션이 아닐 수 있음. self-edge·in-page 동작은 "전환 엣지 누락"으로 오판하지 않는다.
  - 조건부 엣지(예: `R02 -.유료 잠금.-> X03`, `FM1 -.유료 잠금.-> X03`) → 링크 존재가 아니라 **게이팅 로직** 검증.
- 집중 검증 구간:
  - 대시보드 허브 링크(→ recommendations/library/growth/weakness/profile/notifications/subscription/알림 X-09)
  - writing 제출 → D-M1 → D-M2 → E-01/E-02 분기
  - feedback → R-01/R-02, R-01 → X-07, R-02 → C-02
  - 사이드바 로그아웃(POST `/auth/sign-out`)
- 근거: 엣지별 `file:line`, 누락/추가 엣지 목록.

### Phase 4 — 인증 심화 흐름 정합성 (V5)
- `/auth/callback`(route handler): `token_hash`→`verifyOtp` 분기 vs `code`→`exchangeCodeForSession`, `next` relative-only, 성공/실패 redirect, `force-dynamic`.
- `/auth/error`: 11개 `error.code`→reason 매핑, rate-limit 계열 `retry_after_seconds` 카운트다운, `user_not_found` 중립 문구(이메일 미표시), email prefill untrusted 처리.
- `/auth/post-auth`: 세션 없음→`/login`, 동의 누락→`/auth/consent`, 학습목표 없음→`/onboarding/learning-goal`, 모두 충족→`/dashboard`.
- `/auth/consent`: 최신 required published 문서 중 미동의분만 표시, 동의 시 `user_consents.source='signup'` 기록, `next` 복귀.
- `/auth/verify-email`: 60초 cooldown 재전송.
- `/auth/callback-fragment`: implicit `#fragment` fallback, `setSession` 후 `router.replace(next)`.
- 세션 만료: `proxy.ts`가 stale `sb-*-auth-token` 감지 시 `/login?reason=session_expired`(확인됨, 재검증).
- 근거: 시나리오별 코드 ref → user-flow 6 시나리오 행 + 11 error.code에 1:1 매핑 표.

### Phase 5 — 문서 간 일관성 (V6)
- `docs/Wireframe/README.md` 인벤토리(36 화면) ↔ sitemap 라우트 표 ↔ user-flow 노드 집합 대조.
- 커버리지 규칙 확인: "모든 Wireframe 화면이 라우트 맵에 page 또는 hosted modal로 존재".
- 문서-문서 모순 발견 시 **보고만** 하고 임의 수정 금지(정본 충돌 = fail closed, 사용자 판단 요청).

### Phase 6 — e2e 커버리지 매핑 + 실행 (V7)
- `tests/e2e/**` 각 스펙을 화면/엣지/시나리오에 매핑해 커버리지 표 작성.
- 커버리지 빈 구멍(엣지·시나리오에 대응 테스트 없음)을 "결함"이 아닌 "커버리지 갭"으로 식별.
- E2E 게이트(AGENTS.md): 영향 범위가 넓으므로 `pnpm test:e2e` 전체 실행, pass/fail 기록. (테스트 계정/인증정보는 프로젝트 메모리 참조, secret 미출력.)
- 근거: 테스트 실행 요약, 커버리지 갭 목록.

### Phase 7 — 발견사항 보고 + 수정 라우팅 (Report)
- 정합성 매트릭스: 주장별 → **PASS / 불일치(MISMATCH) / 누락(GAP) / 문서충돌(DOC-CONFLICT)**.
- 불일치마다: 코드 결함인가 문서 드리프트인가 판정 → 수정 경로(코드 수정 vs 문서 업데이트 제안).
- 심각도: **P0**(망가진 사용자 경로/가드 구멍/인증 흐름 깨짐) / **P1**(누락 엣지·커버리지 갭) / **P2**(문서 표현·외형).
- 이 계획은 **검증·라우팅까지만**. 실제 수정은 사용자 승인 후 별도 단계(범위 폭주 방지).

## 6. 검증·근거 규칙 (AGENTS.md Workslop 금지 준수)
- 모든 판정은 `file:line`, 명령 출력, 테스트 결과 중 하나 이상으로 뒷받침. "괜찮아 보임" 금지.
- "완료/성공"을 말하려면 무엇을 확인했는지 함께 보고.
- 정본 충돌·승인 없는 파괴적 변경·secret 노출·보안 불확실성은 fail closed.

## 7. 산출물 (Deliverables)
- 정합성 검증 매트릭스(이 run 디렉터리)
- 불일치/누락 목록 + 심각도 + 수정 경로(코드 vs 문서)
- e2e 실행 요약 + 커버리지 갭 목록
- gpt-5.5 검토 기록(`*-gpt55-review.md`) + 합의/타이브레이크 결론

## 8. 위험 (Risks)
- R-1 "검증"이 "수정"으로 번질 위험 → 본 계획은 read-only/verify-only로 고정, 수정은 별도 승인.
- R-2 점선·self-edge·조건부 엣지를 "전환"으로 오판 → Phase 3 분류 규칙으로 오탐 방지.
- R-3 게이팅(유료 잠금) 엣지는 링크 존재가 아니라 로직 검증 필요 → Phase 3·4에서 분리.
- R-4 e2e 환경/인증 미비 시 전체 실행 불가 → 실패/미실행 이유·재현 명령·남은 위험 보고(완료로 처리 금지).
- R-5 문서-문서 모순 발견 시 어느 쪽이 정본인지 판단 필요 → 임의 수정 금지, 사용자 escalation.

## 9. 진행/검증 순서 게이트
- Phase 0~2는 기계적 대조(빠름), Phase 3~4는 코드 정독(핵심), Phase 5~6은 교차/실행, Phase 7은 종합.
- 각 Phase 종료 시 확인 결과를 매트릭스에 남기고, 중단 가능성 있는 작업은 재개 가능한 handoff 기록.
