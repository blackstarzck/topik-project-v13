# AGENTS.md

이 저장소는 TOPIK 학습자를 위한 `TALKPIK AI` 사용자 앱이다. 사용자는 학습 목표를 설정하고, TOPIK 쓰기 51~54번 유형을 연습하며, AI 피드백과 복습 흐름을 통해 실력을 개선한다.

Codex와 모든 AI 에이전트는 이 문서를 프로젝트 작업 계약으로 따른다.

## 응답 원칙

- 답변과 작업 보고는 한국어로 한다. 코드, 명령어, 파일명, 패키지명, route는 원문을 유지한다.
- 객관적 사실, 실행 결과, 프로젝트 문서, 공식 문서, 테스트를 우선한다.
- 추정은 반드시 "가정"으로 표시하고, 모르는 내용은 모른다고 말한다.
- 비개발자도 이해할 수 있게 쉬운 말로 설명하고, 필요한 경우 표, 목록, 체크리스트, Mermaid 다이어그램을 사용한다.
- 사용자-facing 보고, 계획, 리뷰, 요약은 `docs/user-communication-style.md`를 따른다.

## SOT와 문서 변경

- `docs/` 하위 문서는 모두 source of truth(SOT)다. `README.md`, `AGENTS.md`, `package.json`, `TESTING.md`, `supabase/migrations/INDEX.md`, 현재 `src/` 구현은 작업 진입과 구현 확인 기준이다.
- 작업 시 전체 문서를 무조건 읽지 말고, 요청 범위와 직접 관련된 SOT를 체크리스트처럼 선택해 확인한다.
- 현재 source code는 이미 구현된 동작의 기준이다. 동작을 바꾸기 전에는 관련 SOT와 current source를 함께 확인한다.
- SOT나 agent rule 문서 수정이 필요하면 수정 전 사용자에게 `대상 문서 / 수정 이유 / 수정 방향`을 알린다. 요청 범위 밖의 SOT 변경은 승인 없이 수행하지 않는다.
- SOT는 절대 수정하지 않는다. SOT 문서의 변경이 필요한 경우 사용자에게 반드시 보고하고 확인받는다. 기존 SOT 문서를 직접 변경하지 않고 SOT 변경 제안은 `docs/sot-change-proposals/`에 저장한다.
- SOT 수정이 사용자 결정으로 확정된 경우, 해당 결정이 왜 그렇게 내려졌는지 결정 이유, 근거 문서, 검토한 대안을 함께 기록한다.
- 중요 스코프 결정 문서: `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`는 AI 기능 보류, 외부 연동/운영 확정 보류, 6/22 MVP 기준과 전체 Wireframe 기준의 적용 방식을 정한다. 이 범위에서 `docs/development-core-planning/`, `docs/Wireframe/`, `docs/flow/`의 해석이 갈리면 해당 결정 문서를 우선한다.
- 사용자 요청이 active SOT와 충돌하면 구현하지 말고, 충돌한 문서와 위치를 먼저 보고한다.
- active SOT에 없는 net-new scope, 제품 pivot, 제품 behavior, data rule, UX flow, security rule은 바로 구현하지 않는다. 먼저 `docs/sot-change-proposals/`에 docs update proposal 또는 acceptance criteria가 있는 implementation brief를 만든다.

## 읽기 순서

모든 작업은 먼저 `AGENTS.md`와 `README.md`를 확인한다. 이후 작업 유형에 맞춰 최소 관련 문서를 추가로 읽는다.

| 작업 유형 | 추가 확인 문서 |
| --- | --- |
| 제품/기능 | `docs/prd.md`, `docs/ia.md`, `docs/flow/user-flow.md`, 관련 `docs/Wireframe/<page>/` |
| 스코프/보류/AI/외부 연동 | `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`, `docs/development-core-planning/`, 관련 `docs/Wireframe/<page>/`, 현재 `src/` |
| 화면/라우트/내비게이션 | `docs/ia.md`, `docs/flow/user-flow.md`, `docs/flow/sitemap.md`, `docs/Wireframe/README.md`, 관련 `docs/Wireframe/<page>/`, 현재 `src/app/`, 현재 `src/lib/routes.ts` |
| 코드/구현 | `package.json`, 관련 `src/`, 관련 Wireframe 기능명세 |
| UI/스타일 | `DESIGN.md`, `docs/ant-design/README.md` 흐름, `docs/ant-design/07-review-checklist.md` |
| Supabase/DB/RLS | `supabase/migrations/INDEX.md`, 관련 migration, `docs/Wireframe/data-usage-index.md`, 관련 화면 기능명세 |
| Auth | 관련 auth Wireframe, `src/app/auth/`, `src/lib/supabase/`, `supabase/migrations/INDEX.md` |
| 배포/환경 | `README.md`, `.env.example`, `package.json` |
| 결제/구독/paywall | `docs/Wireframe/25-X-03-paywall/`, `docs/Wireframe/26-X-04-subscription-management/` |
| 리뷰/QA | 관련 source docs, 관련 테스트, UI 작업이면 `docs/ant-design/07-review-checklist.md` |

