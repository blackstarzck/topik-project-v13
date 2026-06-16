# X-18 소셜 로그인 약관 동의 화면 데이터 계약

## 화면 요약

Google OAuth 같은 소셜 로그인 이후, 사용자가 서비스 필수 약관에 아직 동의하지 않았다면 `/auth/consent`에서 동의를 받고 `user_consents`에 저장한다.

이 문서는 `docs/Wireframe/35-X-13-terms`의 legal 화면 설명 방식을 참고하되, X-18이 공개 약관 페이지가 아니라 인증된 사용자용 동의 게이트라는 차이를 명시한다.

## 기준 소스

| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | `docs/flow/user-flow.md` | Google OAuth 후처리 흐름 |
| 2 | `docs/ia.md` | `/auth/consent` route와 audience |
| 3 | 관련 auth Wireframe 기능명세와 `src/app/auth/` | 인증 흐름과 코드 매핑 |
| 4 | `src/lib/legal/consent.ts` | legal document 조회와 consent 저장 |
| 5 | `supabase/migrations/20260608120000_legal_documents_and_consents.sql` | DB 테이블/RLS 계약 |

## 사용자에게 표시되는 데이터

- 화면 제목
- 소셜 로그인 후 필수 약관 동의가 필요하다는 설명
- 미동의 필수 문서 목록
- 약관/개인정보 문서 제목, 요약, 본문
- 동의 체크박스
- 계속 버튼
- 체크 누락 안내

## 사용자 입력/상태 데이터

- `accept`: 필수 동의 체크박스 값
- `next`: 동의 후 돌아갈 상대 경로
- `error=required`: 체크 누락 상태 표시

## 운영/관리 대상 데이터 계약

| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 필수 약관 문서 | DB 계약 있음 | `legal_documents.status='published'` and `requires_consent=true` | locale별 최신 문서를 사용한다. |
| 사용자 동의 이력 | DB 계약 있음 | `user_consents`에 insert | append-only 성격이며 UPDATE/DELETE 정책이 없다. |
| 동의 출처 | DB 계약 있음 | `source='signup'` | 소셜 로그인 후 최초 진입 동의도 가입 흐름 동의로 본다. |
| 소셜 provider token | 저장하지 않음 | 앱 DB에 저장하지 않는다 | token이나 raw provider error는 UI에 노출하지 않는다. |

## Supabase 테이블 스키마 정보

### `legal_documents`

- 사용 방식: select
- 주요 컬럼: `id`, `doc_type`, `version`, `locale`, `title`, `summary`, `body`, `requires_consent`, `status`, `effective_at`
- 화면 기능: 사용자에게 표시할 최신 필수 약관/개인정보 문서 계산
- 권한/RLS: published row는 공개 read 가능

### `user_consents`

- 사용 방식: select + insert
- 주요 컬럼: `user_id`, `document_id`, `doc_type`, `version`, `source`, `accepted_at`
- 화면 기능: 이미 동의한 문서 제외, 새 동의 이력 저장
- 권한/RLS: owner read + owner insert
- 불변성: UPDATE/DELETE 정책 없음

## 저장/조회 이벤트 흐름

1. `/auth/post-auth`가 현재 사용자와 profile을 확인한다.
2. `legal_documents`에서 최신 published required 문서를 조회한다.
3. `user_consents`에서 사용자가 이미 동의한 문서를 조회한다.
4. 누락 문서가 있으면 `/auth/consent?next=...`로 이동한다.
5. 사용자가 체크 후 계속한다.
6. 누락 문서만 `user_consents`에 insert한다.
7. `next`로 돌아가 학습 목표 또는 대시보드 라우팅을 계속한다.

## RLS/권한 기준

- 이 화면은 public route가 아니다.
- 세션이 있는 사용자만 자기 동의 이력을 읽고 추가할 수 있다.
- service role key는 클라이언트에 노출하지 않는다.
- 문서 조회는 published document 정책에 기대며, 동의 저장은 owner insert 정책에 기대야 한다.

## 스키마 정합성 메모

- 테이블 생성 migration: `supabase/migrations/20260608120000_legal_documents_and_consents.sql`
- 초기 published placeholder seed: `supabase/migrations/20260610104017_seed_initial_legal_documents.sql`
- published read 정책 보정: `supabase/migrations/20260612221000_fix_legal_documents_public_read_policy.sql`

## 검증 필요 항목

- OAuth 신규 사용자에서 미동의 시 X-18로 이동하는지
- 기존 동의 사용자는 X-18을 건너뛰는지
- 체크 없이 제출하면 insert가 발생하지 않는지
- 체크 후 제출하면 `user_consents`에 누락 문서 수만큼 기록되는지
- `next`가 외부 URL로 악용되지 않는지
