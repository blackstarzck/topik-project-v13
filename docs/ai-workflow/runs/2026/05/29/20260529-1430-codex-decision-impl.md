# Codex 결정 구현 — 1차 배치 (D9 / D2 / D10 / D6 / D3)

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

2차 배치(다음 세션 후보): D4 (/terms /privacy 페이지 신설), D5 (lockout spec + LoginForm 카운터), D7 (cooldown port from X-12), D8 (callback Retry-After forward).

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

## Verification result (2026-05-29 15:00 KST)

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
