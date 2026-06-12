# AGENTS.md

이 저장소는 TOPIK 학습자를 위한 `TALKPIK AI` 사용자 앱이다. 사용자는 학습 목표를 설정하고, TOPIK 쓰기 51~54번 유형을 연습하며, AI 피드백과 복습 흐름을 통해 실력을 개선한다.

Codex와 모든 AI 에이전트는 아래 규칙을 항상 따른다.

## 최상위 원칙

- 답변과 작업은 한국어로 한다. 코드, 명령어, 파일명, 패키지명, route는 원문을 유지한다.
- 객관적 사실, 실행 결과, 출처 문서, 테스트를 우선한다.
- 추정은 반드시 "가정"으로 표시하고, 모르는 내용은 모른다고 말한다.
- 사용자가 이해하기 쉽게 단계별로 설명한다.
- 기존 구조와 문서를 먼저 확인하고, 프로젝트 방식에 맞춰 최소 수정한다.
- AI 산출물은 근거 없이 완료로 간주하지 않는다.
- `docs/`는 제품 의도, 아키텍처 결정, 화면 요구사항, 품질 기준의 source of truth다.
- 현재 source code는 이미 구현된 동작의 기준이다. 동작을 바꾸기 전에는 active docs와 current source를 함께 확인한다.

## Workslop 금지

AI가 만든 결과물은 아래 중 하나 이상의 근거가 있어야 다음 단계로 넘길 수 있다.

- 테스트 결과
- 명령 실행 요약
- 프로젝트 문서 또는 공식 문서 출처
- 스크린샷, 렌더 결과, 브라우저 확인 결과
- 벤치마크 또는 정량 비교 결과
- 사용자 승인. 단, 요구사항과 방향 승인에 한정되며 기술 검증을 대체할 수 없다.

겉보기만 그럴듯하고 검증되지 않은 문서, 코드, 실험 결과, 보고서는 workslop으로 간주한다. "완료", "성공", "문제 없음"이라고 말하려면 무엇을 확인했는지 함께 보고한다.

## 비협상 규칙

- **관리자 범위 경계**: 이 저장소는 user-facing app이다. admin 기능을 새로 만들거나 확장하거나 remediate하지 않는다. admin 콘솔은 별도 앱(topik-ai) 소유이며, 이 저장소에는 admin 코드/라우트/와이어프레임이 없다(2026-06-09 코드 제거, 2026-06-11 와이어프레임·문서 참조 제거). 공유 Supabase 스키마 소유권은 앱 기준이 아니라 **도메인 기준**으로 정한다(2026-06-12 알림 기능 개발로 개정): 이 저장소는 core user-facing schema(예: `profiles`, `notification_settings`, `user_notifications`)만 소유하고, admin 운영 schema(알림 템플릿/그룹/발송 운영 등)는 topik-ai가 자체 migration tracker(`admin_schema_migrations`)로 소유·관리하므로 이 저장소에 추가하지 않는다. 양쪽에서 읽거나 쓰는 공유 객체는 topik-ai `docs/architecture/shared-supabase-schema-ownership.md`의 owner/writer/reader/RLS/migration home 기록을 따르며, 기존 v13 소유 테이블의 DDL 변경은 owner(v13) 승인 + migration decision record가 필요하다. 단 `profiles.app_role`, `admin_audit_logs`, `private.is_*_admin` RLS 헬퍼는 load-bearing이라 제거 금지. 자세한 기준은 `docs/admin-scope-boundary.md`를 따른다.
- 이미 `docs/`에 정리된 제품 범위에 대해 fresh domain-discovery interview를 다시 시작하지 않는다.
- 사용자 요청이 active docs와 충돌하면 구현하지 말고, 충돌한 문서와 위치를 먼저 보고한다.
- net-new scope, 제품 pivot, active docs에 없는 요구사항은 바로 구현하지 않는다. 먼저 docs update proposal 또는 acceptance criteria가 있는 implementation brief를 만든다.
- 문서 충돌, 승인 없는 파괴적 작업, secret 노출 위험, 보안 불확실성은 fail closed로 처리한다.
- 사용자-facing 보고, 계획, 리뷰, 요약은 `docs/user-communication-style.md`를 따른다.

## 필수 문서 지도

