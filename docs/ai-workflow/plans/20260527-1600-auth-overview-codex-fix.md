# auth-overview.md Codex Round-1 적발 정정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. 본 plan은 docs + config-only 변경이라 TDD 사이클 면제 (review-gates.md §TDD `Documentation-only changes` + `Configuration-only changes` 예외 적용) — substitute verification 명시.
>
> **Revision history:**
> - 2026-05-27 16:00 KST · v1 작성 (Opus 4.7)
> - 2026-05-27 16:45 KST · v2 — Codex Round 1 FAIL (1) + CONCERN (7) 전부 수용 후 revise. 변경 사항: §Out of Scope 의 PW drift 항목 → E11 로 in-scope 전환, T4 → T4a/T4b 분리, E7 wording 시간순 정정, per-edit verification target 표 신설, Round 1 finding ↔ edit traceability 표 신설, R7/R8/R9 위험 추가, T2/T3/T6 round counter 독립 명시.
> - 2026-05-27 17:00 KST · v3 — T3 ratify Round 1 HOLD 수용 후 revise. 변경 사항: (1) T4a edit count 정합화 (8/9/10 → **11**, 정본은 E1·E2·E3·E4·E5·E6·E7·E8·E8b·E9·E11), (2) E8 ↔ E8b 가 별도 edit 임을 명시 (SSoT 매트릭스의 다른 행 수정), (3) T2 와 T3 의 관계 명시 — 사용자 명시 룰 ("최종 결정은 별도 GPT") 에 따라 **T3 ratify 가 T2 re-review 를 대체** (T2 는 T3 HOLD 시에만 fall-back 으로 invoke).
> - 2026-05-27 17:15 KST · v4 — T3 ratify Round 2 HOLD 수용 후 revise. 잔여 2건: (1) ledger 의 "9개 edit" 표기 3 군데 정합화 (Accepted scope, Extracted requirements, Agent Assignments), (2) Task 2 *상세 섹션 본문* 이 여전히 "FAIL→Round 2" 기본 경로 서술 — fall-back-only 로 재서술. Tasks 표/Verification Strategy/3-Layer diagram/Status Track 4 군데는 v3 에서 이미 정합화됐으나 Task 2 body 누락이 잡힘.

**Goal:** `reports/auth-overview-codex-review-20260527.html` 의 Codex Round 1 FAIL 2건 + CONCERN 5건을 한 번에 정정해서 `docs/development/auth-overview.md` 가 실제 worktree 코드/마이그레이션/공식 문서와 일치하도록 만든다. 부수적으로 `.env.example` 의 `NEXT_PUBLIC_SITE_URL` 누락도 같이 막아 redirect-url.ts production throw 위험을 제거.

**Architecture:** 단일 reference doc 정정. 코드/마이그레이션은 손대지 않음 (이미 정합). `.env.example` 1줄 추가만 부수 변경. 검증은 (a) 코드 grep 으로 claim ↔ 파일 line 매칭 (b) 공식 Supabase 문서 URL 인용 (c) `node scripts/ai-workflow-check.mjs` (d) Codex Round 2 PASS.

**Tech Stack:** Markdown, HTML report consumption, codex-cli 0.128.0.

---

## Docs Consulted

- `reports/auth-overview-codex-review-20260527.html` — 본 plan 의 입력 (검수 보고서)
- `tasks/codex-output-auth-overview-review-round1.md` — Codex 원본 응답 (라인 단위 인용)
- `docs/development/auth-overview.md` — 정정 대상
- `docs/ai-workflow/planning-contracts.md` — plan 필수 섹션 (Out of Scope, SBU, Subagent-eligible)
- `docs/ai-workflow/review-gates.md` — TDD `Documentation-only` 예외, Plan-Review PASS Gate, Round-cap, Disagreement resolution
- `docs/ai-workflow/agent-packets.md` — subagent 호출 시 packet 템플릿
- `docs/ai-workflow/context-ledger-template.md` — ledger 필수 필드
- `src/app/auth/callback/route.ts` + `src/app/auth/callback-fragment/page.tsx` — P0-1 ground truth
- `src/components/auth/PasswordResetRequestForm.tsx:21-23` — P0-2 ground truth
- `.env.example` 1-20 — P0-3 ground truth (NEXT_PUBLIC_SITE_URL 부재 확인)
- `src/components/auth/SignUpForm.tsx:71-77` + `PasswordResetConfirmForm.tsx:43-49` — PW max 64 drift ground truth
- `src/lib/auth/error-mapping.ts:72-160` — 11종 reason 표 (PASS 받았지만 재인용 시 사용)
- `tests/lib/auth/error-mapping.test.ts`, `tests/integration/route-matrix.test.ts` — P1-3 SSoT 매트릭스에 추가할 테스트 파일
- `tests/components/auth/SignUpForm.test.tsx:141-143`, `LoginForm.test.tsx:112-114` — `NEXT_PUBLIC_SITE_URL` 사용 ground truth
- Supabase 공식 문서 (P1-1, P1-2 인용용):
  - https://supabase.com/docs/guides/deployment/going-into-prod
  - https://supabase.com/docs/guides/auth/sessions
  - https://supabase.com/docs/guides/auth/auth-smtp

**Doc conflicts:** `CLAUDE.md:11-15` 의 "pre-implementation" 표기가 stale (실제 `src/` 구현 존재). 본 plan 은 auth-overview.md 상단에 "현재 worktree 기준" 한 줄로 우회 (CLAUDE.md 자체 수정은 별건).

