# sitemap·user-flow 정합성 검증 — 작업 실행 계획 (v2, GPT-5.5 검토 반영)

> 작성일: 2026-06-15 · 상태: **v2 (gpt-5.5 3개 에이전트 검토 반영, 사용자 승인 대기)**
> v1 초안: [`sitemap-userflow-conformance-plan.md`](./sitemap-userflow-conformance-plan.md) · 검토 기록: [`sitemap-userflow-conformance-gpt55-review.md`](./sitemap-userflow-conformance-gpt55-review.md)
> 대상 정본: [`docs/sitemap.md`](../../../../sitemap.md), [`docs/flow/user-flow.md`](../../../../flow/user-flow.md)
> 성격: **검증 전용(read-only)**. 발견된 불일치 수정은 별도 승인 단계.

---

## 0. 한 줄 요약
두 정본 문서(사이트맵·사용자 여정)가 주장하는 **모든 명제**(라우트·타입·권한·전환 엣지·모달 호스팅·인증 흐름·문서 커버리지 규칙, 그리고 Notes/시나리오/error.code 같은 "숨은 주장"까지)를 1행=1명제로 분해하고, 각 명제를 `근거(파일:줄/명령출력/테스트)`로 PASS/불일치/누락/문서충돌/검증불가로 판정한다.

## 1. 목적·범위 (v1과 동일, 경계 재확인)
- **목적**: 두 문서의 명제 ↔ 실제 구현(`src/app/`, `src/proxy.ts`, `src/lib/routes.ts`, `src/app/api/`, `tests/e2e/`) 일치 검증. 불일치는 코드결함/문서드리프트로 구분해 수정경로 라우팅.
- **In-scope**: 라우트 존재·타입·Notes주장, 가드/권한, 전환 엣지, 모달 호스팅, 인증 콜백·에러·post-auth·consent·세션만료, audience-map 파생 /api 자체인증, 공유엔티티 cross-user negative spot-suite, 문서 간 일관성, e2e 커버리지 매핑 + `pnpm test:e2e`.
- **Out-of-scope (fail closed)**: admin(topik-ai), billing 실제구현(deferred), 전수 RLS/스토리지 보안 감사(별도 보안 패스), net-new 동작. 불일치가 admin/net-new 함의 시 수정 금지·보고.

## 2. Docs consulted
- `docs/sitemap.md`(Target Route Map 33행 + Notes, Audience Map, Overlay/Modal Surfaces, Main Flow mermaid, Coverage Rules)
- `docs/flow/user-flow.md`(플로우 mermaid 36노드, 인증 6시나리오 표, 11 error.code, 세션만료 노트)
- `docs/Wireframe/README.md`(화면 인벤토리)
- `AGENTS.md`/`CLAUDE.md`(작업규칙·범위경계·검증기준·E2E게이트·Workslop금지)
- 코드 reference: `src/app/**`, `src/proxy.ts`, `src/lib/routes.ts`, `src/lib/auth/*`, `src/app/auth/**`, `src/app/api/**`, `tests/e2e/**`

## 3. 사전 확인된 기반 사실 (grounding)
- `src/lib/routes.ts` = "sitemap 정렬 라우트의 단일 소스"(자체 선언): `PUBLIC_PATHS`(12), `AUTH_ENTRY_PATHS`, `PROTECTED_ROUTE_CASES`(22, IA코드 포함), `SIDEBAR_ITEMS` → **코드 정본**으로 3자 diff에 사용.
- `src/proxy.ts`(미들웨어): public/auth-entry/protected 가드 + stale `sb-*-auth-token` 감지 시 `/login?reason=session_expired`. `config.matcher`가 **`api` 제외** → /api 라우트는 자체 인증 필요(아래 Phase 2-B).
- sitemap 33개 라우트 전부 `src/app/` 존재(glob 확인). → 핵심은 존재가 아니라 **타입·권한·엣지·인증흐름·Notes주장의 의미 정합성**.
- 인증 next 정제 로직 실재: `src/lib/auth/redirect-url.ts`, `src/lib/auth/error-mapping.ts`. consent 서버액션: `src/app/auth/consent/actions.ts` + `src/lib/legal/consent.ts`. /api 3종: `export/pdf`, `notifications/dispatch-email`(worker-secret), `notifications/unsubscribe`.

