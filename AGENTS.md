# AGENTS.md

이 저장소는 TOPIK 학습자를 위한 `TALKPIK AI` 사용자 앱이다. Codex와 Claude를 포함한 모든 AI 에이전트는 이 문서를 공통 작업 계약이자 유일한 workflow owner로 따른다.

## 소유권과 우선순위

충돌하면 아래 순서로 판단하고, 조용히 우회하지 말고 충돌을 보고한다.

1. 사용자의 현재 명시 요청
2. 제품 약속과 범위: `docs/prd.md`
3. 데이터베이스·RLS·RPC의 실행 가능한 정본: timestamp 순으로 재생한 `supabase/migrations/*.sql` — **저작은 워터마크 `20260729120000`에서 동결**됐다(아래 참조)
4. 사람이 읽는 데이터 계약: `docs/supabase/`
5. 현재 동작: `src/`, `src/lib/routes.ts`, tests
6. UI 계약: `DESIGN.md`
7. 검증 계약: `TESTING.md`
8. 외부 백엔드 참고: `docs/swagger-api/`

**learner 마이그레이션 저작 동결(2026-07-30)**: 워터마크 `20260729120000` 이하의 `supabase/migrations/*.sql`은 불변이며(편집·이름변경·삭제 금지), 신규 learner 마이그레이션은 이 저장소가 아니라 topik-ai `supabase/migrations-v13/`에 워터마크 초과 timestamp로 작성한다. `migrations/down/**`와 `migrations/INDEX.md`는 예외로 계속 갱신한다. CI가 `scripts/check-migration-freeze.mjs`로 강제하며 우회 스위치는 없다 — 위반은 해당 파일을 topik-ai로 옮겨 해소한다. 근거와 상세는 [`supabase/README.md`](./supabase/README.md)의 "저작 동결" 절이다.

`README.md`는 문서 지도이며 정책 owner가 아니다. `docs/qa/`의 날짜별 계획과 보고서는 당시 상태를 보여주는 historical evidence이지 SOT가 아니다. 과거 보고서의 삭제된 경로는 기록 당시 baseline을 가리킨다.

제품 동작·데이터 규칙·UX·보안 범위를 상상으로 만들지 않는다. 사용자가 제품 변경을 승인하면 별도 proposal을 누적하지 않고 같은 변경 묶음에서 `docs/prd.md`, source, tests를 함께 갱신한다. 작업 중 임시 spec·plan·UI evidence는 ignored 경로인 `.codex/work/<slug>/` 아래에 둔다.

## 사용자와 대화하는 방식

- 답변과 작업 보고는 한국어로 한다. 코드, 명령어, 파일명, package, route는 원문을 유지한다.
- 기본 응답 순서는 `결론 → 이유 → 다음 행동`으로 하고, 필요한 경우 그 뒤에 `기술 세부사항`을 둔다.
- 사용자는 개발에 직접 관여하지 않는 것을 전제로 한다. 메서드명, 변수명, 함수명, 클래스명, 데이터베이스 필드명과 같은 구현 용어를 설명의 중심에 두거나, 사용자가 그 의미를 추론해야 이해할 수 있게 설명하지 않는다.
- 개발 용어나 원문 식별자가 꼭 필요하면 쉬운 한국어를 먼저 쓰고 원문은 처음 한 번만 괄호에 표시한다. 이후에는 한 가지 이름을 일관되게 사용하며, 확인용 원문 식별자는 필요하면 `기술 세부사항`에 모은다.
- 시각 자료가 이해를 실질적으로 높일 때만 사용하고 장식용으로 넣지 않는다. 시각 자료는 긴 설명을 대신해야 하며, 접근성을 위한 핵심 설명을 제외하고 같은 내용을 본문에서 반복하지 않는다.

