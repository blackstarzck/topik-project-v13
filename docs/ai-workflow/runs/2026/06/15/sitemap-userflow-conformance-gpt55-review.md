# sitemap·user-flow 정합성 검증 계획 — GPT-5.5 다중 에이전트 검토 기록

> 일시: 2026-06-15 · 모델: gpt-5.5 (codex exec, read-only sandbox, 양쪽 실소스 대조)
> 대상: [`sitemap-userflow-conformance-plan.md`](./sitemap-userflow-conformance-plan.md) (v1 초안)
> 방식: 3개 독립 렌즈 병렬 검토 → 종합 → 합의/타이브레이크 → 계획 v2 반영

## 1. 3개 에이전트 판정 요약

| 에이전트 | 렌즈 | 판정 |
| --- | --- | --- |
| A1 | 커버리지 완전성 | **NEEDS-REVISION** — route/edge 중심이라 문서의 "숨은 주장"(Notes, RLS, 운영 인증 정책, 문서 변경 규칙)을 다 못 잡음 |
| A2 | 인증·보안 심화 | **NEEDS-REVISION** — auth 항목 목록은 좋으나 공격 입력·negative authorization 기준 부족 → 보안 깨져도 PASS 위험 |
| A3 | 방법론·실행가능성·workslop | **NEEDS-REVISION** — "실행 계획"이 아니라 "체크리스트 초안"에 가까움. Phase 0가 runnable하지 않음 |

세 에이전트 모두 큰 틀(차원 구분·phase·심각도·read-only 의도)은 인정하되, **검증의 정밀도/실행가능성/공격면**에서 보완 필요로 수렴.

## 2. 지적 → 반영 매핑

| # | 출처 | 지적 (요약) | 심각도 | 반영 (plan v2) |
| --- | --- | --- | --- | --- |
| F1 | A1 | Route Map **Notes 컬럼 주장**(landing 링크, billing deferred, raw `error_description` server-log-only, sign-out POST-only)이 1:1 체크로 분해 안 됨 | P0 | Phase 1에 행을 `(route,type,audience,notes-claim[])`로 분해, notes 주장별 근거 칸 추가 |
| F2 | A1·A2 | user route **RLS 자기 row**를 "스폿 체크"로 낮춤 → 권한 누수 못 잡음 | P0 | **신규 트랙 V3b**: 공유 엔티티 cross-user negative spot-suite. 전수 RLS 감사는 별도 보안 패스로 분리 명시 (타이브레이크 §4-T1) |
| F3 | A1 | 30일 cleanup·`token_hash` 메일 템플릿·Supabase rate-limit 등 **repo 밖 운영 주장**은 코드만으론 검증 불가 | P0 | 인증 매트릭스에 `repo-internal 검증불가` 판정값 + Supabase config/대시보드 증거 요구 또는 escalation 항목 추가 |
| F4 | A1·A3 | **두 mermaid edge diff** 부재(합산·중복제거만) → 한쪽에만 있는 엣지 은폐 | P1 | Phase 0 산출물에 `only-in-sitemap / only-in-userflow / intersection` 분리 |
| F5 | A1·A2·A3 | **엣지 분류 키/PASS 조건 부정확** → false missing·false pass 동시 발생 | P0 | 고정 키 `{from,to,label,edgeStyle,category}` + 폐쇄형 category 6종 + category별 검증법 |
| F6 | A1 | **모달 호스팅**이 "컴포넌트 존재" 수준 | P1 | 모달별 negative route check + parent별 trigger/render/close/URL 유지. F-M1은 library·feedback short/long·report 전부 |
| F7 | A1 | Coverage Rule "route 변경 시 3문서 동시 갱신" 검증법 없음 | P1 | `git diff --name-status` 기반 동시변경 확인 항목 추가 |
| F8 | A2 | 6 시나리오·11 error.code가 "존재 확인" 수준 → UX/보안 메시지 깨져도 PASS | P0 | error.code별 **UI 계약**(route·title·msg·CTA·countdown·email-field·raw `error_description` 미노출) falsifiable assertion |
| F9 | A2 | **악성 `next`** 미검증 (`https://evil.com`, `//evil.com`, `javascript:`, `/%2F%2Fevil`) | P0 | callback·callback-fragment·consent page·consent action 4지점 next 정제 테스트 행렬. 근거: `src/lib/auth/redirect-url.ts`, `error-mapping.ts` |
| F10 | A2 | `proxy.ts` matcher가 `/api` 전체 제외 → API 라우트 인증 모델 누락 | P0 | Phase 2에 API 라우트 자체 인증 검증: `/api/export/pdf`(401+cross-user 거부), `/api/notifications/dispatch-email`(worker-secret), `/api/notifications/unsubscribe`(token-only·idempotent·no leak). 근거: audience-map의 "api 제외" 주장에서 파생 |
| F11 | A2 | **session-expiry** 조건 불충분 (익명 최초 no reason / 만료 cookie refresh·clear Set-Cookie / loop 없음) | P1 | Phase 4 세션만료 기준 3종으로 구체화 |
| F12 | A2 | **consent** 검증 얕음 (draft/old version/non-required/locale fallback/latest-by-doc_type/form tampering) | P1 | Phase 4 consent를 DB fixture 기반 + server-side 재조회 검증으로 강화. 근거: `src/app/auth/consent/actions.ts`, `src/lib/legal/consent.ts` |
| F13 | A2 | **post-auth** 케이스 행렬 아님 | P2 | Phase 4 post-auth를 5케이스 행렬로 |
| F14 | A3 | **Phase 0 not runnable** (추출 명령·파서·출력 스키마 없음) | P0 | claims.*.json 4종 스키마 + 추출 절차 명시 |
| F15 | A3 | `src/lib/routes.ts` **자동 diff 기회 누락** | P1 | `scripts/verify-route-map.mts`로 docs↔routes.ts↔src/app glob 3자 diff 스크립트화 |
| F16 | A3 | **code-fix vs doc-drift 라우팅 모호** | P1 | 결정표 추가: active docs끼리 충돌=DOC-CONFLICT(escalate), docs↔routes.ts만=MISMATCH(Source Order+구현증거로 fix route 제안, 자동단정 금지) |
| F17 | A3 | **read-only 경계 미밀봉** | P1 | "허용 쓰기 = run 디렉터리 report 산출물뿐" 명시, docs/source 수정 금지 |
| F18 | A3·A1 | **Deliverables/matrix 컬럼 정의 없음** → 증거 없는 PASS 여지 | P1 | 매트릭스 컬럼 고정: `claim_id\|authority_ref\|code_ref\|command\|observed\|verdict\|severity\|route_to_fix` |
| F19 | A1 | orphan diff 정규화 규칙(route groups, dynamic segment, metadata, api, sign-out audience+method) 선행 정의 필요 | P1 | Phase 1에 정규화 규칙 선정의 추가 |

