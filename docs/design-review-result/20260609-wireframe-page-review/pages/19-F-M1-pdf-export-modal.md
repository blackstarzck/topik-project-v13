# 19-F-M1 PDF 내보내기 모달 — 와이어프레임 기준 리뷰

## 1. 메타
- **IA / host route**: F-M1 / `/library`
- **audience**: user
- **상태**: PASS
- **진입 조건**: F-01 내 서재에서 저장 답안 1개 이상 선택 후 `PDF로 내보내기` 실행

## 2. 보정 요약
- F-01 선택 항목 제목이 실제 `problems.title` 기반으로 전달되도록 보정되어, F-M1 미리보기에서도 `문제 <UUID prefix>`가 노출되지 않는다.
- 모달에 안정적인 검증 지점을 추가했다: `pdf-export-modal`, `pdf-export-filename`, `pdf-export-preview`, `pdf-export-preview-item`, `pdf-export-privacy-confirm`, `pdf-export-submit`, `pdf-export-close`.
- F-M1 e2e는 F-01 선택 흐름 안에서 바로 모달을 열어 파일명 제한, 미리보기 항목, 개인정보 확인 게이트를 검증한다.
- 테스트 fixture는 각 테스트 후 정리하도록 바꿔 `library_items_user_problem_uniq` 중복으로 인한 flake를 제거했다.

## 3. Layer 1 — SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 배경 내 서재 (#1) | dim 배경, 선택 항목 유지, 목록 스크롤 잠금 | 일치 | `/library`에서 항목 선택 후 Ant Design modal로 열림 |
| PDF 옵션 (#2) | 파일명 1-60자, 포함 항목, 정렬, 형식, 개인정보 확인 | 일치 | 파일명 `maxlength=60`, PDF 형식, 답안/피드백 포함 옵션, 개인정보 확인 체크 |
| 미리보기 (#3) | 선택 항목/답안/피드백 요약 1페이지 | 일치 | 미리보기 항목 1개, 실제 문제 제목 표시, UUID prefix 미노출 |
| 내보내기 CTA (#4) | 생성 전 개인정보 확인 필수, 생성 중 disabled | 일치 | 확인 전 `pdf-export-submit` disabled, 확인 후 enabled |

**종합 verdict: PASS.** 이전 P2였던 미리보기 UUID 라벨은 제거됐다.

## 4. 검증 증거
- 산출물: `docs/design-review-result/wireframe-ui-audit/2026-06-10/19-F-M1-pdf-export-modal.html`
- 구조화 결과: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/19-F-M1-pdf-export-modal/findings.json`
- 현재 캡처 데이터: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/19-F-M1-pdf-export-modal/current.json`
- 스크린샷:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/19-F-M1-pdf-export-modal/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/19-F-M1-pdf-export-modal/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/19-F-M1-pdf-export-modal/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/library/PdfExportModal.tsx tests/e2e/screens/library.spec.ts`
- `pnpm exec playwright test tests/e2e/screens/library.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- F-M1 캡처 생성 스크립트: 모바일/태블릿/데스크톱 previewItemCount 1, console/page error 0

## 6. 검증 제한
- 전체 `pnpm exec tsc --noEmit --pretty false`는 현재 worktree의 unrelated 인증/캐릭터 변경에서 실패했다.
- 전체 `pnpm lint`는 현재 worktree의 unrelated `tests/components/auth/AnimatedAuthCharacters.test.tsx` ENOENT로 중단됐다.
- 기본 Playwright setup 프로젝트는 unrelated 로그인 화면 변경으로 `input[autocomplete="email"]` selector를 찾지 못해 실패했다. F-M1 대상 검증은 기존 `tests/e2e/auth-state/student.json`을 사용하는 `--no-deps` 실행으로 확인했다.
