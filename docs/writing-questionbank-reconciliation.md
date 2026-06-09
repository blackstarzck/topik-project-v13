# 쓰기 문제(51–54) ↔ topik-ai question-bank 정합 분석 + 관리자 적용 결정

> **상태**: 분석·결정 제안 (2026-06-09). **코드·스키마를 바꾸지 않는 문서 산출물**입니다.
> 실제 적용은 owner 승인 후, 그리고 admin 코드는 별도 저장소(topik-ai)의 작업입니다.
>
> **다루는 범위**: v13 사용자 화면 `08~11`(쓰기 51/52/53/54)이 화면에 쓰는 "문제 데이터" ↔
> 그 데이터가 저장되는 v13 `problems` 스키마 ↔ 그것을 저작/검수하는 topik-ai 관리자
> `/assessment/question-bank`. 세 표면의 필드·enum·의미를 맞춰보고, 사용자 화면이 의존하는
> 항목 중 **관리자가 다룰 수 있어야 하는 것**을 정리한 뒤, 항목별로 **관리자에 반영할지** 결정.
>
> **상위/관계 문서**
> - 통합 설계서(값 수준 정합·게이트): [`admin-integration-plan.md`](admin-integration-plan.md)
> - 엔티티↔페이지 인벤토리: [`user-admin-data-consistency.md`](user-admin-data-consistency.md)
> - 경계/방법: [`admin-scope-boundary.md`](admin-scope-boundary.md), [`user-admin-consistency-method.md`](user-admin-consistency-method.md)
> - anchor: `topik-ai/docs/specs/admin-data-contract.md`
>
> **검증 신뢰도**: 내부 워크플로우(추출 4 + 종합 1 + 적대검증 2, 총 7 에이전트, 두 검증자 SOUND).
> 추가로 **Codex GPT-5.5 외부 팩트체크**(검증 가능 사실 31건: 26 CONFIRM · 4 PARTIAL · 0 REFUTE,
> 판정 **SOUND-WITH-FIXES**). 내부 보정 §6 · Codex 보정 §8에 반영.

---

## 0. 한 줄 결론

**스키마 갭이 아니라 "관리자 콘텐츠 저작 갭"이 핵심이다.** v13 `problems` 스키마는 쓰기 문제의
풍부한 본문을 이미 `materials/answer_key/rubric`(jsonb)에 담고 있고, 사용자 화면은 그것을
`normalizeWritingProblem`으로 읽어 화면을 그리며, 쓰기 RPC `admin_update_problem`의 허용 키에는
이미 `materials/answer_key/rubric/title/prompt/difficulty` 등 13개가 들어 있다. 그런데 topik-ai
관리자는 **이 본문을 읽지도, 쓰지도 않는다**(빈 placeholder만 만들고, 검수 상태 패치만 전송, 생성 폼
없음). 즉 **새 스키마를 추가할 필요는 거의 없고**, 필요한 일은 (a) 기존 jsonb 컬럼/RPC 위에 관리자
콘텐츠 저작 화면을 올리는 것, (b) 아직 PROPOSED 상태인 enum들을 owner가 확정하는 것 — 둘 다
**문서·승인 게이트 영역**이지 v13에 admin 전용 스키마를 더하는 일이 아니다.

---

## 1. 세 표면 정의

| 표면 | 위치 | 역할 |
|---|---|---|
| **A. 사용자 화면 08–11** | `docs/Wireframe/08~11/*`, `src/lib/writing/*` | 51/52/53/54 풀이 화면. `problems` 한 건을 읽어 타입별로 다른 UI를 그림 |
| **B. v13 `problems` 스키마** | `supabase/migrations/2026052012*~2026060912*`, `src/lib/writing/*`, `src/lib/supabase/types.ts` | 공유 DB(admin-first 설계). 본문은 `materials/answer_key/rubric` jsonb |
| **C. topik-ai 관리자** | `topik-ai/src/features/assessment/*`, `topik-ai/docs/specs/admin-data-contract.md` | `/assessment/question-bank` 저작/검수 화면. **목록 조회는 실 Supabase(`problems`) 연동·검수상태는 RPC로 실연동 / 본문 content만 빈 placeholder(materials를 읽지 않음)** |

