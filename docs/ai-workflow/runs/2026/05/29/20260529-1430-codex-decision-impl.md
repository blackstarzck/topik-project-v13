# Codex 결정 구현 — 1차 + 2차 배치 (D2 / D3 / D4 / D5 / D6 / D7 / D8 / D9 / D10)

- Run start: 2026-05-29 14:30 (KST)
- Predecessor: `20260529-1105-p4-handoff.md` (codex 위임 완료) + `phase-5-cross-audit-results.md` (cross-audit + 인프라 정리)
- Coordinator: Claude Code Opus 4.7

## Goal

P4 codex 위임 10건 중, 변경 범위가 작고 cross-audit 합의가 명확한 5건을 1차 배치로 코드/문서에 반영.

## Docs consulted

- `reports/ia-verification/runs/20260528-141731/manual-review.json` (codex verdicts + reasoning)
- `docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/D{2,3,6,9,10}-*.md` (원본 verdicts)
- `docs/IA/01-A-01-sign-up/description.md` (displayName spec)
- `docs/IA/23-X-01-product-landing/description.md` (CTA spec)
- `docs/IA/28-X-06-password-reset/description.md` (Stepper spec — to be updated by D6)
- `docs/IA/33-X-11-auth-error/description.md` (X-11 H1)
- `docs/IA/34-X-12-auth-verify-email/description.md` (X-12 H1 + SMTP copy)
- `docs/development/auth-overview.md` §6.3 (SMTP 2/hour 한도)
- `tests/e2e/coverage/ia-catalog.ts` (CTA regex — keep)

## Tasks

| ID | 변경 위치 | 종류 | Subagent-eligible? |
| --- | --- | --- | --- |
| D9 | src/app/auth/error/page.tsx + src/app/auth/verify-email/page.tsx | code | N — 4줄 변경 |
| D2 | src/components/landing/Hero.tsx (line 24) | code | N — 1줄 변경 |
| D10 | src/components/auth/VerifyEmailCard.tsx (Paragraph 추가) | code | N — 1줄 추가 |
| D6 | docs/IA/28-X-06-password-reset/description.md (단계 표시 부분) | docs | N — 1 section 수정 |
| D3 | src/components/auth/SignUpForm.tsx (line 103) | code | N — Form.Item rules + label |

2차 배치 (이번 세션 후속) — D4 / D5 / D7 / D8:

| ID | 변경 위치 | 종류 |
| --- | --- | --- |
| D4 | src/app/terms/page.tsx + src/app/privacy/page.tsx (신설) + src/components/auth/SignUpForm.tsx (체크박스 anchor) + src/lib/routes.ts (PUBLIC_PATHS 추가) | code |
| D5 | src/components/auth/LoginForm.tsx (실패 카운터 UX 힌트) + docs/IA/02-A-02-login/description.md (잠금 spec 정정) | code + docs |
| D7 | src/lib/auth/use-email-cooldown.ts (신설 hook) + src/components/auth/PasswordResetRequestForm.tsx (적용) | code |
| D8 | src/lib/auth/error-mapping.ts (RATE_LIMIT_FALLBACK_SECONDS export) + src/app/auth/callback/route.ts (rateLimitFallback + 2 call sites) | code |

D8 한계 (정직 보고): supabase-js v2 의 AuthError 는 response headers 를 노출 안 함. 진짜 Retry-After 헤더 forward 는 custom fetch interceptor 가 필요한데 별도 PR 범위. 현 fix 는 rate-limit code 일 때 60s default 를 호출자(callback) 에서 explicit forward — 이전엔 항상 null 이라 AuthErrorCard 의 implicit default 가 받아주는 구조. 동작 변화는 미세 (X-11 카드 카운트다운이 명시적 60s 시작) 이지만 의도가 코드에 드러남.

## Write scope

- src/app/auth/error/page.tsx
- src/app/auth/verify-email/page.tsx
- src/components/landing/Hero.tsx
- src/components/auth/VerifyEmailCard.tsx
- src/components/auth/SignUpForm.tsx
- docs/IA/28-X-06-password-reset/description.md

