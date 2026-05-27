# Context Ledger

## Run Metadata

- Run id: 20260520-1149-schema-parallel-analysis
- Created: 2026-05-20 11:49 +09:00
- Updated: 2026-05-20 11:55 +09:00
- Main session owner: Claude (Opus 4.7)
- Host: Claude Code
- Status: complete

## Task

- User goal: Opus 4.7과 GPT-5(실제: gpt-5.5) 병렬 분석으로 TALKPIK Supabase Postgres 스키마 최적안 도출. 두 제안을 비교/토론하고 최종 종합 스키마를 채팅으로 제시.
- Accepted scope: 채팅 deliverable (제안 비교 + 종합 스키마 + ER + RLS 패턴 + 위험). 파일 생성은 본 ledger만.
- Out of scope: DDL 마이그레이션 작성, RLS 정책 SQL 구현, billing 제공자 결정, future scope(모의고사/게시판/단어장) 본격 모델링.
- Current next action: 종합 스키마 정본을 별도 spec 파일로 옮길지(예: `docs/development/schema-proposal.md`) 사용자 결정 대기.

## Docs Consulted

- 직접 읽음:
  - `docs/ai-workflow/runs/2026/05/20/20260520-1043-schema-analysis.md` (이전 Codex 세션 ledger; 실제 스키마 본문 없음)
  - `docs/prd.md`
  - `docs/spec.md`
  - `docs/development/backend-auth.md`
  - `docs/flow/user-flow.md`
  - `docs/IA/README.md`
- 두 sub-agent가 자체적으로 읽음 (위임):
  - `docs/sitemap.md`, `docs/ia.md`
  - `docs/development/deferred-scope.md`
  - `docs/IA/03/04/05/06/08/10/11/14/15/16/17/18/19/21/24/29/30/32` 폴더의 `description.md`
  - `.claude/skills/supabase-postgres-best-practices/SKILL.md` 및 references (Opus 에이전트)
- Untouched relevant docs and reason: none

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 11:49 | 두 분석을 background Agent로 병렬 dispatch | 사용자가 명시적으로 병렬+비교 요청 | User prompt |
| 11:49 | Opus 4.7은 일반 Agent로, GPT는 codex CLI wrapping Agent로 분리 | 사용자 의도(Opus 4.7 + GPT-5/5.5 비교) 충족 | User prompt |
| 11:53 | codex Agent를 stuck로 진단 후 중단 시도 → 직후 정상 완료 알림 도착 | 4분 57초 동안 CPU 누적 0.05초로 hang 의심, 결과적으로 false alarm | PID 22304 모니터링 |
| 11:54 | gpt-5/gpt-5-codex 차단 → gpt-5.5로 진행한 codex 결과 채택 | "model is not supported when using Codex with a ChatGPT account" 메시지. 사용자가 의도한 "gpt 5.5"와 일치 | codex CLI 응답 |
| 11:55 | 최종 종합 스키마는 Opus 안을 base로 GPT의 강점(storage buckets, comparison_reports 명시 저장, study_events+daily/skill stats, library_marks 단순화, organization_members 권한 제약) 통합 | 두 모델의 강점만 채택 → IA/RLS/성능 정합성 최대화 | 내부 토론 |
| 11:55 | PK 전략: 외부 노출 ID는 uuidv7, 대량 내부 행은 bigint identity 혼합 | URL 안전성 + 인덱스/heap 효율 | superpowers schema-primary-keys reference |
| 11:55 | 라이브러리 모델은 다형 FK 대신 단순 `library_marks` + `attempts.bookmarked` 플래그 | 다형 FK 안티패턴 회피, RLS 단순화 | GPT-5.5 제안 채택 |
| 11:55 | comparison_reports 별 테이블에 narrative/metrics 저장 | AI 서술 비결정성 → 재현 가능성 보장 | GPT-5.5 제안 채택 |
| 11:55 | writing draft+submission 한 테이블 + status 통합 | F-01 라이브러리가 같은 행을 탭으로 분리; 자연스러운 상태 전이 | 두 모델 합의 |
| 11:55 | 피드백 = overall + dimension(정규화) + sentence(별 테이블) 부분 정규화 | R-01 비교/X-07 약점이 dimension join 요구; 문장 첨삭은 가변 길이 | 두 모델 합의 (Opus는 jsonb 배열 옵션 제시했으나 GPT의 별 테이블이 더 보수적) |

## Active Files

- Files expected to change: 본 ledger.
- Files inspected: 위 Docs Consulted 목록.
- Files changed:
  - `docs/ai-workflow/runs/2026/05/20/20260520-1149-schema-parallel-analysis.md` (created)