**한 줄 데이터 흐름**: 관리자가 저작한 문제 → `problems`(본문 jsonb) → 화면이
`normalizeWritingProblem(kind = q51|q52|q53|q54)`로 변환 → 타입별 UI. 동시에 사용자 제출물(autosave
초안·제출 텍스트·글자수·타임스탬프)은 별도 제출 엔티티로 흐름(이 문서 범위 밖).

---

## 2. 핵심 발견 (왜 "콘텐츠 저작 갭"인가)

1. **공통 골격은 정합**: `question_no`(51–54, PRIOR FINAL로 완전 합의된 유일 필드), `prompt`, `title`,
   그리고 검수 두 축 — `review_status`(최종: pending/approved/rejected)와 신규
   `review_workflow_status`(5단계, PROPOSED, CHECK 없음, PRIOR FINAL D-C, 5→3 붕괴 금지).
2. **관리자가 오늘 실제로 쓰는 본문/메타 쓰기는 검수 상태 하나뿐** — `admin_update_problem` 경유.
   나머지 표시 항목은 전부 읽기 전용이거나 sentinel(`미지정`/`미검증`/`미상`).
3. **본문은 스키마에 이미 있다**: `problems.materials`(blanks·charts·context_notes·source_context·scenario),
   `problems.answer_key`, `problems.rubric`. 화면은 이를 읽고, RPC 허용 키도 이미 받는다.
4. **막힌 곳은 관리자 UI**: `buildContent()`가 항상 빈 값을 만들고 `materials`를 전혀 읽지 않으며,
   생성 폼이 없다 → 관리자는 화면이 의존하는 지문 구조·다항 조건·참고자료·차트·에세이 주제를
   **설정할 수 없다**(스키마·쓰기 경로는 있는데도).

---

## 3. 세 곳 필드 매핑표 (20행)

상태 범례: `ALIGNED` 정합 · `NAME_MISMATCH` 이름만 다름 · `ENUM_MISMATCH` 값 집합 다름 ·
`MISSING_IN_ADMIN` 관리자에 없음 · `MISSING_IN_SCHEMA` 스키마 컬럼 없음 · `MEANING_DIVERGENCE` 의미 어긋남.

