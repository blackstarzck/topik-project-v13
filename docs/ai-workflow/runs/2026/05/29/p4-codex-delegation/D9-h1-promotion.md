# Codex Verdict — D9 (X-11)

- Slug: h1-promotion
- Generated: 2026-05-29T02:43:45.562Z
- Elapsed: 60.4s
- Codex exit: 0 (timedOut=false)

## Question

IA X-11 + X-12 — visibleH1=null in browser-results. 원인: AuthErrorCard 와 VerifyEmailCard 가 antd Card 안의 Typography.Title level=3 (H3) 사용, page level h1 부재. WCAG document outline + 검수 도구 양쪽 영향.

DECISION: (A) page.tsx 에 sr-only h1 추가 (예: <h1 className="sr-only">인증 오류</h1>) — a11y 보완, UI 영향 0, OR (B) Card 내부 Title level=1 으로 승격 — visual hierarchy 변동, OR (C) WCAG 1.3.1 conformance 측면에서 acceptable 로 판단하고 미수정 — Card title role 로 충분. A11y 표준 + 검수 자동화 양쪽 best는?

## Codex stdout (verbatim)

```
����: PID 32732�� ���μ���(PID 50780�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 50780�� ���μ���(PID 21272�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 21272�� ���μ���(PID 39712�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 39712�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 33000�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 53440�� ���μ���(PID 44224�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 44224�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 18608�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 45676�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 48476�� ���μ���(PID 54488�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 54488�� ���μ���(PID 56508�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 56508�� ���μ���(PID 4680�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 4680�� ���μ���(PID 23076�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 23076�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 33400�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 6132�� ���μ���(PID 31392�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 31392�� ���μ���(PID 39812�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 39812�� ���μ���(PID 49712�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 49712�� ���μ���(PID 34492�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 34492�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 44012�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 58068�� ���μ���(PID 39664�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 39664�� ���μ���(PID 40068�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 40068�� ���μ���(PID 10144�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 10144�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 31404�� ���μ���(PID 59300�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 59300�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
����: PID 24852�� ���μ���(PID 50476�� �ڽ� ���μ���)�� ����Ǿ����ϴ�.
=== VERDICT ===
CHOOSE-A

=== REASONING ===
`page.tsx`에 `sr-only h1`을 추가하세요. IA는 카드형 중앙 UI를 요구하고 있으므로 카드 내부 `Title level={3}`을 `h1`로 올리면 시각 계층이 바뀝니다. 반대로 `sr-only h1`은 문서 제목 구조와 자동 검수의 `visibleH1=null` 문제를 해결하면서 UI 영향이 없습니다.

=== CITATIONS ===
src/app/auth/error/page.tsx:11
src/app/auth/verify-email/page.tsx:11
src/components/auth/AuthErrorCard.tsx:142
src/components/auth/VerifyEmailCard.tsx:171
docs/IA/33-X-11-auth-error/description.md:11
docs/IA/34-X-12-auth-verify-email/description.md:11

=== FOLLOW-UP ===
두 page의 `<main>` 첫 자식으로 각각 `sr-only h1`을 추가하고, 카드 내부 `Title level={3}`은 유지하세요.
```

## Codex stderr (tail)

```
src/components/auth/VerifyEmailCard.tsx:171
docs/IA/33-X-11-auth-error/description.md:11
docs/IA/34-X-12-auth-verify-email/description.md:11

=== FOLLOW-UP ===
두 page의 `<main>` 첫 자식으로 각각 `sr-only h1`을 추가하고, 카드 내부 `Title level={3}`은 유지하세요.
hook: Stop
hook: Stop Completed
tokens used
70,450
```