# 2026-06-19 제출 확인 모달(D-M1) 현행 레이아웃 유지 결정

## 결론

현재 버전에서는 제출 확인 모달(D-M1)의 **현행 단순 레이아웃을 그대로 유지**한다. 와이어프레임 SOT가 요구하는 답안 요약 / AI 분석 안내 / 동일 폭 CTA는 **추후 버전에서 보강 예정**으로 보류한다. 사용자 결정(2026-06-19).

## 현재 구현

- `src/components/writing/SubmissionConfirmModal.tsx`는 제목, 부제("작성한 답안을 제출하면 수정할 수 없습니다"), 글자 수 부족 경고, 제출 오류 경고, 취소/제출 CTA만 렌더한다.
- 취소:제출 버튼 폭은 `grid-cols-[2fr_3fr]`로 제출 버튼이 더 넓다.
- pending 동안 모달이 열린 채 loading 표시 + 중복 클릭/닫기/취소 차단은 정상 동작한다(이번 결정과 무관하게 유지).

## 기존 SOT와의 차이 (보류 항목)

`docs/Wireframe/12-D-M1-submission-confirmation-modal/description.md`가 요구하나 현재 미구현이며, 이번 결정으로 **현재 버전에서는 보류**하는 항목:

| 항목 | SOT 근거 | 상태 |
| --- | --- | --- |
| 제출 요약(문제 유형/답안 길이/저장 시각/제출 대상) | description.md:12,36-40 | 보류(미구현) |
| AI 분석 시작·대기 안내 문구 | description.md:13,48 (`submitNotice` 키는 `messages/ko.json:1509`에 존재하나 미사용) | 보류(미구현) |
| 취소·제출 CTA 동일 폭 | description.md:62 | 보류(현재 2:3 비대칭) |

## 결정 근거 / 향후 계획

- 결정 근거: 현재 버전 범위에서는 단순 확인 모달로 충분하다고 판단. 요약/안내/CTA 폭 정비는 후속 디자인 작업으로 미룬다.
- 향후 계획: 미래 버전에서 위 보류 항목을 보강할 때 본 결정을 갱신하고, D-M1 SOT(description.md / functional-spec.md / screen-data-summary.md)와 미사용 메시지 키(`questionTypeLabel`, `submitNotice` 등)를 함께 반영한다.
- 관련: 현재 `tests/components/writing/SubmissionConfirmModal.surface.test.tsx`가 요약/체크리스트/동의 생략과 비대칭 CTA를 단언한다. 본 결정으로 그 단언의 SOT 근거가 마련된다. 향후 보강 시 테스트도 함께 갱신한다.

## 검증 기준 (현행 유지 확인)

- 제출 확인 모달이 현행대로 제목/부제/경고/CTA를 렌더하고, pending 중 중복 제출 차단이 동작한다.
- 본 결정은 레이아웃 보류만 다루며, 제출 가드/page-flow 전환 등 다른 동작에는 영향을 주지 않는다.