| # | 논리 필드 | 화면(08–11) | v13 `problems` 컬럼 | topik-ai admin 필드 | 상태 |
|---|---|---|---|---|---|
| 1 | 문제 타입 51/52/53/54 | `question_no`/`meta.exam_number` → kind | `question_no` smallint, CHECK `null OR (51..54)` | `questionNumber`(필터 전용·편집X) | **ALIGNED**(PRIOR FINAL) |
| 2 | 지문 본문 | `prompt`/`prompt_text`(인라인 ( ㄱ )( ㄴ ), 1)2)3)) | `prompt` text NOT NULL | `questionText`(표시만, UI 쓰기 없음) | ALIGNED(UI배선 갭) |
| 3 | 제목/주제 제목 | `title`, q54 `topicTitle` 폴백 | `title` text NOT NULL | `topic`(읽기 전용) | ALIGNED(UI배선 갭) |
| 4 | 주제 분류 | `meta.domain`(경제/사회/건강/기술/행정…) | **`topic_category_code`** text, NULLABLE, **CHECK 없음**(PROPOSED) | `domain`(생활/학습/사회/문화/경제/교육/환경/기술/미분류) | **ENUM_MISMATCH** |
| 5 | 난이도/레벨 | `meta.difficulty`(4/5) 또는 `difficulty_target`'TOPIK 3급'(51) | `difficulty` smallint 1–5 NULLABLE · `topik_level` smallint **NOT NULL** CHECK(1,2) | `difficultyLevel` 상/중/하/미상(derived) | **ENUM_MISMATCH**(PRIOR FINAL D-G) |
| 6 | 빈칸 정의+정답(51/52) | `blanks[]`, `blankedPrompt` (51=answer_key+blank_1/2, 52=프롬프트 마커+힌트) | `answer_key` jsonb + `materials.blanks.*` | `content(51/52)` **항상 빈값**, materials 안 읽음 | **MISSING_IN_ADMIN** |
| 7 | 참고자료: 차트(53) | `charts[]`(bar/line/pie/donut/table), `materialCards` | `materials.charts.chart_a/chart_b` | `content(53)` **항상 빈값** | **MISSING_IN_ADMIN** |
| 8 | 참고자료: 맥락 노트/상황 | `context_notes`, `source_context.situation_summary` | `materials.context_notes/source_context` | — | **MISSING_IN_ADMIN** |
| 9 | 다항 조건+채점기준(rubric) | `rubric → conditions[]+criteria[]`, q53/q54 별도 | `rubric` jsonb(**보통 OBJECT** {conditions,criteria}) | `scoringCriteria`(배열일 때만 매핑 → 보통 빈값) | **MEANING_DIVERGENCE** |
| 10 | 모범/참고 답안 | `model_answer`(풀이화면 비표시, 피드백서 표시) | `answer_key` jsonb | `modelAnswer`(`answer_key.text`만 투영) | **NAME_MISMATCH** |
| 11 | 글자수 제한(타입별) | `charLimit`(51:10–120…54:300–700) | **컬럼 없음** — `CHAR_LIMITS` 코드 상수(constants.ts) | — | **MISSING_IN_SCHEMA**(의도된 타입 상수) |
| 12 | 에세이 주제/정의/배경/필수 3문항(54) | `topicTitle/topicDefinition/background/requiredQuestions[3]` | `prompt`(번호 항목) + `materials.scenario/approved_topic_seed` | `content(54)` **항상 빈값** | **MISSING_IN_ADMIN** |
| 13 | 운영 가용성(lifecycle) | `lifecycleStatus` active/inactive/expired + reason | `lifecycle_status` text CHECK(active/inactive/expired) + `lifecycle_reason` + `expires_at` | `operationStatus` 미지정/노출후보/숨김후보/운영제외 → **쓰기 비활성, 미지정 sentinel** | **ENUM_MISMATCH**(PRIOR FINAL 타깃) |
| 14 | **사용자 노출 게이트(3축)** | (게이트만) | **`publish_status`** CHECK(draft/published/archived) + **`visibility`** CHECK(private/public/org, **기본 private**) — RLS `problems_visible_select`: `published AND (public OR 소유자)`(20260520121100:72) · 화면 추가필터 `lifecycle_status='active'`(server.ts:135-137) · RPC `admin_toggle_problem_publish` | — (publish·visibility 둘 다 관리자 모델에 없음) | **MISSING_IN_ADMIN** |
| 15 | 검수 단계(진행중) | (비표시) | `review_workflow_status` text NULLABLE **CHECK 없음**(PROPOSED 5단계) | `reviewStatus(5)` → 여기 기록(실연동) | **ALIGNED**(PRIOR FINAL D-C) |
| 16 | 검수 최종 결과 | (비표시) | `review_status` text CHECK(pending/approved/rejected) | `reviewStatus(5)` → 완료=approved/수정필요=rejected, 보류는 보존 | **ALIGNED**(PRIOR FINAL D-C) |
| 17 | 검수자 메모 | `review_memo`(비표시) | **전용 컬럼 없음** → `admin_audit_logs.payload.review_note`(`__note` 예약키) | `reviewMemo` TextArea(**UI-local, DB 미전송**) | **MISSING_IN_SCHEMA**(audit 경로 존재) |
| 18 | 검증/자동검사 상태 | `validation/auto_checks_passed`(51/52 경고) | `materials.review.validation` jsonb | `validationStatus` 항상 `미검증` sentinel | **MEANING_DIVERGENCE** |
| 19 | 출처/생성 메타 | — | `source` text CHECK(ai_generated/curated) | `sourceType` 항상 `미상` sentinel | **MEANING_DIVERGENCE**(범위 밖) |
| 20 | 편집/이력 감사 | `edit_history`(비표시) | `admin_audit_logs`(필드 diff) | `revisionHistory` 빈 placeholder | **MEANING_DIVERGENCE**(범위 밖) |