| 내용의 구조 | 우선 표현 방식 |
| --- | --- |
| 정확한 비교·대응 관계 또는 서로 비교할 항목 3개 이상 | 표 |
| 서로 의존하는 단계나 분기 3개 이상 | Mermaid 흐름도(`flowchart`) |
| 여러 주체가 요청과 응답을 주고받음 | Mermaid 시퀀스 다이어그램(`sequenceDiagram`) |
| 계층·소유권·포함 관계 | 트리 |
| 시간 흐름이나 상태 변화 | 타임라인 또는 차트 |
| UI·레이아웃·공간 관계 | 와이어프레임 또는 스크린샷 |
| 사실 하나, 단계 하나 또는 단순 목록 | 글이나 목록. 시각 자료를 강제하지 않음 |

- 표의 머리글은 내용을 설명하는 구체적인 이름으로 쓰고 한 표에는 한 주제만 담는다. 지나치게 넓으면 나누고, 실용적인 범위에서 글은 왼쪽, 숫자는 오른쪽으로 정렬한다.
- 노드가 있는 다이어그램은 노드를 기본 15개 이하로 제한하고, 짧은 이름과 일관된 진행 방향을 사용한다. 색만으로 의미를 구분하지 않는다. 접근성을 위해 복잡한 시각 자료의 핵심 의미나 결론을 글로 반드시 함께 설명하되, 상세를 그대로 되풀이하지 않는다.
- 플랫폼에서는 Markdown과 Mermaid를 우선한다. Codex에 `visualize`가 있거나 Claude에 `Artifacts`가 있고 상호작용이 이해를 실질적으로 돕는 경우에만 해당 기능을 사용할 수 있다. 이런 선택 기능이 항상 있다고 가정하지 않으며, 언제나 글로 된 대안을 남긴다.
- 비유를 쓰면 곧바로 실제 의미를 설명한다.
- 객관적 사실, 실행 결과, 가정, 미확인 항목을 구분한다. 모르면 모른다고 말한다.
- 고정 보고 템플릿과 신호등 상태표를 강제하지 않는다.
- 보내기 전에 확인한다: 결론이 바로 보이는지, 설명하지 않은 전문 용어가 없는지, 시각 자료가 실제로 유용한지, 사실·가정·미확인 항목이 구분되는지, 저장소가 요구하는 최종 상태 보고가 유지되는지 확인한다.
- 모든 작업 완료 보고에는 남은 작업을 반드시 명시한다. 남은 작업이 있으면 이유·owner·안전한 다음 행동을 구분하고, 없으면 `남은 작업 없음`이라고 명시한다. 미실행·차단·외부 owner 이관·Git 미반영을 완료로 숨기지 않는다.
- 모든 최종 답변 직전에 현재 Git 상태를 읽기 전용 명령으로 확인한다. worktree의 `clean`·`dirty` 여부, 연결 branch와 upstream, 로컬에서 확인 가능한 앞섬·뒤처짐·갈라짐, 충돌 또는 진행 중인 Git 작업 유무를 확인한다. 원격 최신 상태를 그 답변에서 확인하지 않았다면 최신이라고 추정하지 않고 `원격 최신 여부 미확인`이라고 적는다.
- 모든 최종 답변 끝에는 `워크트리 상태`, `Pull 준비 상태`, `Commit → Push 준비 상태`를 쉬운 말과 근거로 표시한다. `Pull 준비 상태`는 미커밋 변경, upstream 유무, 충돌과 진행 중인 Git 작업뿐 아니라 로컬 branch의 앞섬·뒤처짐·갈라짐과 원격 최신 상태 확인 여부를 모두 반영한다. worktree가 `clean`이더라도 동기화 상태나 원격 최신 여부가 확인되지 않으면 단순히 `가능`으로 보고하지 않는다. `Commit → Push 준비 상태`는 변경 존재 여부, 검증 완료 여부, branch·upstream·충돌 상태를 반영하며, 기술적으로 가능해도 사용자 승인 전에는 실행하지 않는다고 구분한다.
- 위 상태 표시 다음의 마지막 줄에는 현재 worktree의 절대 경로와 연결된 branch를 `현재 워크트리: <절대 경로> | 연결 브랜치: <branch>` 형식으로 적는다. branch가 없는 detached HEAD 상태라면 `연결 브랜치: 없음 (detached HEAD)`으로 적는다.

## 7단계 작업 흐름

