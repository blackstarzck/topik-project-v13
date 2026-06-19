# 51번 본문 빈칸 데이터 계약 개선 논의

## 배경

현재 51번 단답 작성 화면은 본문 안의 `(ㄱ)`, `(ㄴ)` 표기를 찾아 클릭 가능한 빈칸 UI로 바꾼다. 이 방식은 기존 DB 스키마를 바꾸지 않고 빠르게 적용할 수 있지만, 본문 안 빈칸 위치를 데이터가 명시적으로 보장하지는 않는다.

현재 구현은 다음 두 정보를 조합한다.

- `problem.prompt` 또는 `problem.blankedPrompt` 안의 텍스트 마커: `(ㄱ)`, `( ㄱ )`, `(ㄴ)`, `( ㄴ )`
- 정규화된 `problem.blanks[].label` 또는 `problem.blanks[].key`

즉 빈칸 구분 키는 있지만, "본문의 어느 위치에 어떤 빈칸을 렌더링해야 하는지"를 나타내는 별도 위치 계약은 없다.

## 현재 구조

원본 문제 조회는 `problems` 테이블에서 다음 필드를 읽는다.

- `id`
- `title`
- `prompt`
- `question_no`
- `materials`
- `answer_key`
- `rubric`
- `lifecycle_status`
- `lifecycle_reason`

프론트 정규화 후 51번 문제는 다음 값을 가진다.

```ts
{
  kind: "q51",
  questionNo: 51,
  prompt: string,
  blankedPrompt: string,
  blanks: Array<{
    key: string;
    label: string;
    role: string | null;
    answerType: string | null;
    acceptedAnswers: string[];
    targetHint: string | null;
  }>
}
```

이 구조에서 `blanks[].label`은 `ㄱ`, `ㄴ` 같은 빈칸 식별자로 사용할 수 있다. 그러나 `prompt` 안에 해당 마커가 없으면 본문 위치를 알 수 없다.

## 논의할 개선안

### 옵션 A: `materials.blanks`에 marker 명시

기존 `materials.blanks` 구조를 유지하되, 각 빈칸에 본문 마커를 명시한다.

```json
{
  "blanks": {
    "blank_1": {
      "label": "ㄱ",
      "marker": "(ㄱ)",
      "role": "문맥 세팅"
    },
    "blank_2": {
      "label": "ㄴ",
      "marker": "(ㄴ)",
      "role": "종결 화행"
    }
  }
}
```

장점:

- 기존 `problems.materials` 안에서 확장할 수 있다.
- DB migration 없이 시작할 수 있다.
- 현재 `prompt` 마커 방식과 호환된다.

한계:

- 여전히 본문은 문자열이므로, 같은 marker가 중복되면 위치 해석 규칙이 필요하다.
- 문제 생성/검수 단계에서 `prompt`와 `materials.blanks.*.marker`의 일치 여부를 검증해야 한다.

### 옵션 B: prompt token 구조 도입

본문을 문자열 하나가 아니라 text/blank token 배열로 저장하거나 API에서 내려준다.

```json
[
  { "type": "text", "value": "이번 취업 특강에 " },
  { "type": "blank", "id": "blank_1", "label": "ㄱ" },
  { "type": "text", "value": " 이번 주 수요일까지 신청서를 작성해 주세요." },
  { "type": "blank", "id": "blank_2", "label": "ㄴ" }
]
```

장점:

- 본문 위치와 빈칸 id가 명확하다.
- 렌더링 로직이 정규식에 덜 의존한다.
- 향후 빈칸별 힌트, 정답 유형, 검수 상태를 안정적으로 연결할 수 있다.

한계:

- API 계약과 문제 저장 구조 변경이 필요하다.
- 기존 `prompt` 문자열 기반 화면, 검색, 관리자 입력 흐름과 호환 전략이 필요하다.
- 마이그레이션 또는 compatibility projection이 필요할 수 있다.

### 옵션 C: 별도 51번 detail table

장기적으로 51번 전용 상세 테이블을 두고, 빈칸과 본문 구조를 정규화한다.

예시:

```sql
writing_problem_51_details
- problem_id
- prompt_tokens jsonb
- blank_schema jsonb
```

장점:

- `problems` 공통 테이블을 과하게 확장하지 않아도 된다.
- 51번 유형의 데이터 품질 검증을 별도 규칙으로 둘 수 있다.
- 52~54번 유형별 상세 구조와 같은 방향으로 확장 가능하다.

한계:

- migration, RLS, admin write flow, compatibility read flow가 필요하다.
- MVP 범위에서는 과한 변경일 수 있다.

## 추천 방향

단기적으로는 옵션 A가 가장 현실적이다.

1. 현재 `(ㄱ)`, `(ㄴ)` 마커 기반 렌더링은 유지한다.
2. 새 문제 생성/검수 시 `materials.blanks.blank_1.marker`, `materials.blanks.blank_2.marker`를 선택적으로 받는다.
3. 정규화 로직에서 marker가 있으면 우선 사용하고, 없으면 현재처럼 prompt 정규식으로 fallback한다.
4. 문제 품질 검사에서 `prompt` 안 marker와 `materials.blanks`의 label/marker 불일치를 경고한다.

중장기적으로는 옵션 B 또는 C를 검토한다. 특히 관리자 문제 생성, AI 문제 생성, 문제 검수 흐름이 안정화된 뒤에는 token 구조가 더 안전하다.

## 영향 범위

