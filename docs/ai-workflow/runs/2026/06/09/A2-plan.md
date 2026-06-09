# A2 실행계획 — 데이터 형태 계약 + 화면(normalizer) 견고화 (G2·G9·G11, F3 읽기측) (2026-06-09)

> 페이즈 A2 (Track A, v13) · 상위: [`2026-06-09-writing-questionbank-remediation.md`](../../../../superpowers/plans/2026-06-09-writing-questionbank-remediation.md)
> 선행: A1(완료). 사이클: 실행계획 → GPT-5.5 리뷰 → 실행 → 검증(unit+e2e) → 보고. Track A라 owner 게이트 없음.

## 0. 현황 (정직한 스코핑)
`src/lib/writing/problem-normalizer.ts`(573줄)는 **이미 방어적**: 모든 입력을 `asRecord/asString/asStringList`로 거르고, 없으면 빈 배열 + `fallbackWarnings`("missing_blanks/charts/...") + `submitBlockedReason`(52/54 incomplete)로 graceful degrade. **현 데이터 형태(시드 466) 전부 처리** 확인(51 rubric없음, 52/53/54 객체 rubric, 배열/문자열 rubric 없음). 기존 테스트(`tests/lib/writing/problem-normalizer.test.ts`) = 466 스모크 + 51/53/54 + 깨진54 1건.
→ **A2는 큰 코드 변경이 아니라**: 모양 규칙 문서화 + 견고함을 테스트로 고정 + 작은 미래대비 + 글자수 가드.

## 1. 작업 (4개)
**(A) 데이터 형태 계약 문서** — 신규 `docs/writing-problem-content-shape-contract.md`:
- rubric = **OBJECT `{conditions[], criteria[]}`**(중첩 `rubric`/`approved_rubric` 폴백 허용), 51은 rubric 없음 정상.
- #54 materials: **풍부형(approved_topic_seed/scenario)이 정식**, 평면형(top-level topic_seed_title)은 레거시 폴백 — 둘 다 흡수.
- charts = `materials.charts.chart_a/chart_b`(series=label+number[]), 53만 채움.
- validation = `materials.review.validation`(51/52 경고 표시용).
- 빈칸 = `answer_key`(51) + `materials.blanks.blank_1/2`/프롬프트 마커/`blank_target_*`(52).
- **C3·C-TAX가 write 시 이 계약을 검증 기준으로 재사용**(F3: 서버 무검증이라 저작기 클라 검증 필수).

**(B) 견고화 회귀 테스트** — `problem-normalizer.test.ts` 확장(적대적 입력 → **throw 없음 + graceful**):
- rubric = 바닥 배열 `["조건A","조건B"]` → criteria로 흡수(아래 C 보강 검증).
- materials = 문자열(파싱 안 된 JSON) → 전부 폴백, 크래시 없음.
- materials/rubric/answerKey = null/undefined → 폴백.
- chart series에 비숫자 값 섞임 → 해당 값 무시, 크래시 없음.
- prompt 빈 문자열 → 빈 처리.
- **52 incomplete**(rubric conditions/criteria 없음) → `problem_data_incomplete` (현재 미테스트).

**(C) 작은 코드 보강** — `normalizeRubric`:
- 현재 `asRecord(rubric)`라 **바닥 배열 rubric → 빈값**(데이터 손실). F3상 admin이 raw RPC로 배열을 쓸 수 있으므로, **바닥 배열 rubric → criteria로 매핑**(admin scoringCriteria 해석과 일치). 현 데이터엔 배열 없음 → **기존 동작 불변, 순수 미래대비**.
- 그 외 코드 변경 없음(이미 견고).

**(D) 글자수 드리프트 가드 테스트**(A3 이관) — 신규 또는 기존 테스트에:
- 53/54 시드 프롬프트 내장 범위("200~300"/"600~700") == `CHAR_LIMITS[53/54].recommendedMin/Max` 단언. 미래에 어긋나면 실패.

## 2. 변경 대상
- 신규 문서 `docs/writing-problem-content-shape-contract.md`.
- `src/lib/writing/problem-normalizer.ts` (normalizeRubric 배열 분기 1곳, 동작 보존).
- `tests/lib/writing/problem-normalizer.test.ts` (적대 케이스 추가).
- 글자수 가드: `tests/lib/writing/char-limit-prompt-consistency.test.ts`(신규) 또는 기존에 추가.

## 3. 수용 기준
- 적대 입력 전부 **throw 없이** 폴백(경고/submit-block) — 테스트 GREEN.
- 배열 rubric → criteria 흡수 확인. 기존 466 스모크·51/53/54 테스트 **불변 GREEN**(회귀 0).
- 글자수 가드 GREEN.
- 형태 계약 문서가 normalizer 실제 동작과 일치.

## 4. 검증
- `pnpm vitest run tests/lib/writing/` (단위) GREEN.
- **E2E 게이트**: `pnpm test:e2e`(기존 dev 서버) 또는 공개+쓰기 스모크 — 런타임 회귀 0.
- 코드 변경이 normalizeRubric 1곳뿐이라 영향 좁음.

## 5. 리스크 / 롤백
- normalizeRubric 변경이 기존 객체 rubric 동작을 바꾸면 안 됨 → 배열일 때만 분기(객체 경로 불변), 테스트로 고정.
- 롤백: 해당 커밋 되돌림(파일 4개).
- 동시작업: 위 파일만 최소 변경, 다른 미커밋 변경 미접촉([[feedback-concurrent-agent-worktree]]).

## 6. Docs consulted
`problem-normalizer.ts`, `problem-normalizer.test.ts`, `constants.ts`, `20260608120200`(rubric 형태), 정합문서 §10(G8), 상위 계획.

## 7. 검수 결과
**임시 Claude 적대검수(codex 만료): PASS-WITH-FIXES** ([`A2-claude-review.md`](A2-claude-review.md)). P0 크래시 0(퍼징). P1-1/2/3 + P2 전부 반영. 구현·검증 완료 → [`A2-report.md`](A2-report.md). typecheck✓·단위 97✓·E2E 쓰기플로우✓.