> **검증자 추가 확인(필드 바인딩)**: 관리자는 `problems.explanation`을 **실제로 읽어** `managementNote`로
> 표시한다(서비스 line 152). v13 설계 의도상 `explanation`은 학습자용이라 검수자 메모의 올바른 저장처는
> 아니지만, "관리자가 explanation을 전혀 안 본다"는 아니다. 또한 검수 액션 다이얼로그가 수집하는
> **사유(reason) 텍스트도 RPC 전에 버려진다**(§6 참고).

---

## 4. 사용자 화면(08–11)이 의존 → "관리자가 다룰 수 있어야 하는" 항목 정리

화면이 정상 동작하려면 **누군가(=관리자) 저작해야 하는** 문제 본문/메타. 저장처는 모두 기존 컬럼.

**공통(51–54)**
- 지문 본문 `prompt` · 제목 `title` · 타입 `question_no` · 주제분류 `topic_category_code` · 난이도 `difficulty`
- 채점 rubric `rubric`(conditions/criteria) · **노출 3축: 게시 `publish_status` + 공개범위 `visibility`(기본 private) + 운영 `lifecycle_status`**

**51 단답(빈칸완성)** — `answer_key`(블록별 정답) + `materials.blanks.blank_1/2`(accepted_answers/synonyms), `blank_count`, 텍스트상태 메타. 글자수 10–120(타입 상수).
**52 연결표현** — `answer_key` **없음**: 프롬프트 ( ㄱ )( ㄴ ) 마커 + `blank_target_giyeok/nieun` 힌트 + `model_answer`. `rubric.conditions/criteria` 없으면 **제출 차단**(`problem_data_incomplete`). 10–160.
**53 자료설명** — `materials.charts.chart_a/chart_b`(차트), `context_notes/source_context`, `rubric.criteria`. 120–300(권장 200–300).
**54 에세이** — `prompt`의 번호형 **필수 3문항**(또는 `materials.scenario` 폴백), `topicTitle/topicDefinition/background`, `rubric`(content/structure/language). 3문항 미만 또는 rubric 비면 **제출 차단**. 300–700(권장 600–700).

> **데이터 형태 주의**: 54는 두 가지 JSON 형태가 공존(평면 `sample-54` vs 53식 풍부 `sample-54-2`). 정규화기는
> 둘 다 흡수하지만, 관리자 저작 시 **하나의 정식 형태**를 정해야 한다(§5 G9).

---

## 5. 갭별 결정표 (G1–G12)

권고: `APPLY_TO_ADMIN`(관리자가 다룰 수 있게 추가 — **문서·owner 승인 후 topik-ai 작업**) ·
`RECONCILE_V13_SCREEN`(v13이 스키마에 맞춤) · `ESCALATE_OWNER`(실 스키마/정책 결정 필요).
**모든 권고는 문서 단계이며 v13에 admin 전용 스키마를 더하지 않는다.**

