# 38-X-16 새 비밀번호 설정 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-16 / `/password-reset/confirm`
- **audience**: public. 화면 접근은 세션 없이 가능하지만, 실제 비밀번호 저장은 Supabase recovery session이 필요하다.
- **캡처 상태**: rendered / PASS
- **host**: 단독 페이지
- **SOT 이미지**: 없음. 기존 34개 Wireframe 이후 코드 기준으로 추가된 화면이라 텍스트 SOT와 현재 구현을 대조했다.

## 2. 판정
**PASS**

이전 리뷰의 P1 이슈였던 만료 시각 하이드레이션 불일치는 현재 소스에서 재현되지 않는다. `PasswordResetConfirmForm`은 `expiresAt`을 `null`로 초기화하고 `useEffect` 내부 `setTimeout` 이후에만 클라이언트 시각을 계산한다. 따라서 SSR 출력에는 시각 문자열이 포함되지 않고, Playwright public smoke에서도 `pageerror`가 0건으로 확인됐다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| 재설정 카드(#1) | 일치 | `AppCard` 기반 중앙 카드가 360/768/1280 캡처에서 유지된다. |
| 흐름 안내(#2) | 일치 | “마지막 단계” 안내와 새 비밀번호 설정 헤딩이 노출된다. |
| 비밀번호 입력(#3) | 일치 | 새 비밀번호/확인 필드, 8-64자 검증, 강도 미터와 규칙 체크리스트가 동작한다. |
| 안내 카피(#4) | 일치 | 보안 조건과 “약 60분 후(HH:mm쯤)” 만료 안내가 hydration 이후 렌더되며 console/page error가 없다. |
| 마스코트(#5) | 일치 | 보안 마스코트가 입력 영역을 가리지 않는 상단 위치에 표시된다. |
| 완료 CTA + 실패 알림(#6) | 일치 | 저장 실패 시 warning alert와 `/password-reset` 재설정 링크가 노출되고 provider raw error는 UI에 노출되지 않는다. |

## 4. Layer 2 — 멘탈 모델 / 상태 검증
- **직접 진입**: `/password-reset/confirm`은 세션 없이도 HTTP 200으로 렌더된다. 이는 public route 요구와 일치한다.
- **recovery session 없음/만료**: 저장 실패는 canonical warning alert로 안내되고, 사용자는 `/password-reset`에서 재요청할 수 있다.
- **성공 흐름**: 기존 unit test가 `updateUser({ password })` 호출과 `/login` 이동을 검증한다.
- **반응형**: 360/768/1280 캡처 모두 레이아웃 겹침, 잘림, dev error overlay가 없다.

## 5. 증거
- Report: `docs/design-review-result/wireframe-ui-audit/2026-06-10/38-X-16-password-reset-confirm.html`
- Structured findings: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/38-X-16-password-reset-confirm/findings.json`
- Current capture data: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/38-X-16-password-reset-confirm/current.json`
- Screenshots:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/38-X-16-password-reset-confirm/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/38-X-16-password-reset-confirm/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/38-X-16-password-reset-confirm/desktop-1280.png`

## 6. 검증
- `pnpm exec eslint src/components/auth/PasswordResetConfirmForm.tsx tests/e2e/screens/password-reset-confirm.spec.ts`
- `pnpm exec vitest run tests/components/auth/PasswordResetConfirmForm.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/password-reset-confirm.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- `pnpm exec playwright test tests/e2e/screens/screens-public.spec.ts -g "X-16" --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`

## 7. 남은 리스크
- 실제 Supabase recovery email/session을 사용한 live password update는 실행하지 않았다. 현재 검증은 기존 unit test와 Playwright의 빈 세션/실패 복구 분기, public render smoke를 결합한 감사 범위다.
