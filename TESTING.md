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
pnpm check:task-lifecycle       # v2 task + cleanup 계약
pnpm task:measure -- --repo <task-worktree> --branch <task-branch> --actor <actor> --phase test --scope focused --budget small-check -- pnpm test
pnpm task:metrics -- --repo <repo-or-worktree> --branch <task-branch>
```

작은 변경은 관련 test 파일이나 `-g` filter부터 실행한다. auth, middleware, app shell, route guard, global theme처럼 여러 route에 영향을 주거나 범위를 좁히기 어려우면 전체 관련 suite를 실행한다.

10초 이상 걸릴 것으로 예상되는 setup·test·typecheck·lint·build·review·CI·publish 명령은 `task:measure`로 감싼다. 명령이 끝난 뒤 `task:metrics`에서 명령 합계와 겹친 구간을 제외한 실제 측정 시간, 실패·미완료·예산 초과를 확인하고 작업 보고의 실측 근거로 사용한다. 명령 원문·인자·환경·출력은 저장되지 않으며, 측정 저장 실패나 예산 초과는 원래 검증 결과를 바꾸지 않는다. 자세한 phase·scope·budget 기준은 [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md)를 따른다.

## UI 변경

route, component, layout, theme, global style 또는 interaction을 바꾸면 다음 두 검증을 모두 수행한다.

1. 영향 범위의 Playwright CLI test
2. 현재 worktree runtime을 Playwright MCP로 직접 열어 확인

MCP 확인에는 고유 loopback port, isolated browser session, desktop/mobile viewport, 주요 interaction과 관련 loading/empty/success/error/disabled 상태, console/network 오류 확인이 포함된다. Playwright CLI 통과만으로 직접 확인을 대신하지 않는다. UI에 영향이 없는 정책·문서·server-only 변경은 그 경계를 diff로 확인한 뒤 브라우저 검증을 생략할 수 있다.

하나의 development server를 대상으로 하는 Playwright 검증은 `workers: 1`로 순차 실행한다. 병렬 검증은 각 worker의 loopback port, runtime, test data가 모두 분리된 경우에만 허용한다. development server의 최초 compile은 read-only GET과 응답 상태로 명시적으로 준비할 수 있지만, hydration이나 interaction 준비 상태를 임의의 `waitForTimeout` 또는 retry로 대신하지 않는다. 전환 결과, 선택 상태, 표시된 panel처럼 사용자가 관찰할 수 있는 조건을 기다린다.

`.codex/work/` 아래의 임시 spec·config·결과는 진단 자료일 뿐 최종 합격 증거가 아니다. merge-ready 증거는 repository의 `playwright.config.ts`와 `tests/e2e/`에 포함된 test로 재현되어야 한다.

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

`test:supabase:local`은 `SUPABASE_LOCAL_STACK=1`을 설정하며, 이 값은 loopback local API에만 사용한다. service-role key와 테스트 계정 비밀번호는 terminal output, report, screenshot, commit에 남기지 않는다. migration 또는 auth/RLS 경로를 바꾸면 local stack test를 실행하고, v13에서 원격 Supabase schema/data apply는 하지 않는다.

## 검증 선택 기준

| 변경 | 최소 검증 |
| --- | --- |
| 문서·checker | 해당 contract test, dead-reference 검사, `git diff --check` |
| task lifecycle·CI·산출물 정책 | `check:project-structure`, `check:artifact-hygiene`, v1·v2 lifecycle contract, CI trust boundary test |
| 순수 TypeScript 로직 | 관련 Vitest, lint, typecheck |
| route·auth·middleware | 관련 unit/integration, scoped 또는 전체 e2e, build |
| UI | 관련 test, lint, typecheck, Playwright CLI + MCP 직접 확인 |
| migration·RLS·RPC | SQL review, local reset/integration, migration index·`docs/supabase/` 일치 검사 |

실패 시에는 실패 명령, 핵심 오류, 재현 조건과 남은 위험을 기록한다.

## CI 변경 범위 분류

CI는 workflow의 `paths` filter나 PR files API 대신 전체 Git diff를 NUL 구분 형식으로 읽는다. PR은 3-dot, merge queue와 `main` push는 2-dot 범위를 사용한다. 문서만 바뀐 ready PR도 base 소유 UI·artifact 검사와 project structure·agent skill 검사를 실행하지만 dependency 설치, app typecheck/test/lint/build와 Windows lifecycle은 생략한다. task pipeline·lifecycle 변경은 관련 contract와 Windows 검증을 실행하고, app·lock·config·workflow·혼합 변경은 전체 검증을 실행한다.

삭제·rename·copy·type-change, symlink·gitlink, 알 수 없는 mode/status/path, 유효하지 않거나 찾을 수 없는 SHA, 실패하거나 빈 diff는 모두 전체 검증(`full-fallback`)으로 되돌린다. ASCII control·비ASCII 문자, Windows 금지 문자·device 이름, 빈·`.`·`..` segment, 점·공백으로 끝나는 segment나 HEAD tree 안의 파일·directory ASCII 대소문자 충돌처럼 Windows checkout 안전을 증명할 수 없는 경로도 해당한다. 이 분류에서 `main` push의 `full`은 감사용 결과이며 app 전체 suite 재실행을 뜻하지 않는다. push는 PR에서 완료한 검증을 중복하지 않고 dependency 없는 경량 무결성 검사만 수행한다. 정확한 분류표와 단일 필수 검사 집계 계약은 [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md)를 따른다.

후보 PR은 classifier와 집계 workflow를 함께 수정할 수 있으므로 이 둘만으로 독립적인 신뢰 경계가 되지 않는다. `.github/`, `scripts/`, package·lock·config와 pipeline contract test에 대한 `CODEOWNERS` 검토, 기존 필수 검사, base 소유 trusted 검사까지 함께 통과해야 한다.
