# 배포 전 실제 Supabase 데이터 전환 제안

## 결론

배포 전 테스트 환경은 로컬 개발용 seed와 wireframe fixture가 아니라 실제 검수 데이터로 검증해야 한다. 기존 seed는 로컬 개발과 감사 재현용으로 남기되, 배포 전 검증 DB에서는 실행 경로와 공개 데이터 노출을 분리한다.

## 배경

- 현재 `supabase/config.toml`은 `db.seed.enabled=true`이고 `./seed.sql`을 실행 대상으로 둔다.
- `supabase/seed.sql`은 `audit_seed` 문제와 개발용 q52 공개 보정 데이터를 포함한다.
- `20260608120200_seed_writing_problem_fixtures.sql`는 wireframe 기반 문제 데이터를 `materials.seed_source='wireframe_problem_fixtures'`로 넣는다.
- `20260610104017_seed_initial_legal_documents.sql`는 `is_placeholder=true`인 임시 약관/개인정보 문서를 넣는다.
- `20260602120100_billing.sql`는 `__seed:conformance-20260602` marker가 있는 임시 요금제 데이터를 넣는다.

## 제안 범위

### 유지

- 로컬 개발용 `supabase/seed.sql`은 유지한다.
- schema migration history는 임의로 되돌리지 않는다.
- `docs/` SOT는 이 제안이 확정되기 전까지 직접 수정하지 않는다.

### 분리

- 배포 전 검증 DB에서는 `supabase/seed.sql` 자동 실행 결과를 기준 데이터로 보지 않는다.
- 공개 문제 데이터는 실제 검수 완료 문제만 허용한다.
- wireframe fixture, audit seed, placeholder legal document는 배포 전 검증의 차단 항목으로 본다.
- 결제/요금제 placeholder는 현재 결제 scope가 deferred이므로 경고 항목으로 본다. 실제 결제 화면을 공개 검증 범위에 넣는 시점에는 차단 항목으로 승격한다.

## Acceptance Criteria

- `problems`에 `tags`가 `audit_seed`를 포함하는 공개 문제가 없다.
- `problems.materials.seed_source='wireframe_problem_fixtures'`인 공개 문제가 없다.
- `question_no=51,52,53,54` 각각에 대해 실제 검수 완료 문제가 최소 1개 이상 있다.
- 공개 문제는 `publish_status='published'`, `review_status='approved'`, `visibility='public'`, `lifecycle_status='active'`를 만족한다.
- `/practice/problems`는 실제 공개 문제만 보여준다.
- `/writing/*` 제출은 실제 공개 문제에서만 성공한다.
- `legal_documents`에는 로그인/동의 흐름에 필요한 published 문서가 있으며, 배포 전 검증 대상에서는 `is_placeholder=true` 문서가 차단된다.
- 테스트 계정 데이터는 `SUPABASE_ENV_LABEL=prod` 대상에 적재하지 않는다.
- service role 또는 secret key는 브라우저 변수, 로그, 테스트 리포트, 문서에 출력하지 않는다.

## 도구 제안

- `scripts/predeploy-data-audit.mjs`: seed/fixture/placeholder 잔존 수를 세고, production 대상 실행을 기본 차단한다.
- 이후 단계에서 별도 도구를 추가한다면:
  - 실제 문제 데이터 적재 도구
  - 테스트 계정 시나리오 적재 도구
  - dry-run 기본값의 fixture 정리 도구

## 검증 계획

- `pnpm exec vitest run tests/scripts/predeploy-data-audit.test.ts`
- 배포 전 Supabase 프로젝트 환경 변수로 `node scripts/predeploy-data-audit.mjs --json`
- 로그인 후 `/practice/problems`와 51~54번 작성 화면 Playwright 확인
- `pnpm lint`
- `pnpm typecheck`

## 검토한 대안

| 대안 | 판단 |
| --- | --- |
| 기존 seed 파일 삭제 | 이미 local reset과 migration history에 연결되어 있어 새 환경 재현성이 깨질 수 있으므로 거절 |
| fixture migration 파일 제거 | 적용된 DB와 새 DB의 migration history가 갈라져 위험하므로 거절 |
| 실제 운영 데이터 복사 | 개인정보와 동의 문제가 생길 수 있어 비식별 검수 데이터 중심으로 제한 |
| 앱 코드에서 seed tag만 숨김 | DB에는 여전히 공개 데이터가 남아 배포 전 검증 기준을 흐리므로 보조 수단으로만 허용 |

## 근거

- Supabase seed는 migration 이후 로컬 reset/start 경로에서 초기 데이터를 넣는 용도다.
- Supabase 공개 schema의 데이터는 API/RLS 정책과 함께 검증해야 하므로, seed 제거 여부만으로 공개 노출 여부를 판단할 수 없다.
