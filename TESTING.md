# Testing

테스트는 변경 영향에 맞게 선택하고, 실행하지 않은 검증을 성공으로 표현하지 않는다.

## 기본 명령

```bash
pnpm test             # Vitest unit/integration
pnpm test:watch       # Vitest watch
pnpm test:e2e         # Playwright e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm format           # Prettier check
pnpm check:project-structure
pnpm check:artifact-hygiene
pnpm check:worktree-lifecycle   # 기존 v1 report-only 계약
pnpm check:task-lifecycle       # v2, v3, release/security/validation shard를 순차 검증
pnpm task:autocleanup -- --repo <기준-checkout> --branch <task-branch>
pnpm task:sweep -- --repo <기준-checkout>
node "<new-worktree>/scripts/ai-task.mjs" sweep --repo "<기준-checkout>" --background true
pnpm task:measure -- --repo <task-worktree> --branch <task-branch> --actor <actor> --phase test --scope focused --budget small-check -- pnpm test
pnpm task:metrics -- --repo <repo-or-worktree> --branch <task-branch>
```

작은 변경은 관련 test 파일이나 `-g` filter부터 실행한다. auth, middleware, app shell, route guard, global theme처럼 여러 route에 영향을 주거나 범위를 좁히기 어려우면 전체 관련 suite를 실행한다.

10초 이상 걸릴 것으로 예상되는 setup·test·typecheck·lint·build·review·CI·publish 명령은 `task:measure`로 감싼다. 명령이 끝난 뒤 `task:metrics`에서 명령 합계와 겹친 구간을 제외한 실제 측정 시간, 실패·미완료·예산 초과를 확인하고 작업 보고의 실측 근거로 사용한다. 명령 원문·인자·환경·출력은 저장되지 않으며, 측정 저장 실패나 예산 초과는 원래 검증 결과를 바꾸지 않는다. 자세한 phase·scope·budget 기준은 [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md)를 따른다.

무거운 전체 검증은 정확한 `(head SHA, base SHA, workflow digest)`가 모두 같고 이전 결과가 성공일 때만 재사용한다. 이 세 값과 성공 여부·소요시간은 caller가 제출하지 않는다. `validation:record --workflow pipeline-v3.1-black-pr-full`이 clean worktree의 Git 상태와 고정된 검증 정의를 직접 읽고 승인된 전체 검증을 실행해 산출한다. Black PR에서 전체 검증을 한 번 수행하고 Keduall 승격은 같은 key의 증거와 승격·DB·Vercel 전용 검증을 소비한다. 셋 중 하나라도 달라지거나 실패·미완료 결과면 다시 실행한다.

## UI 변경

route, component, layout, theme, global style 또는 interaction을 바꾸면 다음 두 검증을 모두 수행한다.

1. 영향 범위의 Playwright CLI test
2. 현재 worktree runtime을 Playwright MCP로 직접 열어 확인

MCP 확인에는 고유 loopback port, isolated browser session, desktop/mobile viewport, 주요 interaction과 관련 loading/empty/success/error/disabled 상태, console/network 오류 확인이 포함된다. Playwright CLI 통과만으로 직접 확인을 대신하지 않는다. UI에 영향이 없는 정책·문서·server-only 변경은 그 경계를 diff로 확인한 뒤 브라우저 검증을 생략할 수 있다.

UI contract scanner v6의 정책·문서·baseline만 활성화하는 변경은 사용자 runtime과 DB를 바꾸지 않으므로 브라우저·DB 검증이 필요하지 않다. v4→v6 사전 승인이 trusted base에 먼저 병합된 뒤, 범위를 좁힌 scanner trust/transition test와 trusted base 비교로 정확한 scanner·baseline 전환을 검증한다.

하나의 development server를 대상으로 하는 Playwright 검증은 `workers: 1`로 순차 실행한다. 병렬 검증은 각 worker의 loopback port, runtime, test data가 모두 분리된 경우에만 허용한다. development server의 최초 compile은 read-only GET과 응답 상태로 명시적으로 준비할 수 있지만, hydration이나 interaction 준비 상태를 임의의 `waitForTimeout` 또는 retry로 대신하지 않는다. 전환 결과, 선택 상태, 표시된 panel처럼 사용자가 관찰할 수 있는 조건을 기다린다.

