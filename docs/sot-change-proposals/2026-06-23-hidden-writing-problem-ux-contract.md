# 2026-06-23 숨김/비활성 쓰기 문제 사용자 UX 계약 SOT 변경 제안

## 목적

운영자가 쓰기 문제를 숨김, 비공개, 비활성, 만료 상태로 바꿨을 때 학습자에게 이미 보이던 문제, 작성 중 답안, 내 서재 항목, 기존 제출 기록이 어떻게 보여야 하는지 정한다.

## 한 줄 요약

새 풀이와 제출은 막고, 사용자가 이미 만든 학습 기록은 보존하되, 문제 본문을 계속 노출하면 안 되는 상태에서는 placeholder와 제공 종료 안내만 보여준다.

## 상태 구분

| 상태 | 기준 | 사용자-facing 의미 |
| --- | --- | --- |
| 사용 가능 | `publish_status='published'`, `visibility='public'`, `lifecycle_status='active'` | 새 풀이, 다시 풀기, 제출 가능 |
| Soft unavailable | `publish_status='published'`, `visibility='public'`, `lifecycle_status in ('inactive','expired')` | 문제 존재와 제목은 표시 가능하지만 새 풀이/제출 불가 |
| Hard unavailable | `publish_status!='published'` 또는 `visibility!='public'` 또는 row 없음 | 문제 본문/제목을 새로 노출하지 않고 저장 ledger만 placeholder로 유지 |

## 사용자별 동작

| 사용자 상태 | 권장 동작 |
| --- | --- |
| 새 탐색/추천 | 사용 가능 문제만 추천 후보로 제공한다. |
| 문제 목록 | soft unavailable row는 비활성화하고 사유를 표시한다. hard unavailable row는 목록에 노출하지 않는다. |
| 작성 중 | 제출 직전 서버가 상태를 다시 확인한다. 사용 불가 상태면 제출을 저장하지 않고 답안 보존 안내를 표시한다. |
| 내 서재 문제 탭 | 저장 항목은 유지한다. soft unavailable은 제목 + 제공 종료 배지, hard unavailable은 placeholder + 제공 종료 배지를 표시한다. 다시 풀기는 비활성화한다. |
| 기존 제출/피드백/리포트 | 과거 학습 기록으로 보존한다. 단, 다시 풀기 CTA는 사용 가능 문제일 때만 제공한다. |

## 현재 구현과 맞춰야 할 지점

- DB 제출 guard는 이미 숨김/비공개/비활성 문제 제출을 거절한다.
- 내 서재 문제 탭은 RLS로 문제 row가 사라지면 ledger 항목도 화면에서 빠질 수 있어 보완이 필요하다.
- 일반 제출 실패 모달은 현재 다시 시도를 유도하므로, `problem_not_submittable`은 별도 UX로 분리해야 한다.

## 대상 문서 / 수정 이유 / 수정 방향

| 대상 문서 | 수정 이유 | 수정 방향 |
| --- | --- | --- |
| `docs/Wireframe/06-C-02-problem-list/functional-spec.md` | 비활성 문제 행 동작을 명확히 해야 한다. | disabled row, 사유 표시, 클릭/키보드 진입 차단을 수용 기준에 추가한다. |
| `docs/Wireframe/18-F-01-my-library/functional-spec.md` | 저장 문제가 숨김 처리될 때 ledger 보존 방식이 빠져 있다. | 제공 종료 배지, placeholder, 다시 풀기 비활성화를 상태/오류와 수용 기준에 추가한다. |
| `docs/Wireframe/12-D-M1-submission-confirmation-modal/functional-spec.md` | 제출 직전 상태 변경 실패가 일반 실패와 구분되어야 한다. | 문제 사용 불가 실패는 재시도 대신 답안 보존 안내와 문제 목록 이동을 제공한다고 추가한다. |
| `docs/Wireframe/data-usage-index.md` | 새 RPC와 availability 필드가 역색인에 필요하다. | RPC와 반환 필드를 추가한다. |

## 검증 기준

- `/practice/problems`에서 soft unavailable row는 비활성화되고 사유가 보인다.
- `/library?tab=problems`에서 soft/hard unavailable 저장 항목이 사라지지 않는다.
- 작성 중 상태 변경 후 제출하면 답안이 사라지지 않고 deterministic 안내가 나온다.
- 기존 제출/피드백/리포트는 유지된다.