1. **기준 확인**: 이 문서와 `README.md`를 읽고 요청에 필요한 최소 owner, source, tests만 확인한다.
2. **영향도와 계획**: 제품·코드·데이터·UI·테스트·문서 영향을 나누고, 목적·범위·TODO·검증 방법을 정한다.
3. **격리와 환경**: 먼저 `task:prepare`로 요청을 분류한다. 질문·조사·리뷰는 현재 checkout에서 읽기만 하고 branch·worktree·registry를 만들지 않는다. 작은 순차 코드 작업은 task branch 하나와 `.worktrees/shared-dev` 공용 slot을 재사용한다. 기존 task를 이어갈 때는 Codex·Claude 구분 없이 같은 branch·workspace와 `TaskRecordV3` claim을 이어 쓴다. 병렬·장기·위험 작업만 사용자에게 `공용 작업 공간 / 별도 안전 폴더`를 선택받고, 별도 관리 worktree를 만든다. host/adopted workspace는 소유권을 가져오거나 폴더를 삭제하지 않는다. 공용 `task:prepare`, `task:start`, `task:status`, `task:handoff`, `task:resume`, `task:runtime`, `task:finish`, `task:finalize`, `task:cleanup`, `task:autocleanup`, `task:sweep`, `task:measure`, `task:metrics`, `task:owner-auth`, `release:start`, `release:status`, `release:resume`, `validation:record`, `validation:check`, `validation:status` 명령과 [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md)가 workflow owner다. 필요한 경우 `pnpm prepare:worktree-env --profile app` 또는 `--profile e2e`로 검증된 main checkout의 `.env.local`을 안전하게 준비한다. 기존 파일은 덮어쓰거나 합치지 않으며 값과 secret을 출력하지 않는다.
4. **구현과 TDD**: 실패하는 관련 테스트를 먼저 만들거나 확인하고, 프로젝트 구조를 유지한 최소 변경으로 통과시킨다.
5. **비판적 리뷰**: critic 관점에서 요구사항 누락, 회귀, 권한·secret·RLS, 실패 복구와 불필요한 확장을 확인한다. 가능하면 독립 에이전트 리뷰를 사용한다.
6. **검증**: 영향 범위의 test, lint, typecheck, build를 실행한다. 10초 이상 걸릴 것으로 예상되는 setup·검증·review·CI 대기는 `task:measure`로 감싸고, 보고 전 `task:metrics`로 실제 소요 시간·중복 실행·예산 초과를 확인한다. 측정 실패와 예산 초과는 경고일 뿐 원래 명령의 성공·실패나 Git 안전 조건을 바꾸지 않는다. UI 변경은 Playwright CLI와 Playwright MCP 직접 브라우저 확인을 각각 별도 증거로 남긴다.
7. **보고와 Git 승인**: 바뀐 내용, 검증 결과, 남은 위험과 Git 상태를 쉽게 설명한다. stage, commit, push, PR, merge는 사용자가 요청했거나 결과 보고 뒤 승인한 범위에서만 수행한다. Black 또는 Keduall `main` 병합 뒤에는 관리 대상 workspace를 `task:autocleanup`으로 즉시 정리한다. 에이전트 밖에서 병합된 작업은 다음 코드 작업의 `task:prepare`가 일회성 `task:sweep`을 실행해 따라잡으며, 필요하면 사용자가 `task:sweep`을 직접 실행할 수 있다. 읽기 전용 `task:prepare`는 sweep을 실행하지 않는다. shared slot은 폴더를 유지하고 branch만 비강제로 정리하며, isolated는 관리 worktree와 branch를 비강제로 정리한다. host/adopted는 claim과 task 산출물만 해제하고 폴더를 보존한다. dirty·runtime 실행 중·unknown 파일·SHA·계정·소유권 불일치는 `PRESERVED`로 남긴다.

작업 방식은 Superpowers만 사용한다. OMX와 gstack을 사용하지 않는다. UI 컴포넌트·페이지 styling 작업에는 프로젝트 로컬 `frontend-design`을 함께 사용하되, 이는 domain skill이며 `DESIGN.md`, 기존 Ant Design/theme 구조, Superpowers workflow보다 우선하지 않는다.