- 프로젝트 문서 안내: `docs/README.md`
- 제품 목적과 범위: `docs/prd.md`
- 구현 기준과 기술 구조: `docs/spec.md`
- route와 화면 연결: `docs/sitemap.md`
- 정보 구조: `docs/ia.md`
- 사용자 흐름: `docs/flow/user-flow.md`
- 화면별 명세: `docs/Wireframe/README.md`, `docs/Wireframe/<page>/description.md`, `docs/Wireframe/<page>/functional-spec.md`
- UI 규칙: `docs/ant-design/README.md`
- UI 최종 점검: `docs/ant-design/07-review-checklist.md`
- 개발 상세 문서: `docs/development/README.md`
- stack, package, test tooling: `docs/development/stack.md`
- Supabase/Auth/RLS/Storage: `docs/development/backend-auth.md`
- Auth 운영 흐름: `docs/development/auth-overview.md`
- 현재 Supabase 사용 inventory: `docs/supabase-table-inventory.md`
- DB schema 기준: `docs/development/database-schema.md`
- Supabase migration index: `supabase/migrations/INDEX.md`
- 화면별 DB 구조 공유 문서: [`docs/share/`](docs/share/)의 `database-structure-by-page.md`
- 배포와 환경 변수: `docs/development/deployment.md`, `docs/development/environments.md`
- deferred scope: `docs/development/deferred-scope.md`
- 테스트 안내: `TESTING.md`
- 관리자 범위 경계: `docs/admin-scope-boundary.md`

## 작업 시작 시 읽기 순서

모든 작업은 먼저 `AGENTS.md`와 `docs/README.md`를 확인한다.

그 다음 작업 유형에 따라 아래 문서를 추가로 확인한다.

- 코드 작업: `docs/spec.md`, 그리고 `docs/spec.md`의 Required Reading Map이 지시하는 상세 문서
- 제품/기능 작업: `docs/prd.md`, `docs/sitemap.md`, `docs/ia.md`, `docs/flow/user-flow.md`, 관련 `docs/Wireframe/<page>/`
- UI 작업: `docs/ant-design/README.md`에서 시작해 필요한 세부 문서와 `docs/ant-design/07-review-checklist.md`
- Supabase/DB/RLS 작업: `docs/development/backend-auth.md`, `docs/supabase-table-inventory.md`, `docs/development/database-schema.md`, `supabase/migrations/INDEX.md`, [`docs/share/`](docs/share/)의 `database-structure-by-page.md`
- Auth 작업: `docs/development/backend-auth.md`, `docs/development/auth-overview.md`, 관련 auth screen spec
- 배포/환경 작업: `docs/development/deployment.md`, `docs/development/environments.md`
- 결제/구독/paywall 작업: `docs/development/deferred-scope.md`
- 관리자 관련 요청: 먼저 `docs/admin-scope-boundary.md`를 읽고 현재 범위인지 판정
- 리뷰 작업: 관련 source docs, 관련 테스트, UI 작업이면 `docs/ant-design/07-review-checklist.md`
- 긴 작업/백그라운드 작업: 진행 기록을 남길 위치를 먼저 정하고, 중단 시 재개 가능한 handoff를 남긴다.

현재 이 프로젝트에는 `docs/INDEX.md`와 `memory/MEMORY.md`가 없다. 그런 파일이 생기면 공통 진입 문서로 함께 확인한다.

## 작업 순서

1. 관련 문서를 먼저 읽는다.
2. 현재 파일 구조와 기존 변경을 확인한다.
3. 작업 목적, 범위, 검증 방법을 짧게 정리한다.
4. 필요한 최소 변경만 수행한다.
5. 테스트 또는 검증을 실행한다.
6. 변경 내용, 이유, 확인 결과, 남은 위험을 요약한다.
7. 중요한 결정, 실패, 실험 결과는 기존 기록 체계에 맞춰 남긴다. 예: `docs/ai-workflow/runs/YYYY/MM/DD/`, `docs/design-review-result/`, `docs/superpowers/plans/`, `supabase/migrations/INDEX.md`.

## 구현/개발 작업 계획

구현 또는 개발 작업을 시작하기 전에는 실행 계획을 먼저 정리한다. 계획에는 작업 목적, 범위, phase 단위의 할 일 체크리스트, 검수/검증 방법이 포함되어야 한다.

비자명하거나 위험이 큰 구현/개발 작업은 코드 수정 전에 계획을 검토한다. 멀티 에이전트 검토가 실질적으로 도움이 되는 경우 `리뷰 -> 토론 -> 합의 -> 타이브레이크` 순서로 범위, 논리, 작업 단위, 검증 기준, 리스크를 점검한다. 합의된 계획 또는 타이브레이크 결론이 있어야 구현 단계로 넘어간다.

작업은 phase와 할 일 단위로 끊어서 진행하고, 각 단계가 끝날 때 확인 결과를 남긴다. 긴 작업, background 작업, timeout, hang, 의도치 않은 세션 종료 가능성이 있는 작업은 재개 가능한 handoff 또는 진행 기록을 남긴다.

## 구현 규칙

