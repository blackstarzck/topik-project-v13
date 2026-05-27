# 인증 에러

- Source: 33 X-11 인증 에러
- Code: X-11
- Wireframe: (해당 없음 — Codex 3-round 합의 spec 기반, wireframe.png 추후 추가)

## Wireframe Number Map

| No. | Area | Description |
| --- | --- | --- |
| 1 | 에러 카드 | 인증 콜백 실패 사유를 명확히 보여주는 중앙 카드. |
| 2 | 사유별 메시지 | 11개 reason 매핑 표에서 받은 한국어 메시지를 따뜻하고 평이한 톤으로 표시. |
| 3 | 주요 CTA | 사유별 우선 행동 버튼 (재전송 / 다시 가입 / 다시 시도 / 홈). |
| 4 | Retry-After 카운트다운 | rate-limit 계열 사유일 때 `retry_after_seconds`를 받아 분 단위 카운트다운. |
| 5 | 이메일 prefill 인풋 | `otp_expired`, `email_not_confirmed` 사유일 때 가시·편집 가능한 이메일 입력 필드. |
| 6 | 보조 링크 | 로그인 / 가입 / 홈 — 사용자가 막다른 길에 갇히지 않도록 항상 최소 1개 escape 제공. |

## Detailed Description

### 33 X-11 인증 에러

1

■ 에러 카드

▣ 설명

• 인증 콜백 실패 시 사유를 한 화면에 명확히 보여주는 중앙 카드.

▣ 제약 조건: 카드 폭 360-520px, 모바일/데스크톱 동일 레이아웃, 사유별 색상 일관성.

▣ 예외: `reason` query 미지정 시 `unknown`으로 fallback.

2

■ 사유별 메시지

▣ 설명

• `reason` query를 받아 11개 매핑 표에서 한국어 메시지를 표시. 톤은 따뜻하고 평이한 일반 사용자용.

▣ 제약 조건: 메시지 80자/2줄, raw Supabase `error_description`은 절대 노출하지 않음 (서버 로그에만).

▣ 예외: 매핑에 없는 reason은 `unknown` 메시지로 fallback.

3

■ 주요 CTA

▣ 설명

• 사유별 우선 행동. `otp_expired`/`email_not_confirmed` → 인증 메일 재전송. `user_not_found` → 다시 가입하기. `flow_state_*` → 다시 시도. `over_*_rate_limit` → 카운트다운 후 자동 활성.

▣ 제약 조건: 한 화면당 primary CTA 1개 + secondary 1개 이하. 중복 제출 차단.

▣ 예외: rate-limit 카운트다운 중에는 CTA 비활성.

4

■ Retry-After 카운트다운

▣ 설명

• `over_email_send_rate_limit`/`over_request_rate_limit` 사유 + `retry_after_seconds` query가 있으면 분/초 단위로 카운트다운 표시 후 CTA 자동 활성.

▣ 제약 조건: `retry_after_seconds` 범위 1~86400. 값 없으면 60초 fallback. Supabase same-user OTP 한도 정렬.

▣ 예외: 음수/비숫자 값은 fallback 60초.

5

■ 이메일 prefill 인풋

▣ 설명

• `?email=` query를 받아 가시·편집 가능한 input의 초기값으로 사용. 사용자가 한 번 더 확인 후 제출.

▣ 제약 조건: untrusted — 자동 resend 절대 X. URL 변조 방지 차원에서 항상 사용자 명시 제출.

▣ 예외: 잘못된 이메일 형식은 클라이언트 검증 + 서버 검증.

6

■ 보조 링크

▣ 설명

• 로그인 / 가입 / 홈 / 도움말 — 사용자가 에러 상태에 갇히지 않도록 항상 최소 1개 escape route 제공.

▣ 제약 조건: 항상 노출, 키보드 접근성 확보.

▣ 예외: 없음.

화면 목적 / 분기 / 피드백 / 예외 상황

목적

인증 콜백 실패를 사용자에게 친절히 안내하고 다음 행동으로 유도한다.

분기

`reason` query 11개 (otp_expired / flow_state_expired / flow_state_not_found / bad_code_verifier / user_not_found / over_email_send_rate_limit / over_request_rate_limit / email_not_confirmed / signup_disabled / access_denied / unknown).

피드백

사유별 메시지 + 주요 CTA + Retry-After 카운트다운 + (필요 시) 이메일 입력.

예외

매핑되지 않은 reason은 `unknown`. raw `error_description`은 서버 로그에만, URL/UI 노출 금지.
