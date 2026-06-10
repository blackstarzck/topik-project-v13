# 27-X-05 프로필 편집 페이지 와이어프레임 기준 리뷰

## 1. 메타
- **IA / 라우트**: X-05 / `/profile`
- **audience**: user
- **상태**: PASS
- **host**: 단독 페이지

## 2. 보정 요약
- 기존 구현은 프로필 편집 와이어프레임과 강하게 일치해 코드 보정은 하지 않았다.
- X-05 전용 e2e를 추가해 `/profile` 인증 접근, 이메일 읽기 전용, 이름/닉네임/자기소개 길이 제한, 변경 전 저장 비활성화, 아바타 업로드 안내, 목표 시험 카드, 계정 상태 카드를 mobile/tablet/desktop에서 검증했다.
- 감사 검증은 공유 테스트 계정의 프로필 저장값과 아바타 데이터를 변경하지 않는 read-only 범위로 제한했다.

## 3. Layer 1 - SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 개인정보 입력 폼 (#2) | 이름 2-30자, 닉네임 2-20자, 자기소개 160자, 이메일 변경 제한 | 일치 | `current.json`: `emailReadOnly` true, `nameMaxLength` 30, `nicknameMaxLength` 20, `bioMaxLength` 160 |
| 아바타 영역 (#3) | JPG/PNG 5MB 이하, 정사각형 자동 처리, 이미지 변경 CTA | 일치 | `avatarVisible` true, `avatarConstraintsVisible` true, `uploadEnabled` true |
| 학습 목표/상태 카드 (#4) | 목표 시험과 계정 상태를 3개 이하 보조 카드로 안내 | 일치 | `examCardVisible` true, `statusCardVisible` true |
| 저장 CTA (#5) | 변경사항이 없으면 저장 비활성화 | 일치 | `saveDisabled` true |
| 보안 안내 | 이메일 등 민감 정보 변경 제한과 재인증 안내 | 일치 | 프로필 폼 내 이메일 read-only 처리와 저장 가능한 일반 정보 분리 |
| 반응형 배치 | 360/768/1280 뷰포트에서 입력 영역과 보조 카드가 읽히게 배치 | 일치 | mobile/tablet/desktop screenshot 모두 dev overlay와 console error 없음 |

**종합 verdict: PASS.**

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/27-X-05-profile-editing.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/27-X-05-profile-editing/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/27-X-05-profile-editing/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/27-X-05-profile-editing/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/27-X-05-profile-editing/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/27-X-05-profile-editing/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint tests/e2e/screens/profile-editing.spec.ts`
- `pnpm exec vitest run tests/components/profile/ProfileForm.test.tsx tests/components/profile/ExamInfoCard.test.tsx tests/components/profile/StatusHelpCard.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/profile-editing.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-05 캡처 생성 스크립트: mobile/tablet/desktop `status` PASS, heading/email/maxLength/save/avatar/exam/status assertions true, `devOverlayVisible` false, console/page error 0

## 6. 검증 제한
- 프로필 저장 mutation과 아바타 업로드는 공유 테스트 계정 상태를 바꾸므로 이번 read-only 감사 e2e에서는 실행하지 않았다.
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패한다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단된다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패한다. X-05 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
