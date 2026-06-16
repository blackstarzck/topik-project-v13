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
- SOT를 실제로 수정한 경우 완료 보고에 `수정한 문서 / 수정 내용 / 충돌 여부 / 후속 갱신 필요 여부`를 포함한다.
- 사용자 요청이 active SOT와 충돌하면 구현하지 말고, 충돌한 문서와 위치를 먼저 보고한다.
- active SOT에 없는 net-new scope, 제품 pivot, 제품 behavior, data rule, UX flow, security rule은 바로 구현하지 않는다. 먼저 docs update proposal 또는 acceptance criteria가 있는 implementation brief를 만든다.

## 읽기 순서

모든 작업은 먼저 `AGENTS.md`와 `README.md`를 확인한다. 이후 작업 유형에 맞춰 최소 관련 문서를 추가로 읽는다.

| 작업 유형 | 추가 확인 문서 |
| --- | --- |
| 제품/기능 | `docs/prd.md`, `docs/ia.md`, `docs/flow/user-flow.md`, 관련 `docs/Wireframe/<page>/` |
| 코드/구현 | `package.json`, 관련 `src/`, 관련 Wireframe 기능명세 |
| UI/스타일 | `DESIGN.md`, `docs/ant-design/README.md` 흐름, `docs/ant-design/07-review-checklist.md` |
| Supabase/DB/RLS | `supabase/migrations/INDEX.md`, 관련 migration, `docs/Wireframe/data-usage-index.md`, 관련 화면 기능명세 |
| Auth | 관련 auth Wireframe, `src/app/auth/`, `src/lib/supabase/`, `supabase/migrations/INDEX.md` |
| 배포/환경 | `README.md`, `.env.example`, `package.json` |
| 결제/구독/paywall | `docs/Wireframe/25-X-03-paywall/`, `docs/Wireframe/26-X-04-subscription-management/` |
| 리뷰/QA | 관련 source docs, 관련 테스트, UI 작업이면 `docs/ant-design/07-review-checklist.md` |

`docs/INDEX.md`나 `memory/MEMORY.md`가 생기면 공통 진입 문서로 함께 확인한다.

## 작업 절차

- 개발 또는 변경 작업은 먼저 목적, 범위, phase/TODO, 검증 방법이 포함된 실행 계획을 만든다.
- 계획은 `1차 초안 -> 비판적 검토 -> 보완안 -> 구현` 순서로 다듬는다.
- 사용자의 개발/변경 작업 요청은 원칙적으로 에이전트 팀 관점으로 처리한다. 도구가 허용되면 실제 멀티 에이전트를 사용하고, 단순 작업이거나 도구 사용이 적절하지 않으면 메인 세션 안에서 `계획자 / 구현자 / 비판자` 역할을 분리해 검토한다.
- 검토에는 반드시 비판적 시선의 critic 관점을 포함한다.
- 작업은 phase와 TODO 단위로 쪼개 진행하고, 각 단계가 끝날 때 확인 결과를 남긴다.
- 기존 구조와 문서를 먼저 확인하고, 프로젝트 방식에 맞춰 필요한 최소 변경만 수행한다.
- 긴 작업, background 작업, timeout, hang, 의도치 않은 세션 종료 가능성이 있으면 재개 가능한 handoff 또는 진행 기록을 남긴다.
- 중요한 결정, 실패, 실험 결과는 기존 기록 체계에 맞춰 남긴다. 예: `docs/superpowers/plans/`, `docs/qa/reports/`, `supabase/migrations/INDEX.md`, 관련 active docs의 Decision/History 섹션.

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
- auth/security 변경은 실패 케이스, redirect, cookie/session, secret 노출 여부를 확인한다.
- 검증을 실행하지 못했거나 실패하면 완료로 보고하지 않는다. 미실행/실패 이유, 재현 명령, 남은 위험을 함께 보고한다.

## 파일과 Git 규칙

- 문서/비코드 요청에서 "읽기", "검토", "정리", "요약", "제안"은 기본적으로 채팅 응답만 반환한다. 새 파일/폴더 생성은 사용자가 명시적으로 요청했거나, 생성할 경로와 목적을 먼저 제시해 승인받은 경우에만 한다.
- 사용자 또는 다른 도구가 만든 변경을 임의로 되돌리지 않는다. 이미 수정된 worktree에서는 내가 만든 변경과 기존 변경을 구분한다.
- Git 저장소가 아닌 경우 장기 변경 추적이 어렵다는 사실을 사용자에게 알린다. 사용자가 명시적으로 요청하지 않으면 `git init`을 실행하지 않는다.
- 사용자 동의 없이 브랜치를 만들지 않는다.
- 작업 후 Git 반영 절차는 반드시 확인한다. 변경 범위와 검증 결과를 보고한 뒤 사용자 승인에 따라 stage/commit/push/PR을 수행한다. 사용자가 이미 commit/push/PR을 명시한 경우에도 검증과 secret 점검 후 진행한다.
- secret, token, private key, service role key는 출력하거나 commit하지 않는다.
- 승인 없는 파괴적 작업, secret 노출 위험, 보안 불확실성, 문서 충돌은 fail closed로 처리한다.

## 비협상 경계

- 이 저장소는 user-facing app이다. admin 기능을 새로 만들거나 확장하거나 remediate하지 않는다.
- admin 콘솔은 별도 앱(topik-ai) 소유이며, 이 저장소에는 admin 코드/라우트/와이어프레임이 없다(2026-06-09 코드 제거, 2026-06-11 와이어프레임·문서 참조 제거).
- 공유 Supabase 스키마 소유권은 앱 기준이 아니라 도메인 기준으로 정한다. 이 저장소는 core user-facing schema(예: `profiles`, `notification_settings`, `user_notifications`)만 소유한다.
- admin 운영 schema(알림 템플릿/그룹/발송 운영 등)는 topik-ai가 자체 migration tracker(`admin_schema_migrations`)로 소유·관리하므로 이 저장소에 추가하지 않는다.
- 양쪽에서 읽거나 쓰는 공유 객체는 topik-ai `docs/architecture/shared-supabase-schema-ownership.md`의 owner/writer/reader/RLS/migration home 기록을 따른다.
- 기존 v13 소유 테이블의 DDL 변경은 owner(v13) 승인과 migration decision record가 필요하다.
- `profiles.app_role`, `admin_audit_logs`, `private.is_*_admin` RLS 헬퍼는 load-bearing이므로 제거하지 않는다.
- 이미 `docs/`에 정리된 제품 범위에 대해 fresh domain-discovery interview를 다시 시작하지 않는다.
- 목적 없는 대형 문서나 장황한 보고서를 생성하지 않는다.
- 이미 실패한 실험은 기록 확인 없이 반복하지 않는다.
