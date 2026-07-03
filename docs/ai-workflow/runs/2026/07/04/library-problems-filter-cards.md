# Run Ledger: library-problems-filter-cards (2026-07-04)

## Scope

`/library/problems`에 유형·상태 필터 카드 그리드 추가 (탭 미도입, 체크박스 = OR 패싯 필터).
사용자 확정 사항은 `docs/sot-change-proposals/2026-07-04-library-problems-filter-cards.md` 참조.

## Worktree

- worktree: `D:\workspace\v13-library-problems-filters`
- branch: `claude/library-problems-filters` (base: local `main` @ 8e8e7f4a)
- slug: `library-problems-filters`
- 기준 폴더(`v13`)에는 다른 워크스트림의 미커밋 변경이 있어 격리 필수였음
  (`messages/*.json`, `tests/e2e/screens/library.spec.ts` 등 — 통합 시 충돌 주의).

## Docs consulted

- `AGENTS.md`, `CLAUDE.md`
- `docs/sot-change-proposals/2026-07-01-library-problems-all-view.md`
- `docs/ant-design/07-review-checklist.md`
- `.claude/skills/talkpik-orchestrator`, `.claude/skills/talkpik-ui-system`
- 현재 src: `LibraryProblemsList.tsx`, `library-enrich-data.ts`, `lib/library/*`,
  practice 참고 컴포넌트(`ProblemTypeFilterCards.tsx`)
- 참고: `docs/spec.md`는 orchestrator 스킬이 참조하지만 저장소에 존재하지 않음 (문서 공백으로 기록)

## Doc conflicts

- 선행 제안(2026-07-01)의 `검색 패널 + 혼합 리스트 + 페이지네이션` 구조에 계층 추가 → 후속 제안 문서로 처리.
- 그 외 active SOT 충돌 없음.

## Plan

1. sot-change-proposal 브리프 + 본 레저 작성
2. `library-problems-filters.ts` (pure 필터/카운트) + `LibraryProblemsFilterCards.tsx` 신규
3. `LibraryProblemsList.tsx` 통합 (상태, 카운트, OR 필터, 빈 상태, 페이지 리셋)
4. i18n: ko/en/vi `library.problemsList`에 `filterCardsAriaLabel`, `emptyFiltered` 추가 (라벨은 기존 키 재사용)
5. 테스트: 기존 컴포넌트 테스트 이중 매치 보정 + 필터 시나리오 추가, pure 단위 테스트 신규
6. 검증: vitest(범위), lint, typecheck, e2e `F-01 library dashboard`(기존 스펙, /library/problems 커버),
   런타임 desktop/mobile 확인
7. e2e 신규 파일은 추가하지 않음 — base 워크스트림이 `library.spec.ts` 수정 중이라 충돌 회피,
   신규 상호작용은 컴포넌트 테스트 + 런타임 확인으로 커버 (예외 기록)

## Verification (updated at completion)

- [x] vitest scoped: `pnpm vitest run tests/components/library/LibraryProblemsList.test.tsx tests/components/library/library-problems-filters.test.ts` — 15/15 passed
- [x] pnpm lint — pass
- [x] pnpm typecheck — pass
- [x] prettier --check (변경 파일) — pass (write 후)
- [x] e2e scoped: `pnpm exec playwright test tests/e2e/screens/library.spec.ts` (E2E_BASE_URL=127.0.0.1:3113, worktree dev server)
      — mobile-360/tablet-768/desktop-1280 3 passed, 1 flaky(mobile 첫 시도 dev 콜드 컴파일 nav timeout, retry 통과)
- [x] runtime desktop(1280)/mobile(360): service-role seed → 캡처 → cleanup (.scratch/seed-capture-library-filters.mjs)
      — 카운트 8종 fixture 일치, 저장 문제 체크 시 problem 행만, 0건 카드 체크 시 emptyFiltered+필터 초기화,
        저장 항목 0이면 카드 그리드 숨김, 모바일 2열 가로 오버플로 없음 (스크린샷 .scratch/library-problems-*.png)

## Critic notes (self-review)

- 기존 테스트 `getByText(typeSubmission/typeProblem)`가 카드 라벨과 이중 매치 → getAllByText로 보정 필요 (반영).
- AntD Checkbox 내부 span 성장은 `[&>span:last-child]:flex-1` 레이아웃 글루 1건만 사용, `!important` 금지 (반영).
- enrichment 도착 시 카운트가 pending→실상태로 이동하는 시프트는 행 배지와 동일 동작으로 허용, 브리프에 명시.
