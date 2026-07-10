# X-14 개인정보처리방침 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

회원가입 및 서비스 이용 전 개인정보 처리 범위를 확인할 수 있는 공개 route를 제공한다. 현재는 정식 개인정보보호 검토 전 placeholder다.

## 사용자와 권한

- Audience: public
- 세션 없이 접근 가능해야 한다.
- 권한 기준: public route이며 인증 세션이 없어도 접근할 수 있어야 한다.

## 진입/이탈 흐름

- Route: `/privacy`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: X-01 제품 랜딩, X-13 이용약관, A-01 회원가입, 직접 `/privacy` 접근.
- 이탈 경로: 이용약관 링크는 X-13, 돌아가기는 X-01 또는 호출한 화면으로 이동한다.
- 화면 내부 동작: 개인정보처리방침 본문 읽기와 섹션 확인을 처리한다.

## 주요 기능

- 임시 개인정보처리방침 안내
- 수집 항목/이용 목적/보관 기간/제3자 제공 범위 요약 (전화번호·성별은 선택 수집 항목으로 명시)
- 외부 LLM 전송 가능성 고지
- 관련 법적 문서와 가입/홈 링크 제공

## 상태/오류

- 개인정보 민감 copy는 구현된 범위만 말하고 미확정 정책을 단정하지 않는다.

## 데이터 사용

- 발행된 개인정보처리방침 문서를 `legal_documents`에서 read-only로 조회한다(force-dynamic, published + admin-projected/placeholder만 신뢰).
- 발행 문서가 없거나 placeholder면 정적 fallback 카드(i18n)를 렌더링하며, 어느 경우에도 사용자별 데이터는 조회/쓰기하지 않는다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `legal_documents` | `id`, `doc_type`, `version`, `locale`, `title`, `summary`, `body`, `effective_at`, `status`, `is_placeholder`, `source_policy_id` | select | 발행된 privacy 문서를 locale 기준(요청 locale 없으면 ko fallback)으로 조회해 표시. 없거나 placeholder면 정적 i18n fallback. | public/published read (anon-readable RLS) | `src/app/privacy/page.tsx`<br>`src/lib/legal/documents.ts` | 정책 동의/삭제 요청 저장은 미정 |

## 현재 구현 상태

- `src/app/privacy/page.tsx`는 발행된 privacy `legal_documents`가 있으면 `LegalDocument`로 본문을 렌더링하고, 없거나 placeholder면 5개 영역(제목 / 임시 안내 / 처리 항목 요약 / 갱신 안내 / 관련 링크) fallback 카드를 description 매핑과 1:1로 표시한다. 처리 항목 요약에는 전화번호(선택)·성별(선택) 수집이 포함된다.
- 데이터 읽기/쓰기가 없는 server component이며, antd 컴포넌트를 쓰지 않으므로 `"use client"`가 필요 없다(정적 legal 페이지 house convention — home/terms 와 동일).
- `src/lib/routes.ts`의 `PUBLIC_PATHS`에 `/privacy`가 포함되어 anonymous 접근이 허용된다.
- `/sign-up` 동의 체크박스 라벨이 `target="_blank"`로 본 페이지를 연다(`src/components/auth/SignUpForm.tsx`).
- 정식 처리방침과 알림/재동의 운영 절차는 아직 확정되지 않았다.

## 코드 구현 근거

- `PrivacyPage` - `src/app/privacy/page.tsx`

## 미구현/불일치

- 정식 개인정보처리방침 문안은 아직 없다.
- 정책 버전, 동의 이력, 데이터 삭제 요청 흐름은 현재 별도 기능으로 구현되어 있지 않다.

## 추가 발견 후보

- 개인정보 처리방침 versioning과 consent log가 필요하면 별도 DB 설계가 필요하다.
- 외부 LLM 제공자별 보관 정책을 정식 문서에 연결해야 한다.

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/privacy`는 세션 없이 열리고 사용자별 데이터를 조회하지 않는다.
- 수집 항목(전화번호·성별 선택 수집 포함), 이용 목적, 보관 기간, 외부 LLM 전송 가능성이 fallback/발행 문서 범위 안에서 드러난다.
- 정식 게시 시 갱신 및 가입자 안내 예정임을 별도 안내로 표시한다.
- `/terms`, `/`, `/sign-up` 이동 링크가 유지된다.