## Git과 worktree 안전

- 수정 전 CWD, branch/detached 상태, tracked/untracked 변경, remote와 worktree 소유권을 확인한다.
- 공유 기준 checkout에서 다른 task를 위해 `switch`, `checkout`, `reset`, `rebase`, `merge`하지 않는다.
- 도구와 무관하게 branch는 `feat|fix|refactor|test|docs|chore|ci/<kebab-slug>` 형식만 쓴다. Codex와 Claude는 도구별 branch·worktree를 새로 만들지 않고 같은 task branch·workspace·`TaskRecordV3`를 인수인계한다. 기존 v2 record는 변경하지 않고 v3로 복사하며, 미등록 legacy worktree는 발견 목록에만 남기고 자동 소유권이나 삭제 권한을 부여하지 않는다.
- worktree는 포트, dev server, 로컬 DB, `.env.local`, test data를 격리하지 않는다. 병렬 runtime은 고유 loopback port와 분리된 test data를 사용한다.
- 다른 사용자의 변경을 되돌리지 않는다. dirty·untracked·ignored-sensitive 파일이나 미게시 commit이 있으면 소유자를 확인하기 전 삭제하지 않는다.
- 완료된 branch/worktree도 publish·merge·소유권·runtime 종료를 확인하기 전 삭제하지 않는다. 강제 정리는 하지 않는다.
- 작업 산출물과 정리는 [`docs/operations/ai-development-pipeline.md`](./docs/operations/ai-development-pipeline.md)를 따른다. `task:finalize`는 report-only다. 병합과 소유권이 증명된 managed v3 task는 `task:autocleanup` 또는 `task:sweep`이 승인 입력 없이 비강제 정리한다. `task:cleanup --approval`은 legacy·수동 복구 호환 경로로 유지한다. 강제 삭제는 제공하지 않으며 `stg`와 `main`은 절대 정리 대상이 아니다.

Black 개발 저장소 `origin`은 `blackstarzck/topik-project-v13`이며 `blackstarzck` 계정으로 관리한다. `origin/main`은 PR과 필수 검사를 거쳐 반영한다. solo 작업에 `guestkeduall-design` 승인을 강제하지 않는다. 실제 협업자가 작성한 PR은 저장소의 활성 CODEOWNERS·ruleset을 그대로 따르며 self-review, 필수 검사 우회, stale approval 재사용은 금지한다.

이 checkout에서 `collab`은 `https://github.com/keduall/topik-project-v13.git`의 고정 remote 별칭이다. `collab/main`은 `keduall/topik-project-v13`의 `refs/heads/main`이며, Keduall 저장소를 직접 clone한 checkout에서는 같은 ref를 `origin/main`이라고 부른다. 반면 이 checkout에서 별도 한정 없는 `origin/main`은 `blackstarzck/topik-project-v13`을 뜻한다. 이 대응은 확정된 계약이므로 어느 별칭을 뜻하는지 다시 질문하지 않는다.

Keduall 운영 저장소 `collab`은 `guestkeduall-design` 계정으로 관리한다. 사용자가 “운영에 반영해줘” 또는 같은 뜻의 명시적 승격 요청을 해야만 Black `main`의 정확한 SHA를 Keduall의 장기 `stg` branch로 승격하는 `PromotionRunV1`을 시작한다. `stg`는 `topik-dev`를 쓰는 Vercel Preview에서 검증하고 DB gate를 통과한 뒤 `stg` → `main` PR로 production을 반영한다. squash·rebase·Keduall `main` 직접 push는 허용하지 않는다.

같은 pipeline 계약 버전의 최초 2회 production 승격은 `stg`·DB 검사가 끝난 뒤 Keduall `main` merge 직전에 최종 확인을 한 번 받는다. 그 두 번이 production `READY`, 정확한 main SHA, production alias, smoke test, cleanup까지 연속 성공한 뒤에만 `AUTO`로 전환한다. 사용자가 push 또는 merge라고 표현해도 최초 2회 최종 확인을 생략하거나 우회하지 않는다. pipeline 계약, DB workflow·호환성 정책, Vercel project·environment·domain, remote·branch·인증 profile이 바뀌거나 배포 실패·rollback·보안 사고가 발생하면 성공 횟수를 0으로 되돌린다. destructive DB migration과 강제 Git 작업은 자동 mode에서도 별도 승인이 필요하다.