### 제품/화면 문서

- [51번 단답 작성 wireframe description](../Wireframe/08-D-01-short-answer-writing-51/description.md)
  - 문제 지문 영역과 답안 입력 영역의 관계가 바뀐다.
  - 본문 안 빈칸이 primary selector가 되는 UX를 명시할 수 있다.

- [51번 단답 작성 functional spec](../Wireframe/08-D-01-short-answer-writing-51/functional-spec.md)
  - `prompt`, `materials`, `answer_key`, `answer_json`의 사용 규칙을 보강해야 한다.

- [Wireframe data usage index](../Wireframe/data-usage-index.md)
  - `problems.materials`, `writing_drafts.answer_json`, `writing_submissions.answer_json` 사용 설명에 51번 빈칸별 답안 구조를 반영할 수 있다.

- [Wireframe index](../Wireframe/README.md)
  - D-01 화면의 데이터/상호작용 설명이 변경될 경우 참조 흐름을 확인해야 한다.

### 데이터/서버 코드

- [`src/lib/writing/server.ts`](../../src/lib/writing/server.ts)
  - 현재 `problems`에서 `prompt`, `materials`, `answer_key`, `rubric`을 읽고 정규화한다.
  - API 계약을 바꾸면 이 조회/정규화 경로가 영향을 받는다.

- [`src/lib/writing/problem-normalizer.ts`](../../src/lib/writing/problem-normalizer.ts)
  - 현재 prompt 안 `(ㄱ)`, `(ㄴ)` 마커와 `materials.blanks`를 이용해 `problem.blanks`를 만든다.
  - marker 또는 token 구조를 도입하면 이 파일이 핵심 변경 지점이다.

- [`src/lib/writing/types.ts`](../../src/lib/writing/types.ts)
  - `ShortAnswerQuestion51Json`, draft guard, flatten helper가 51번 답안 저장 구조를 담당한다.
  - 빈칸 id 체계가 바뀌면 타입도 함께 바뀐다.

- [`src/lib/writing/server-actions.ts`](../../src/lib/writing/server-actions.ts)
  - 제출 시 `answer_text`, `answer_json`, `char_count`를 저장한다.
  - `answer_json` 구조를 확장해도 RPC/server action 계약이 유지되는지 확인해야 한다.

### UI 코드

- [`src/components/writing/ShortAnswerWriting51Workspace.tsx`](../../src/components/writing/ShortAnswerWriting51Workspace.tsx)
  - 51번 전용 상태, 저장, 제출, 하단 답안 탭 동기화를 담당한다.

- [`src/components/writing/InteractiveBlankPrompt.tsx`](../../src/components/writing/InteractiveBlankPrompt.tsx)
  - 본문 안 inline blank UI를 렌더링한다.
  - prompt token 구조가 도입되면 이 컴포넌트의 입력 props가 바뀔 가능성이 높다.

- [`src/lib/writing/q51-prompt.ts`](../../src/lib/writing/q51-prompt.ts)
  - 현재 문자열 prompt를 정규식으로 token화한다.
  - API가 token을 직접 내려주면 fallback parser로 축소할 수 있다.

- [`src/styles/global.css`](../../src/styles/global.css)
  - `.writing-inline-blank` 계열 스타일을 포함한다.

### 테스트

- [`tests/lib/writing/types.test.ts`](../../tests/lib/writing/types.test.ts)
  - 51번 답안 JSON guard와 flatten helper 테스트가 영향을 받는다.

- [`tests/lib/writing/q51-prompt.test.ts`](../../tests/lib/writing/q51-prompt.test.ts)
  - prompt tokenizer 규칙이 바뀌면 업데이트해야 한다.

- [`tests/components/writing/InteractiveBlankPrompt.test.tsx`](../../tests/components/writing/InteractiveBlankPrompt.test.tsx)
  - 본문 빈칸 클릭과 활성 상태 테스트가 영향을 받는다.

- [`tests/e2e/flows/core-writing-flow.spec.ts`](../../tests/e2e/flows/core-writing-flow.spec.ts)
  - 51번 작성/제출 플로우에서 본문 빈칸 선택 동작을 검증할 수 있다.

## 결정 전 확인할 질문

1. 51번 문제 데이터 생성 주체는 누구인가?
   - 수동 입력, seed SQL, AI 생성, 관리자 화면 중 어디에서 marker를 보장할 수 있는지 확인해야 한다.

2. 51번 빈칸은 항상 `ㄱ`, `ㄴ` 두 개인가?
   - TOPIK 51번의 현재 제품 범위가 두 칸으로 고정인지, 예외를 허용할지 결정해야 한다.

3. 저장 구조의 canonical key는 무엇으로 할 것인가?
   - `ㄱ`/`ㄴ` label을 key로 쓸지, `blank_1`/`blank_2` 같은 stable id를 쓸지 결정해야 한다.

4. `answer_text` flatten 형식은 계속 유지할 것인가?
   - 현재는 기존 호환을 위해 `ㄱ: ...\nㄴ: ...` 형태로 저장한다.
   - 피드백 생성, 비교 리포트, 라이브러리 저장이 이 형식을 어떻게 소비하는지 확인해야 한다.

5. 문제 검수 단계에서 marker 불일치를 막을 것인가?
   - 예: `materials.blanks.blank_1.label = "ㄱ"`인데 `prompt`에 `(ㄱ)`이 없는 경우 publish를 막을지, 경고만 할지 결정해야 한다.

