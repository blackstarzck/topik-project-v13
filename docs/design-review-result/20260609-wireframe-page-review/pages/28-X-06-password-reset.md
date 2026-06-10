# 28-X-06 비밀번호 재설정 요청 페이지 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-06 / `/password-reset`
- **audience**: public
- **상태**: PASS
- **host**: 단독 페이지. 새 비밀번호 입력은 X-16 `/password-reset/confirm` 범위다.

## 2. 보정 요약
- 기존 요청 폼은 라우트와 Supabase Auth 흐름은 맞았지만, 와이어프레임의 보안 시각 요소와 링크 만료 안내가 초기 상태에서 약했다.
- `PasswordResetPage`에 보안/메일 아이콘 visual을 추가하고, `PasswordResetRequestForm` 초기 상태에 기존 번역 키 `sentExpiryNote`를 재사용해 만료/재발송 안내를 노출했다.
- X-06 전용 e2e를 추가해 실제 메일을 보내지 않고 Supabase recover endpoint를 intercept한 성공 상태까지 검증했다.

## 3. Layer 1 - SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 재설정 카드 (#1) | 중앙 카드 안에서 비밀번호 재설정 요청 절차를 안내 | 일치 | `current.json`: `cardVisible` true, `formVisible` true |
| 흐름 안내 (#2) | 요청 페이지 위치와 다음 단계 안내, Stepper 미사용 | 일치 | heading `비밀번호 재설정`, intro copy, X-16은 별도 confirm route로 분리 |
| 이메일 입력/발송 | 이메일 입력 후 재설정 링크 발송, cooldown 적용 | 일치 | `emailVisible` true, `submitVisible` true, intercepted send 후 `countdownVisible` true |
| 안내 카피 (#4) | 보안 조건, 링크 만료, 재발송 가능성 안내 | 일치 | `expiryNoteVisible` true |
| 보조 시각 요소 (#5) | 입력 영역을 가리지 않는 보안/메일 보조 visual | 일치 | `visualVisible` true, desktop/mobile screenshot 확인 |
| 완료/복귀 CTA (#6) | 로그인 복귀 링크와 성공 상태 안내 | 일치 | `loginHref` `/login`, `sentStateVisible` true, `sentEmailVisible` true |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/28-X-06-password-reset.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/28-X-06-password-reset/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/28-X-06-password-reset/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/28-X-06-password-reset/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/28-X-06-password-reset/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/28-X-06-password-reset/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/app/password-reset/page.tsx src/components/auth/PasswordResetRequestForm.tsx tests/e2e/screens/password-reset.spec.ts`
- `pnpm exec vitest run tests/components/auth/PasswordResetRequestForm.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/password-reset.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-06 캡처 생성 스크립트: mobile/tablet/desktop `status` PASS, request shell/security copy/navigation/intercepted success assertions true, dev overlay false, console/page error 0

## 6. 검증 제한
- 실제 Supabase 메일 발송은 사용자 계정과 외부 메일 전송을 발생시키므로 실행하지 않았다. e2e는 `/auth/v1/recover`를 intercept해 UI 성공 상태만 검증했다.
- X-16 새 비밀번호 입력/저장은 별도 화면 범위라 이 페이지 감사에서는 다루지 않았다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. X-06 대상 검증은 public route에 대해 `--no-deps`로 확인했다.
