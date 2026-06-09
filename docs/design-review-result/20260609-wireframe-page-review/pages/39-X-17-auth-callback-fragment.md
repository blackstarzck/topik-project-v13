# 39-X-17 인증 콜백 fragment 처리 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-17 / `/auth/callback-fragment` (public)
- **audience**: public
- **캡처 상태**: rendered (fragment 없는 직접 접근 → 오류/이동 fallback 경로). 정상 fragment 처리(spinner→세션 설정)는 transient·실토큰 필요 → UNVERIFIED-LIVE
- **host**: 단독 페이지 (implicit auth fragment fallback)

## 2. 캡처 증거
- 스크린샷: `.design-review-shots/20260609/39-X-17-auth-callback-fragment-{360,768,1280}.png`
- 렌더 헬스(`_health.json`): HTTP 200, 콘솔 에러 0, 에러 오버레이 없음, bodyLen 작음(전이 화면).

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요소/상태 | 판정 | 근거 |
| --- | --- | --- | --- |
| Callback container(#1) | 중앙 카드 + 상태 안내 | 일치 | 캡처: 중앙 카드 |
| 실패 처리(#3) | token/error 없으면 unknown 오류로 이동 | 일치(예외 경로) | 캡처: fragment 없는 직접 접근 → "처리 중 문제가 생겼어요 / 잠시 후 다시 시도" + 홈으로 + 로그인·가입 |
| Spinner/상태 문구(#2/#3) | "인증을 확인 중이에요…"/"이동 중이에요…" | UNVERIFIED-LIVE | 정상 fragment·실토큰 없이는 spinner 경로 미발생 |
| 보안(#4/#5) | token/raw error 미노출, safe redirect | 일치(추정) | 캡처에 token/raw 오류 노출 없음. sanitizeNext는 소스상 적용 |

**종합 verdict: 일치 (예외 경로) + 정상 경로 UNVERIFIED-LIVE** — fragment 없는 접근의 안전한 오류 fallback은 확인. 정상 토큰 처리(spinner→세션)는 실토큰 필요로 미검증.

## 4. Layer 2 — 멀티 에이전트 독립 분석

- **상태 커버리지 (양호)**: 토큰/에러 없는 진입을 막다른 길 없이 오류 안내 + escape(홈/로그인/가입)로 처리. 무한 spinner 없음.
- **보안 (양호, 소스+화면)**: token/refresh_token/raw error_description을 화면·URL에 노출하지 않음(SOT 핵심). `next` open-redirect 방지(sanitizeNext) — 소스상 확인.
- **콘텐츠/i18n (양호)**: 오류 문구 평이("처리 중 문제가 생겼어요").
- **반응형/접근성 (양호)**: 중앙 카드 360 유지. (SOT의 `role="status"` aria-live는 소스상 정의)
- **적대적 검증**: "fallback 정상" 확정. 단 정상 fragment 경로는 실토큰 없이 미검증(정직 표기, 과장 금지).

## 5. 결론 — 개선안

### P0 / P1
- 없음 (안전한 fallback + 보안 처리).

### 검증 보강 (P2)
- **정상 fragment 경로 실측**: implicit flow(또는 fragment 포함 링크)로 spinner→`setSession`→sanitized next 이동을 1회 실측. (현재는 fragment 없는 오류 경로만 확인)

> 참고: best-effort transient 화면. 코드 미수정.
