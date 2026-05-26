# Phase 7 — Coverage Gap Fill Light Spec

> **Source**: Implementation Coverage Audit (2026-05-23) consensus — `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md` 13건 합의 + 사용자 결정.
>
> **Date**: 2026-05-24 00:00 KST
>
> **Author**: Claude Code (Opus 4.7)
>
> **Audience**: user (모든 13건 finding이 user-facing 라우트. admin은 본 audit에서 P0/P1 0건)

## 1. Core Functionality

본 phase는 Implementation Coverage Audit 2026-05-23이 발견한 13건 (P0 5 + P1 8)을 모두 채워 **사용자가 가입부터 글쓰기 피드백까지 골든 패스 끝까지 갈 수 있게 만든다**. 3가지 핵심 가치:

1. **인증 흐름 완성** — 가입 → 로그인 → 비밀번호 재설정 → 학습 목표 → 대시보드 (P0-1)
2. **글쓰기 시험 환경 재현** — 51~54 char limit + 53번 LongFormEditor + 54번 EssayChecklist (P0-2/3/4)
3. **사용자 학습 흐름 보강** — 대시보드/문제 리스트/약점/피드백/프로필 spec 일치 (P1-1~8)

## 2. Out of Scope

| Item | Reason |
| --- | --- |
| 실제 LLM 호출 | Tier 2 OOS-1, 본 phase는 mock/fixture 유지 |
| Stripe 결제 | Tier 2 OOS-3, X-03/X-04 OOS-SHELL 유지 |
| SMTP 트랜스포트 (이메일 발송) | Tier 2 OOS-9, 본 phase는 Supabase 기본 dev 메일러 |
| i18n | Tier 2 OOS-7, 한국어 한정 |
| Real-time 알림 push | Tier 2 OOS-2, in-app banner만 |
| Full admin CRUD | Tier 2 OOS-5, 본 phase는 user-facing만 |
| Notification transport (SES/FCM) | Tier 2 OOS-9 |
| 디자인 토큰 자체 refactor | UX/UI Consistency Pass로 별도 처리 |

## 3. Minimum Acceptable Behavior

본 phase 종료 시 "최소 작동 조건":

- 신규 사용자가 `/`에서 가입 CTA 클릭 → 회원가입 폼 작성 → 이메일 확인 → 학습 목표 → 대시보드 도달 가능 (P0-1)
- 글쓰기 51/52/53/54 모두 자기 IA spec(글자 수 + UI 컴포넌트)대로 작동 (P0-2/3/4)
- 약점 페이지에 4 dimension tabs + diagnostic card 보임 (P1-3)
- 대시보드에 최근 피드백 + 알림 카드 보임 (P1-7)
- 문제 리스트에 추천/풀이 상태 필터 보임 (P1-8)
- 프로필에 bio + 시험 정보 + 상태 카드 (P1-6)
- 자동 저장 실패 시 경고 모달 (P1-5)
- AI 분석 로딩 모달 spec 시각화 (P1-4)
- 다음 문제 추천 페이지에 summary + 3 alternative (P1-2)
- 다시 풀기 모달 작동 (P1-1)
- 로컬 dev 환경에서 `pnpm dev` 즉시 가능 (P1-0)

## 4. User Flow

`docs/flow/user-flow.md`의 골든 패스가 본 phase로 0단계부터 끝까지 작동:

```
X-01 랜딩 → A-01 가입 → 이메일 확인 → A-03 학습 목표 → B-01 대시보드 (+ 최근 피드백 + 알림)
  → C-01 추천 → C-02 문제 리스트 (+ 추천/풀이 상태 필터) → 문제 풀이 (+ C-03 retry)
  → D-01/02/03/04 글쓰기 (char limit + 53 탭/원고지 + 54 체크리스트 + D-M3 autosave 경고)
  → D-M1 제출 확인 → D-M2 분석 로딩 (캐릭터 + 단계) → E-01/E-02 피드백 → R-01 비교
  → R-02 다음 문제 (+ summary + 3 alternative) → F-01 자료실

부가: X-05 프로필 / G-01 언어 / X-07 약점(4 tabs + 진단 카드) / X-09 알림 / X-02 성장
```

## 5. Domain Boundary

## Audience

user (admin은 본 phase 비대상)

- Domain target:
- **변경 폴더**:
  - `src/app/` — 라우트 페이지 (인증 4개 + 일부 수정)
  - `src/app/password-reset/confirm/` (신규 — P0-1 비번 재설정 confirm step)
  - `src/components/{auth,writing,learning,practice,feedback,profile}/` — 신규/수정 컴포넌트
  - `src/lib/{auth,writing}/` — utility/types
  - `supabase/migrations/` — profiles.bio 컬럼 추가 1 마이그레이션 (P1-6)
- **건드리지 않는 폴더**:
  - `src/components/admin/`, `src/lib/admin/`, `src/lib/auth/admin-guard.ts` (admin 비대상)
  - 모든 Tier 2 OOS 영역 (LLM/Stripe/SMTP transport 등)

## 6. Success Criteria

본 phase는 다음 조건 모두 충족 시 종결:

1. 13건 fix 모두 구현됨 (proposal 합의 옵션대로)
2. Playwright `tests/e2e/coverage/coverage-matrix.spec.ts` 81/81 PASS (회귀 보호)
3. 새 골든 패스 흐름 manual QA (가입→로그인→대시보드→글쓰기→피드백) 통과
4. UX/UI Consistency Pass 4 체크 모두 PASS (Tokens/Components/A11y/Responsive)
5. QA Gate passed (dev 서버 부팅 + 직접 클릭 + 콘솔 에러 캡처)
6. Codex pre-plan review PASS (또는 CONCERN with accept)
7. Codex post-implementation cross-review PASS
8. Architecture Pass — 모든 라우트가 도메인 boundary 일치
9. `node scripts/ai-workflow-check.mjs` PASS
