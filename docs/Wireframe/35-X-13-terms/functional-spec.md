# X-13 이용약관 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

회원가입 약관 동의 대상 문서를 공개 route로 제공한다. 현재는 정식 법무 검토 전 placeholder이며, 운영 전 공식 약관으로 교체되어야 한다.

## 사용자와 권한

- Audience: public
- 세션 없이 접근 가능해야 한다.
- 권한 기준: public route이며 인증 세션이 없어도 접근할 수 있어야 한다.

## 진입/이탈 흐름

- Route: `/terms`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: X-01 제품 랜딩의 약관 링크, A-01 회원가입의 약관 확인, 직접 `/terms` 접근.
- 이탈 경로: 개인정보처리방침 링크는 X-14, 돌아가기는 X-01 또는 호출한 화면으로 이동한다.
- 화면 내부 동작: 약관 본문 읽기와 섹션 확인을 처리한다.

## 주요 기능

- 임시 이용약관 placeholder 안내 (정식 약관 미확정 명시)
- 서비스 성격과 학습 데이터 사용 목적 요약
- 개인정보처리방침(`/privacy`) 링크
- 운영 문의 채널 부재 안내 (꾸며내지 않음)
- 홈/회원가입/개인정보처리방침 escape 링크

## 상태/오류

- 법무 검토 전 문구임을 명확히 표시한다.

## 데이터 사용

- 직접 DB 읽기/쓰기를 하지 않는다.
- 현재 직접 DB 사용 근거 없음.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | 현재 직접 DB 사용 근거 없음 | public route | `src/app/terms/page.tsx` | 약관 동의 이력 저장은 미정 |

## 현재 구현 상태

- `src/app/terms/page.tsx`(server)가 antd Typography/Card 기반 placeholder를 렌더링한다.
- `src/lib/routes.ts`의 `PUBLIC_PATHS`에 `/terms`가 이미 포함되어 세션 없이 접근 가능하다.
- 사이트맵의 sibling legal 화면 `/privacy`(X-14)와 동일한 단일 컬럼 레이아웃·톤을 공유한다.
- 정식 약관 내용과 운영 문의 채널은 아직 확정되지 않았다 (placeholder 명시 유지).

## 코드 구현 근거

- `TermsPage` - `src/app/terms/page.tsx`
- `TermsContent` - `src/components/legal/TermsContent.tsx`

## 미구현/불일치

- 정식 법무 검토 약관은 아직 없다.
- 약관 버전, 동의 시각, 재동의 정책 저장은 현재 별도 DB 명세가 없다.

## 추가 발견 후보

- 회원가입 동의 로그를 저장하려면 별도 migration과 동의 이력 명세가 필요하다.
- 정식 약관 게시 시 A-01 회원가입 문구도 함께 갱신해야 한다.

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/terms`는 세션 없이 열리고 raw auth/provider 오류나 사용자 데이터를 노출하지 않는다.
- placeholder 상태와 정식 약관 미확정 상태를 사용자에게 숨기지 않는다.
- `/privacy`, `/`, `/sign-up` 이동 링크가 유지된다.
- 회원가입 동의 라벨과 랜딩 헤더 양쪽 진입점에서 `/terms`가 reachable 하다.
