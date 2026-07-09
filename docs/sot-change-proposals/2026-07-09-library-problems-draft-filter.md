# F-01 `/library/problems` 임시 저장 필터 보강 제안

## 제안

`/library/problems` 우측 필터 패널의 항목 유형에 `임시 저장`을 추가한다.

- `저장 답안`: 제출 후 `library_items.item_type = 'submission'`으로 보관된 답안
- `북마크한 문제`: 사용자가 북마크한 `library_items.item_type = 'problem'` 문제
- `임시 저장`: 제출 전 작성 중인 `writing_drafts` 답안 초안

필터 그룹은 다음처럼 분리한다.

- 항목 유형: 저장 답안, 북마크한 문제, 임시 저장
- 답안 분석 상태: 분석 대기, 분석 중, 분석 완료, 분석 실패
- 문제 제공 상태: 제공 종료, 이용 불가

## 이유

기존 필터 패널은 `저장 문제` 아래에 `제공 종료`, `이용 불가`가 들여쓰기되어 있어 `저장 문제 = 임시 저장`처럼 오해하기 쉽다. 쓰기 화면의 `임시 저장`은 `writing_drafts`이며, 문제 북마크인 `저장 문제`와 데이터 의미가 다르다.

## 구현 기준

- DB migration은 하지 않는다.
- 기존 `library_items`와 `writing_drafts`만 사용한다.
- 빈 draft와 `autosave_status = 'superseded'` draft는 `/library/problems` 임시 저장 목록에 노출하지 않는다.
- 임시 저장 row는 이어쓰기 CTA로 원 문제 풀이 화면에 진입한다.

## 영향

- 영향 화면: `/library/problems`
- 영향 데이터: `writing_drafts`, `library_items`
- 갱신 필요 SOT 후보: `docs/Wireframe/18-F-01-my-library/functional-spec.md`
