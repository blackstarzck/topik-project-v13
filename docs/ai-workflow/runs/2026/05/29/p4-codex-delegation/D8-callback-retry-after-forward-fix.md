# Codex Verdict — D8 (X-11)

- Slug: callback-retry-after-forward-fix
- Generated: 2026-05-29T02:42:45.209Z
- Elapsed: 85.8s
- Codex exit: 0 (timedOut=false)

## Question

IA X-11 (Auth error, /auth/error) — critical eng gap. src/app/auth/callback/route.ts 의 buildErrorUrl 이 Supabase response Retry-After 헤더를 forward하지 않음. 즉 over_email_send_rate_limit / over_request_rate_limit 발생 시 X-11이 받는 retry_after_seconds query 는 항상 sanitizeRetryAfterSeconds 의 60s default. 실제 server 측 Retry-After 가 5분이거나 60분이어도 사용자에게는 항상 60초만 표시. (Codex C-ε note 에 명시된 gap)

DECISION: (A) callback route를 수정하여 Supabase response headers 의 Retry-After 를 추출 + buildErrorUrl 의 retry_after_seconds query 로 forward — 즉시 fix, 1 PR scope, OR (B) X-11 UI를 '재시도 가능 시점은 약 60초 후' 로 일반화 — backend fix 회피, OR (C) Retry-After forward 를 별도 Phase로 이연 — 현 60s default 가 80% case 에서 acceptable. 보안·정확성 + 사용자 신뢰 우선순위?

## Codex stdout (verbatim)

```
����: PID 53852�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 52976�� ���μ���(PID 56956�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 56956�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 52312�� ���μ���(PID 47792�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 47792�� ���μ���(PID 27684�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 27684�� ���μ���(PID 43296�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 43296�� ���μ���(PID 58676�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 58676�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 41200�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 2064�� ���μ���(PID 46868�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 46868�� ���μ���(PID 46220�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 46220�� ���μ���(PID 41736�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 41736�� ���μ���(PID 4640�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 4640�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 2900�� ���μ���(PID 39052�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 39052�� ���μ���(PID 38516�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 38516�� ���μ���(PID 42908�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 42908�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 44772�� ���μ���(PID 8900�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 8900�� ���μ���(PID 55416�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 55416�� ���μ���(PID 8080�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 8080�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 47528�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 49016�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 27572�� ���μ���(PID 40096�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 40096�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 57168�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 41788�� ���μ���(PID 22056�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
=== VERDICT ===
CHOOSE-A

=== REASONING ===
`X-11` 명세는 rate-limit 에러에서 `retry_after_seconds`를 받아 카운트다운을 보여주는 구조다. 현재 callback route는 `buildErrorUrl`에 전달할 자리가 이미 있지만 실패 분기에서 항상 `null`을 넘겨 실제 대기 시간을 버린다. 보안 문제라기보다 정확성·신뢰 문제이고, 범위도 callback route + 테스트 1 PR로 충분하다.

=== CITATIONS ===
docs/IA/33-X-11-auth-error/description.md:64
docs/IA/33-X-11-auth-error/description.md:66
src/app/auth/callback/route.ts:43
src/app/auth/callback/route.ts:51
src/app/auth/callback/route.ts:100
src/app/auth/callback/route.ts:119
docs/development/auth-overview.md:130
src/lib/auth/error-mapping.ts:175

=== FOLLOW-UP ===
callback route에서 Supabase `Retry-After` 헤더를 읽고 `sanitizeRetryAfterSeconds` 통과 값만 `retry_after_seconds`로 넘기세요.
```

## Codex stderr (tail)

```
src/app/auth/callback/route.ts:119
docs/development/auth-overview.md:130
src/lib/auth/error-mapping.ts:175

=== FOLLOW-UP ===
callback route에서 Supabase `Retry-After` 헤더를 읽고 `sanitizeRetryAfterSeconds` 통과 값만 `retry_after_seconds`로 넘기세요.
hook: Stop
hook: Stop Completed
tokens used
79,458
```