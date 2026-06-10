# 22-D-M3 자동저장 경고 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: D-M3 / host: `/writing/short-answer-writing-51` 등 작성 화면 D-01~D-04
- **audience**: user
- **상태**: PASS
- **host**: 작성 화면 위 모달(`AutosaveWarningModal`)

## 2. 보정 요약
- `AutosaveWarningModal`에 회귀 검증용 test id를 추가했다: `autosave-warning-modal`, `autosave-warning-body`, `autosave-warning-alert`, `autosave-warning-state`, `autosave-warning-last-saved`, `autosave-warning-recovery-state`, `autosave-warning-no-backup`, `autosave-warning-keep`, `autosave-warning-retry`, `autosave-warning-proceed`.
- `save_failure` 분기의 별도 경고 문구가 AntD `Alert`의 표시용 `message`가 아니라 HTML `title` 속성에만 들어가던 문제를 수정했다.
- 컴포넌트 테스트를 D-M3 세 트리거 기준으로 보강했다: `save_failure`, `disable_attempt`, `exit_with_dirty`.
- D-M3 전용 e2e를 추가해 51번 작성 화면에서 실제 `disable_attempt` 모달을 열고 mobile/tablet/desktop에서 mask, 저장/복구 상태, CTA 상태를 검증했다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 배경 dim/입력 잠금 (#1) | 미저장/자동저장 위험 시 작성 화면 위 blocking modal | 일치 | e2e 캡처에서 `.ant-modal-mask` visible, 작성 화면 preserved |
| 경고 상태 (#2) | 고정 경고 표시, 아이콘 실패 시 텍스트 fallback | 일치 | 제목에 warning Tag와 경고 title 표시 |
| 안내 문구 (#3) | 24자 이내 제목, 80자/2줄 본문, 손실 범위 명시 | 일치 | `disable_attempt` 본문이 새로 고침/페이지 이동 시 답안 손실을 명시 |
| 마지막 저장/복구 상태 (#4) | 마지막 저장 시각 필수, 복구 가능/불가/확인중 표시 | 일치 | e2e: `lastSavedText`, `recoveryText` visible; 컴포넌트 테스트: checking/impossible 분기 확인 |
| CTA (#5) | 유지, 재시도, 위험 인지 진행. 중복/불가 액션 차단 | 일치 | `disable_attempt`에서 retry disabled, keep/proceed enabled; `save_failure` retry handler 검증 |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/22-D-M3-autosave-warning.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/22-D-M3-autosave-warning/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/22-D-M3-autosave-warning/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/22-D-M3-autosave-warning/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/22-D-M3-autosave-warning/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/22-D-M3-autosave-warning/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/writing/AutosaveWarningModal.tsx tests/components/writing/AutosaveWarningModal.test.tsx tests/e2e/screens/autosave-warning-modal.spec.ts`
- `pnpm exec vitest run tests/components/writing/AutosaveWarningModal.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/autosave-warning-modal.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- D-M3 캡처 생성 스크립트: mobile/tablet/desktop modalVisible true, maskVisible true, bodyMentionsLossScope true, retryDisabled true, keep/proceed enabled, console/page error 0

## 6. 검증 제한
- `save_failure`와 `exit_with_dirty`는 작성 route에서 네트워크 실패/이탈 상태를 강제하지 않고 컴포넌트 테스트로 직접 검증했다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. D-M3 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