| Gap | 제목 | 우선 | 결정 | 핵심 근거 |
|---|---|---|---|---|
| **G1** | 관리자가 풍부한 문제 본문(materials/blanks/charts/conditions)을 **전혀 저작·편집 못 함** | **P0** | **APPLY_TO_ADMIN** | 스키마·화면 읽기·RPC 허용키 모두 존재. 빠진 건 관리자 콘텐츠 저작 UI뿐. `materials/answer_key/rubric`를 읽어 타입별로 투영하고 같은 키로 되쓰기. **새 컬럼 0**. RPC는 `private.is_content_admin`(content/platform admin)만 통과. **⚠️ 리스크: `admin_update_problem`은 materials/answer_key/rubric jsonb를 서버에서 형태검증 없이 그대로 저장**(20260608120400:78-89) → 잘못된 blob이면 normalizer가 `missing_blanks/charts/rubric`로 떨어져 **제출 차단** 유발. 저작기는 타입별 shape를 클라이언트에서 검증해야 함 |
| **G2** | `scoringCriteria`가 배열 rubric만 읽음 → OBJECT rubric은 빈값 | P1 | **RECONCILE_V13_SCREEN** | v13의 OBJECT `{conditions,criteria}`가 정식. v13은 정식 rubric 형태를 공표, 관리자 reader 수정은 topik-ai 몫 |
| **G3** | 54 다항 조건(conditionLines/rubric.conditions) 저작 불가인데 **제출 게이트** | P1 | **APPLY_TO_ADMIN** | 조건은 `rubric`(jsonb, 허용키)에 있음 = 스키마 갭 아님. G1과 같은 슬라이스, 기존 `rubric` 쓰기 경로 |
| **G4** | 검수자 메모 `reviewMemo`(+검수 사유 `reason`)가 UI-local → **DB 미저장(손실)** | P1 | **APPLY_TO_ADMIN (단서 있음)** | v13는 메모를 `admin_audit_logs.payload.review_note`(`__note` 예약키, 20260608120400:42)로 라우팅. **주의: `__note`는 실 컬럼 변경이 함께 있어야만 남음** — empty diff면 early-return이라 **메모만 단독 저장 시 조용히 유실**(migration 주석 line 19). 검수 액션은 항상 컬럼을 바꾸므로 그 패치에 `__note` 동봉하면 OK. **그러나** 컬럼 변경과 무관한 독립·조회형 메모가 필요하면 → **ESCALATE_OWNER**(작은 additive 컬럼이 audit-log payload보다 깔끔) |
| **G5** | `operationStatus`↔`lifecycle_status` 값 매핑 | P1 | **RESOLVED(B2, 2026-06-09)** | [`B2-decision.md`](ai-workflow/runs/2026/06/09/B2-decision.md): operationStatus=권고레이어 → 미지정=write안함·노출후보→active·숨김후보→inactive·**운영제외→inactive**(expired는 만료채널 전용). expires_at=수동/저장만(자동만료 없음). 선행=A1-pre+allowlist에 lifecycle키 추가(현재 없어 silent no-op). |
| **G6** | `topic_category_code` PROPOSED(NULLABLE·CHECK 없음), 관리자 8라벨이 화면 라벨(**건강/행정**) 미포함 | P1 | **ESCALATE_OWNER** | PRIOR FINAL D-B(컬럼 확정)+PRIOR OPEN R2(코드 미확정). owner가 ① ASCII 코드셋 ② 미포함 라벨 매핑 확정해야 CHECK·쓰기 가능 |
| **G7** | **사용자 노출 게이트(publish_status + visibility + lifecycle)가 관리자 모델에 없음** | P1 | **APPLY_TO_ADMIN** | 노출 = RLS `publish_status='published' AND (visibility='public' OR 소유자)`(20260520121100:72) + 화면 `lifecycle_status='active'`(server.ts:135-137). **visibility 기본값이 'private'**라 검수·게시해도 visibility를 public으로 안 바꾸면 **안 보임**. allowlist에 `publish_status`·`visibility` 둘 다 있고 전용 RPC `admin_toggle_problem_publish` 존재. **'검수 완료'≠'게시'≠'공개'** 3축임을 문서화하고 관리자에 게시+공개 표면 추가. **새 컬럼 0** |
| **G8** | 타입별 글자수 제한 — 컬럼·관리자 필드 없음, 프롬프트 내장 범위와 상수 불일치 가능 | P2 | **RECONCILE_V13_SCREEN** | 현 설계상 글자수는 타입 상수(constants.ts)지 문제별 데이터 아님. 프롬프트 내장 범위는 표시 카피 → QA 일치 검증. 문제별 오버라이드 필요시에만 ESCALATE |
| **G9** | 54의 두 JSON 형태(평면 vs 풍부) 공존 → 관리자 저작 일관성 | P2 | **RECONCILE_V13_SCREEN** | 화면은 둘 다 흡수. v13이 신규 54의 정식 materials 형태(풍부형)를 정하고 평면형은 레거시 폴백 유지. G1 저작기가 그 한 형태를 저작 |
| **G10** | 52 정답셋 정책 | P2 | **RESOLVED(B3, 2026-06-09)** | [`B3-decision.md`](ai-workflow/runs/2026/06/09/B3-decision.md): **#52=피드백/루브릭 채점 전용**(채점기가 answer_key 안 읽음, server-actions:35-39). #52 answer_key는 complete_paragraph(model_answer+힌트) 유지, 정답배열 비저작. 완성도=프롬프트 마커+rubric. 적발: admin buildContent('52')가 객관식 오모델→C3b 수정. 새 스키마 0 |
| **G11** | `validationStatus` `미검증` sentinel, 관리자가 `materials.review.validation` 안 읽음 | P2 | **RECONCILE_V13_SCREEN** | 데이터는 materials에 있고 51/52 화면이 표시. v13은 정식 형태 유지, 관리자 reader 강화는 G1에 흡수(선택) |
| **G12** | 생성된 `src/lib/supabase/types.ts` **STALE**: `topic_category_code/review_workflow_status/admin_update_problem` 누락 | P2 | **RECONCILE_V13_SCREEN** | 순수 v13 타이핑 위생. 마이그레이션 후 live DB에서 타입 재생성. (lifecycle 3컬럼은 이미 타입에 있음 — §6) |

