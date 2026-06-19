# 다시 풀기 모달 문제 만료 규칙 논의

## 배경

C-03 다시 풀기 모달은 Wireframe description에 "문제 만료 시 시작 대신 만료 안내와 닫기만 제공" 예외가 적혀 있다. 이 예외 UI 자체는 active C-03 요구사항이다. 그러나 현재 제품에서는 어떤 문제를 언제 만료로 볼지에 대한 판정 규칙을 아직 세우지 않았다.

현재 구현은 `RetryModal`에 `expired` prop이 있지만, `/practice/problems` host에서 이 값을 넘기지 않는다. 즉 C-03의 만료 예외를 렌더링할 수 있는 자리는 있고, 남은 논의 대상은 어떤 데이터와 정책으로 `expired=true`를 주입할지다.

## 현재 상태

- C-03 모달은 `expired=true`가 주입되지 않은 문제에서는 다시 풀기 방식을 선택해 작성 화면으로 이동한다.
- `expired` 기본값은 `false`다.
- 현재 `problems` 조회 경로에서 만료 여부를 결정하는 명시적 필드는 사용하지 않는다.
- 만료 판정 규칙을 확정하지 않았으므로 `/practice/problems` host는 임의로 만료 상태를 추론하지 않는다.

## 논의할 정책 질문

1. 어떤 대상을 만료시킬 것인가?
   - 개별 문제
   - 추천 세션 또는 추천 결과
   - 시험/모의고사 세트
   - 외부 이벤트성 콘텐츠

2. 만료 기준 시각은 어디에 둘 것인가?
   - `problems` 테이블의 문제 lifecycle
   - 추천 run/item의 유효 기간
   - 사용자별 assignment 또는 attempt 기준
   - 운영 설정값

3. 만료 후 사용자가 할 수 있는 행동은 무엇인가?
   - 완전 차단 후 닫기만 제공
   - 기존 제출/피드백 보기만 허용
   - 새 답안 작성은 차단하되 복습은 허용
   - 만료 사유와 대체 문제 추천 제공

4. 기존 draft가 있는 문제는 어떻게 처리할 것인가?
   - 만료 시 draft 이어쓰기를 막을지
   - grace period를 둘지
   - 이미 작성 중인 사용자는 완료까지 허용할지

5. 만료와 문제 lifecycle은 같은 개념인가?
   - `lifecycle_status`가 retired/archived인 문제와 시간 기반 만료를 같은 UX로 볼지 결정해야 한다.

## 데이터 계약 후보

### 옵션 A: `problems`에 만료 필드 추가

예시:

```sql
problems.expires_at timestamptz null
problems.expiration_reason text null
```

장점:

- 문제 자체의 유효 기간을 명확히 표현할 수 있다.
- 문제 목록, 작성 화면, 다시 풀기 모달이 같은 기준을 사용할 수 있다.

한계:

- 추천 세션처럼 사용자별/컨텍스트별 만료에는 맞지 않을 수 있다.
- 기존 lifecycle 상태와 의미가 겹칠 수 있다.

### 옵션 B: 추천/할당 컨텍스트에 만료 필드 유지

예시:

```sql
recommendation_runs.expires_at
user_problem_assignments.expires_at
```

장점:

- 같은 문제라도 추천 경로나 과제 경로에 따라 다르게 만료시킬 수 있다.
- 운영 이벤트나 개인화 추천에 맞다.

한계:

- 문제 목록에서 어떤 컨텍스트의 만료를 우선할지 정해야 한다.
- 사용자가 직접 검색해서 들어온 문제에는 별도 기준이 필요하다.

### 옵션 C: lifecycle만 사용하고 시간 기반 만료는 두지 않음

장점:

- 정책이 단순하다.
- `lifecycle_status`와 공개/비공개 관리만으로도 MVP 운영이 가능하다.

한계:

- 기간 한정 추천, 이벤트 문제, 시험 세트 만료 같은 UX를 표현하기 어렵다.

## 추천 방향

현재는 만료 판정 규칙을 새로 만들지 않는다. 먼저 만료 대상과 사용자 행동을 확정한 뒤 데이터 계약을 정한다. C-03 모달의 만료 예외 UI는 active description 요구사항으로 유지한다.

단기적으로는 다음 원칙을 유지한다.

1. `expired`는 기본 `false`로 둔다.
2. host 화면은 만료 여부를 임의 추론하지 않는다.
3. 만료 정책이 확정되기 전까지는 host 화면에서 `expired=true`를 임의 추론해 넘기지 않는다.
4. 정책 확정 시 C-03 description, functional spec, data usage index, `RetryModal` host 연결을 함께 갱신한다.

## 영향 범위

### 제품/화면 문서

- [C-03 다시 풀기 모달 description](../Wireframe/07-C-03-retry-modal/description.md)
  - 만료 예외 문구를 실제 정책에 맞게 구체화해야 한다.

- [C-03 다시 풀기 모달 functional spec](../Wireframe/07-C-03-retry-modal/functional-spec.md)
  - 만료 상태, 권한, 이탈 경로, 오류/안내 문구를 추가해야 한다.

- [Wireframe data usage index](../Wireframe/data-usage-index.md)
  - 만료 판단에 쓰는 테이블/필드를 역색인해야 한다.

### 데이터/서버 코드

- `src/components/practice/problem-list-data.ts`
  - 문제 목록 row에 만료 상태를 포함할지 결정해야 한다.

- `src/components/practice/ProblemListView.tsx`
  - `RetryModal`에 `expired` 값을 넘기는 host가 될 가능성이 높다.

- `src/components/practice/RetryModal.tsx`
  - 현재 만료 UI seam은 있지만 정책 확정 전에는 기본 비활성 상태다.

- Supabase migration
  - `problems`, 추천 run/item, 사용자 assignment 중 어디에 만료 필드를 둘지 결정한 뒤 추가한다.

### 테스트

- `tests/components/practice/RetryModal.test.tsx`
  - 만료 상태에서 모드 선택과 시작 CTA가 숨겨지고 닫기만 보이는지 검증할 수 있다.

- `tests/e2e/screens` 또는 `tests/e2e/flows`
  - 문제 목록에서 만료 문제를 열었을 때 작성 화면으로 이동하지 않는지 검증할 수 있다.

## 결정 전 확인할 질문

1. 만료는 문제 자체의 상태인가, 추천/과제 컨텍스트의 상태인가?
2. 만료된 문제의 기존 제출 결과와 피드백은 계속 볼 수 있는가?
3. 작성 중 draft가 있으면 만료 후에도 이어쓸 수 있는가?
4. 만료 사유를 사용자에게 보여줄 것인가?
5. 만료 문제를 목록에서 숨길 것인가, 비활성 상태로 보여줄 것인가?
