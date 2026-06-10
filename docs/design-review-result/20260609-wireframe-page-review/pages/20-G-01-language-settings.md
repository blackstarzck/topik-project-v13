# 20-G-01 언어 설정 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: G-01 / `/settings/language`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지

## 2. 보정 요약
- 기존 리뷰의 결론대로 P0/P1/P2 이슈는 없었다.
- 회귀 검증을 위해 주요 영역에 안정적인 test id를 추가했다: `language-settings-form`, `language-ui-radio`, `language-learning-card`, `language-learning-radio`, `language-content-card`, `language-feedback-display`, `language-example-difficulty`, `language-explanation-length`, `language-help-card`, `language-help-item`, `language-unsupported-notice`, `language-save`.
- G-01 전용 e2e를 추가해 UI 언어 옵션 수, 학습 언어 옵션 수, 콘텐츠 설정 3그룹, 도움말 3항목, 변경 전 저장 disabled 상태를 검증했다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 학습자 사이드 내비 (#1) | 설정 위치 유지, 인증 필요 | 일치 | `/settings/language` 인증 storage state 접근, `/login` 리다이렉트 없음 |
| UI 언어 선택 (#2) | 언어명/자어 병기, 옵션 6개 이하, 즉시 미리보기 | 일치 | UI 언어 radio 3개(ko/en/vi), 변경 전 저장 disabled |
| 학습 언어 선택 (#3) | 학습 콘텐츠 기준 언어 설정, 번역 없음 안내 | 일치 | follow UI + ko/en/vi radio 4개 |
| 콘텐츠 설정 (#4) | 옵션 그룹 3개 이하, 저장 전 임시 상태 | 일치 | 피드백 표시, 예문 난이도, 해설 길이 3그룹 |
| 안내말 (#5) | 3항목 이하, 각 항목 60자 이하 | 일치 | 도움말 항목 3개 |
| 저장 (#6) | 변경 없으면 disabled, 저장 중 중복 클릭 차단 | 일치 | `language-save` 초기 disabled, `saving` 상태에서 Form disabled |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/20-G-01-language-settings.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/20-G-01-language-settings/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/20-G-01-language-settings/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/20-G-01-language-settings/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/20-G-01-language-settings/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/20-G-01-language-settings/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/settings/LanguageForm.tsx tests/e2e/screens/language-settings.spec.ts`
- `pnpm exec playwright test tests/e2e/screens/language-settings.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- G-01 캡처 생성 스크립트: 모바일/태블릿/데스크톱 uiRadioCount 3, learningRadioCount 4, helpItemCount 3, console/page error 0

## 6. 검증 제한
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패했다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단됐다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. G-01 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