`.codex/work/` 아래의 임시 spec·config·결과는 진단 자료일 뿐 최종 합격 증거가 아니다. merge-ready 증거는 repository의 `playwright.config.ts`와 `tests/e2e/`에 포함된 test로 재현되어야 한다.

DB 변경이 필요 없는 공개 화면은 app profile의 승인된 원격 읽기 대상과 고유 loopback runtime을 사용해 `PLAYWRIGHT_PUBLIC_READ_ONLY=1`로 실행할 수 있다. 이 모드는 `landing-locales.spec.ts`, `screens-public.spec.ts`, `system-reporting.spec.ts`만 모바일·데스크톱에서 선택하며 인증 setup과 DB 변경 suite를 구성하지 않는다. 시스템 신고 테스트의 제출 요청은 모두 브라우저에서 가로채고, 인증이 필요한 고정 action bar 사례는 local Supabase stack 전용으로 skip한다.

최종 승인된 screenshot 같은 저장 증거는 `docs/qa/reports/<date>-<slug>/`에 두고 `artifact-manifest.json`에 경로·목적·SHA-256을 등록한다. 그 밖의 중간 산출물은 `.codex/work/<slug>/`에서만 관리한다. 자세한 기준은 [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md)를 따른다.

## Supabase local integration

Supabase 의존 test는 Docker 기반 local stack과 실제 migration replay가 필요해 기본 `pnpm test`에서는 skip될 수 있다.

```bash
pnpm dlx supabase start
pnpm dlx supabase db reset
pnpm test:supabase:local
```

현재 local config는 `supabase/config.toml`, user-independent seed는 `supabase/seed.sql`, schema/RLS/RPC 정본은 `supabase/migrations/*.sql`이다. `src/lib/supabase/env.ts`는 development에서 `http://127.0.0.1`과 `http://localhost` local stack 연결을 허용하고, production/test runtime에서는 HTTPS URL을 요구한다.