- Files explicitly not to touch: production source, migrations, Supabase project state, 기존 docs.

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Opus 4.7 (general-purpose) | Schema 제안 A 작성 | MVP+Deferred 스키마, 5~8 의사결정, RLS 패턴, ER 다이어그램 | complete | duration 220s, tokens 79k, tool_uses 23. Self-read 19 docs incl. supabase-postgres-best-practices skill. Returned full Tier1/Tier2 split + ER + trade-off section. |
| codex transport Agent | GPT-5/5.5 schema 제안 B를 codex CLI로 받아 raw 반환 | 동일 deliverable | complete | duration 1755s, tokens 103k, tool_uses 62. gpt-5/gpt-5-codex 차단(ChatGPT account auth) → gpt-5.5 사용. Coverage gap: ER 다이어그램·trade-off·Tier 라벨·의사결정 enumerated 누락. |

## Child Result Packets

- Packet A (Opus 4.7): 본 대화 내 상단 결과로 통합 — 핵심 채택점: PK 분리, attempts/writing 분리, 인덱스 상세, audit/notification 포함, partial index 전략.
- Packet B (gpt-5.5 via codex): 본 대화 내 결과로 통합 — 핵심 채택점: study_events 원장 + daily/skill stats 집계, comparison_reports 명시 저장, library_marks 단순화, organization_members.org_role 명시, storage buckets 3분할, "기관 관리자는 학습자 원문 답안 제한" 정책.
- Codex 원본 transcript: `C:\Users\admin\.claude\projects\C--Users-admin-Desktop-workspace-topik-project-v13\30ea7294-7702-4f2c-a68f-74c4fecfa4f7\tool-results\bvln0ffi8.txt` (4537 lines).
- Codex session id: `019e434f-a72f-7cf3-ac8f-3148cd4bef05`.

## Verification State

- Required checks: docs 정합성 확인, 비교 토론의 논리적 일관성, 채택 결정의 IA 근거 제시.
- Checks run:
  - 핵심 docs (prd, spec, backend-auth, flow/user-flow, IA README) 직접 read.
  - 두 sub-agent의 docs 인용 cross-check (IA 폴더 번호 일치, fixed baseline 일치).
- Latest results: 두 제안 모두 fixed baseline(Supabase + RLS, billing deferred) 준수. Doc conflict 없음.
- Skipped checks and reason: 실제 DDL 작성/실행/RLS 정책 SQL 검증은 본 task scope 밖. 다음 단계에서 별 ledger로 진행.
- Cross-model review: degraded — historical, pre-rule (single-AI authored before 2026-05-21 cross-review rule was introduced)

## Fallback State

- Normal path blocked: codex Agent 4m57s간 CPU 0.05s로 hang 의심 발생.
- Failure class: 자식 에이전트 응답 지연.
- Fallback used: 사용자에게 옵션 제시(AskUserQuestion: 재호출/Opus 단독/Agent 재호출). 사용자가 "재호출(직접)" 선택했으나 그 직후 codex Agent 정상 완료 → 재호출 불요.
- Evidence collected: PID 22304 elapsed 4m57s vs CPU 0.05s, Working Set 58.6MB; commandline `codex.js exec "design supabase schema for TALKPIK read project docs"` (축약 prompt 확인).
- Completion allowed: yes — 최종 결과 정상 수신.
- Remaining fallback risk: codex CLI가 향후에도 ChatGPT-account auth로는 gpt-5/gpt-5-codex 차단. 실제 gpt-5가 필요하면 OpenAI API key 계정으로 codex auth 전환 필요.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes (본 ledger만).
- Docs consulted match implemented behavior: 본 task는 행동(코드/마이그레이션) 없음 — 분석 결과만 채팅 deliverable.
- Child result packets integrated: yes (비교 표 + 종합 스키마에 반영).
- Verification state current: yes.
- Remaining risks listed: yes (아래).

## Risks And Follow-Up

- Remaining risks:
  - 종합 스키마는 **제안**. 사용자/제품 승인 전 마이그레이션 금지.
  - `comparison_reports.metrics` JSON 키, `feedback_dimension_scores.dimension` enum, `study_events.event_type` 카탈로그는 AI 프롬프트·UI 와이어프레임 확정 후 동결 필요.
  - uuidv7는 `pg_uuidv7` 확장 가용 가정. 미가용 시 폴백(`gen_random_uuid()` + 정렬 컬럼) 결정 필요.
  - RLS 정책 SQL은 별도 review/테스트 필요 (force RLS, definer fn 권한, denorm user_id 무결성 트리거).
  - 본 분석에서 codex transport Agent는 ER 다이어그램·trade-off 섹션을 누락 → Opus 안이 보강. 의사결정 근거가 한쪽으로 치우치지 않도록 향후 GPT 분석 재호출 시 prompt에 명시적 요구 강화 필요.
- Assumptions:
  - Supabase `auth.users.id` 를 FK 타겟으로 사용.
  - admin 판정은 private schema의 SECURITY DEFINER 함수.
  - billing은 deferred placeholder만.
  - 모의고사/게시판/standalone 단어장은 별도 IA/route 추가 전까지 미구현.
- Follow-up needed:
  - 사용자가 종합 스키마를 정본으로 받아들이면 `docs/development/schema-proposal.md` (또는 동등 경로) 로 spec 등재.
  - 등재 후 마이그레이션 DDL/SQL을 작성하고 RLS 테스트 슈트 구축 — 별도 ledger 권장.

---

