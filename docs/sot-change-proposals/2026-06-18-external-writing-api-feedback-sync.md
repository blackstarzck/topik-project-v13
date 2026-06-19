# External Writing API Feedback Sync Scope Proposal

## 제안 요약

쓰기 제출 후 외부 Writing API에 답안을 제출하고, 반환된 `submission_id`로 분석 상태와 피드백을 조회해 Supabase에 저장하는 범위를 연다.

## 제안 이유

현재 feedback 화면은 `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`에 저장된 데이터를 기준으로 표시된다. 외부 API 호출이 비활성화되거나 응답 매핑이 비어 있으면 사용자는 제출 후 점수와 첨삭을 볼 수 없다.

## 기존 SOT와의 충돌

`docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`는 실제 AI 첨삭, 실제 AI 분석 파이프라인, AI 사용량 한도를 보류로 둔다. 이 제안은 그중 실제 외부 Writing API 분석 파이프라인만 명시적으로 여는 변경이다.

## 범위에 포함

- `TALKPIK_API_BASE_URL` 서버 전용 환경변수를 사용한 외부 API 호출
- `POST /api/writing/submit` 제출 후 외부 `submission_id` 수신
- `GET /api/evaluation/{submission_id}` 상태 조회
- `GET /api/evaluation/{submission_id}/feedback` 결과 조회
- Supabase에 제출, 총평, 영역별 점수, 문장 첨삭 저장
- 실패, 지연, 부분 결과, 결과 없음 상태 표시
- 서버 전용 writer 경로로만 피드백 저장

## 범위에서 제외

- 결제/구독 provider 연동
- 실제 AI 사용량 한도 차감 UI
- 외부 알림/이메일/메신저 연동
- 법무 검토가 필요한 PDF 장기 보관 정책 변경
- admin 기능 추가 또는 확장

## 수용 기준

- 브라우저에서 직접 Supabase RPC를 호출해 점수나 피드백을 위조할 수 없다.
- 외부 API가 정상 완료되면 feedback 화면에 총점, 총평, 영역별 점수, 문장 첨삭이 표시된다.
- 외부 API가 실패하거나 지연되면 무한 로딩 대신 실패/대기/재시도 상태가 표시된다.
- 외부 API 원본 응답은 `writing_feedback.raw_ai_result`에 보존된다.
- `NEXT_PUBLIC_`가 붙은 환경변수로 외부 API base URL이나 secret을 노출하지 않는다.
- desktop/mobile UI 검증과 관련 unit/integration test가 통과한다.

## 검토한 대안

- 외부 API 연동을 계속 보류하고 준비중 안내만 표시: 기존 SOT와 가장 잘 맞지만, 사용자가 제출 후 feedback 데이터를 받아야 한다는 현재 요구를 만족하지 못한다.
- mock feedback을 계속 저장: 사용자가 실제 AI 결과로 오해할 수 있어 기존 scope decision의 안내 원칙과 맞지 않는다.
- 모든 외부 응답 필드를 정규화: 초기 범위가 커지므로 화면과 복습에 필요한 필드만 정규화하고 나머지는 `raw_ai_result`에 보존한다.
