# Codex Verdict — D10 (X-12)

- Slug: smtp-rate-limit-copy
- Generated: 2026-05-29T02:44:30.694Z
- Elapsed: 45.1s
- Codex exit: 0 (timedOut=false)

## Question

IA X-12 (Verify-email, /auth/verify-email) — auth-overview.md §6.3 'Built-in SMTP 2/hour limit' 가 사용자에게 사전 고지되지 않음. 사용자가 60초 cooldown 지났는데도 over_email_send_rate_limit 받으면 X-11 redirect 후에야 인지. Reviewer A 발견: pre-emptive copy 한 줄 권장.

DECISION: (A) VerifyEmailCard 에 neutral pre-emptive 안내 한 줄 추가 (예: '메일이 자주 발송되면 몇 분 후 다시 시도해주세요') — 사용자 친절도 향상, OR (B) reactive only 유지 — over_email_send_rate_limit 시점에 카운트다운으로 surface 됨이 충분, OR (C) Custom SMTP 도입 — 한도 자체 해결, 별건 ops 작업. 신규 가입자 onboarding 마찰 + Custom SMTP 도입 비용 trade-off는?

## Codex stdout (verbatim)

```
����: PID 44584�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 55688�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 39756�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 28948�� ���μ���(PID 47348�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 47348�� ���μ���(PID 53292�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 53292�� ���μ���(PID 55132�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 55132�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 41564�� ���μ���(PID 42900�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 42900�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 50224�� ���μ���(PID 53748�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 53748�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 32316�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 44276�� ���μ���(PID 34972�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 34972�� ���μ���(PID 54464�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 54464�� ���μ���(PID 58292�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 58292�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 36124�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 50908�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 36980�� ���μ���(PID 48124�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 48124�� ���μ���(PID 40008�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 40008�� ���μ���(PID 33096�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 33096�� ���μ���(PID 20500�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 20500�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 30756�� ���μ���(PID 48112�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 48112�� ���μ���(PID 51524�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 51524�� ���μ���(PID 15580�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 15580�� ���μ���(PID 46524�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 46524�� ���μ���(PID 35744�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
=== VERDICT ===
CHOOSE-A

=== REASONING ===
VerifyEmailCard에 중립 안내 한 줄을 추가하세요. 2/hour 한도는 가입 직후 사용자가 쉽게 밟을 수 있는 숨은 제약이고, 지금 구현은 실패 후에만 알려줘서 불필요한 온보딩 마찰이 생깁니다. Custom SMTP는 필요하지만 운영 설정 문제라서, X-12 IA 결정의 즉시 해법은 아닙니다.

=== CITATIONS ===
docs/development/auth-overview.md:181
docs/development/auth-overview.md:184
docs/development/auth-overview.md:230
docs/IA/34-X-12-auth-verify-email/description.md:110
src/components/auth/VerifyEmailCard.tsx:150

=== FOLLOW-UP ===
eng/product: VerifyEmailCard 안내문에 “메일이 자주 발송되면 몇 분 후 다시 시도해주세요” 수준의 neutral copy를 추가하고, Custom SMTP는 별도 ops 작업으로 추적하세요.
```

## Codex stderr (tail)

```
docs/development/auth-overview.md:230
docs/IA/34-X-12-auth-verify-email/description.md:110
src/components/auth/VerifyEmailCard.tsx:150

=== FOLLOW-UP ===
eng/product: VerifyEmailCard 안내문에 “메일이 자주 발송되면 몇 분 후 다시 시도해주세요” 수준의 neutral copy를 추가하고, Custom SMTP는 별도 ops 작업으로 추적하세요.
hook: Stop
hook: Stop Completed
tokens used
41,088
```