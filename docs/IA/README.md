# Talkpik IA

Paper `IA-WIREFRAME`에서 추출한 IA 문서입니다.

## 문서 간 연결 규칙

`docs/flow/user-flow.md`는 사용자가 화면을 어떤 순서로 이동하는지 정의하는 사용자 흐름 문서입니다. 이 문서의 Mermaid 코드에 등장하는 페이지명은 `docs/IA/*/description.md`의 `Source` 값과 같은 페이지를 가리킵니다.

페이지 하나는 `docs/IA/{순번}-{페이지코드}-{영문-slug}/` 디렉토리 하나로 관리합니다. 각 페이지 디렉토리는 최소한 다음 파일을 포함합니다.

- `description.md`: 페이지의 상세 IA와 화면 구성 설명.
- `wireframe.png`: 해당 설명을 바탕으로 제작될 화면 기준 이미지.

`description.md` 상단의 메타 정보는 다음 규칙을 따릅니다.

```md
# 회원가입

- Source: 01 A-01 회원가입
- Code: A-01
- Wireframe: ![회원가입 wireframe](./wireframe.png)
```

- `Source`는 Mermaid 코드의 페이지명과 일치해야 합니다. 예: `01 A-01 회원가입`.
- `Code`는 페이지 식별 코드입니다. 예: `A-01`.
- IA 폴더명은 `Source`의 앞 순번과 `Code`를 하이픈 형태로 보존하고, 마지막에 영문 slug를 붙입니다. 예: `01-A-01-sign-up`.
- `README.md`의 페이지 목록 링크 텍스트도 `Source`와 같은 이름을 사용합니다.
- `wireframe.png`는 같은 페이지 디렉토리 안에 두고, `description.md`에서 상대 경로 `./wireframe.png`로 참조합니다.

따라서 동일 페이지는 다음 네 값으로 추적합니다.

| 기준 | 예시 | 역할 |
| --- | --- | --- |
| Mermaid 페이지명 | `01 A-01 회원가입` | 사용자 흐름에서 노드/페이지를 식별 |
| IA 디렉토리명 | `01-A-01-sign-up` | 파일 시스템에서 페이지 산출물을 묶는 단위 |
| `description.md` Source | `01 A-01 회원가입` | Mermaid 페이지명과 IA 상세 문서를 연결 |
| `description.md` Code | `A-01` | 구현, 라우트, 컴포넌트 논의에서 쓰는 짧은 식별자 |

새 페이지를 추가하거나 이름을 바꿀 때는 Mermaid 페이지명, IA 디렉토리명, `description.md`의 `Source`/`Code`, 아래 목차 링크를 함께 갱신해야 합니다.

## 페이지 목록

- [01 A-01 회원가입](./01-A-01-sign-up/description.md)
- [02 A-02 로그인](./02-A-02-login/description.md)
- [03 A-03 학습 목표 설정](./03-A-03-learning-goal-setup/description.md)
- [04 B-01 홈 대시보드](./04-B-01-home-dashboard/description.md)
- [05 C-01 문제 유형 추천](./05-C-01-problem-type-recommendations/description.md)
- [06 C-02 문제 목록](./06-C-02-problem-list/description.md)
- [07 C-03 다시 풀기 모달](./07-C-03-retry-modal/description.md)
- [08 D-01 51번 단답 작성](./08-D-01-short-answer-writing-51/description.md)
- [09 D-02 52번 답안 작성](./09-D-02-answer-writing-52/description.md)
- [10 D-03 53번 장문 작성](./10-D-03-long-form-writing-53/description.md)
- [11 D-04 54번 에세이 작성](./11-D-04-essay-writing-54/description.md)
- [12 D-M1 제출 확인 모달](./12-D-M1-submission-confirmation-modal/description.md)
- [13 D-M2 AI 분석 로딩](./13-D-M2-ai-analysis-loading/description.md)
- [14 E-01 단답 피드백](./14-E-01-short-answer-feedback/description.md)
- [15 E-02 장문 피드백](./15-E-02-long-form-feedback/description.md)
- [16 R-01 비교 리포트](./16-R-01-comparison-report/description.md)
- [17 R-02 다음 문제 추천](./17-R-02-next-problem-recommendation/description.md)
- [18 F-01 내 서재](./18-F-01-my-library/description.md)
- [19 F-M1 PDF 내보내기 모달](./19-F-M1-pdf-export-modal/description.md)
- [20 G-01 설정 언어](./20-G-01-language-settings/description.md)
- [21 H-01 관리자 문제 관리](./21-H-01-admin-problem-management/description.md)
- [22 D-M3 자동저장 경고](./22-D-M3-autosave-warning/description.md)
- [23 X-01 제품 랜딩](./23-X-01-product-landing/description.md)
- [24 X-02 성장 대시보드](./24-X-02-growth-dashboard/description.md)
- [25 X-03 페이월](./25-X-03-paywall/description.md)
- [26 X-04 구독 관리](./26-X-04-subscription-management/description.md)
- [27 X-05 프로필 편집](./27-X-05-profile-editing/description.md)
- [28 X-06 비밀번호 재설정](./28-X-06-password-reset/description.md)
- [29 X-07 약점 기반 추천](./29-X-07-weakness-based-recommendations/description.md)
- [30 X-08 기관 관리자 대시보드](./30-X-08-organization-admin-dashboard/description.md)
- [31 X-09 알림 설정](./31-X-09-notification-settings/description.md)
- [32 X-10 관리자 사용자 관리](./32-X-10-admin-user-management/description.md)