## 4. 검증 차원
| 차원 | 정본 | 핵심 질문 |
| --- | --- | --- |
| V1 라우트 존재·타입·**Notes주장** | sitemap Route Map(+Notes) | 모든 IA가 선언 타입으로 존재? Notes 명제도 충족? 양방향 고아? |
| V2 모달 호스팅 | Overlay/Modal Surfaces | 5개 모달이 top-level 라우트 부재 **AND** 지정 부모에서 trigger→render→close→URL유지? |
| V3 접근 권한·가드 | Audience Map | public 전부 PUBLIC_PATHS? user 세션가드? auth-entry 역가드? |
| V3b **권한/RLS spot(신규)** | Audience Map(RLS 주장) | 공유 엔티티 cross-user 읽기/쓰기 차단? (bounded negative suite) |
| V4 전환 엣지 | 두 mermaid | 모든 엣지가 category별 기준대로 배선? 두 다이어그램 diff? |
| V5 인증 심화 | 6시나리오+11 error.code+auth Notes | 콜백분기·error UI계약·악성 next·post-auth·consent·세션만료·fragment가 명세대로? |
| V6 문서 일관성 | Coverage Rules | sitemap↔user-flow↔Wireframe 화면집합 무모순 + "route변경=3문서 동시갱신"? |
| V7 e2e 커버리지 | E2E 게이트 | 엣지/화면/시나리오별 테스트 매핑? 갭? `pnpm test:e2e` 통과? |

## 5. Phase 단위 실행 계획

### Phase 0 — 기준 추출 (runnable artifacts)
정본을 **기계 대조 가능한 JSON claim 세트**로 추출한다. (F14 반영: 추출 절차·스키마 고정)
- 산출물 4종(run 디렉터리 하위 `_artifacts/`):
  - `claims.routes.json`: `[{claim_id, ia, route, type, audience, notes_claims:[...]}]` (sitemap 33행 + Notes 분해)
  - `claims.edges.json`: `[{claim_id, from, to, label, edgeStyle:"solid|dashed", source:"sitemap|userflow|both", category}]` (두 mermaid 합산 **전에** 각각 추출 후 set 비교)
  - `claims.modals.json`: `[{claim_id, ia, host_routes:[...]}]` (C-03,D-M1,D-M2,D-M3,F-M1)
  - `claims.auth.json`: `[{claim_id, kind:"scenario|errorcode|gate", ref, expected}]` (6시나리오+11 error.code+post-auth/consent/세션만료/fragment)
- **edge category 폐쇄형 6종**(F5): `navigation | redirect | hosted-modal | in-page-self | conditional-gate | external-auth-provider`. 모든 엣지는 정확히 1개로 분류.
- **두 mermaid diff**(F4): `only-in-sitemap`, `only-in-userflow`, `intersection`을 별도 표로. label/edgeStyle/방향 차이도 기록.
- 검증: claim 카운트 ↔ 원문 대조(route 33, modal 5, error.code 11, scenario 6, edge=추출수). 불일치 시 재추출.

### Phase 1 — 라우트 존재·타입·Notes 정합성 (V1, V2) — 스크립트 우선
- **3자 diff 스크립트**(F15): `scripts/verify-route-map.mts`(`node --experimental-strip-types`)로
  (a) `src/app` 글로브 라우트, (b) `src/lib/routes.ts`의 `PUBLIC_PATHS/PROTECTED_ROUTE_CASES/SIDEBAR_ITEMS`, (c) `docs/sitemap.md` 표 파싱 → 3자 비교. 결정론적 orphan/누락 리스트 산출.
- **정규화 규칙 선정의**(F19): route groups `(workspace)` 제거, dynamic segment `[id]`↔`:id` 정규화, metadata 파일(`icon.svg` 등)·`/api/*`·`/auth/*` route handler 분리 처리.
- **Notes 주장 분해 체크**(F1): 행별 Notes를 명제로 — 예: X-01 "links to sign-up/login", `/paywall·/subscription` "billing deferred", callback "raw `error_description` server-log-only", `/auth/sign-out` "POST only". 각 명제에 코드/테스트 근거.
- 모달 타입: 모달 IA는 자체 page 부재 확인(Phase 2-모달은 V2에서 심화).
- `/auth/sign-out` audience: sitemap audience table 부재 vs `PUBLIC_PATHS` 포함 + POST-only — 별도 명시 비교(F19).

### Phase 2 — 접근 권한·가드 정합성
**2-A 페이지 라우트 가드(V3)**
- `PUBLIC_PATHS`(12) ↔ Audience Map public 목록 diff.
- `PROTECTED_ROUTE_CASES`/`(workspace)`가 `proxy.ts`에서 미인증 시 `/login` redirect 되는지(가능 시 기존 `tests/e2e/screens/screens-authed.spec.ts`로 보강).
- auth-entry 역가드: 로그인 상태 `/login`·`/sign-up`→`/dashboard`(`proxy.ts:52`).