`docs/INDEX.md`나 `memory/MEMORY.md`가 생기면 공통 진입 문서로 함께 확인한다.

사이드바, workspace layout, active menu, route 노출 여부를 바꾸는 작업은 `docs/Wireframe/share/03-learner-side-nav-state/description.md`, `docs/Wireframe/share/03-learner-side-nav-state/contextual-route-placement.md`, `docs/Wireframe/share/03-learner-side-nav-state/sidebar-navigation-decision-summary.md`를 함께 확인한다.

## 작업 절차

- 작업 전 사용자가 요청한 작업이 제품, 코드, 데이터, UI, 테스트, 문서에 어느 정도 영향을 미치는지 영향도를 먼저 파악한다.
- 파악한 영향도에 따라 읽을 SOT, 수정 범위, 검증 범위, phase/TODO 수준을 정하고 불필요한 확장을 피한다.
- 개발 또는 변경 작업은 먼저 목적, 범위, phase/TODO, 검증 방법이 포함된 실행 계획을 만든다.
- 계획은 `1차 초안 -> 멀티 에이전트 호출 + 비판적 검토 -> 보완안 -> 구현` 순서로 다듬는다.
- 사용자의 개발/변경 작업 요청은 원칙적으로 에이전트 팀 관점으로 처리한다. 도구가 허용되면 실제 멀티 에이전트를 사용하고, 단순 작업이거나 도구 사용이 적절하지 않으면 메인 세션 안에서 `계획자 / 구현자 / 비판자` 역할을 분리해 검토한다.
- 검토에는 반드시 비판적 시선의 critic 관점을 포함한다.
- 작업은 phase와 TODO 단위로 쪼개 진행하고, 각 단계가 끝날 때 확인 결과를 남긴다.
- 기존 구조와 문서를 먼저 확인하고, 프로젝트 방식에 맞춰 필요한 최소 변경만 수행한다.
- 긴 작업, background 작업, timeout, hang, 의도치 않은 세션 종료 가능성이 있으면 재개 가능한 handoff 또는 진행 기록을 남긴다.
- 중요한 결정, 실패, 실험 결과는 기존 기록 체계에 맞춰 남긴다. 예: `docs/superpowers/plans/`, `docs/qa/reports/`, `supabase/migrations/INDEX.md`, 관련 active docs의 Decision/History 섹션.
- 작업후 반드시 인사이트를 제공한다. 인사이트는 반드시 웹, 커뮤니티등 조사를 통해 팩트 체크가된 객관적인 사실이어야 한다. 추측은 금지한다. 근거를 웹 링크로 명시한다.

## 병렬 작업과 worktree 격리

이 저장소에서 병렬 AI 작업의 최우선 규칙은 `한 작업/세션 = 한 branch = 한 worktree`다.

