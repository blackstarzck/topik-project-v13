# Wireframe 문서 안내

이 폴더는 TALKPIK AI의 화면별 와이어프레임과 설명 문서를 모아 둔 곳입니다. IA 코드는 각 화면의 정보 구조를 구분하기 위한 코드이며, 각 화면 폴더의 `description.md`에 있는 `Source` 값을 기준으로 관리합니다.

사용자 흐름은 [../flow/user-flow.md](../flow/user-flow.md)가 기준입니다. 화면 이동 정보가 화면 문서와 충돌하면 사용자 흐름 문서를 우선합니다.

관리자 화면은 별도 관리자 앱(topik-ai) 소관이라 이 폴더에 없습니다(2026-06-11 와이어프레임 제거). 자세한 경계는 [../admin-scope-boundary.md](../admin-scope-boundary.md)를 따릅니다.

각 화면 폴더에는 보통 다음 파일이 있습니다.

| 파일 | 설명 |
| --- | --- |
| `description.md` | 화면의 목적, 주요 UI 영역, 상태, 버튼, navigation을 설명합니다. |
| `functional-spec.md` | 화면 기능, 권한, 데이터 사용, 현재 코드 구현 근거를 설명합니다. |
| `screen-data-summary.md` | 있는 폴더에서만 화면 데이터 계약을 요약합니다. |
| `wireframe.png` | 있는 폴더에서만 화면 배치 이미지를 제공합니다. |

## Flow와 IA의 관계

`docs/flow/user-flow.md`는 사용자가 화면 사이를 이동하는 순서를 정의합니다. 각 `description.md`는 그 흐름을 화면 단위로 풀어서 설명합니다.

`functional-spec.md`는 `description.md`와 현재 `src/` 코드에서 확인되는 구현 근거를 함께 반영합니다. 코드에서 확인되지 않은 동작은 기능명세에 확정 구현처럼 적지 않습니다.

## 화면 문서 목록