**2-B /api 자체 인증(V3, audience-map 파생, bounded)**(F10, 타이브레이크 T2)
- matcher가 `/api` 제외함을 전제로, 각 /api가 스스로 인증하는지만 검증:
  - `/api/export/pdf`: 미인증 401 + 타 사용자 source/소유 자원 거부.
  - `/api/notifications/dispatch-email`: worker-secret 없음/불일치 시 401.
  - `/api/notifications/unsubscribe`: token-only, idempotent, user_id 미노출.
- 전체 API 감사는 비범위(범위 표기).

**2-C 권한/RLS spot(V3b, 신규, bounded)**(F2, 타이브레이크 T1)
- 최고위험 공유 엔티티에 cross-user **negative** spot-suite: profiles, writing submissions/feedback, reports, export_files, storage. "타인 row 읽기/쓰기 차단" 확인.
- 전수 RLS/스토리지 권한 감사는 **본 패스 비범위 → 후속 보안 패스** 포인터(`docs/development/backend-auth.md`).

### Phase 3 — 전환 엣지 정합성 (V4) — category별 기준
Phase 0 엣지 claim 각 항목을 category별 기준으로 판정(F5):
- `navigation`(실선): `<Link href>`/`router.push`/sidebar item 존재 → **PASS 조건=대상 라우트로의 실 이동 경로**.
- `redirect`: 서버/미들웨어 `redirect()` 또는 route handler redirect 존재.
- `hosted-modal`: V2로 위임(아래 모달 심화).
- `in-page-self`(예: `C01→C01` 필터, `X09→X09` 토글저장, `DM2→DM2` 대기): 네비게이션 아님 → **control 존재 + state 변화/save/loading 동작** 근거로 검증(F5/A1). "전환 누락"으로 오판 금지.
- `conditional-gate`(예: `R02·FM1·R01 → X03` 유료잠금): 링크 존재가 아니라 **게이팅 로직** 검증.
- `external-auth-provider`(Google OAuth, callback): Phase 4로 위임.
- 모달 호스팅 심화(F6): 모달별 ① top-level 라우트 부재 negative check ② 지정 부모별 trigger→render→close→URL 유지. **F-M1은 `/library`, feedback short/long, report 전부**.
- 집중 구간(전수 검증을 대체하지 않음 명시): 대시보드 허브, writing 제출→D-M1→D-M2→E-01/E-02, feedback→R-01/R-02, R-01→X-07, 사이드바 로그아웃.
- 근거: 엣지별 `file:line`, 누락/추가/오분류 목록.

### Phase 4 — 인증 심화 흐름 (V5)
- **callback**(`src/app/auth/callback/route.ts`): `token_hash`→`verifyOtp` vs `code`→`exchangeCodeForSession`, `next` relative-only, 성공/실패 redirect, `force-dynamic`.
- **error UI 계약**(F8): 11 error.code별 `route·title·message·primary/secondary CTA·countdown(rate-limit)·email prefill(editable·untrusted)·user_not_found 이메일 미표시·raw error_description 미노출·unknown fallback` falsifiable assertion. (`docs/Wireframe/33-X-11-auth-error/description.md` 표 대조)
- **악성 next 행렬**(F9): `https://evil.com`, `//evil.com`, `javascript:`, `/%2F%2Fevil` 입력을 callback·callback-fragment·consent page·consent action 4지점에서 → 항상 안전 relative 목적지. 근거: `src/lib/auth/redirect-url.ts`, `error-mapping.ts`.
- **post-auth 케이스 행렬**(F13): {세션없음→/login}·{동의누락+목표있음→/auth/consent}·{동의OK+목표없음→/onboarding/learning-goal}·{모두OK→/dashboard}·{callback 성공+next}.
- **consent 심화**(F12): 최신 required published만 표시(draft/old version/non-required/locale fallback/latest-by-doc_type 처리), server-side 미동의분 재조회, `user_consents.source='signup'` 기록, form tampering 방어. 근거: `src/app/auth/consent/actions.ts`, `src/lib/legal/consent.ts`.
- **세션만료**(F11): ① 익명 최초 방문엔 reason 없음 ② 만료 cookie 시 refresh/clear Set-Cookie가 redirect에 실림 ③ stale-cookie loop 없음(`proxy.ts:62-71`).
- **callback-fragment**: implicit `#fragment` fallback, `setSession` 후 `router.replace(next)`.
- **repo 밖 운영 주장**(F3): 30일 cleanup·`token_hash` 메일 템플릿·Supabase rate-limit은 **`repo-internal 검증불가`** 판정값으로 표기 + Supabase config/대시보드 증거 요구 또는 escalation.
- 근거: 시나리오별 코드 ref → 6시나리오 행 + 11 error.code 1:1 매핑.