- 여러 Codex/Claude/AI 세션이 같은 프로젝트 폴더에서 동시에 파일을 수정하면 안 된다. 같은 폴더는 현재 branch, index, 미커밋 변경을 공유하므로 한 세션의 branch switch가 다른 세션을 즉시 오염시킨다.
- 병렬로 실행되는 모든 쓰기 작업은 반드시 독립된 git worktree에서 진행한다. 기준 폴더 `v13`은 가능하면 `main` 기준 확인, 통합, 전체 검증용으로 유지한다.
- Codex Desktop에서는 새 병렬 작업을 시작할 때 Codex의 Worktree 모드 또는 Handoff를 우선 사용한다. 앱이 이미 worktree를 관리 중이면 그 안에서 다시 중첩 worktree를 만들지 않는다.
- 수동으로 만들 때는 기준 폴더에서 `git worktree add <path> -b <branch> main` 형태를 사용하고, 작업 세션은 생성된 `<path>`에서만 실행한다.
- worktree 경로와 branch 이름은 작업을 식별할 수 있게 짓는다. 예: `../v13-practice-filter` + `codex/practice-filter`, `../v13-auth-redirect` + `codex/auth-redirect`.
- 병렬 작업 중 공유 기준 폴더에서 `git switch`, `git checkout`, `git reset`, `git rebase`, `git merge`를 실행해 다른 세션의 기반을 흔들지 않는다. 통합 작업은 병렬 세션의 상태를 확인한 뒤 한 번에 하나씩 진행한다.
- 작업 시작 전 `pwd`, `git branch --show-current`, `git status`, 필요하면 `git worktree list`로 현재 위치와 branch를 확인한다. 예상한 worktree가 아니면 수정하지 말고 먼저 위치를 바로잡는다.
- 작업 완료 후에는 해당 worktree에서 테스트와 diff를 확인하고 commit 또는 PR 단위로 정리한다. 병합은 기준 폴더에서 최신 `main`을 기준으로 작업 branch를 하나씩 통합한다.
- 완료된 worktree는 변경이 commit/merge된 뒤 `git worktree remove <path>`로 정리한다. 폴더만 직접 삭제한 경우 `git worktree prune`으로 stale metadata를 정리한다.
- worktree는 코드 파일을 격리하지만 포트, 로컬 DB, Supabase 테스트 데이터, `.env.local`, dev server 같은 런타임 자원은 자동으로 격리하지 않는다. 병렬 runtime 검증이 필요하면 포트와 데이터 자원 충돌을 별도로 피한다.

## 구현 규칙

- Next.js App Router 구조와 `src/app/` route tree를 따른다.
- route 변경 전 `docs/ia.md`, `docs/flow/user-flow.md`, `docs/Wireframe/README.md`, 현재 `src/app/` 구현을 함께 reconcile한다.
- Supabase server-only key와 secret은 browser-visible 변수로 노출하지 않는다.
- RLS, auth, storage, profile, admin role을 건드릴 때는 관련 문서와 migration을 먼저 읽는다.
- framework-level dependency를 추가하거나 교체하려면 stack-change decision 또는 사용자 승인과 문서 갱신이 필요하다.
- billing SDK, payment provider, 실제 결제 흐름은 deferred scope가 명시적으로 열리기 전까지 추가하지 않는다.
- user-facing 화면은 loading, empty, success, error, disabled 상태를 설계와 검증에 포함한다.

## UI와 스타일

- UI 컴포넌트는 Ant Design 컴포넌트 또는 프로젝트 wrapper를 우선 사용한다.
- 스타일 추가/수정 시 React `style={{ ... }}` 같은 인라인 스타일은 금지한다.
- 레이아웃, spacing, responsive, 제한된 시각 보정은 Tailwind `className`으로 적용한다.
- AntD 컴포넌트의 color, hover, active, disabled, border, radius 같은 상태와 토큰은 Tailwind로 재구현하지 않고 `ConfigProvider`, theme token, AntD props를 우선 사용한다.
- theme을 수정하거나 추가할 때는 하나의 theme source of truth를 기준으로 Ant Design adapter와 Tailwind adapter를 함께 갱신한다. AntD는 `ConfigProvider`/`theme.token`/`theme.components`, Tailwind는 `src/styles/global.css`의 Tailwind v4 `@theme inline`과 `--app-*` bridge 방식으로 같은 값을 소비해야 한다.
- Tailwind에 새 palette, font, radius, shadow token을 임의로 만들지 않는다. 필요한 경우 `DESIGN.md`, `docs/ant-design/08-theme-architecture.md`, `src/theme` 기준으로 갱신한다.
- 난이도(1~5) 색 표시는 `DESIGN.md`의 "Tokens - Difficulty Scale"을 따른다. 아이콘만 틴트하고 글자 라벨은 무채색으로 두며, 색/라벨 매핑은 `src/components/practice/DifficultyMeter.tsx`의 `difficultyFillColor`와 `difficultyLabelKey` 단일 소스를 쓴다. 이 5색은 난이도 표시 외 UI에 재사용하지 않는다.
- UI 작업은 desktop과 mobile 확인을 포함한다.

## 검증과 완료 기준