## 3. 검토자 주장의 사실 검증 (workslop 방지)
A2가 인용한 코드 심볼이 실재하는지 직접 확인 (환각 차단):
- `src/lib/auth/error-mapping.ts`, `src/lib/auth/redirect-url.ts` — next 정제/relative-only 로직 존재 ✅
- `src/app/auth/consent/actions.ts`, `src/lib/legal/consent.ts` — consent 서버액션/`source='signup'` 존재 ✅
- `src/app/api/notifications/dispatch-email/route.ts` — worker-secret 검증 존재 ✅
- `/api/export/pdf`, `/api/notifications/unsubscribe` 라우트 존재 ✅
- `src/proxy.ts` `config.matcher`가 `api` 제외 ✅
→ 3개 검토 모두 실소스 기반. 반영 가능.

## 4. 합의(Consensus)와 타이브레이크(Tie-break)

대부분 상호보완이라 충돌은 적음. 깊이/범위 다툼만 조정:

- **T1 — RLS 검증 깊이** (A1 "매핑 or 검증불가 분리" vs A2 "cross-user negative suite 전면 승격")
  → **타이브레이크**: 본 패스는 sitemap/user-flow **정합성** 검증이고, 두 문서의 RLS 주장은 "user routes = auth.uid() 자기 row RLS"라는 고수준 1줄. 전수 RLS 보안 감사는 별도 보안 트랙 소관.
  **결정**: 최고위험 공유 엔티티(profiles, writing submissions/feedback, reports, export_files, storage)에 한정한 **cross-user negative spot-suite(V3b)**로 스폿 체크를 승격하되, 전수 RLS/스토리지 권한 감사는 본 패스 비범위로 명시하고 후속 보안 패스로 포인터.

- **T2 — `/api/*` 인증 검증 범위** (sitemap Route Map에 /api 라우트는 없음 → 정합성 범위 밖 주장 가능)
  → **타이브레이크**: sitemap Audience Map이 "middleware는 api 라우트 제외"라고 **명시적으로 주장**하므로, "그렇다면 각 /api 라우트는 스스로 인증해야 한다"는 그 주장의 직접 귀결. 보안 구멍 위험도 실재.
  **결정**: "각 /api 라우트가 자체 인증을 강제하는가"만 **bounded**하게 검증(전체 API 감사 아님). audience-map 파생 항목으로 표기.

- **T3 — 자동화 강제 여부** (A3 스크립트화 vs 수작업)
  → **결정**: route-table 3자 diff는 **스크립트 필수**(결정론적·재현가능). 엣지/인증 UI 계약은 코드 정독 + 가능 시 기존 e2e로 보강(전수 자동화는 비강제).

## 5. 결론
- 판정: **NEEDS-REVISION → 반영 완료(plan v2)**. P0 7건·P1 9건 전부 v2에 반영, P2 2건 반영.
- 미해결 충돌 0 (T1~T3 타이브레이크 종결).
- 다음 단계: plan v2를 사용자 승인 게이트에 올림. 승인 시 Phase 0(스크립트+claims 산출)부터 실행.