### Phase 5 — 문서 간 일관성 (V6)
- `docs/Wireframe/README.md`(36) ↔ sitemap ↔ user-flow 노드 집합 대조. 커버리지 규칙("모든 Wireframe 화면이 page 또는 hosted modal로 존재") 확인.
- **"route 변경=3문서 동시 갱신" 검증**(F7): 이번 변경의 `git diff --name-status` 기준으로 route/source 변경 시 `Wireframe/README.md`·`sitemap.md`·`user-flow.md`가 함께 바뀌었는지 확인.
- 문서-문서 모순 발견 시 **보고만**, 임의 수정 금지(fail closed, escalation).

### Phase 6 — e2e 커버리지 매핑 + 실행 (V7)
- `tests/e2e/**` 각 스펙을 claim(화면/엣지/시나리오)에 매핑한 커버리지 표. 빈 구멍은 "결함" 아닌 "커버리지 갭".
- E2E 게이트: 영향 범위 넓음 → `pnpm test:e2e` 전체 실행, pass/fail 기록. (테스트 계정은 프로젝트 메모리 참조, secret 미출력. 실행 불가/실패 시 사유·재현명령·잔여위험 보고, 완료처리 금지.)

### Phase 7 — 발견사항 보고 + 수정 라우팅
- **정합성 매트릭스 컬럼 고정**(F18): `claim_id | authority_ref | code_ref | command | observed | verdict | severity | route_to_fix`. verdict ∈ {PASS, MISMATCH, GAP, DOC-CONFLICT, NOT-VERIFIABLE}.
- **수정경로 결정표**(F16):
  - active docs끼리 충돌 → `DOC-CONFLICT` → **escalation**(자동수정 금지).
  - docs ↔ `routes.ts`/구현만 충돌 → `MISMATCH` → Source Order(`sitemap.md:10-14`) + 구현 증거로 fix route(코드 vs 문서) **제안**, 자동 단정 금지.
- 심각도: P0(망가진 사용자경로/가드구멍/인증·보안 깨짐) / P1(누락 엣지·커버리지 갭) / P2(표현·외형).

## 6. 검증·근거·경계 규칙
- **증거 강제**(F18): 모든 PASS는 `code_ref`+`command/observed` 또는 테스트결과 필수. "괜찮아 보임" 금지(Workslop).
- **read-only 밀봉**(F17): 본 패스의 **허용 쓰기 = run 디렉터리 내 report/_artifacts/스크립트뿐**. `docs/`·`src/` 수정 금지. 수정은 별도 승인 단계.
- fail closed: 정본 충돌·승인없는 파괴적 변경·secret 노출·보안 불확실성.

## 7. 산출물
- `_artifacts/claims.{routes,edges,modals,auth}.json` + 두 mermaid edge diff 표
- `scripts/verify-route-map.mts`(3자 diff) 출력
- 정합성 매트릭스(컬럼 고정) + 불일치/누락/문서충돌/검증불가 목록 + 심각도 + 수정경로
- e2e 실행 요약 + 커버리지 갭 목록

## 8. 위험
- R-1 "검증"이 "수정"으로 번짐 → §6 read-only 밀봉으로 차단.
- R-2 점선·self·조건부 엣지 오판 → Phase 0 폐쇄형 category + Phase 3 category별 PASS 조건.
- R-3 보안 false-pass → Phase 2-B/2-C + Phase 4 악성 next/error UI 계약으로 negative 기준 확보.
- R-4 repo 밖 운영 주장 검증불가 → `NOT-VERIFIABLE` 판정 + 증거요구/escalation.
- R-5 문서-문서 모순 정본 판단 → 임의수정 금지, escalation.
- R-6 e2e 환경/인증 미비 → 사유·재현명령·잔여위험 보고, 완료처리 금지.

## 9. 실행 순서 게이트
Phase 0(스크립트+claims) → 1~2(기계대조·가드) → 3~4(코드 정독·인증 심화) → 5~6(교차·e2e) → 7(종합·라우팅). 각 Phase 종료 시 매트릭스 갱신 + 중단대비 handoff 기록.

---
### 변경 이력
- v1 → v2: gpt-5.5 3개 에이전트(커버리지/인증/방법론) 검토 반영. P0 7·P1 9·P2 2건 반영, 타이브레이크 T1~T3 종결. 상세 [`gpt55-review`](./sitemap-userflow-conformance-gpt55-review.md) §2~4.