- AI 산출물은 근거 없이 완료로 간주하지 않는다. "완료", "성공", "문제 없음"이라고 말하려면 무엇을 확인했는지 함께 보고한다.
- 완료 보고에는 SOT 체크를 포함한다. 형식: `읽은 SOT / 확인한 요구사항 / 충돌 여부 / 갱신 필요 문서`.
- 개발 관련 작업은 UI 영향 여부와 관계없이 변경 영향 범위에 맞는 검증을 실행한다.
- UI에 영향을 주는 변경(route, component, layout, theme, global style, interaction)은 로컬 runtime에서 대상 route를 실제 렌더링하고, 작업 범위 내 Playwright e2e를 실행한다.
- UI 검증 최소 범위는 desktop/mobile viewport, 주요 상호작용, loading/empty/success/error/disabled 상태다.
- 범위를 좁혀 e2e를 실행한 경우 실행한 Playwright 파일/필터/명령과 그 범위가 충분한 이유를 보고한다. 예: `pnpm exec playwright test -g "B-01 home-dashboard"`.
- `pnpm test:e2e` 전체 실행은 auth, middleware, app shell, route guard, global style/theme, shared navigation, test config처럼 여러 route에 영향을 주거나 영향 범위를 좁히기 어려운 경우에 사용한다.
- 코드 변경은 관련 unit/integration test, `pnpm lint`, `pnpm typecheck` 중 영향 범위에 맞는 항목을 실행한다.
- Supabase/migration 변경은 SQL idempotency, RLS 영향, `supabase/migrations/INDEX.md`, 관련 migration, `docs/Wireframe/data-usage-index.md`, 관련 화면 기능명세 갱신 여부를 확인한다.
- 검증 또는 테스트 과정에서 Supabase 데이터베이스 조작이 필요하면 `.env.example`에 정의된 변수명을 기준으로 하며, 관리 API/DB 조작은 `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, 사용자 테스트 계정은 `E2E_STUDENT_EMAIL`, `SUPABASE_TEST_PASSWORD`를 사용한다. 해당 값은 secret으로 취급해 터미널 출력, 로그, 문서, 커밋 메시지, 테스트 리포트에 기록하지 않고, 보고에는 변수명만 언급한다.
- auth/security 변경은 실패 케이스, redirect, cookie/session, secret 노출 여부를 확인한다.
- 검증을 실행하지 못했거나 실패하면 완료로 보고하지 않는다. 미실행/실패 이유, 재현 명령, 남은 위험을 함께 보고한다.

## 파일과 Git 규칙

- 문서/비코드 요청에서 "읽기", "검토", "정리", "요약", "제안"은 기본적으로 채팅 응답만 반환한다. 새 파일/폴더 생성은 사용자가 명시적으로 요청했거나, 생성할 경로와 목적을 먼저 제시해 승인받은 경우에만 한다.
- 사용자 또는 다른 도구가 만든 변경을 임의로 되돌리지 않는다. 이미 수정된 worktree에서는 내가 만든 변경과 기존 변경을 구분한다.
- 병렬 AI 작업은 같은 프로젝트 폴더에서 진행하지 않고, 반드시 `한 작업/세션 = 한 branch = 한 worktree` 원칙을 따른다. 자세한 기준은 `병렬 작업과 worktree 격리` 섹션을 우선한다.
- Git 저장소가 아닌 경우 장기 변경 추적이 어렵다는 사실을 사용자에게 알린다. 사용자가 명시적으로 요청하지 않으면 `git init`을 실행하지 않는다.
- 사용자 동의 없이 브랜치를 만들지 않는다.
- 작업 후 Git 반영 절차는 반드시 확인한다. 변경 범위와 검증 결과를 보고한 뒤 사용자 승인에 따라 stage/commit/push/PR을 수행한다. 사용자가 이미 commit/push/PR을 명시한 경우에도 검증과 secret 점검 후 진행한다.
- secret, token, private key, service role key는 출력하거나 commit하지 않는다.
- 승인 없는 파괴적 작업, secret 노출 위험, 보안 불확실성, 문서 충돌은 fail closed로 처리한다.

## 비협상 경계

- 이 저장소는 user-facing app이다. admin 기능을 새로 만들거나 확장하거나 remediate하지 않는다.
- 이미 `docs/`에 정리된 제품 범위에 대해 fresh domain-discovery interview를 다시 시작하지 않는다.
