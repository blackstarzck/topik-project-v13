# 기관 배정 문제만 쓰기 노출 실행 계획

## 범위

- 쓰기 문제 visibility DB predicate를 기관 사용자 assigned-only 정책으로 변경한다.
- availability helper/API를 추가하고 추천/사이드바 UI가 같은 결과를 사용하게 한다.
- 직접 쓰기 URL과 제출은 기존 server/DB guard를 통해 미배정 문제를 차단한다.
- active SOT는 직접 수정하지 않고 SOT 변경 제안 문서만 추가한다.

## 단계

1. SOT 충돌과 새 정책 행렬을 `docs/sot-change-proposals/`에 기록한다.
2. migration/static/unit/integration/e2e 테스트 기대값을 assigned-only 기준으로 갱신한다.
3. 새 migration으로 public/private visibility predicate를 재정의한다.
4. `GET /api/practice/writing-availability`와 client hook을 추가한다.
5. 추천 탭/카드와 사이드바 쓰기 메뉴에 locked 상태를 연결한다.
6. desktop/mobile Playwright 검증과 스크린샷을 `docs/qa/reports/2026-06-29-institution-assigned-only-writing-access/`에 저장한다.
7. Vitest, Supabase integration, Playwright, `pnpm lint`, `pnpm typecheck`를 실행한다.

## 비판 검토 반영

- 기존 "기관 회원 콘텐츠 권한 변경 없음" 문서와 충돌하므로 구현 전 제안 문서로 결정 변경을 분리한다.
- exposure table 부재 시 기관/비기관 모두 fail-closed로 둔다.
- UI lock은 편의 장치이고, 실제 접근 차단은 DB predicate와 제출 guard가 권위 지점이다.