## Round-2 (gpt-5 재시도 + gpt-5.5 재호출, 2026-05-20 14:00 +09:00)

### Round-2 Task

- User goal: gpt-5로 재분석을 받아 비교 토론 강화. 사용자가 ChatGPT 재인증 진행.
- Outcome: ChatGPT 계정 인증으로는 codex CLI가 `gpt-5`/`gpt-5-codex` 호출을 정책상 차단 (`"The 'gpt-5' model is not supported when using Codex with a ChatGPT account."`). 사용자 결정으로 default `gpt-5.5` 재호출 (round-2) 진행.

### Round-2 Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 13:47 | 새 ChatGPT 계정으로 재로그인 후 gpt-5 ping → 차단 확인 | codex CLI 정책: ChatGPT 인증 모드에서 gpt-5 차단 (plan 무관) | codex 400 응답 |
| 13:50 | gpt-5-codex 차단 여부 ping 시도 → 120s 안 응답 없어 검증 불가 | MCP 초기화/응답 지연 | PowerShell timeout |
| 14:00 | 사용자 선택: gpt-5.5로 명시 prompt 재호출 | 사용자 결정 | AskUserQuestion 응답 |
| 14:03 | cmd.exe + chcp 65001 + raw stdin pipe로 codex exec 호출 | PowerShell stdin UTF-16 변환 우회 | encoding 안전성 |
| 14:?? | gpt-5.5 round-2 결과 수신 (exit 0, 결과 본문 정상) | codex CLI 정상 응답 | result file |

### Round-2 Schema Deltas (이전 종합본 → 갱신본)

| 영역 | 이전 결정 (Round-1) | 갱신 결정 (Round-2) | 트리거 |
| --- | --- | --- | --- |
| writing draft+submit | 한 테이블 통합 + status | **2 테이블 분리** (`writing_drafts` + `writing_submissions`) | gpt-5.5 R2 입장 전환: "immutable 제출과 mutable draft 섞이면 audit/재채점이 흐려짐" |
| library 모델 | `library_marks` 단순 (R1 GPT 채택) | **polymorphic `library_items` + nullable FK + check constraint** | R2 + Opus 일치: F-01 IA가 객관식 attempt/쓰기 submission/report/export 동일 화면이라 다형 FK 정당. R2가 R1 입장을 뒤집음. |
| organizations | Tier 1 minimal | **Tier 2 placeholder** | R2: PRD MVP에 organizations 없음, X-08은 IA에만 존재 |
| notifications | Tier 1 (`notification_settings`) | **Tier 2 placeholder** | R2: X-09 PRD 후순위 인정 |
| study_events PK | bigint identity | **uuid 통일** | R2: Supabase Auth/RLS 일관성, 클라이언트 노출, future sharding |
| audit_logs PK | bigint identity | **uuid 통일** | 동일 일관성 논리 |
| AI feedback 정규화 | 부분 정규화 (Opus) | **유지 (Opus)** — R2의 JSONB-only 안 거부 | R-01 비교 리포트 + X-07 약점 추천이 dimension join을 요구 |
| practice_sessions | Opus의 별 묶음 테이블 | **제거 → `study_events.session_id`로 표현** | R2 단순화 채택 |
| storage buckets | gpt-5.5 R1 명시 3개 | **유지** (avatars/problem-assets/generated-exports) | R1의 강점 보존 |
| RLS SQL 패턴 | Opus 패턴 | **R2 SQL 채택 + Opus 강화** (immutable submission 정책 추가) | R2가 더 정통적 |

### Round-2 Files

- Background command id `bvg1qbvxf` (exit 0)
- Prompt: `C:\Users\admin\AppData\Local\Temp\codex-gpt5-prompt-20260520.txt`
- Result: `C:\Users\admin\AppData\Local\Temp\codex-gpt55-r2-result.txt`
- Log: `C:\Users\admin\AppData\Local\Temp\codex-gpt55-r2-log.txt`

### Round-2 Risks / Notes

- gpt-5는 본 환경에서 codex CLI로 호출 불가 — 향후 진짜 gpt-5 second opinion 필요 시 OpenAI API key 기반 codex 인증 또는 별도 API 호출 경로 필요.
- gpt-5.5는 같은 prompt에 대해 round-1과 round-2에서 3개 핵심 입장(draft/submit 분리, library 다형 FK, org/notification Tier)을 뒤집었음 — 단일 모델 호출 결과를 단정적 사실로 받지 말고 prompt 명세성에 따라 결과가 흔들릴 수 있음을 후속 진행 시 인지.
- 본 갱신 스키마는 여전히 **제안**. DDL/RLS SQL 등재는 별도 ledger.

### Round-2 Follow-up

- 사용자가 갱신본을 정본으로 채택할 시 `docs/development/schema-proposal.md` 등재.
- `study_events.event_type` 카탈로그, `feedback_dimension_scores.dimension` enum, `comparison_reports` JSON 키는 AI 출력 contract 동결 후 확정.
- draft → submission 승격 트리거 DDL 작성 시 활성 draft 1개 보장 unique partial index와 결합 검증 필요.
