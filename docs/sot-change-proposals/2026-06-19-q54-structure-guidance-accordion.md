# Q54 구조 안내 아코디언 SOT 갱신 제안

## 대상 문서

- `docs/Wireframe/11-D-04-essay-writing-54/functional-spec.md`
- `docs/Wireframe/11-D-04-essay-writing-54/screen-data-summary.md`
- 필요 시 `docs/Wireframe/data-usage-index.md`

## 수정 이유

54번 작성 화면의 오른쪽 영역은 기존 6개 항목 tri-state 작성 체크리스트에서, 문제 DB metadata의 `required_structure`, `required_reason_count`, `reasoning_pattern`, `scoring_focus`, `prohibited_elements`, `model_outline`를 보여 주는 작성 안내 아코디언으로 변경되었다.

현재 SOT에는 `EssayChecklist`와 "체크리스트를 작성한다"는 구현 근거가 남아 있어, 실제 구현과 문서가 달라진다.

## 수정 방향

- 화면 내부 동작을 "사용자가 체크리스트 상태를 입력한다"가 아니라 "문제 metadata 기반 구조/점검 안내를 확인한다"로 갱신한다.
- DB 데이터 사용은 신규 테이블이 아니라 기존 `problems.materials`/`rubric` JSONB 읽기 범위 안에서 유지한다.
- 코드 구현 근거에서 `EssayChecklist`를 54번 현재 화면 근거에서 제거하고 `EssayStructureGuide`, `WritingGuideAccordion`, `problem-normalizer`의 `essayGuidance` 정규화를 추가한다.
- 기존 `54.v1` draft JSON의 `checklist` 필드는 후방 호환을 위해 유지되지만 화면 입력 UI로는 노출하지 않는다고 명시한다.

## 결정 근거

- `docs/metadata-tag-schema-rule.md` 7.5는 Q54 전용 metadata로 `required_structure`, `required_reason_count`, `reasoning_pattern`, `scoring_focus`, `model_outline`를 정의한다.
- `docs/swagger-api/schemas/writing.md`의 `TopikWriting54Response`에도 동일 필드가 response field로 존재한다.
- `/writing/essay-writing-54`는 53번과 같은 공통 `WritingGuideAccordion` 시각 패턴을 유지하되, 오른쪽 패널에 문제별 구조 안내를 보여 주는 것이 사용자 요청과 더 일치한다.

## 검증 기준

- 54번 화면 오른쪽 패널에 `글의 구조 제안`, `작성 체크 포인트` 아코디언이 보인다.
- 기존 `아직`, `부분`, `완료` tri-state 상태 선택 UI는 54번 오른쪽 패널에 보이지 않는다.
- metadata가 없는 기존 fixture도 fallback 구조 안내를 렌더링한다.
- `54.v1` draft JSON read/write 호환은 유지한다.
- desktop/mobile e2e와 제출 후 장문 피드백 화면 도착 e2e가 통과한다.