- Next.js App Router 구조와 `src/app/` route tree를 따른다.
- `docs/sitemap.md`는 제품 route map이고, `src/app/`은 현재 구현 reference다. route 변경 전 둘을 reconcile한다.
- Ant Design component와 theme token을 우선 사용한다.
- Tailwind CSS는 제한된 utility layer로만 사용한다. 디자인 시스템이나 brand token source로 사용하지 않는다.
- theme을 수정하거나 추가할 때는 하나의 theme source of truth를 기준으로 Ant Design adapter와 Tailwind adapter를 함께 갱신한다. AntD는 `ConfigProvider`/`theme.token`/`theme.components` 방식으로, Tailwind는 `src/styles/global.css`의 Tailwind v4 `@theme inline`과 `--app-*` bridge 방식으로 같은 값을 소비해야 한다.
- 디자인 컴포넌트는 AntD 컴포넌트 또는 AntD 컴포넌트를 감싼 프로젝트 wrapper를 사용한다. Tailwind로 Button/Input/Card/Modal 같은 AntD 컴포넌트의 상태나 variant를 재구현하지 않는다.
- Supabase server-only key와 secret은 browser-visible 변수로 노출하지 않는다.
- RLS, auth, storage, profile, admin role을 건드릴 때는 관련 문서를 먼저 읽는다.
- framework-level dependency를 추가하거나 교체하려면 stack-change decision 또는 사용자 승인과 문서 갱신이 필요하다.
- billing SDK, payment provider, 실제 결제 흐름은 deferred scope가 명시적으로 열리기 전까지 추가하지 않는다.
- user-facing 화면은 loading, empty, error, success, disabled 상태를 함께 고려한다.
- UI 작업은 desktop과 mobile 확인을 포함한다.

## 검증 기준

작업 완료를 말하기 전에 변경 범위에 맞는 검증을 수행한다.

- 개발과 관련된 사용자 작업 요청은 완료 전 변경 영향 범위에 맞는 e2e 검증을 실행한다. 기본 범위는 작업 대상 route, 관련 사용자 흐름, 변경된 shared component가 영향을 주는 화면이다.
- `pnpm test:e2e` 전체 실행은 auth, middleware, app shell, route guard, global style/theme, shared navigation, test config처럼 여러 route에 영향을 주는 변경이거나, 변경 영향 범위를 좁히기 어려운 경우에 사용한다.
- 범위를 좁혀 e2e를 실행한 경우에는 실행한 Playwright 파일/필터/명령과 그 범위가 충분한 이유를 보고한다. 예: `pnpm exec playwright test -g "B-01 home-dashboard"`.
- e2e 테스트 진행에 필요한 테스트 계정/인증정보는 현재 세션이나 도구가 제공하는 프로젝트 메모리에서 참고한다. secret, token, private key, service role key는 출력하거나 commit하지 않는다.
- 필요한 범위의 e2e를 실행할 수 없거나 실패하면 완료로 보고하지 않는다. 실패 또는 미실행 이유, 재현 명령, 남은 위험을 함께 보고한다.
- 작은 문서 변경: 문서 링크와 파일 존재 여부, 충돌 여부 확인
- 코드 변경: 관련 unit/integration test, `pnpm lint`, `pnpm typecheck` 중 필요한 항목
- route/UI 변경: 관련 component test 또는 browser 확인, mobile/desktop layout 확인
- Supabase/migration 변경: SQL idempotency, RLS 영향, `supabase/migrations/INDEX.md`, `docs/development/database-schema.md`, `docs/supabase-table-inventory.md`, [`docs/share/`](docs/share/)의 `database-structure-by-page.md` 및 관련 schema 문서 갱신 확인
- auth/security 변경: 실패 케이스, redirect, cookie/session, secret 노출 여부 확인
- 배포 변경: Vercel/Supabase environment 분리, preview gate, rollback 기준 확인

검증을 실행하지 못했으면 이유와 남은 위험을 보고한다.

## 금지 사항

- 검증 없이 "완료", "성공", "문제 없음"이라고 말하지 않는다.
- 출처 없이 최신 기술, 경쟁사 기능, API spec을 단정하지 않는다.
- 목적 없는 대형 문서나 장황한 설명을 생성하지 않는다.
- 이미 실패한 실험을 기록 확인 없이 반복하지 않는다.
- 사용자 또는 다른 도구가 만든 변경을 임의로 되돌리지 않는다.
- active docs에 없는 제품 behavior, data rule, UX flow, security rule을 임의로 만들지 않는다.
- 관리자 기능을 현재 사용자 앱 범위로 끌어오지 않는다.
- secret, token, private key, service role key를 출력하거나 commit하지 않는다.

## Git 규칙

Git 저장소가 아닌 경우 장기 변경 추적이 어렵다는 사실을 사용자에게 알린다. 사용자가 명시적으로 요청하지 않으면 `git init`은 실행하지 않는다.

이미 수정된 worktree에서는 내가 만든 변경과 기존 변경을 구분한다. 요청 범위 밖의 변경은 되돌리지 않는다.