---

## 6. 적대검증 보정사항 (반영 완료)

두 검증자 모두 종합을 **SOUND**로 판정. 결론을 바꾸지 않는 정밀화/누락 보정:

- **`admin_toggle_problem_publish` 출처**: 검토 6파일엔 없으나 실재함 — `supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` 정의, `types.ts:1005`에 타입 존재. G7의 근거 유효.
- **G12 범위 정밀화**: types.ts는 "전면 stale"이 아니라 Phase-C 추가분만 누락. `lifecycle_status/lifecycle_reason/expires_at`(20260608120100)은 **이미 타입에 있음**(types.ts:176–228, 1036–1039). 누락은 `topic_category_code/review_workflow_status/admin_update_problem` 셋뿐.
- **`question_no` nullability**: 컬럼은 `null OR (51..54)`로 **NULL 허용**(비-쓰기 문제용). 쓰기 화면은 4값만 조회하므로 결론 불변.
- **`topik_level`**: **NOT NULL** CHECK(1,2). (난이도 `difficulty`와 별개 축, 관리자 미표시)
- **`getWritingProblem` lifecycle 필터**: `active`로 먼저 조회하다 컬럼 부재 에러면 **필터 없이 재실행**(런타임 폴백, server.ts:125–147). 마이그레이션된 DB에선 active-only지만 pre-migration 스키마도 견딤.
- **검수 사유(reason)도 손실(G4 강화)**: 검수 다이얼로그가 사유 텍스트를 수집하지만 `setReviewStatusViaRpc`가 RPC 전에 **버린다**(reviewMemo와 별개로 두 번째 손실 필드). 즉 관리자 UI에 정당화 입력 플러밍이 **이미 일부 존재** → G4 APPLY_TO_ADMIN을 강화(메모/사유를 `__note`로 전달만 하면 됨).
- **`operationStatus = lifecycle_status` 표기**: 현재는 코드가 lifecycle_status를 **읽지도 않음**(`미지정` 리터럴 하드코딩). "= lifecycle_status"는 **의도된 타깃**이지 현 바인딩 아님 → G5 ESCALATE 타당.

---

## 7. 권고 요약 & 다음 단계 (전부 owner 승인 게이트)

**관리자에 반영 권고 (APPLY_TO_ADMIN, topik-ai 작업, 새 스키마 0):**
1. **G1(P0)** — 타입별 콘텐츠 저작/편집 화면: `materials/answer_key/rubric`를 읽어 투영, `admin_update_problem`로 되쓰기. (G3·G11 흡수) **단 서버가 blob 형태를 검증하지 않으므로 저작기에서 shape 검증 필수.**
2. **G7(P1)** — 노출 표면(`publish_status` + `visibility`). **노출 3축**(게시·공개범위·운영) 문서화. **visibility 기본 private** 주의(게시만으론 안 보임).
3. **G4(P1)** — 검수 메모/사유를 `__note`로 검수 패치에 동봉(이미 UI 플러밍 일부 존재). **단 memo-only 저장은 유실** → 독립·조회형 메모가 필요하면 owner에 작은 additive 컬럼 escalate.

