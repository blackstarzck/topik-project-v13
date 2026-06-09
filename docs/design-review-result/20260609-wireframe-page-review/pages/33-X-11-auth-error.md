# 33-X-11 인증 에러 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-11 / `/auth/error?reason=<code>` (public)
- **audience**: public
- **캡처 상태**: rendered (otp_expired + over_request_rate_limit 2개 변형 캡처)
- **host**: 단독 페이지 / SOT 이미지 없음(코드 기반, 텍스트 SOT)

## 2. 캡처 증거
- 스크린샷: `33-X-11-auth-error-otp-{360,768,1280}.png`, `33-X-11-auth-error-ratelimit-{360,768,1280}.png`
- 렌더 헬스(`_health.json`): HTTP 200, 에러 오버레이 없음. **otp 변형 콘솔 에러 1건 — `legacyBehavior` (Link) 폐기 경고**; rate-limit 변형은 콘솔 에러 0.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요소/상태 | 판정 | 근거 |
| --- | --- | --- | --- |
| 에러 카드(#1) | 중앙 카드, 사유별 일관 | 일치 | 캡처: 중앙 카드 |
| 사유별 메시지(#2) | reason→한국어 메시지, raw 미노출 | 일치 | otp: "인증 링크가 만료됐어요" (raw error_description 노출 없음) |
| 주요 CTA(#3) | 사유별 우선 행동 | 일치 | otp: "인증 메일 다시 받기" (재전송) |
| Retry-After 카운트다운(#4) | rate-limit 계열 카운트다운 | 일치 | 캡처: "59초 후 다시 시도할 수 있어요" + 버튼 비활성 |
| 이메일 prefill(#5) | otp/email_not_confirmed 시 편집 가능 input | 일치 | otp: "가입한 이메일을 입력해주세요" input |
| 보조 링크(#6) | 로그인/가입/홈 escape | 일치 | 캡처: 로그인하기 / 홈 |

**종합 verdict: 일치 (강)** — 11 reason 매핑·카운트다운·prefill·escape 모두 구현. 콘솔 경고 1건만 보완 대상.

## 4. Layer 2 — 멀티 에이전트 독립 분석

- **코드 품질 (P2)**: otp 변형에서 `legacyBehavior is deprecated` (Next `<Link legacyBehavior>`) 콘솔 경고. rate-limit 변형엔 없음 → otp 분기의 특정 Link가 legacyBehavior 사용. 향후 Next 제거 대비 codemod 필요.
- **UX/IA (우수)**: 막다른 길 방지(항상 escape 링크), rate-limit 시 카운트다운으로 "왜 지금 안 되는지" 설명. raw provider 오류 비노출(보안).
- **상태 커버리지 (우수)**: 2개 reason 변형 실측(otp/rate-limit). 나머지 9개 reason은 코드 매핑상 정의(미실측).
- **반응형/접근성 (양호)**: 360/1280 중앙 카드, 입력·버튼 라벨.
- **적대적 검증**: legacyBehavior 경고는 `_health.json`으로 확정(otp만). 메시지/카운트다운/escape 일치도 확정.

## 5. 결론 — 개선안

### P0 / P1
- 없음.

### P2 (여유 있을 때)
- **`legacyBehavior` Link codemod**: otp 분기의 `<Link legacyBehavior>` 제거(`@next/codemod new-link`). — 근거: Layer 2 코드 품질, 증거 `_health.json`(otp 변형 콘솔 에러).

> 참고: 코드 미수정. 인증 에러 화면은 reason 매핑·카운트다운·escape가 잘 구현됨.