**Untouched relevant docs:**
- `docs/IA/01-A-01-sign-up/description.md`, `28-X-06-password-reset/description.md` — PW 8-64자 명세. 본 plan 의 P2-3 가 drift 명시만 함. IA 명세 자체 수정 (PW max 구현 또는 명세 수정 통일) 은 별건 작업.
- `docs/flow/user-flow.md` — 본 plan 은 auth-overview.md 의 mermaid 요약만 정정. user-flow.md 정본 변경 없음.
- `docs/development/backend-auth.md` — 백엔드 stack 정본. 본 plan 과 무관.

## Out of Scope — Intentional Cuts

| 제외 항목 | 이유 |
| --- | --- |
| `CLAUDE.md` 의 "pre-implementation" 표기 일괄 갱신 | 본 plan 은 auth-overview.md 상단 1줄로 우회만. CLAUDE.md 정본 수정은 별건 — 다른 stale 항목과 함께 일괄 처리해야 의미. |
| PW max 64 코드 구현 (`SignUpForm`, `PasswordResetConfirmForm` 에 maxLength 추가) | 본 plan 은 *문서* 정정. 구현 변경은 product 결정 필요. 다만 drift 자체는 **E11 로 in-scope 전환** — Codex Round 1 FAIL #3 수용. |
| IA description.md 의 PW 길이 명세 수정 | 구현 vs 명세 통일은 별건. 본 plan 은 auth-overview.md 안에서만 drift 사실을 기록. |
| `tests/lib/auth/error-mapping.test.ts` 새 reason 추가 시 자동 update 스크립트 | P1-3 은 SSoT 매트릭스에 "테스트도 함께 갱신" 한 줄 추가만. 자동화는 별건. |
| auth-overview.md §7 환경 변수 표를 `deployment.md` 와 통합 | 인덱스 문서가 별도로 deployment.md 를 가리키게만 함. 통합은 별건 정리. |
| Codex Round 1 의 "용어집 추가" 권장 (PASS dimension #6) | PASS 라 필수 아님. 본 plan 의 P2 후순위. |
| auth-overview.md 외 다른 doc 의 callback 경로 표기 일괄 audit | 본 plan 은 auth-overview.md 하나만 정합 보장. 다른 doc (예: `docs/flow/user-flow.md` 의 `/auth/callback` 표기) 의 stale 여부는 별건 audit. |

## Smallest Buildable Unit

**P0 3건 (P0-1 + P0-2 + P0-3a/b) 묶음** — 거짓 정보 정정. 이것만 머지돼도:

1. `auth-overview.md` 가 "정본 인덱스" 자격을 회복 (P0-1, P0-2)
2. `.env.example` 의 production-blocking 누락 제거 (P0-3a)
3. 환경 변수 표가 실제 파일과 일치 (P0-3b)
4. P1 5건은 후속 PR 로 분리 가능 (정확도/명료성 보강, 안전망 영향 없음)

P0-3a (.env.example 수정) 를 함께 묶은 이유: 단순 doc 정합성보다 더 중요한 운영 위험 (production env throw) 을 같은 cross-check 흐름에서 처리. P0-3a 만 단독 머지는 doc 와 어긋난 상태 유지.

## File Structure

| Path | Responsibility | 변경 종류 |
| --- | --- | --- |
| `docs/development/auth-overview.md` | P0/P1 적발 7건 정정 + 상단 worktree 기준 1줄 | 변경 (단일 파일 다중 섹션) |
| `.env.example` | `NEXT_PUBLIC_SITE_URL` 1줄 추가 (P0-3a) | 변경 |
| `docs/ai-workflow/runs/2026/05/27/20260527-1600-auth-overview-codex-fix.md` | 본 plan 의 ledger | 신규 |
| `tasks/codex-prompt-auth-overview-fix-plan-review-round1.md` | Plan 검수 프롬프트 (T0) | 신규 |
| `tasks/codex-output-auth-overview-fix-plan-review-round1.md` | Codex Round 1 응답 (T0) | 신규 (codex 실행 후) |
| `tasks/codex-prompt-auth-overview-fix-final-ratify.md` | 최종 결정 별도 GPT 에이전트 프롬프트 (T3) | 신규 |
| `tasks/codex-output-auth-overview-fix-final-ratify.md` | 최종 결정 응답 (T3) | 신규 |
| `reports/auth-overview-codex-fix-complete-20260527.html` | 완료 보고서 (T7 후) | 신규 |

코드/마이그레이션/IA description.md/user-flow.md/CLAUDE.md/REASON_CONTENT — 일체 변경 없음.

## Tasks

| # | Task | Files | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| T0 | Codex Round 1 plan-eng-review | (외부 codex exec) | N — main session 이 packet 작성, 결과 통합 |
| T1 | Round 1 결과 분석 + plan revise (FAIL/CONCERN 발생 시) | 본 plan | N — 리뷰 결과에 따라 main 직접 |
| T2 | **(fall-back only) Codex Round 2** — T3 HOLD 가 "plan 자체에 추가 review 필요" 라고 명시할 때만 invoke. 일반적으로 사용자 명시 룰에 따라 T3 ratify 가 re-review 를 대체 | (외부) | N — re-review 는 main 책임 |
| T3 | **최종 결정 별도 GPT 에이전트 ratify** — Round 토론과 별개의 fresh codex 세션이 plan + 검수 이력 읽고 최종 GO/NO-GO 결정 | (외부 codex exec, fresh session) | N — ratify 권한은 main 위임 불가 |
| T4a | T3 ratify 후 별도 implement 에이전트 호출 — `auth-overview.md` **11 edit** (E1·E2·E3·E4·E5·E6·E7·E8·E8b·E9·E11) 적용 | `docs/development/auth-overview.md` | Y — 단일 파일 다중 라인 패치, exact Task Packet 으로 위임 가능 |
| T4b | T3 ratify 후 implement 에이전트 호출 — `.env.example` 1 줄 + 주석 2 줄 추가 (E10) | `.env.example` | Y — 단일 파일 insertion 1건. T4a 와 병렬 가능 |
| T5 | Main session: subagent result packet 통합 + 검증 (grep으로 claim ↔ 파일 line 재대조, `node scripts/ai-workflow-check.mjs` 실행) | (전체) | N — 통합 책임 |
| T6 | Codex Round 2 — 정정본 재검수 (callback/reset/env/rate-limit 4 항목 집중) | (외부) | N — cross-model review 의무 |
| T7 | 완료 보고서 + ledger 마무리 | `reports/auth-overview-codex-fix-complete-20260527.html`, ledger | N — main 책임 |

---

## Task 0: Codex Round 1 plan-eng-review

**Files:** `tasks/codex-prompt-auth-overview-fix-plan-review-round1.md` (생성)

- [ ] **Step 1: 프롬프트 작성** — plan 파일을 ground-truth 와 함께 검수받기. 강조 포인트:
  1. P0 3건의 정정 방향이 실제 코드와 정확히 매핑되는가
  2. SBU 묶음 (P0-3a + P0-3b) 선정이 합리적인가
  3. P1 5건의 정정 위치 (auth-overview.md 내 line 번호) 가 맞는가
  4. Out of Scope 에서 빠뜨린 것 또는 잘못 뺀 것이 있는가
  5. T4 implement 에이전트에게 전달할 write scope 가 명확한가
  6. P0-3a (.env.example 수정) 가 본 plan 의 scope 에 포함된 것이 적절한가, 별건 분리 추천하는가

- [ ] **Step 2: codex exec 실행 (background)**

```bash
codex exec --sandbox workspace-write \
  -C "$(pwd)" \
  - < tasks/codex-prompt-auth-overview-fix-plan-review-round1.md \
  > tasks/codex-output-auth-overview-fix-plan-review-round1.md \
  2> tasks/codex-runs/stderr-auth-overview-fix-plan-review-round1.txt
```
> codex 가 본 plan + 적발된 ground-truth 파일들을 직접 grep 하면서 검수.

- [ ] **Step 3: 결과 verdict 분류**
  - PASS / CONCERN → Task 1 skip, Task 2 로 (PASS gate 확정 기록)
  - FAIL → Task 1 진입

## Task 1: Round 1 결과 분석 + plan revise (조건부)

**Files:** 본 plan

- [ ] **Step 1**: Codex 응답을 dimension 별로 분해. PASS · CONCERN · FAIL 카운트. FAIL 발생 시 disagreement-resolution 룰 적용 (review-gates.md §Plan-Review PASS Gate):
  - 1라운드 안에 main + codex 각자 position + rationale + trade-off ledger 에 기록
  - 정량 기준 (line count, checker PASS, 명시 user rule) 우선 적용
  - 정량으로 안 풀리면 weakness acknowledgement 라운드
- [ ] **Step 2**: 합의된 변경 사항을 plan 의 *모든 레이어* 에 동시 반영 (planning-contracts.md §"When Scope Changes" — Scope summary → Out of Scope → Task table → 세부 task → Architecture → Risks → Verification Strategy 7개 레이어)
- [ ] **Step 3**: ledger Decisions 표에 Round 1 verdict + revise 내용 + timestamp 기록

## Task 2: (fall-back only) Codex plan Round 2

**Files:** `tasks/codex-prompt-auth-overview-fix-plan-review-round2.md` (T2 가 실제로 invoke 될 때만 생성)

**기본 경로**: 사용자 명시 룰 ("최종 결정은 별도 GPT") 에 따라 **T2 는 default skip**. T0 결과 (PASS / CONCERN / FAIL) 와 무관하게:
- T0 = PASS / CONCERN → ledger 기록 후 바로 Task 3 (T3 ratify) 진입
- T0 = FAIL → ledger Decisions 에 disagreement-resolution 기록 + plan revise → 바로 Task 3 진입 (T2 skip)

**T2 fall-back invoke 조건 (예외)**: T3 ratify 가 HOLD 를 반환하면서 "plan-level deep review needed — single-round fixes 로는 불충분" 같은 *명시적 plan-review 요청* 을 할 때만 invoke. 일반적인 wording/numbering 정정 등은 T3 가 직접 지적하고 main 이 revise 후 T3 재호출하는 경로가 표준.

- [ ] **Step 1 (기본 경로 — T0 모든 verdict)**: ledger 에 "T2 skip — substituted by T3 ratify per user mandate. T0 verdict: <PASS/CONCERN/FAIL> 기록" 적고 Task 3 으로.
- [ ] **Step 2 (T3 가 명시적 plan-level review 요청한 fall-back 경로)**: Revised plan 으로 codex Round 2 실행 (Task 0 와 동일 패턴, 라운드 표시만 변경). Round-cap: Plan review counter base 3. T2 가 PASS/CONCERN/FAIL 반환 → Task 3 재호출 (T3 counter +1).
- [ ] **Step 3 (T2 도 FAIL — counter 누적)**: ledger Disagreement 섹션에 옵션 A/B + 추천 작성 → 사용자 escalation.

## Task 3: 최종 결정 별도 GPT 에이전트 ratify

**Files:** `tasks/codex-prompt-auth-overview-fix-final-ratify.md` (생성)

> 사용자 명시 요구: "최종 결정은 별도 GPT 에이전트가 한다". 이전 라운드 대화 컨텍스트에 오염되지 않은 fresh codex 세션이 GO/NO-GO 결정. T2 PASS 와 별개로 final gate 의 의미.

- [ ] **Step 1 프롬프트 구성**: ratify agent 가 받을 input
  - 본 plan 파일 (정정본)
  - Codex Round 1 (그리고 있으면 Round 2) 응답 원본
  - Round 간 disagreement-resolution 기록 (있으면)
  - Ground-truth 파일들의 현재 상태 (callback/route.ts, .env.example 등)
  - 명시 질문: "이 plan 을 별도 implement 에이전트에게 dispatch 해도 안전한가? GO / HOLD / NO-GO 중 하나로 답하라. HOLD 면 무엇을 추가 검증해야 하는지, NO-GO 면 어떤 근본 문제가 있는지."
- [ ] **Step 2 실행**: `codex exec --sandbox workspace-write` 동일 패턴
- [ ] **Step 3 결과 분기**:
  - **GO** → Task 4 로
  - **HOLD** → 추가 검증 후 Task 3 재시도 (라운드 카운트 +1, 3 라운드 초과 시 사용자 escalation)
  - **NO-GO** → 사용자 escalation 의무

## Task 4a/4b: Implement 에이전트 dispatch (T3 GO 후만)

**Files:** `docs/development/auth-overview.md` (T4a), `.env.example` (T4b)

두 파일이 독립적이므로 **T4a 와 T4b 는 병렬 dispatch 가능**. 각 subagent 는 별도 Task Packet 으로 위임. 두 packet 의 `Files not to touch` 는 상대방 파일을 포함해 cross-write 차단.

### Task Packet (T4a — auth-overview.md, 11 edit)

```
- Agent: Claude (Agent tool, general-purpose subagent, isolation=worktree 권장)
- Role: Documentation fix implementer (auth-overview.md only)
- Objective: docs/development/auth-overview.md 의 P0/P1 적발 정정 — Edit-by-Edit Table 의 E1~E9, E11 적용 (E10 은 T4b 가 처리)
- Audience: n/a (non-UI / non-permission docs work)
- Accepted scope: docs/development/auth-overview.md 만. 다른 파일 일체 금지 (.env.example 포함 — T4b 가 처리).
- Out of scope: 코드, 마이그레이션, IA description.md, user-flow.md, CLAUDE.md, REASON_CONTENT 정의, test 파일, .env.example
- Docs consulted: 본 plan + Codex Round 1 output + 본 plan §"Per-Edit Verification Targets" 표
- Extracted requirements: Edit-by-Edit Table 의 **E1·E2·E3·E4·E5·E6·E7·E8·E8b·E9·E11 — 총 11 edit** 정확히 적용. E8 과 E8b 는 §10 SSoT 매트릭스의 *서로 다른 행* 을 수정하는 별도 edit (E8 = "새 ?reason= 추가" 행, E8b = "라우트 path 변경" 행). E10 은 본 packet scope 아님 — T4b 가 처리.
- Exact read scope: 본 plan, codex output, auth-overview.md, src/app/auth/callback/route.ts, src/components/auth/PasswordResetRequestForm.tsx, src/components/auth/SignUpForm.tsx (cross-check 용)
- Exact write scope: docs/development/auth-overview.md
- Files not to touch: .env.example, src/**, supabase/**, docs/IA/**, docs/flow/**, CLAUDE.md, tests/**, 다른 docs/development/*.md
- Constraints:
  - 단일 edit 당 정확한 Edit tool old_string/new_string 사용
  - 한국어 톤은 기존 문서와 동일 (development/ 위치이므로 엔지니어 어휘 허용)
  - 모든 line 번호 인용은 정정 후 doc 의 line 기준이 아니라 코드/마이그레이션의 line 기준
- Required verification: §"Per-Edit Verification Targets" 표의 E1~E9, E11 verification 명령 통과
- Expected output: Result Packet + 11 edit 의 before/after 요약 + verification 결과
- Context ledger path: docs/ai-workflow/runs/2026/05/27/20260527-1600-auth-overview-codex-fix.md
```

### Task Packet (T4b — .env.example, 1 edit)

```
- Agent: Claude (Agent tool, general-purpose subagent, isolation=worktree 권장)
- Role: Config example fix implementer (.env.example only)
- Objective: .env.example 에 NEXT_PUBLIC_SITE_URL 1줄 + 주석 2줄 추가 (E10)
- Audience: n/a (non-UI / non-permission config work)
- Accepted scope: .env.example 만.
- Out of scope: 다른 모든 파일
- Docs consulted: 본 plan + src/lib/auth/redirect-url.ts:29-35 (E10 의 정당화 근거)
- Extracted requirements: E10 의 정확한 3 줄 추가
- Exact read scope: .env.example, src/lib/auth/redirect-url.ts
- Exact write scope: .env.example
- Files not to touch: docs/development/auth-overview.md (T4a 가 처리), src/**, supabase/**, docs/**, tests/**
- Constraints:
  - 기존 line 14 (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) 와 line 15 (ACCESS_TOKEN) 사이에 삽입
  - 한국어 주석 금지 (기존 파일이 영어 주석 일관성 유지)
- Required verification: §"Per-Edit Verification Targets" 표의 E10 verification 명령 통과
- Expected output: Result Packet + before/after 요약
- Context ledger path: docs/ai-workflow/runs/2026/05/27/20260527-1600-auth-overview-codex-fix.md
```

### Round 1 Finding ↔ Edit Traceability

Codex Round 1 의 모든 FAIL/CONCERN dimension 이 어느 edit 로 닫히는지 1:1 매핑. 빠진 항목 = 누락 = revise 트리거.

| Round 1 dim | Verdict | Closed by | Justification |
| --- | --- | --- | --- |
| #1 코드 참조 정확성 | FAIL | E2, E3 | callback page.tsx → route.ts + callback-fragment/page.tsx |
| #2 운영 정책 정확성 | CONCERN | E5, E6 | OTP rate 표, refresh token 설명 |
| #3 11종 reason 표 | PASS | (no edit) | 이미 일치 |
| #4 SSoT 매트릭스 drift | CONCERN | E8, E8b | 테스트 파일 누락 |
| #5 프로젝트 state 정직성 | CONCERN | E1 | 최상단 worktree 기준 1줄 |
| #6 vibe coder 톤 | PASS | (no edit) | 균형 적절 |
| #7 누락 시나리오 | CONCERN | (cut to OoS) | P2 후순위, 본 plan §Out of Scope 의 "deployment.md 통합" 과 같은 별건 |
| #8 디버깅 SQL | CONCERN | E9 | 위험 명령 삭제 |
| #9 Mermaid 다이어그램 | PASS | (no edit, indirectly E4) | reset 흐름 수정으로 mermaid 와도 정합 |
| #10a Cross-doc: reset 흐름 | FAIL | E4 | callback 미경유 명시 |
| #10b Cross-doc: NEXT_PUBLIC_SITE_URL | FAIL | E7, E10 | .env.example 추가 + doc 비고 정정 |
| #10c Cross-doc: PW 8-64 drift | FAIL | E11 | drift 기록 (Codex Round 1 후 in-scope 전환) |
| Cross-cutting: 용어집 | (PASS 의 nice-to-have) | (no edit) | P2 별건 |

### Per-Edit Verification Targets

각 edit 가 실제로 적용됐는지 기계적으로 확인하는 grep/명령 표. Implement subagent 의 Result Packet 의 `Tests/checks run` 에 그대로 옮길 수 있음.

| Edit | Verification command (PowerShell 또는 bash) | Expected result |
| --- | --- | --- |
| E1 | `grep -n "worktree 구현 기준" docs/development/auth-overview.md` | ≥ 1 hit |
| E2 | `grep -nE "callback/page\.tsx" docs/development/auth-overview.md` | 0 hits |
| E2 | `grep -n "callback/route.ts" docs/development/auth-overview.md` | ≥ 1 hit |
| E2 | `grep -n "callback-fragment/page.tsx" docs/development/auth-overview.md` | ≥ 1 hit |
| E3 | `grep -n "서버 컴포넌트가 다음 순서로" docs/development/auth-overview.md` | 0 hits |
| E3 | `grep -n "Route Handler 가 다음 순서로" docs/development/auth-overview.md` | ≥ 1 hit |
| E4 | `grep -n "callback 거쳐" docs/development/auth-overview.md` | 0 hits |
| E4 | `grep -n "verify endpoint" docs/development/auth-overview.md` | ≥ 1 hit |
| E5 | `grep -n "30/hour (목표값)" docs/development/auth-overview.md` | 0 hits |
| E5 | `grep -n "360/hour" docs/development/auth-overview.md` | ≥ 1 hit |
| E6 | `grep -n "60일 (sliding)" docs/development/auth-overview.md` | 0 hits |
| E6 | `grep -n "1회 사용으로 회전" docs/development/auth-overview.md` | ≥ 1 hit |
| E7 | `grep -n "E10 적용 후" docs/development/auth-overview.md` | ≥ 1 hit |
| E8 | `grep -n "error-mapping.test.ts" docs/development/auth-overview.md` | ≥ 1 hit |
| E8b | `grep -n "route-matrix.test.ts" docs/development/auth-overview.md` | ≥ 1 hit |
| E9 | `grep -n "supabase db remote commit" docs/development/auth-overview.md` | 0 hits |
| E10 | `grep -n "NEXT_PUBLIC_SITE_URL" .env.example` | ≥ 1 hit |
| E10 | `grep -n "Absolute site URL for Supabase" .env.example` | ≥ 1 hit |
| E11 | `grep -n "Known doc-↔-impl drift" docs/development/auth-overview.md` | ≥ 1 hit |
| E11 | `grep -n "PW 8-64자 명세" docs/development/auth-overview.md` | ≥ 1 hit |

총 20개 grep 명령. 모두 통과해야 T5 verify 성공.

### Edit-by-Edit Table

> **Edit ID 규칙 (T3 ratify v1 의 #2 지적 수용):**
> - **T4a 의 11개 edit**: E1, E2, E3, E4, E5, E6, E7, E8, E8b, E9, E11 — 모두 `docs/development/auth-overview.md` 의 *서로 다른* 위치를 수정.
> - **T4b 의 1개 edit**: E10 — `.env.example` 수정.
> - **E8 과 E8b 는 sub-check 가 아니라 별도 edit**. §10 SSoT 매트릭스의 두 행 ("새 ?reason= 추가" 행 vs "라우트 path 변경" 행) 을 각각 수정. ID 가 `8b` 로 어색해 보일 수 있으나 v1→v2 revise 때 행을 끼워 넣었고 후속 grep target/traceability 매핑이 이미 E8b 를 가리키고 있어 보존 (재번호화 시 cross-reference drift 위험 더 큼).
> - 총 **12 edit** (T4a 11 + T4b 1).

| # | Section | 현재 (틀림) | 정정 |
| --- | --- | --- | --- |
| E1 | 문서 최상단 (after `> Last updated:` block) | 없음 | "주의: 루트 CLAUDE.md 의 pre-implementation 표기는 stale. 이 문서는 2026-05-27 현재 worktree 구현 기준" 1 줄 |
| E2 | §3 화면 ↔ 라우트 ↔ 코드 매핑 표의 "인증 콜백" 행 | `src/app/auth/callback/page.tsx` + `CallbackFragmentFallback.tsx` | `src/app/auth/callback/route.ts` (Route Handler) + `src/app/auth/callback-fragment/page.tsx` (`CallbackFragmentFallback.tsx`) |
| E3 | §4.4 첫 문장 + 표 헤더 | "서버 컴포넌트가 다음 순서로 처리한다" | "Route Handler 가 다음 순서로 처리한다. (server component 였을 때 발생한 cookie silent-fail 문제 때문에 Phase 8 follow-up P0 fix 에서 Route Handler 로 전환. 자세한 사유는 `route.ts:1-18` 주석)" |
| E4 | §4.3 비밀번호 재설정 흐름 step 2 | "사용자가 메일 링크 클릭 → `/auth/callback` 거쳐 세션 확보 → `/password-reset/confirm`" | "사용자가 메일 링크 클릭 → Supabase verify endpoint (자체 호스팅) 에서 토큰 교환 + recovery 세션 쿠키 set → `redirectTo` 값인 `/password-reset/confirm` 으로 redirect. `/auth/callback` 은 미경유 (PasswordResetRequestForm.tsx:22 의 redirectTo 가 직접 confirm 페이지를 가리킴)" |
| E5 | §6.3 Rate limit 표의 "프로젝트 OTP 한도" 행 | "30/hour (목표값)" | "Dashboard 설정 확인 필요. Supabase 공식 기본값: OTP 360/hour (`supabase.com/docs/guides/deployment/going-into-prod`). custom SMTP 도입 후 첫 시간 30/hour 부터 ramp-up" |
| E6 | §9 Q5 세션 자동 로그아웃 답변 | "Supabase 기본 access token: 1시간, refresh token: 60일 (sliding)" | "access token 기본 1시간. refresh token 은 기본 만료 없음 — 1회 사용으로 회전 (`supabase.com/docs/guides/auth/sessions`). Inactivity timeout 은 Dashboard Auth 설정값에 따름" |
| E7 | §7 환경 변수 표의 `NEXT_PUBLIC_SITE_URL` 행 비고 | "production 에서 필수" | "production 에서 필수. `redirect-url.ts:29-35` 가 미설정 시 throw. **E10 적용 후 `.env.example` 에 추가됨** (시간순: E10 이 먼저 적용되어야 본 비고가 사실이 됨)" |
| E8 | §10 SSoT 매트릭스의 "새 `?reason=` 추가" 행 | (현재 목록) | 끝에 `tests/lib/auth/error-mapping.test.ts` 추가 |
| E8b | §10 SSoT 매트릭스의 "라우트 path 변경" 행 | (현재 목록) | 끝에 `tests/integration/route-matrix.test.ts`, `docs/sitemap.md` (auth callback rows) 추가 |
| E9 | §11 첫 코드 블록의 첫 줄 | `supabase db remote commit --linked  # (필요 시)` | 삭제. 위에 한 줄 주석으로 "이미 `supabase link` 된 DB 에서 실행" |
| E10 | `.env.example` line 14 와 15 사이 | (NEXT_PUBLIC_SITE_URL 누락) | `# Absolute site URL for Supabase auth redirects (e.g. emailRedirectTo).` 1 줄 + `# Required in non-development; redirect-url.ts throws if unset.` 1 줄 + `NEXT_PUBLIC_SITE_URL=https://your-deploy-domain.example` 1 줄 추가 |
| E11 | §10 SSoT 매트릭스 직후 (또는 표의 새 행) | (없음) | "**Known doc-↔-impl drift (2026-05-27)**: IA A-01 (`description.md:58-60`)·X-06 (`description.md:52-54`) 는 PW 8-64자 명세. 실제 구현은 `SignUpForm.tsx:71-77`, `PasswordResetConfirmForm.tsx:43-49` 의 `min: 8` only (max 미적용). 본 plan 은 drift 사실만 기록 — 구현 통일 또는 명세 완화는 product 결정 후 별건 PR" 1 단락 추가. Codex Round 1 FAIL #10c (cross-doc conflict) 수용. |

## Task 5: Main session 통합 + 검증

- [ ] **Step 1**: Subagent Result Packet 수신
- [ ] **Step 2**: `Files changed` ↔ accepted scope 매칭 확인 (auth-overview.md + .env.example 만)
- [ ] **Step 3**: grep 검증 4개 명령어 실행 (위 Task 4 Required verification)
- [ ] **Step 4**: `node scripts/ai-workflow-check.mjs --repo .` 실행 → PASS 확인
- [ ] **Step 5**: ledger Verification State 갱신

## Task 6: Codex Round 2 — 정정본 재검수

**Files:** `tasks/codex-prompt-auth-overview-review-round2.md` (생성, scope: callback/reset/env/rate-limit 4 항목만 집중)

- [ ] **Step 1**: 4 항목 집중 프롬프트 구성 (Round 1 와 달리 dimension 1·2·10 만 verify, dimension 3·6·9 (PASS 받은 것) 재확인 생략)
- [ ] **Step 2**: `codex exec` 실행
- [ ] **Step 3**: Round 2 verdict 분류:
  - PASS → Task 7
  - CONCERN → 사용자 확인 후 Task 7 진행 (정정본의 CONCERN 은 fail-closed 아님)
  - FAIL → Round 3 또는 사용자 escalation (Round-cap 3)

## Task 7: 완료 보고서 + ledger 마무리

- [ ] **Step 1**: `reports/auth-overview-codex-fix-complete-20260527.html` 작성 — Round 1 FAIL → 정정 → Round 2 PASS 의 before/after, 12 edit (T4a 11 + T4b 1) 의 적용 결과, ratify agent 결정 timestamp
- [ ] **Step 2**: ledger Status: complete, Verification State 모든 필드 채움, Cross-model review 기록
- [ ] **Step 3**: `node scripts/ai-workflow-check.mjs --repo .` 최종 실행, Git publication decision (`no-commit` / `local-commit` / `push-and-pr` / `blocked`) 명시

---

## Test Strategy

본 plan 은 documentation-only 변경 → review-gates.md §TDD `Documentation-only changes` 예외 적용. 정식 RED/GREEN 사이클 면제.

**Substitute verification:**
- grep 기반 false-claim hunting: `grep -n "callback/page.tsx" docs/development/auth-overview.md` 등 4개 명령. 각각 0 hits (또는 1 hits) 확인.
- `node scripts/ai-workflow-check.mjs --repo .` — plan/ledger 컨트랙트 위반 검사.
- Codex Round 2 cross-model verification — 정정본을 ground-truth 와 다시 대조.
- Implement 에이전트 의 self-checklist (T4a Result Packet 에 11 edit 적용 확인 + T4b Result Packet 에 1 edit 적용 확인 = 12 edit 총합).

**No-test-runtime justification:** auth-overview.md 정정은 사용자 노출 동작을 바꾸지 않음 (코드 무변경). 테스트 추가 자리가 없음. 정정 자체의 정확성은 ground-truth grep + Codex Round 2 에서 검증.

## Known Risks

| # | 위험 | 영향 | 완화 |
| --- | --- | --- | --- |
| R1 | T3 ratify 에이전트가 NO-GO 를 반복적으로 내면 진척 불가 | Stuck | Round-cap 3, 그 후 사용자 escalation 의무 |
| R2 | Subagent 가 write scope 를 벗어나 코드 파일 수정 | 무관 파일 corruption | Task Packet `Files not to touch` 명시 + Result Packet `Files changed` 검증 + isolation=worktree 사용 권장 |
| R3 | E9 (digital-debug command 삭제) 가 기존 사용자에게 손실 | 기존 워크플로 깨짐 | 본 명령은 디버깅 자리에 부적절. 대체 한 줄 설명 제공. 운영 매뉴얼이 별도 없음 (auth-overview.md §11 만 영향) |
| R4 | E10 (.env.example 에 NEXT_PUBLIC_SITE_URL 추가) 가 다른 deployment 가이드 와 충돌 | 환경 변수 정의 drift | `docs/development/deployment.md` 의 환경 변수 표 cross-check. 충돌 시 별도 PR 로 정합. |
| R5 | Codex Round 2 가 FAIL 을 또 발견 (Round 1 에서 PASS 받은 dimension 3·6·9 가 사실은 정확하지 않았을 가능성) | 검증 신뢰도 저하 | Round 2 프롬프트에 "Round 1 PASS dimension 도 다시 보되, scope 는 정정된 4 항목에 우선" 명시 |
| R6 | T3 ratify 와 T6 Round 2 가 중복으로 보일 수 있음 | 사용자 혼동 | 명확히 구분: T3 = pre-implementation gate (plan 자체 GO/NO-GO), T6 = post-implementation gate (정정된 doc 의 cross-model review). 둘 다 mandatory per review-gates.md (T6 는 cross-model review, T3 는 사용자 명시 요구) |
| R7 | Codex CLI 가 mid-flow 에 unavailable (network, license, daemon crash) | T0/T3/T6 진행 불가 | `fallback-and-recovery.md` 의 degraded mode 적용 — ledger 의 `Cross-model review` 필드에 `degraded — codex unavailable, <reason>` 기록. 사용자 escalation 의무. 본 plan 의 verification chain 약화 명시. |
| R8 | T3 ratify 가 non-actionable HOLD 반환 ("뭔가 미심쩍지만 무엇인지 못 짚음") | 진행 freeze | 사용자 escalation. 가능하면 T3 프롬프트에 "HOLD 면 무엇을 추가 검증해야 하는지 *구체적* 으로" 강제 (현재 plan §T3 Step 1 에 이미 포함). 그래도 non-actionable 이면 round-cap 으로 차단. |
| R9 | E10 (`.env.example` 에 `NEXT_PUBLIC_SITE_URL` 추가) 가 Vercel/CI env policy 와 충돌 | deploy 실패 | `.env.example` 은 *예시* 라 직접 환경 변수를 주입하지 않음. 그러나 일부 CI 가 `.env.example` 의 키를 "required" 로 해석하는 deploy 가드를 가질 수 있음. R9 완화: `docs/development/deployment.md` 의 환경 변수 표를 cross-check (본 plan §Untouched relevant docs 에 명시). 충돌 발견 시 별건 PR. |

## Acceptance Criteria

- [ ] **총 12 edit (T4a 11 + T4b 1)** 모두 적용됨 — T4a: E1·E2·E3·E4·E5·E6·E7·E8·E8b·E9·E11 (auth-overview.md), T4b: E10 (.env.example). **§"Per-Edit Verification Targets" 표의 20 grep 명령 전부 통과** (개수 단위로 verify; "grep verifiable" 의 의미가 모호하다는 Round 1 #10 지적 수용)
- [ ] `node scripts/ai-workflow-check.mjs --repo .` PASS (Node 부재 시 degraded — ledger 에 `Cross-model review: degraded — <reason>` 기록 + 사용자 승인 필요)
- [ ] Codex Round 2 verdict ∈ {PASS, CONCERN}. **CONCERN 의 경우 각 concern 마다 ledger §Decisions 또는 §Verification State 에 `concern: <text> / reason accepted: <text> / residual risk: <text>` 3 필드로 기록** (review-gates.md:48 "accepted with reason" 의 구체 형식)
- [ ] T3 ratify agent verdict: **GO** (HOLD 는 추가 검증 후 T3 재시도; NO-GO 는 사용자 escalation; 본 criterion 은 GO 만 만족)
- [ ] Ledger `Status: complete`, `Verification State` 모든 필드 채움, `Cross-model review` 기록 있음 (T0/T3/T6 모두)
- [ ] 완료 보고서 `reports/auth-overview-codex-fix-complete-20260527.html` 작성
- [ ] Git publication decision (`no-commit` / `local-commit` / `push-and-pr` / `blocked`) 명시 (review-gates.md §Finish)

## Verification Strategy

review-gates.md 의 모든 가능 가게 매핑:

| Gate | 적용 여부 | 본 plan 의 처리 |
| --- | --- | --- |
| TDD cycle | 면제 — Documentation-only changes 예외 | Substitute verification: grep + checker + Codex Round 2 |
| Cross-model review | 필수 | T0 (Round 1) + T6 (Round 2) Codex |
| **Plan-Review PASS Gate** | **필수 (현재 진행 중)** | T0 → T1 → **T3 ratify** (사용자 명시 룰 "최종 결정은 별도 GPT" → T3 가 표준 re-review 를 대체. T2 는 T3 HOLD 가 "plan 자체 추가 review 필요" 명시할 때만 fall-back invoke) |
| Code/Doc Review Gate | 적용 — doc 변경 | T6 Codex Round 2 가 review 역할 겸함 |
| Architecture Pass | n/a — phase ledger 아니고 코드 boundary 무변경 |
| UX/UI Consistency Pass | n/a — UI 코드 무변경 (`docs/development/` 만) |
| QA Gate | n/a — UI 무변경 |
| Finish | 적용 | `node scripts/ai-workflow-check.mjs` + Git publication decision + 본 plan 의 Acceptance Criteria 통과 |

**3-Layer Gate 요약** (사용자 명시 요구):

```
T0 (Codex Round 1 plan review)
   ↓
PASS → T3 직행
FAIL → T1 revise → T3 (T2 skip — 사용자 룰)

T3 (별도 fresh GPT agent ratify — GO / HOLD / NO-GO)
   ↓
GO → T4a + T4b
HOLD → revise → T3 재실행 (round counter +1)
HOLD with "plan-level deep review needed" → T2 fall-back invoke
NO-GO → 사용자 escalation

T4a + T4b (Implement subagents, 병렬 가능)
   ↓
T5 (Main session verify — 20 grep + checker)
   ↓
T6 (Codex Round 2 — post-implementation review)
   ↓
T7 (Final report + ledger close)
```

**Round counter 독립성** (Round 1 #8 수용):

- **Plan review counter** (T0 + T2 fall-back): max 3 rounds. T2 는 대부분의 경우 skip 이라 카운터 거의 안 씀. 초과 시 사용자 escalation.
- **Ratify counter** (T3): max 3 rounds. HOLD 후 추가 검증 → T3 재실행. 3회 초과 시 사용자 escalation.
- **Post-impl review counter** (T6): max 3 rounds. FAIL 시 정정본 재revise → T6 재실행.

각 counter 는 *독립적* 으로 관리 — 한 counter 의 소진이 다른 counter 를 막지 않음. 단, 모든 counter 의 누적 합이 9 를 초과하면 사용자에게 plan 자체 재검토 escalation.

---

## Status Track

- [ ] T0 — Codex Round 1 plan-eng-review
- [ ] T1 — Revise (conditional)
- [ ] T2 — Round 2 (fall-back only, usually skip per user mandate)
- [ ] T3 — Final ratify by separate GPT agent
- [ ] T4 — Implement subagent dispatch
- [ ] T5 — Main session integrate + verify
- [ ] T6 — Codex Round 2 post-implementation
- [ ] T7 — Report + ledger close