## Constraints

- D9: visible UI 영향 0 (Codex 명시) — sr-only h1 만 추가, Card 내부 Typography.Title level=3 유지.
- D2: tests/e2e/coverage/ia-catalog.ts 의 regex `/(무료\\s*시작|시작하기|회원가입)/i` 유지 (라벨이 regex에 매치되므로 자동 검수도 OK).
- D10: VerifyEmailCard 의 기존 카피 톤 유지, neutral pre-emptive 안내 한 줄만 삽입.
- D6: description.md `Wireframe Number Map` 의 단계 표시 row + Detailed Description 의 단계 표시 섹션을 두 페이지 흐름으로 정정. `wireframe.png` 이미지 자체는 수정 범위 밖 (별도 디자인 작업).
- D3: SignUpForm `displayName` 을 required + `min:2, max:30` rule 로 변경. label '이름 (선택)' → '이름'. signUp data 호출부에서 `values.displayName ? { display_name: values.displayName } : undefined` → 그대로 두되 required 이므로 항상 값 존재.

## Verification

- `pnpm tsc --noEmit` (또는 next build dry-run) — type-check 통과.
- 가능하면 dev server 띄워 4 페이지 (/, /auth/error, /auth/verify-email, /sign-up) 스모크 확인.
- 기존 vitest / playwright suite 가 깨지는지 확인 (특히 ia-catalog regex 변동 없으므로 OK 예상).

## Verification result — 2차 배치 (2026-05-29 KST)

- `pnpm tsc --noEmit`: 동일 pre-existing 2 errors. 신규 없음.
- `pnpm vitest run tests/integration/route-matrix.test.ts`: **59/59 PASS** (PUBLIC_PATHS iter 가 /terms /privacy 도 자동 cover).
- `pnpm vitest run tests/scripts/ia-audit-scripts.test.ts`: **4/4 PASS**.
- Dev server smoke (PID 45052, HMR):
  - `GET /terms` → 200 + `이용약관` 본문 ✓
  - `GET /privacy` → 200 + `개인정보처리방침` 본문 ✓
  - `GET /sign-up` → 체크박스 라벨에 `<a target="_blank" href="/terms">이용약관</a>` + `<a href="/privacy">개인정보처리방침</a>` 두 링크 ✓
  - `GET /password-reset` → 200 (cooldown 0 상태) ✓
  - `GET /login` → 200 (실패 카운터는 interaction 후 visible)

## Verification result — 1차 배치 (2026-05-29 15:00 KST)

- `pnpm tsc --noEmit`: pre-existing 2 errors (`coverage-matrix.spec.ts` FixtureIdType, `theme-context.test.tsx` Binding element). Stash diff 확인 — 이번 변경과 무관.
- Dev server (PID 45052, 사용자 기존 인스턴스, HMR 활성) 에 5건 변경 모두 반영됨:
  - `GET /` → `<button>무료 시작</button>` ✓
  - `GET /auth/error` → `<h1 style="...sr-only...">인증 오류</h1>` ✓
  - `GET /auth/verify-email` → sr-only h1 "이메일 인증" + Paragraph "메일이 자주 발송되면 몇 분 후 다시 시도해주세요." ✓
  - `GET /sign-up` → label "이름" (선택 표기 제거) ✓
- catalog regex `/(무료\\s*시작|시작하기|회원가입)/i` 가 "무료 시작" 에 매치 (Node REPL `true`) — D2 적용으로 catalog 미수정.

## Out of scope

- D4 /terms /privacy 페이지 신설 — 별도 PR 권장 (legal copy 검토 필요).
- D5 / D7 / D8 — 다음 배치.
- Phase 2 dev-server 재실행 / Phase 6 agent-integration — codex 결정 코드 반영 끝나면 진행.
- IA description.md ↔ impl PASS 라벨 확정 — 인프라 블로커 정리 별도 필요.