**owner 정책 결정 (ESCALATE_OWNER) — 전부 RESOLVED(2026-06-09):**
- ~~**G6**~~ → **B1 결정**: 관리형 참조 테이블(parent/child) + 매핑 명세([`B1-arch-decision.md`](ai-workflow/runs/2026/06/09/B1-arch-decision.md)·[`B1-mapping-spec.md`](ai-workflow/runs/2026/06/09/B1-mapping-spec.md)).
- ~~**G5**~~ → **B2 결정**: operationStatus 권고레이어, 운영제외→inactive, expires_at 수동([`B2-decision.md`](ai-workflow/runs/2026/06/09/B2-decision.md)).
- ~~**G10**~~ → **B3 결정**: #52 피드백 채점 전용, answer_key=complete_paragraph 유지([`B3-decision.md`](ai-workflow/runs/2026/06/09/B3-decision.md)).

**v13 자체 정리 (RECONCILE_V13_SCREEN, 이 저장소):**
- **G12(P2)** — live DB에서 Supabase 타입 재생성(누락 3건).
- **G2/G9/G11** — 정식 rubric·54 materials·validation 형태를 문서로 공표(관리자 reader가 맞추도록).
- **G8(P2)** — 글자수 타입 상수 ↔ 프롬프트 내장 범위 일치 QA.

> **경계 재확인**: 이 문서는 분석·결정 제안이다. v13의 admin-first 스키마는 충분하므로 user 화면을
> 스키마에 맞춘다는 원칙을 지키며, admin 전용 스키마를 v13에 더하지 않는다. APPLY_TO_ADMIN 항목은
> 별도 저장소(topik-ai)에서 owner 승인 후 구현한다. ([`admin-scope-boundary.md`](admin-scope-boundary.md) 준수)

---

## 8. Codex GPT-5.5 외부 교차검증 결과 (2026-06-09)

내부 적대검증(§6)에 더해 **다른 계열 모델(Codex GPT-5.5)**로 양쪽 저장소 실소스 대조 팩트체크 + 결정
로직 리뷰를 받음. 검증 가능 사실 31건 중 **26 CONFIRM · 4 PARTIAL · 0 REFUTE**, 판정 **SOUND-WITH-FIXES**.
PARTIAL/지적은 모두 본문에 반영 완료. (cross-family 리뷰 = 구현자와 다른 모델 계열 충족.)

### 8.1 반영한 보정 (검증자 지적 → 문서 수정)

| # | Codex 지적 | 근거(직접 재확인) | 반영 위치 |
|---|---|---|---|
| F1 | **노출 게이트가 publish_status 단독이 아님** — `visibility`(기본 `private`) RLS 축을 누락 | RLS `problems_visible_select`: `publish_status='published' AND (visibility='public' OR author_id=auth.uid())` (`20260520121100_rls_policies.sql:67-72`); `visibility` 컬럼 CHECK(private/public/org) 기본 private(`20260520120200:31-32`) | §3 행14, §4 공통, **G7**, §7 |
| F2 | **`__note` memo-only 저장은 유실** — 단순 "보내면 끝"은 부족 | empty diff면 early-return, `__note`는 실 컬럼 변경과 함께여야 영속(migration 주석 `20260608120400:19`) | **G4**(단서·조건부 ESCALATE 추가) |
| F3 | **`admin_update_problem`이 materials/answer_key/rubric를 서버 형태검증 없이 raw 저장** | `update ... set materials = patch->'materials'` 등 무검증(`20260608120400:78-89`); 잘못된 blob → normalizer fallback → 제출차단 | **G1**(리스크 절 추가) |
| F4 | **관리자는 "mock/in-memory"가 아님** — 목록은 실 Supabase 조회, content만 placeholder | `supabase-...service.ts:170-185`가 `problems` SELECT; content는 빈 placeholder(`104-119`), materials 미독 | §1 표 C행 |

### 8.2 확인된 사실 정정 (PARTIAL 4건)

- **C14**(memo 유실): note-only 드롭은 맞음. 단 "컬럼이 안 바뀌면"은 약간 부정확 — 같은 값이라도
  allowlist 키를 보내면 `v_diff`에 잡힘(즉 트리거 조건은 "diff 비었나"). → G4에 정확히 반영.
- **C19**(mock): content placeholder는 맞으나 **목록 read는 실 Supabase**. → F4로 정정.
- **C25**(검수맵): target 값(approved/done 등 ASCII)은 일치. 단 맵의 **키는 한글 라벨**(ASCII 아님). 의미 동일.
- **C28**(차트): 53 차트 채워짐 맞음. 54는 sample-54가 chart 필드 **자체 없음**, sample-54-2는 **빈** 필드. 미세차.

