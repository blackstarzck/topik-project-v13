# 35-X-13 이용약관 와이어프레임 리뷰

## 1. 메타
- **IA / route**: X-13 / `/terms` (public)
- **Audience**: public
- **상태**: PASS
- **Host**: legal support placeholder page

## 2. 보정 요약
- 페이지 동작은 유지하고 `TermsContent`에 감사용 stable test id만 추가했다.
- X-13 전용 e2e를 추가해 placeholder 고지, 임시 약관 요약, 문의 안내, escape links를 검증했다.
- `legal.terms`/`legal.privacy` 번역은 현재 dirty worktree와 HEAD가 동일함을 구조화 비교로 확인했다. 따라서 X-13 산출물은 unrelated dirty 번역 변경에 의존하지 않는다.

## 3. Layer 1 - SOT 정합 리뷰

| 항목 | 요구사항 | 판정 | 근거 |
| --- | --- | --- | --- |
| 법적 고지 페이지 (#1) | 제목과 placeholder 약관 안내를 명확히 표시 | Pass | `current.json`: `cardVisible`, `introVisible`, `placeholderNoticeVisible` true |
| 임시 약관 요약 (#2) | 서비스 성격, 학습 데이터 목적, 개인정보 링크, 재동의 안내 | Pass | `current.json`: `summaryVisible` true |
| 운영 문의 안내 (#3) | 존재하지 않는 문의 채널을 꾸며내지 않음 | Pass | `current.json`: `contactVisible` true |
| Escape links (#4) | 홈, 회원가입, 개인정보처리방침으로 이동 가능 | Pass | `current.json`: `homeLinkVisible`, `signUpLinkVisible`, `privacyLinkVisible` true |
| 반응형 단일 컬럼 | 모바일/데스크톱에서 읽기 좋은 단일 컬럼 | Pass | mobile/desktop screenshot 확인, 겹침 없음 |

**종합 verdict: PASS.**

## 4. 증거
- Report: `docs/design-review-result/wireframe-ui-audit/2026-06-10/35-X-13-terms.html`
- Structured findings: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/35-X-13-terms/findings.json`
- Current capture data: `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/35-X-13-terms/current.json`
- Screenshots:
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/35-X-13-terms/mobile-360.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/35-X-13-terms/tablet-768.png`
  - `docs/design-review-result/wireframe-ui-audit/2026-06-10/screenshots/35-X-13-terms/desktop-1280.png`

## 5. 실행 검증
- `pnpm exec eslint src/components/legal/TermsContent.tsx tests/e2e/screens/terms.spec.ts`
- `pnpm exec vitest run tests/components/legal/TermsContent.test.tsx`
- `pnpm exec playwright test tests/e2e/screens/terms.spec.ts --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- `pnpm exec playwright test tests/e2e/screens/screens-public.spec.ts -g "X-13" --project=mobile-360 --project=tablet-768 --project=desktop-1280 --no-deps`
- X-13 capture script: `/terms`를 360/768/1280에서 캡처했고 status PASS.

## 6. 검증 한계
- 정식 법무 검토 약관은 아직 scope 밖이다. 현재 화면은 명세대로 placeholder 상태를 정직하게 표시하는지만 검증했다.
- 전체 lint/typecheck와 기본 Playwright setup은 unrelated auth/landing/legal worktree 변경 때문에 계속 차단되어 있다.