원격 반영의 선행 조건은 두 저장소 전체 Git 이력의 임시 산출물에 대한 secret-safe 보안 감사, 관련 credential 폐기·교체, 승인된 노출 대응이다. 경로·commit·탐지 규칙·안전한 hash만 기록하고 secret 값은 읽거나 출력하지 않는다. credential 교체, Git history rewrite와 GitHub Support 요청은 각각 별도 승인 작업이다. 이 선행 조건이 충족되지 않으면 publish·promotion을 중단한다.

production DB 자동 apply는 migration 기준선, tracker prefix, schema·RPC·RLS·grant fingerprint, backup/PITR, 고정 tool version, forward reconciliation과 N-1/N 호환성 검증이 준비될 때까지 비활성이다. production credential은 로컬 에이전트나 PR에 전달하지 않고 trusted operations workflow만 정확한 SHA와 digest를 적용한다. Keduall `main` merge 뒤에는 정확한 결과 SHA의 Vercel Production 배포가 `READY`이고 production alias·domain·읽기 전용 smoke test가 맞는지 확인한다. smoke 실패 시 이전 `READY` deployment로 alias만 rollback하며 DB는 되돌리지 않는다.

## 구현 경계

- Next.js App Router와 기존 project wrapper를 유지한다.
- 이 저장소는 user-facing app이다. admin 화면을 새로 만들거나 확장하지 않는다. 필요한 admin 운영 계약은 별도 소유 앱과의 경계로만 기록한다.
- 실제 LLM 첨삭·문제 생성, billing provider, 외부 알림 전송, 정식 법무 확정 기능은 `docs/prd.md`에서 scope가 열리기 전까지 완료 기능으로 만들지 않는다.
- framework-level dependency 추가·교체는 사용자 승인과 관련 owner 갱신이 필요하다.
- 에이전트가 secret, token, private key, service-role key 값을 직접 읽거나 출력·로그·문서화·브라우저 전달하지 않는다. 승인된 env 준비 도구와 로컬 E2E 프로세스가 값을 노출하지 않은 채 local loopback target에만 사용하는 것은 허용하지만, remote target에는 privileged key를 전달하거나 사용하지 않는다.
- v13 작업면에서 원격 Supabase schema/data apply를 실행하지 않는다. DB 변경이 필요하면 migration과 계약을 로컬에서 검증하고 별도 운영 절차로 넘긴다.
- 클라이언트 운영·복구·환경 안전의 상세 경계는 [`docs/operations/README.md`](./docs/operations/README.md)를 따른다.
- UI는 Ant Design 또는 기존 wrapper를 우선하고 `DESIGN.md`의 theme·Tailwind 경계를 따른다. user-facing 변경에는 관련 loading, empty, success, error, disabled 상태와 desktop/mobile을 포함한다.

## 검증과 완료 기준

완료라고 말하기 전에 실제 명령 출력과 runtime 결과를 읽는다. 실패하거나 미실행한 검증이 있으면 완료로 표현하지 않고 원인, 재현 명령과 남은 위험을 남긴다.

UI 변경은 다음 두 증거가 모두 있어야 merge-ready다.

1. 영향 범위의 Playwright CLI test
2. 현재 worktree의 고유 loopback runtime을 Playwright MCP로 열어 desktop/mobile, 주요 상호작용과 관련 상태를 직접 확인한 결과

MCP가 없거나 현재 worktree runtime임을 증명하지 못하면 해당 UI 검증은 미완료다. 원격 Supabase를 연결한 브라우저 검증은 승인 없는 create/update/delete/submission을 하지 않는다.

완료 보고에는 읽은 owner, 확인한 요구사항과 충돌 여부, 변경 파일, 검증 결과, 미확인·남은 위험, Git 반영 상태를 포함한다.
