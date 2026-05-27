# Phase 8 — 인증 흐름 다이어그램 정정안 초안

Codex Agent 1 검수 결과를 반영한 새 Mermaid 다이어그램.

## 정정 항목

1. **CB_RESULT 성공 도착지 분기** — 단일 `/onboarding/learning-goal` 아님:
   - signup callback: `next=/onboarding/learning-goal` → `/onboarding/learning-goal`
   - magic link (LoginForm): `next=/dashboard` → `/dashboard`
   - 기본 fallback: `sanitizeNext` fallback = `/dashboard`
2. **RESET 흐름 분리** — `/auth/callback?type=recovery` 안 거침. `PasswordResetRequestForm`은 `/password-reset/confirm`으로 직접.
3. **SIGNUP_INLINE 라벨 변경** — "폼 내 inline 에러" 거짓. 실제는 AntD `message.error` toast.
4. **ERR reason 분기 보강** — 실제 11개 reason 중 다이어그램에서 누락된 분기 추가:
   - `over_request_rate_limit`
   - `email_not_confirmed`
   - `access_denied`
   - `flow_state_expired` / `flow_state_not_found` 개별 표기
5. **CLEANUP 표기** — pg_cron 매일 04:00 UTC 자동 실행 주장은 마이그레이션에 없음. "수동 호출 함수, 원격 DB cron 등록 미확인"으로 정정.
6. **otp_expired RESEND_FLOW 60초 cooldown 라벨 삭제** — 코드에 cooldown 없음 (`hasCountdown: false`).
7. **VerifyEmailCard cooldown 표기** — 새로고침 시 초기화되는 client-state 기반. "메모리상 60s" 등 명시.

## 새 Mermaid 다이어그램

```mermaid
flowchart TD
  START(["👤 사용자<br/>처음 방문"]) --> LANDING["🏠 X-01 랜딩<br/>/"]
  LANDING -->|"무료 시작"| SIGNUP["📝 A-01 회원가입<br/>/sign-up"]
  LANDING -->|"로그인"| LOGIN["🔐 A-02 로그인<br/>/login"]

  SIGNUP -->|"이메일+비번 제출"| SIGNUP_OK{"가입 응답?"}
  SIGNUP_OK -->|"YES"| VERIFY["⏳ X-12 대기실<br/>/auth/verify-email<br/>(60s cooldown · 메모리, 새로고침 시 초기화)"]
  SIGNUP_OK -->|"이미 가입된 이메일"| SIGNUP_TOAST["AntD message.error toast<br/>(폼 위 inline 아님)"]

  VERIFY -->|"60s 후<br/>재전송 가능"| VERIFY
  VERIFY -.->|"📧 메일 도착 (or admin/generate_link)"| INBOX(["📧 받은편지함"])

  INBOX -->|"인증 링크 클릭"| CB["🛂 콜백<br/>/auth/callback<br/>token_hash + type=signup<br/>next=/onboarding/learning-goal"]

  LOGIN -->|"매직링크 요청"| OTP["📧 OTP 메일 발송"]
  OTP -.-> INBOX2(["📧 받은편지함"])
  INBOX2 -->|"매직링크 클릭"| CB2["🛂 콜백<br/>token_hash + type=email<br/>next=/dashboard"]

  LOGIN -->|"비번 로그인"| DASH["🏠 B-01 대시보드<br/>/dashboard"]
  LOGIN -->|"비번 잊음"| RESET["🔑 X-06 재설정<br/>/password-reset"]
  RESET -->|"재설정 메일 클릭"| RESET_CONFIRM["🔐 X-07 새 비번 설정<br/>/password-reset/confirm<br/>(callback 안 거침 — 직접 진입)"]
  RESET_CONFIRM --> LOGIN

  CB --> CB_RESULT{"verifyOtp 결과"}
  CB2 --> CB_RESULT
  CB_RESULT -->|"✅ signup 성공"| GOAL["🎯 A-03 학습목표<br/>/onboarding/learning-goal"]
  CB_RESULT -->|"✅ magic link 성공"| DASH
  CB_RESULT -->|"❌ 실패"| ERR["🪧 X-11 에러 안내<br/>/auth/error?reason=..."]
  GOAL --> DASH

  ERR -->|"otp_expired"| RESEND_FLOW["이메일 입력<br/>→ 재전송<br/>(cooldown 없음)"]
  ERR -->|"user_not_found<br/>(cleanup된 계정)"| SIGNUP
  ERR -->|"over_email_send_rate_limit"| COUNTDOWN["⏰ Retry-After<br/>카운트다운 disabled"]
  ERR -->|"over_request_rate_limit"| COUNTDOWN
  ERR -->|"flow_state_expired<br/>flow_state_not_found<br/>bad_code_verifier"| LOGIN
  ERR -->|"email_not_confirmed"| RESEND_FLOW
  ERR -->|"access_denied"| SIGNUP
  ERR -->|"unknown / signup_disabled"| LANDING

  RESEND_FLOW -.-> INBOX

  CLEANUP{{"🤖 cleanup_unconfirmed_users 함수<br/>retention_days(>=1) · dry_run · max_batch<br/>⚠ pg_cron 자동 스케줄은 마이그레이션 미포함<br/>(원격 DB cron 등록 여부 별도 확인)"}}
  CLEANUP -.->|"호출 시 30일+ 미인증 삭제"| GONE([🗑️ 계정 삭제])
  GONE -.->|"옛 링크 클릭 시"| CB_RESULT

  classDef startNode fill:#dbeafe,stroke:#2563eb,stroke-width:2px
  classDef publicNode fill:#fff,stroke:#6a7787,stroke-width:1px
  classDef authNode fill:#fef3c7,stroke:#d97706,stroke-width:2px
  classDef errorNode fill:#fde8e8,stroke:#dc2626,stroke-width:2px
  classDef successNode fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  classDef systemNode fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,stroke-dasharray: 5 5
  classDef mailNode fill:#f3f4f6,stroke:#6b7280,stroke-width:1px
  classDef toastNode fill:#fee2e2,stroke:#dc2626,stroke-width:1px

  class START,LANDING,SIGNUP,LOGIN,RESET,RESET_CONFIRM publicNode
  class VERIFY,CB,CB2 authNode
  class ERR,RESEND_FLOW,COUNTDOWN errorNode
  class GOAL,DASH successNode
  class CLEANUP,GONE systemNode
  class INBOX,INBOX2 mailNode
  class SIGNUP_TOAST toastNode
```

## 핵심 차이점 비교

| 항목 | 이전 다이어그램 | 정정안 |
|---|---|---|
| 성공 도착지 | 단일 `/onboarding/learning-goal` | signup → onboarding, magic link → dashboard |
| 비번 재설정 | RESET → CB3 → CB_RESULT | RESET → /password-reset/confirm (직접) |
| 가입 실패 | "폼 내 inline 에러" | AntD `message.error` toast |
| reason 분기 | 5종 (otp_expired, user_not_found, rate_limit, flow_state_*, unknown/signup_disabled) | 8종 추가: over_request_rate_limit, email_not_confirmed, access_denied 분리 |
| RESEND_FLOW | "60s cooldown" 표기 | "cooldown 없음" 표기 |
| VERIFY 대기실 | "60초 cooldown" | "60s · 메모리, 새로고침 시 초기화" |
| CLEANUP | "매일 새벽 4시 UTC pg_cron" | "함수만 존재, cron 등록 미확인" |
