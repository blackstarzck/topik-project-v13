# QA — C-01 규칙 기반 추천 fallback (2026-07-09)

- 브랜치/worktree: `claude/c01-rule-recommendations` / `../v13-c01-rule-recommendations` (base `codex/dev` @ 2569cd0f)
- 검증 서버: 신선한 프로덕션 빌드(`pnpm build` + `next start -p 3100`), `E2E_BASE_URL=http://127.0.0.1:3100` (스테일 3000 dev 서버 회피)
- 구현 brief: `docs/sot-change-proposals/2026-07-09-c01-rule-fallback-recommendations-implementation-brief.md`

## 스크린샷 (computed 상태 — service key로 run 만료 flip 후 캡처, 캡처 후 원복)

| 파일 | 내용 |
| --- | --- |
| `computed-desktop-1280.png` | 전체 유형: hero(51, 순환 사유) + 다른 추천 52/53/54 각 1건(목표 적합 사유) + 정직한 요약("아직 풀이 기록이 적어 51→54 유형 순환 순서로 골랐어요.") |
| `computed-mobile-360.png` | 동일 상태 mobile 1-column 스택 정상 |
| `computed-type-52-desktop-1280.png` | `?type=52` 필터: 52번만 4건(hero 25분 기본 시간), 다양성 규칙 미적용 확인 |

## 자동 검증 결과

- vitest 전체: 1629 passed / 9 skipped (0 fail). 신규 `tests/lib/practice/recommendation-fallback.test.ts` 11케이스, `recommendations.test.ts` +4케이스, `RecommendationsView.test.tsx` computed 렌더+key 회귀 케이스 포함.
- `pnpm lint`, `pnpm typecheck` 통과.
- 스코프 e2e (`recommendations-empty` 재작업 + `recommendations-fallback-ui` 신규 + `recommendations-fallback-live` 신규): **3개 viewport(mobile-360/tablet-768/desktop-1280) 모두 전체 통과.** live 스펙은 실제 DB에서 run 만료 flip→computed 렌더→원복까지 검증.
- 회귀 e2e: `institution-writing-existing-account`(어서션 갱신분) ✓, `institution-writing-exposure`(무수정 통과 = 기관 미배정 fail-closed 유지 증명) ✓, `next-problem` ✓, `screens-authed`의 C-01 항목 ✓.

## 환경 이슈 (이 변경과 무관, 기록용)

1. **e2e 세션 간섭**: 한 번의 playwright 실행이 2~3분을 넘기면 저장된 학생 세션이 외부 요인으로 무효화되어 이후 테스트가 /login으로 떨어지는 현상 재현(같은 스펙이 viewport 단독 실행에서는 전부 통과). 원인은 공유 e2e 계정에 대한 동시 세션/재로그인으로 추정. 회피: `--project=<viewport>` 단위 실행.
2. **durable fixture 유실**: 검증 시점에 e2e 학생의 durable 추천 4건과 감사 submission 2건이 DB에 존재하지 않았음(사전 드리프트). `node scripts/seed-e2e-audit-fixtures.mjs`로 복구 → E-01/E-02 통과 복원.
3. **X-04 subscription-management** (screens-authed): heading 미렌더로 실패. 이 변경의 diff와 파일 겹침 없음 + reseed 이전 첫 실행에서도 동일 실패 → 기존 환경/데이터 이슈로 분류.
4. **X-07 weakness 상세 스펙**: `diagnostic-empty` 노출로 실패 — 학생 계정의 누적 `feedback_dimension_scores`(표본 ≥5)가 DB 초기화로 소실된 데이터 전제 문제. 이 변경은 weakness 화면/진단 로직을 수정하지 않음.