### 8.3 검증자가 추가로 확인해 준 안심 포인트

- **권한**: `admin_update_problem`/`admin_toggle_problem_publish`는 `authenticated`에 grant되나 내부
  `private.is_content_admin`로 **content_admin/platform_admin만 통과**(`20260608120400:52`) — 무단 쓰기 위험 낮음.
- 중앙 thesis("스키마 갭 아닌 콘텐츠 저작 갭, 새 admin 스키마 불필요")는 content 필드에 대해 **방어 가능**.
  유일한 예외 후보 = durable·조회형 검수 메모(그때만 작은 additive 컬럼 검토) → G4에 명시.

> **순 결론 변화**: 12갭의 버킷팅(APPLY/ESCALATE/RECONCILE)은 유지. 다만 **G7은 3축(publish+visibility+lifecycle)**으로
> 확장, **G1은 서버 무검증 리스크**, **G4는 memo-only 유실 단서**가 추가됨. 이 셋이 구현 시 가장 주의할 지점.

---

## 9. 노출 규칙 (B0 확정, 2026-06-09)

보완 페이즈 **B0**(owner 승인 완료)에서 확정. 출처: [`docs/ai-workflow/runs/2026/06/09/B0-report.md`](ai-workflow/runs/2026/06/09/B0-report.md).

**현황(dev 시드 466건)**: `published/public/approved` 217 ↔ `draft/private/pending` 249 (완벽 1:1, 반례 0, GPT-5.5 재확인). 숨김 249건은 **의도된 검수 대기 staging** — 일괄 공개하지 않음(D1).

**노출 규칙** — 기술 게이트와 프로세스 전제를 구분한다:
- **기술 게이트(시스템이 실제로 강제)**: `publish_status='published'` + `visibility='public'`(RLS `problems_visible_select`) + `lifecycle_status='active'`(쓰기 화면 필터). 셋을 모두 만족해야 사용자에게 노출.
- **프로세스 전제(관례, RLS/화면이 강제하지 않음)**: `review_status='approved'`. 검수 통과가 공개의 전제지만, **승인이 자동 공개를 트리거하지 않는다**(D3: 명시적 공개 액션).
- **함정**: `visibility` 기본 `private`·`publish_status` 기본 `draft` → 신규/검수완료 문제도 명시 설정 없으면 **숨김 고착**. → **D6**: `approved AND NOT(published&public&active)` 관리자 리포트로 누락 방지(C1에서 구현).
- topic_category_code(466 NULL)·lifecycle 값매핑은 각각 **B1·B2**에서 확정.

---

## 10. 글자수 정책 (A3 확정, 2026-06-09 / G8)

보완 페이즈 **A3**(GPT-5.5 PASS) 결과. 출처: [`docs/ai-workflow/runs/2026/06/09/A3-report.md`](ai-workflow/runs/2026/06/09/A3-report.md).

- **글자수는 타입별 시스템 상수**(`src/lib/writing/constants.ts` `CHAR_LIMITS`), 문제별 컬럼 없음 — 정책 유지(오버라이드 요구 시에만 B로 escalate).
- **상수 ↔ 프롬프트 내장 범위 일치 확인(불일치 0, 시드 466건)**: 53 프롬프트 "200~300자"=recommended 200–300, 54 "600~700자"=recommended 600–700, 51/52는 빈칸형이라 범위 표기 없음. 프롬프트 내장 범위는 **recommended를 보여주는 표시 카피**.
- **hard 하한 < recommended는 의도된 완화**: 53 hard 120(분석 가능 최소)·54 hard 300. 제출 게이트는 hard(`isCountSubmittable`), 프롬프트 지시는 recommended. ⚠️ owner 인지: 프롬프트가 "200~300자로 쓰시오"라 적혀도 53은 120자부터 제출 허용됨(의도된 설계, 재고 원하면 별도 결정).
- 후속(A2 이관): 프롬프트 카피 ↔ `CHAR_LIMITS.recommended` 드리프트 방지 **가드 단위 테스트**(현재 불일치 0이라 이번엔 보류).
