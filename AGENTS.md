# AGENTS.md

이 저장소는 TOPIK 학습자를 위한 `TALKPIK AI` 사용자 앱이다. Codex와 모든 AI 에이전트는 이 문서를 프로젝트 constitution이자 작업 진입점으로 따른다.

## 응답과 근거

- 답변과 작업 보고는 한국어로 한다. 코드, 명령어, 파일명, 패키지명, route는 원문을 유지한다.
- 객관적 사실, 실행 결과, active SOT, current source, 공식 문서와 테스트를 우선한다.
- 추정은 `가정`으로 표시하고, 모르는 내용은 모른다고 말한다.
- 사용자-facing 보고는 `docs/user-communication-style.md`를 따른다.

## 정책 진입점과 우선순위

작업 전 이 파일, `README.md`, `docs/INDEX.md`를 확인하고 요청 범위의 active SOT와 current source만 추가로 읽는다. `docs/INDEX.md`는 `docs/sot-registry.json`에서 생성되며 직접 편집하지 않는다.

충돌 시 우선순위와 상세 실행 계약은 다음 문서를 따른다.

1. `docs/agent-workflow/core.md` — 정책 우선순위, 위험 등급, SOT lifecycle, 권한, 검증과 보고
2. `docs/agent-workflow/codex.md` — task/worktree/branch/PR/cleanup lifecycle
3. `docs/agent-workflow/ui.md` — 공통 레이아웃, Ant Design/Tailwind/theme/CSS 소유권

현재 source와 tests는 이미 구현된 동작의 관찰 기준이다. active SOT와 다르면 조용히 한쪽을 우회하지 않고 defect 또는 SOT 변경으로 분리한다.

제품 동작, 데이터 규칙, UX flow, security rule, framework stack을 active SOT 밖에서 새로 만들지 않는다. 변경이 필요하면 `docs/sot-change-proposals/`에 근거·대안·acceptance criteria를 기록하고, 사용자 승인과 검증 뒤 registry와 owner 문서를 같은 promotion 묶음에서 갱신한다.

## 비협상 경계

- 이 저장소는 user-facing app이다. admin 기능을 새로 만들거나 확장하지 않는다.
- `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`의 AI·외부 연동·MVP 보류 결정을 우선한다.
- billing SDK, 실제 결제 흐름, deferred 외부 연동은 active scope가 명시적으로 열리기 전까지 추가하지 않는다.
- Supabase server-only key와 secret을 browser-visible 변수, 로그, 문서, commit에 노출하지 않는다.
- v13 작업면에서 원격 Supabase schema/data apply를 실행하지 않는다.
- 기존 사용자·다른 task 변경을 임의로 되돌리지 않는다.
- 승인 없이 파괴적 작업, branch/worktree 삭제, production/collab 변경을 수행하지 않는다.

## Git과 worktree

- 기본 원칙은 `한 task = 한 의미 있는 slug = 한 branch = 한 worktree 소유권`이다.
- Codex Desktop이 이미 linked worktree를 제공했다면 중첩 worktree를 만들지 않는다.
- 수정 전 CWD, branch/detached 상태, tracked/untracked 변경, worktree 목록과 소유권을 확인한다.
- 공유 기준 checkout에서 다른 task를 위해 `switch`, `checkout`, `reset`, `rebase`, `merge`하지 않는다.
- worktree는 포트, dev server, 로컬 DB, `.env.local`, test data를 격리하지 않으므로 runtime owner도 확인한다.
- 작업 완료 후 clean/owner/PR/process 조건을 모두 확인하기 전 worktree나 branch를 삭제하지 않는다. `--force` cleanup은 사용하지 않는다.
- stage, commit, push, PR, merge는 사용자가 publish를 요청했거나 검증 결과 보고 뒤 승인한 경우에만 수행한다.

`collab`은 Vercel 배포 브랜치다. 사용자가 정확히 `collab`과 즉시 배포 의도를 명시하지 않으면 merge, rebase, push, PR target으로 사용하지 않는다. 명시된 경우에도 변경 범위, 검증, secret 점검과 즉시 노출 경고 뒤 별도 확인을 받는다.

## 구현 진입점

- 제품/기능: `docs/prd.md`, `docs/ia.md`, `docs/flow/user-flow.md`, 관련 Wireframe과 current source
- 화면/route/navigation: `docs/flow/sitemap.md`, `docs/Wireframe/README.md`, `src/app/`, `src/lib/routes.ts`
- UI/style: `DESIGN.md`, `docs/ant-design/README.md`, `docs/ant-design/07-review-checklist.md`, `docs/agent-workflow/ui.md`
- Supabase/Auth: `supabase/migrations/INDEX.md`, 관련 migration/Wireframe, `src/lib/supabase/`, auth source
- 검증: `TESTING.md`, 관련 tests, `docs/agent-workflow/core.md`

Next.js App Router와 기존 project wrapper를 유지한다. UI는 기존 Page Recipe와 공통 layout, Ant Design props/token, Tailwind layout utility 순서로 해결한다. page-specific `global.css`, broad `.ant-*` override, 정적 inline style을 새로 추가하지 않는다.

user-facing 화면은 변경 범위와 관련된 loading, empty, success, error, disabled 상태를 포함한다. UI 변경은 desktop/mobile 실제 렌더링과 관련 Playwright 범위를 검증한다.

## 완료 기준

완료라고 말하기 전에 변경 범위에 맞는 registry/path 검사, 관련 test, lint, typecheck, build, UI runtime 검증을 실행하고 실제 출력을 읽는다. 실패하거나 미실행한 검증이 있으면 완료로 보고하지 않고 원인, 재현 방법과 남은 위험을 남긴다.

완료 보고에는 `읽은 active SOT / 확인한 요구사항 / 충돌 여부 / 갱신한 owner 문서 / 검증 결과 / Git 반영 상태`를 포함한다.
