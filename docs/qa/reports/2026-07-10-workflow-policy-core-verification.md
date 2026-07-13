# Workflow Policy Core Verification

- Date: 2026-07-10
- Scope: workflow Phase 0/1 active promotion
- Current decision: `active`
- Product/UI behavior changed: no
- Build workflow changed: yes, worktree-safe Next.js 16 preflight

## Promotion result

Phase 1 정책 묶음을 한 번에 승격했다.

- `workflow-index`, `workflow-core`, `workflow-codex`, `workflow-ui`: `active`
- `workflow-overhaul-proposal`: `superseded`
- 네 active workflow 문서의 `replaces`와 proposal의 `replacedBy`를 상호 참조
- `.workflow-staging/` 제거 및 `docs/agent-workflow/`를 최종 경로로 사용
- root `AGENTS.md`, `CLAUDE.md`, `README.md`, 사용자 보고 규칙, package/CI gate를 같은 묶음으로 적용
- generated `docs/INDEX.md`를 registry와 동기화

## Verification evidence

| Check | Result |
| --- | --- |
| SOT registry | PASS, 20 registered documents, generated index current |
| Registry/checker unit tests | PASS, 13 tests |
| Build-preflight unit tests | PASS, 17 tests |
| Targeted policy tests | PASS, 30 tests |
| Lint | PASS |
| Typecheck | PASS |
| Full Vitest | PASS, 252 files passed / 7 skipped; 1,729 tests passed / 14 skipped |
| Production build | PASS, Next.js 16.2.6, 10 static routes generated |
| Diff whitespace | PASS |

전체 Vitest의 첫 실행은 실행 도구의 304초 제한으로 중단되었지만 테스트 실패는 아니었다. 제한을 600초로 늘려 다시 실행했고 207.92초에 exit code 0을 확인했다. 기존 jsdom `getComputedStyle()` pseudo-element 경고는 남았지만 실패는 없었다.

## Build preflight correction

기존 preflight는 다른 worktree의 개발 서버가 port 3000을 사용한다는 이유만으로 현재 worktree의 production build를 막았다. 읽기 전용 프로세스 조사로 listener가 기준 checkout의 Next.js 개발 서버임을 확인했고, 그 프로세스를 종료하거나 `--force`로 우회하지 않았다.

Next.js 16의 isolated development build는 개발 산출물을 `.next/dev`에 두고 production build 산출물 `.next`와 분리한다. 이에 따라 다음 조건을 모두 만족할 때만 다른 worktree의 개발 서버를 경고 후 허용한다.

1. 호출자가 `--isolated-dev-build`를 명시했다.
2. 설치된 Next.js major가 정확히 16이다.
3. Next config를 읽을 수 있다.
4. 설정이 없거나 `isolatedDevBuild: true`가 literal로 명시돼 있다.

legacy, future major, unknown version, unreadable config, quoted/unquoted `false`, 간접 변수, 환경식, shorthand와 그 밖의 해석 불가능한 설정은 모두 fail closed로 기존 port 차단을 유지한다. Supabase port와 원격 DB 경계는 변경하지 않았다.

공식 근거: [Next.js `isolatedDevBuild`](https://nextjs.org/docs/app/api-reference/config/next-config-js/isolatedDevBuild)

## Worktree safety

- 기준 checkout의 개발 서버를 중단하지 않았다.
- 현재 app-managed detached worktree에서 추가 중첩 worktree나 branch를 만들지 않았다.
- build가 자동 변경한 `next-env.d.ts` import는 원래 상태로 복구했다.
- stage, commit, push, PR은 수행하지 않았다.
- legacy worktree는 삭제하지 않고 별도 inventory/report-only 상태로 남겼다.

## Independent policy review

초기 비판 리뷰에서 Claude branch prefix 상속, stale verification 기록, isolated-build gate의 future/opt-out fail-open 위험이 발견됐다. 각각 Claude override, 현재 상태 보고서, exact Next 16 + readable config + fail-closed 설정 판정과 회귀 테스트로 보완했다.

최종 독립 재검토 결과는 `READY`이며 남은 Critical / Important / Minor는 0건이다. 리뷰어는 Claude 경계, active lifecycle, replacement 상호 참조, staging 제거, `next-env.d.ts` 원복, quoted/dynamic config fail-closed, registry·targeted test·build·diff 증거를 확인했다.

## Deferred follow-up

- Codex Desktop cleanup enforce는 소유권과 lifecycle API가 증명될 때까지 report-only다.
- legacy worktree 실제 삭제는 별도 승인과 owner 확인이 필요하다.
- repo-local skill 정합화는 Phase 1B pressure scenario 검증 뒤 진행한다.
- `global.css` 부채의 실제 축소는 화면별 회귀 테스트를 갖춘 별도 STRICT remediation phase다.

이 항목들은 Phase 1 정책 묶음의 active 승격을 막지 않으며, 이번 변경에 포함되지 않는다.

## Not run

Playwright는 실행하지 않았다. 이번 phase는 정책, Markdown, JSON registry, Node checker와 build preflight만 바꾸며 route, component, theme, global style, interaction 또는 사용자 제품 동작을 변경하지 않는다.

## SOT check

- 읽은 SOT: `AGENTS.md`, `README.md`, `docs/INDEX.md`, `docs/sot-registry.json`, 기존 workflow 제안서·설계서·계획서, `TESTING.md`, `DESIGN.md`, Next.js build 설정과 관련 source/test
- 확인한 요구사항: 문서 우선순위 단일화, active lifecycle의 기계적 검증, task/worktree 격리, guarded cleanup, UI ownership ladder, Tailwind/AntD/global CSS 경계, 검증과 publish authority 분리
- 충돌 여부: 기존 `docs/ 전체=SOT`, Claude branch prefix 상속, global port 단일 차단 규칙을 해소했다.
- 갱신 필요 문서: Phase 1 범위에서는 없음. 후속 cleanup/UI debt/skill 변경은 별도 proposal 또는 implementation plan에서 관리한다.
