# Codex GPT 5.5 — Decision Delegate (User Decision Pack for TALKPIK AI)

You are acting as a **decision delegate** on behalf of the user (project owner, "vibe coder" — reads code but is not a professional developer). The Opus 4.7 + Codex round-1 review resulted in 2 items that need user judgment.

Your task: prepare a structured decision pack the user can answer in one short session, then state your own recommendation per item.

## Context

The Implementation Coverage Audit completed (Plan rev4, 4 Codex rounds, post-audit FAIL → fixed). 13 P0/P1 findings have fix proposals. 11 are settled by Opus + Codex consensus. 2 need user decision.

User's communication style (from `CLAUDE.md`): Korean, vibe-coder tone, short cards, "What / Why / How to fix" 3-line items, glossary at the end for jargon.

Read these for context:

- **Proposals (per-item)**: `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md`
- **Audit report**: `reports/implementation-coverage-audit-20260523.html`
- **Canonical IA**:
  - P0-1 auth: `docs/IA/{01-A-01,02-A-02,23-X-01,28-X-06}/description.md`
  - P0-3 53번: `docs/IA/10-D-03-long-form-writing-53/description.md`
- **Phase 6 ledger** (for OOS reasoning): `docs/ai-workflow/runs/2026/05/21/20260521-1800-phase-6-admin-library-hardening.md`
- **Tech stack** (fixed baseline): `docs/spec.md` (Next.js + Supabase + Ant Design, billing deferred)

## Items needing user decision

### Decision 1 — P0-1 인증 UI 가입 방식 (4 options)

Currently all 4 public auth routes (X-01 / A-01 / A-02 / X-06) are placeholders. Auth UI must be built. The question is WHICH auth method to ship.

| Option | What | Implementation cost | UX | Infra dependency |
| --- | --- | --- | --- | --- |
| **A** | 이메일+비번 기본 + 매직링크 옵션 + 표준 비번 재설정 (Opus 권장) | 2-3일 | 표준 | Supabase 기본 (이메일 전송 dev에서 자동) |
| **B** | 매직링크만 (비번 없음) | 1일 | 신선하지만 매번 이메일 확인 필요 | SMTP transport (Tier 2 OOS-9와 충돌) |
| **C** | 이메일+비번만 (매직링크 없음) | 1-2일 | 표준 | 없음 |
| **D** | 소셜 로그인 우선 (Google + Kakao) | 3-5일 | 한국 시장 최적 | OAuth 설정 + 정책 검토 |

Cross-cutting consideration: Email confirmation flow, "forgot password" link, terms acceptance — all are part of A/C but missing from B/D.

### Decision 2 — P0-3 글쓰기 53번 UI 범위 (3 options)

53번은 TOPIK II 글쓰기 최고난도 (도표 분석 장문). IA spec(`docs/IA/10-D-03-long-form-writing-53/description.md`) requires: (a) 도표/그래프 자료 표시, (b) 도입/전개/마무리 3-탭 작성, (c) 원고지 미리보기. Current code is single generic textarea.

| Option | What | Cost | Coverage |
| --- | --- | --- | --- |
| **A** | LongFormEditor 컴포넌트 신설 + 3 탭 + 원고지 미리보기 + 도표 영역 (Opus 권장) | 3-5일 | 100% spec |
| **B** | WritingEditor 내부에서 questionNo === 53 분기 (별도 컴포넌트 안 만듦) | 2-3일 | 100% spec, but 단일 파일 비대화 |
| **C** | 일단 다음 phase로 미룸. 51/52/54처럼 generic textarea 유지 | 0일 | 30% spec (53번은 학습 효과 손상 상태로 출시) |

## Your task

For each decision:

1. **Frame the trade-off** in vibe-coder Korean (3-line What/Why/How to fix style).
2. **Recommend** one option per item with explicit reasoning (1-2 sentences).
3. **Flag the riskiest path** the user might pick without realizing.
4. State which decision blocks the most downstream work (priority signal).

## Output format (Korean for user-facing, English for internal tags)

```
# Decision Pack — Phase 7 사전 결정

## Decision 1 · 인증 UI 가입 방식

(3카드: 무슨 일? / 왜 결정해야? / 옵션 4개 비교 + 추천)

**Codex 권장**: <A/B/C/D>
**이유**: <1-2 문장>
**조심할 점**: <만약 사용자가 X를 고르면 ... 문제>

## Decision 2 · 글쓰기 53번 UI 범위

(같은 3카드 형식)

**Codex 권장**: <A/B/C>
**이유**: ...
**조심할 점**: ...

## 우선순위

<Decision 1이 막는 다운스트림 / Decision 2가 막는 다운스트림 비교>

## 한 줄 요약 (사용자가 즉시 답해도 되는 형식)

"인증은 ___안, 53번은 ___안" → 그럼 Phase 7 plan으로 진입.
```

Be tight. The user will skim this once and answer. Don't pad.
