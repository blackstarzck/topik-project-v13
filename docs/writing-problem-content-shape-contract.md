# 쓰기 문제 콘텐츠 데이터 형태 계약 (Writing Problem Content Shape Contract)

> 출처/근거: 학생 화면 변환기 `src/lib/writing/problem-normalizer.ts`가 **실제로 읽는** 형태.
> 산출 페이즈: A2(2026-06-09). **이 계약은 C3(관리자 콘텐츠 저작기)·C-TAX가 write 시 검증 기준으로 재사용**한다.
> 배경: 쓰기 문제 본문은 `problems.materials/answer_key/rubric`(jsonb)에 저장되고, RPC `admin_update_problem`은 **서버에서 형태를 검증하지 않는다**(F3) → 저작기가 **클라이언트에서 이 계약대로 검증**해야 잘못된 blob이 학생 화면을 깨뜨리지 않는다. (변환기 자체는 잘못된 입력에도 throw 없이 graceful degrade하도록 설계됨 — 퍼징 검증.)

## 0. 불변식 (Invariants)
- **`problems.prompt`·`problems.title`은 `text not null`** — 변환기는 `prompt`가 항상 문자열이라 가정(matchAll/split 안전). prompt가 비면 `materials.prompt_text` → `materials.prompt` → `""` 순 폴백.
- `materials/answer_key/rubric`는 **무엇이든 올 수 있다**(객체/배열/문자열/null) — 변환기는 전부 가드. 누락/이상 → 빈 배열 + `fallbackWarnings`("missing_*") + (해당 시) `submitBlockedReason`.
- **저장 시 한글 라벨/주제 코드는 [`writing-questionbank-reconciliation.md`](writing-questionbank-reconciliation.md) §9·§10 + 주제 분류 매핑 명세를 따른다**(별도).

## 1. 공통
| 필드 | 위치 | 형태 |
|---|---|---|
| 지문 | `prompt`(주) → `materials.prompt_text` → `materials.prompt` | 문자열. 51/52는 인라인 `( ㄱ )( ㄴ )`, 53/54는 번호형 `1) 2) 3)` + 글자수/배점 문구 |
| 제목 | `title` | 문자열 |
| rubric | `rubric`(주) — **OBJECT 권장** | `{ conditions: string[], criteria: string[] }`. 중첩 `rubric.rubric`/`rubric.approved_rubric`, 또는 `materials.rubric`/`materials.approved_rubric`도 폴백으로 읽음. **바닥 배열**도 허용(degenerate): conditions·criteria 양쪽에 흡수. 51은 rubric 없음 정상 |
| 운영상태 | `lifecycle_status`(없으면 active) | active/inactive/expired — non-active면 제출차단(lifecycle) |

## 2. 타입별 본문

### 51 (단답·빈칸완성)
- `answer_key`: `{ "ㄱ": string[], "ㄴ": string[] }` 또는 `{ answer_key: {…} }`(중첩) — 빈칸별 정답.
- `materials.blanks.blank_1/blank_2`: `{ role, answer_type, canonical_answer, accepted_answers: string[] }`.
- 빈칸 라벨은 프롬프트의 `( ㄱ )( ㄴ )` 마커로 도출.
- **제출 차단**: 빈칸 0개 → `problem_data_incomplete`(A2 신규).

### 52 (연결표현)
- `answer_key` 보통 **없음**(채점 정책은 B3 결정). 빈칸은 프롬프트 마커 + `materials.blanks.blank_target_giyeok`/`blank_target_nieun`(힌트) + `materials.blanks` 객체.
- 조건은 `rubric.conditions` 또는 빈칸 힌트(role/targetHint)에서 도출.
- **제출 차단**: `rubric.conditions` 또는 `rubric.criteria`가 비면 `problem_data_incomplete`.

### 53 (자료설명)
- **차트**: `materials.charts.chart_a`/`chart_b` **또는 top-level `materials.chart_a`/`chart_b`** (둘 다 허용 — 시드는 top-level 사용). 형태: `{ title, chart_type(bar/line/pie/donut/table), unit, survey_org, year_range:(string|number)[], series:[{label, values:number[]}] }`. series 값 중 비숫자는 무시.
- 맥락카드: `materials.context_notes`(또는 `materials.notes`) `{ display_label, row1_label/row1_value, row2_label/row2_value, cause, status }`; `materials.source_context.situation_summary`(텍스트카드, 차트 없을 때).
- 과제: 프롬프트 번호 항목(`1) 2) 3)`).
- **제출 차단**: 차트 0개 **그리고** 과제 0개 → `problem_data_incomplete`(A2 신규, 둘 다 없으면 풀 수 없음). (하나만 있으면 차단 안 함.)

### 54 (에세이)
- 주제: `materials.scenario`/`scenario_logic`/`approved_topic_seed`의 `topic_seed_title`, 또는 top-level `topic_seed_title`, 또는 `title`.
- 필수 3문항: 프롬프트 번호 항목, 없으면 `scenario.chart_a_focus`/`chart_b_focus`/`cross_chart_bridge` 폴백.
- rubric 요약: `{ content, structure, language }`(rubric 후보에서).
- **두 형태 공존**: 평면형(top-level topic_seed_title, 최소 meta) vs 풍부형(approved_topic_seed/scenario/narrative). **풍부형이 정식**, 평면형은 레거시 폴백 — 둘 다 흡수.
- **제출 차단**: 필수문항 < 3 **또는** rubric criteria 0 → `problem_data_incomplete`.

## 3. 검증/QA 메타 (학생 미표시)
- `materials.review.validation`: 51/52 화면의 `validationMessages`로 표시(배열/문자열, 비배열이면 빈 처리).
- `review_passed`, `review_memo`, `edit_history`, `auto_checks_passed`: 저작/검수 메타, 학생 화면 비표시.

## 4. 제출 차단 규약 요약 (A2 기준)
| 타입 | problem_data_incomplete 조건 |
|---|---|
| 51 | 빈칸 0개 (A2 신규) |
| 52 | rubric.conditions 또는 criteria 비음 |
| 53 | 차트 0 **AND** 과제 0 (A2 신규) |
| 54 | 필수문항 < 3 **또는** criteria 0 |
> lifecycle non-active면 위와 무관하게 `lifecycle`로 차단(우선).
> ⚠️ 51·53 차단은 A2에서 추가한 **사용자 영향 변경**(못 푸는 문제 방지). owner veto 가능.

## 5. C3/C-TAX 재사용
저작기는 저장 전 이 계약대로 클라이언트 검증(타입별 필수 필드·차트 series 숫자·rubric 객체 형태·필수문항 수 등). 통과분만 `admin_update_problem`로 write. 서버 검증 RPC 추가 여부는 C3c에서 결정(F3).