| 단계 | 화면 | Source | 문서 |
| --- | --- | --- | --- |
| 시작 | 회원가입 | 01 A-01 회원가입 | [description.md](./01-A-01-sign-up/description.md) |
| 시작 | 로그인 | 02 A-02 로그인 | [description.md](./02-A-02-login/description.md) |
| 시작 | 학습 목표 설정 | 03 A-03 학습 목표 설정 | [description.md](./03-A-03-learning-goal-setup/description.md) |
| 홈 | 홈 대시보드 | 04 B-01 홈 대시보드 | [description.md](./04-B-01-home-dashboard/description.md) |
| 문제 선택 | 문제 유형 추천 | 05 C-01 문제 유형 추천 | [description.md](./05-C-01-problem-type-recommendations/description.md) |
| 문제 선택 | 문제 목록 | 06 C-02 문제 목록 | [description.md](./06-C-02-problem-list/description.md) |
| 문제 선택 | 다시 풀기 모달 | 07 C-03 다시 풀기 모달 | [description.md](./07-C-03-retry-modal/description.md) |
| 답안 작성 | 51번 단답 작성 | 08 D-01 51번 단답 작성 | [description.md](./08-D-01-short-answer-writing-51/description.md) |
| 답안 작성 | 52번 답안 작성 | 09 D-02 52번 답안 작성 | [description.md](./09-D-02-answer-writing-52/description.md) |
| 답안 작성 | 53번 장문 작성 | 10 D-03 53번 장문 작성 | [description.md](./10-D-03-long-form-writing-53/description.md) |
| 답안 작성 | 54번 에세이 작성 | 11 D-04 54번 에세이 작성 | [description.md](./11-D-04-essay-writing-54/description.md) |
| 답안 작성 | 제출 확인 모달 | 12 D-M1 제출 확인 모달 | [description.md](./12-D-M1-submission-confirmation-modal/description.md) |
| 답안 작성 | AI 분석 로딩 | 13 D-M2 AI 분석 로딩 | [description.md](./13-D-M2-ai-analysis-loading/description.md) |
| 피드백 | 단답 피드백 | 14 E-01 단답 피드백 | [description.md](./14-E-01-short-answer-feedback/description.md) |
| 피드백 | 장문 피드백 | 15 E-02 장문 피드백 | [description.md](./15-E-02-long-form-feedback/description.md) |
| 리포트 | 비교 리포트 | 16 R-01 비교 리포트 | [description.md](./16-R-01-comparison-report/description.md) |
| 리포트 | 다음 문제 추천 | 17 R-02 다음 문제 추천 | [description.md](./17-R-02-next-problem-recommendation/description.md) |
| 보관함 | 내 서재 | 18 F-01 내 서재 | [description.md](./18-F-01-my-library/description.md) |
| 보관함 | PDF 내보내기 모달 | 19 F-M1 PDF 내보내기 모달 | [description.md](./19-F-M1-pdf-export-modal/description.md) |
| 설정 | 설정 언어 | 20 G-01 설정 언어 | [description.md](./20-G-01-language-settings/description.md) |
| 작성 보조 | 자동저장 경고 | 22 D-M3 자동저장 경고 | [description.md](./22-D-M3-autosave-warning/description.md) |
| 확장 | 제품 랜딩 | 23 X-01 제품 랜딩 | [description.md](./23-X-01-product-landing/description.md) |
| 확장 | 성장 대시보드 | 24 X-02 성장 대시보드 | [description.md](./24-X-02-growth-dashboard/description.md) |
| 확장 | 페이월 | 25 X-03 페이월 | [description.md](./25-X-03-paywall/description.md) |
| 확장 | 구독 관리 | 26 X-04 구독 관리 | [description.md](./26-X-04-subscription-management/description.md) |
| 확장 | 프로필 편집 | 27 X-05 프로필 편집 | [description.md](./27-X-05-profile-editing/description.md) |
| 확장 | 비밀번호 재설정 | 28 X-06 비밀번호 재설정 | [description.md](./28-X-06-password-reset/description.md) |
| 확장 | 약점 기반 추천 | 29 X-07 약점 기반 추천 | [description.md](./29-X-07-weakness-based-recommendations/description.md) |
| 확장 | 알림 설정 | 31 X-09 알림 설정 | [description.md](./31-X-09-notification-settings/description.md) |
| 확장 | 인증 에러 | 33 X-11 인증 에러 | [description.md](./33-X-11-auth-error/description.md) |
| 확장 | 인증 메일 확인 안내 | 34 X-12 인증 메일 확인 안내 | [description.md](./34-X-12-auth-verify-email/description.md) |
| 추가 화면 | 이용약관 | 35 X-13 이용약관 | [description.md](./35-X-13-terms/description.md) |
| 추가 화면 | 개인정보처리방침 | 36 X-14 개인정보처리방침 | [description.md](./36-X-14-privacy-policy/description.md) |
| 추가 화면 | 새 비밀번호 설정 | 38 X-16 새 비밀번호 설정 | [description.md](./38-X-16-password-reset-confirm/description.md) |
| 추가 화면 | 인증 콜백 fragment 처리 | 39 X-17 인증 콜백 fragment 처리 | [description.md](./39-X-17-auth-callback-fragment/description.md) |
| 추가 화면 | 소셜 로그인 약관 동의 | 40 X-18 소셜 로그인 약관 동의 | [description.md](./40-X-18-auth-consent/description.md) |

> 33-40번은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다. 일부 코드 기반 추가 화면은 `wireframe.png`가 없을 수 있으며, 해당 경우 각 `description.md`에 이미지 없음 상태를 명시합니다. 폴더 번호 21·30·32·37은 관리자 화면 제거(2026-06-11)로 결번입니다.

## AI에게 지시할 때

`docs/Wireframe/README.md`에서 관련 화면을 찾고, 해당 `description.md`, `functional-spec.md`, 필요 시 `screen-data-summary.md`를 함께 확인합니다.

화면 이름을 바꾸거나 새 화면을 추가할 때는 [../flow/user-flow.md](../flow/user-flow.md), [../sitemap.md](../sitemap.md), 이 README의 Source 목록을 함께 맞춰야 합니다.
