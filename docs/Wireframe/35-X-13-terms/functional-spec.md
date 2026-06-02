# X-13 이용약관 기능명세

> 이 화면은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.

## 화면 목적

회원가입 약관 동의 대상 문서를 공개 route로 제공한다. 현재는 정식 법무 검토 전 placeholder이며, 운영 전 공식 약관으로 교체되어야 한다.

## 진입/이탈 흐름

- Route: `/terms`
- Route type: page
- Audience: public
- 진입: 회원가입 약관 동의 라벨 또는 직접 URL.
- 이탈: `/`, `/sign-up`, `/privacy`.

## 주요 기능

- 임시 이용약관 안내
- 서비스 성격과 데이터 사용 목적 요약
- 개인정보처리방침 링크
- 홈/회원가입 복귀 링크

## 상태/오류/권한

- 세션 없이 접근 가능해야 한다.
- 직접 DB 읽기/쓰기를 하지 않는다.
- 법무 검토 전 문구임을 명확히 표시한다.

## 현재 구현 상태

- `src/app/terms/page.tsx`가 placeholder 페이지를 렌더링한다.
- `src/lib/routes.ts`의 `PUBLIC_PATHS`에 `/terms`가 포함되어야 한다.
- 정식 약관 내용과 운영 문의 채널은 아직 확정되지 않았다.

## 미구현/불일치

- 정식 법무 검토 약관은 아직 없다.
- 약관 버전, 동의 시각, 재동의 정책 저장은 현재 별도 DB 명세가 없다.

## 추가 발견 후보

- 회원가입 동의 로그를 저장하려면 별도 migration과 동의 이력 명세가 필요하다.
- 정식 약관 게시 시 A-01 회원가입 문구도 함께 갱신해야 한다.

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | 현재 직접 DB 사용 근거 없음 | public route | `src/app/terms/page.tsx` | 약관 동의 이력 저장은 미정 |

## 수용 기준

- 기존 34개 Wireframe 이후 추가된 코드 기준 화면임을 명시한다.
- `/terms`는 세션 없이 열리고 raw auth/provider 오류나 사용자 데이터를 노출하지 않는다.
- placeholder 상태와 정식 약관 미확정 상태를 사용자에게 숨기지 않는다.
- `/privacy`, `/`, `/sign-up` 이동 링크가 유지된다.

## 검증 근거

- Description: `docs/Wireframe/35-X-13-terms/description.md`
- Route map: `docs/sitemap.md`
- Source: `src/app/terms/page.tsx`
- Route allowlist: `src/lib/routes.ts`