local integration test는 변수를 `process.env`로 직접 읽는다. 현재 test command가 `.env.test.local`을 자동으로 읽는다고 가정하지 말고, 다음처럼 실행할 terminal session에 local 값을 주입한다. `.env.test.local`을 값 보관용으로 사용한다면 별도 loader를 명시적으로 구성해야 한다.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<supabase start가 출력한 local key>"
pnpm test:supabase:local
```

`test:supabase:local`은 `SUPABASE_LOCAL_STACK=1`을 설정하며, 이 값은 loopback local API에만 사용한다. 이 명령은 사용자 데이터 참조 무결성 검사를 포함한 모든 Supabase 변경 통합 테스트를 명시적으로 실행한다. service-role key와 테스트 계정 비밀번호는 terminal output, report, screenshot, commit에 남기지 않는다. migration 또는 auth/RLS 경로를 바꾸면 local stack test를 실행하고, v13에서 원격 Supabase schema/data apply는 하지 않는다.

## 검증 선택 기준

| 변경 | 최소 검증 |
| --- | --- |
| 문서·checker | 해당 contract test, dead-reference 검사, `git diff --check` |
| task lifecycle·CI·산출물·보안 정책 | `check:project-structure`, `check:artifact-hygiene`, security artifact audit, v1·v2·v3 lifecycle, one-shot sweep·promotion contract, CI trust boundary test |
| 순수 TypeScript 로직 | 관련 Vitest, lint, typecheck |
| route·auth·middleware | 관련 unit/integration, scoped 또는 전체 e2e, build |
| UI | 관련 test, lint, typecheck, Playwright CLI + MCP 직접 확인 |
| migration·RLS·RPC | SQL review, local reset/integration, migration index·`docs/supabase/` 일치 검사 |

실패 시에는 실패 명령, 핵심 오류, 재현 조건과 남은 위험을 기록한다.

Lifecycle V3는 읽기 작업에서 Git 자원이 생기지 않는지, 작은 순차 작업이 `.worktrees/shared-dev`를 재사용하는지, 병렬·장기·위험 작업만 별도 worktree 선택을 요구하는지 검증한다. Codex↔Claude claim 전환·동시 수정 차단, v2→v3 copy journal, 미등록 legacy 발견-only, Windows 대소문자·reparse·경로 탈출도 포함한다.

자동 cleanup은 Black·Keduall 외부 `main` 병합 감지, shared slot 유지·branch 정리, isolated 비강제 제거, host/adopted 보존, candidate 정리와 `stg`·`main` 보호를 검증한다. dirty·runtime active·locked·detached·unknown 파일·SHA·계정·소유권 불일치는 모두 `PRESERVED`여야 한다. 원격 ref 삭제는 exact-SHA lease와 TOCTOU 보존을 실제 bare remote로 확인한다.

일회성 `task:sweep`은 유효한 v2 후보의 v3 copy·기존 v3 재사용·복사 실패 보존 뒤 v3 정리기만 한 번 실행하는지 검증한다. 직접 `task:autocleanup`을 호출한 v2-only task도 v3 copy 뒤 같은 계정 복원 경로로 재호출되고 legacy 정리기로 우회하지 않아야 한다. 두 GitHub 계정 전환과 원래 계정 복원, repository permission 실패, ACTIVE task가 없을 때 zero-network, 중복 worker·stale lock·최대 10개·10분 실행 예산, 하위 Git·GitHub 명령의 timeout 전달도 dependency injection으로 확인한다. 코드 작업의 `task:prepare`는 성공 뒤 sweep을 한 번 실행하고, 읽기 전용 prepare는 실행하지 않는다. 운영체제 예약 작업 설치와 파일시스템 호출을 강제 종료하는 watchdog은 파이프라인 범위가 아니다.

`PromotionRunV1`은 exact-parent candidate, candidate→`stg`와 `stg`→`main` merge lineage, security audit SHA binding, migration drift·destructive SQL·N-1/N 호환성, 최초 2회 `AWAITING_PROD_APPROVAL`, 이후 `AUTO`, 계약·profile 변경과 실패·rollback·보안 사고 reset을 검증한다. Vercel은 Preview/Production target, 정확한 commit SHA·project·domain·alias, smoke 실패 시 alias-only rollback과 DB non-rollback을 확인한다. 로그·registry·보고서에 secret 값이 기록되지 않는지도 모든 fixture에서 검사한다.

## CI 변경 범위 분류

CI는 workflow의 `paths` filter나 PR files API 대신 전체 Git diff를 NUL 구분 형식으로 읽는다. PR은 3-dot, merge queue와 `main` push는 2-dot 범위를 사용한다. 문서만 바뀐 ready PR도 base 소유 UI·artifact 검사와 project structure·agent skill 검사를 실행하지만 dependency 설치, app typecheck/test/lint/build와 Windows lifecycle은 생략한다. task pipeline·lifecycle 변경은 관련 contract와 Windows 검증을 실행하고, app·lock·config·workflow·혼합 변경은 전체 검증을 실행한다.

삭제·rename·copy·type-change, symlink·gitlink, 알 수 없는 mode/status/path, 유효하지 않거나 찾을 수 없는 SHA, 실패하거나 빈 diff는 모두 전체 검증(`full-fallback`)으로 되돌린다. ASCII control·비ASCII 문자, Windows 금지 문자·device 이름, 빈·`.`·`..` segment, 점·공백으로 끝나는 segment나 HEAD tree 안의 파일·directory ASCII 대소문자 충돌처럼 Windows checkout 안전을 증명할 수 없는 경로도 해당한다. 이 분류에서 `main` push의 `full`은 감사용 결과이며 app 전체 suite 재실행을 뜻하지 않는다. push는 PR에서 완료한 검증을 중복하지 않고 dependency 없는 경량 무결성 검사만 수행한다. 정확한 분류표와 단일 필수 검사 집계 계약은 [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md)를 따른다.

후보 PR은 classifier와 집계 workflow를 함께 수정할 수 있으므로 이 둘만으로 독립적인 신뢰 경계가 되지 않는다. `.github/`, `scripts/`, package·lock·config와 pipeline contract test에 대한 `CODEOWNERS` 검토, 기존 필수 검사, base 소유 trusted 검사까지 함께 통과해야 한다.
