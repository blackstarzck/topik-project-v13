# 2026-06-18 51~54 쓰기 화면 참고 자료 제거 제안

> ## ⛔ 결정 갱신 (2026-06-19): 이 제안은 철회됨 (WITHDRAWN)
>
> 사용자 결정(2026-06-19)으로 "51~54 쓰기 화면에서 참고 자료를 없앤다"는 지시를 **철회한다.** 아래 원문은 이력 보존용이며 더 이상 적용하지 않는다.
>
> **철회 이유:** 53번(D-03)은 그래프/표 자료(`Writing53MaterialCards`의 chart 카드)를 보고 그 내용을 글로 설명하는 문제다. 이 자료는 보조 "참고 자료"가 아니라 53번이 묘사해야 할 **핵심 자극물**이라, 제거하면 53번 문제 자체가 성립하지 않는다. 또한 53번 active SOT(`docs/Wireframe/10-D-03-long-form-writing-53/description.md:12,37,39`)는 "그래프, 조건, 참고 자료"와 "자료 카드 3개 이하"를 유지하도록 요구해, 이 제안의 일괄 제거 지시와 충돌한다.
>
> **확정 사항:**
> - 53번 작성 화면의 자료/참고 카드(`Writing53MaterialCards`, `problem-normalizer`의 `materialCards`/reference 카드)는 **현행 유지**한다. 관련 코드는 변경하지 않는다.
> - 51·54번은 별도의 참고 이미지(`problem_assets`) 영역을 렌더링하지 않으며, `problem_assets` 조회도 하지 않는다. 이는 이 제안과 무관하게 현재 상태로 유지한다(추가 작업 불필요).
> - 따라서 51~54 어느 화면에서도 이 제안에 따른 코드 변경/제거는 수행하지 않는다.
>
> **검토한 대안:** ⓐ 53번에서 보조 "reference(context_notes)" 카드만 제거하고 그래프 카드는 유지 → 사용자가 "참고 자료를 없애라 부분 제거"로 지시해 채택하지 않음(전체 철회). ⓑ 제안 전체 철회(채택).

## 배경

51~54 쓰기 풀이 화면에서 문제 지문 아래의 `참고 자료` 영역을 제거하기로 했다.
이에 따라 구현에서는 참고 자료 카드 렌더링, `problem_assets` 조회, 참고 자료 정규화 필드 전달을 제거한다.

## 변경이 필요한 SOT

- `docs/Wireframe/08-D-01-short-answer-writing-51/description.md`
  - `Wireframe Number Map`의 `3 | 참고 이미지` 항목 제거 또는 비활성 처리
  - `Detailed Description`의 `■ 참고 이미지` 섹션 제거 또는 보류 상태로 변경
- `docs/Wireframe/08-D-01-short-answer-writing-51/screen-data-summary.md`
  - `problem_assets`와 `storage:problem-assets`를 51번 풀이 화면 표시 데이터에서 제거
  - “문항 본문/자료/조건” 설명에서 첨부 자료 제공 문구 제거
- `docs/Wireframe/08-D-01-short-answer-writing-51/functional-spec.md`
  - `problem_assets` read 의존성 제거
  - `renderWritingQuestionPage`, `loadProblemExtras` 관련 설명 갱신

## 구현 반영 방향

- 51~54 workspace에서 `<ReferenceMaterials />`를 렌더링하지 않는다.
- 쓰기 route 서버 컴포넌트에서 `problem_assets`를 조회하지 않는다.
- 문제 `materials`에서 참고 자료 카드용 `referenceMaterials`/`materialCards`를 만들지 않는다.
- 기존 문제 지문, 빈칸 입력, 조건 패널, 저장, 자동저장, 제출, 피드백 이동은 유지한다.

## 결정 근거

사용자 요청에 따라 실제 풀이 화면에서 참고 자료 컨텐츠를 제거한다. 현재 활성 SOT에는 참고 이미지/자료 영역이 남아 있으므로, 문서 갱신 없이는 구현과 SOT가 불일치한다.

## 검증 기준

- 51~54 풀이 화면에 `참고 자료` 카드가 표시되지 않는다.
- `problem_assets` 조회가 51~54 풀이 route에서 발생하지 않는다.
- `writing.reference` 번역 키가 더 이상 사용되지 않는다.
- `pnpm typecheck`, `pnpm lint`, 51~54 desktop/mobile 렌더 검증을 통과한다.
