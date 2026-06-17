# 2026-06-17 흐름별 미구현 TODO 인벤토리

## 목적

이 문서는 현재 코드베이스 조사 결과를 `docs/flow/user-flow.md`와 첨부된 제품 흐름 이미지의 1~6번 큰 카테고리 기준으로 다시 묶은 TODO 인벤토리다.

기존 SOT 문서를 직접 수정하지 않고, `docs/todo/` 아래에 별도 기록으로 둔다. `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`에서 이미 보류하기로 결정한 항목은 active TODO와 분리한다.

## 적용 기준

- `구현됨`은 route/page 또는 hosted modal이 현재 `src/app`에 있고, `src/lib/routes.ts`의 route map과 연결되는 상태를 뜻한다.
- `active TODO`는 보류 결정 범위 밖에서 사용자-facing 동작이 부분 구현, stub, disabled, placeholder, 또는 누락된 상태를 뜻한다.
- `보류 TODO`는 현재 개발 완료 기능처럼 취급하지 않고 "준비중", "개발중", "출시 예정"으로 표시하거나 MVP 기준에서는 숨겨야 하는 항목이다.
- 결제 provider checkout, 구독 provider write-back, 외부 알림 transport, 정식 법무 문서, 실제 LLM 첨삭/분석, AI 사용량 한도, 작성 중 AI 대화 피드백은 2026-06-17 스코프 결정에 따라 보류다.

## 요약

| 번호 | 큰 카테고리 | 현재 판단 | Active TODO | 보류/스코프 메모 |
| --- | --- | --- | ---: | --- |
| 1 | 시작 / 인증 | 대부분 구현 | 2 | 정식 법무 문구는 보류 |
| 2 | 홈 / 대시보드 | 대부분 구현 | 0 | 피드백 데이터 품질에 의존 |
| 3 | 문제 선택 | 부분 구현 | 3 | C-01은 페이지는 있으나 추천 데이터/정책 TODO가 남음 |
| 4 | 답안 작성 | 화면/제출 흐름 대부분 구현 | 0 | 실제 AI 분석/작성 중 AI 피드백은 보류 |
| 5 | 피드백 / 복습 | 부분 구현 | 4 | AI를 제외해도 내 서재/PDF/복습 세트가 남음 |
| 6 | 설정 / 결제 | 설정은 부분 구현, 결제는 보류 | 3 | 외부 알림 transport와 결제 provider는 보류 |

## 1. 시작 / 인증

대상 화면: X-01, A-01, A-02, A-03, X-06, X-11, X-12, X-13, X-14, X-16, X-17, X-18.

### 현재 구현 범위

- A-01 회원가입, A-02 로그인, A-03 학습 목표 설정, X-06 비밀번호 재설정, X-11/X-12/X-16/X-17/X-18 인증 복구/동의 화면 route가 존재한다.
- 로그인, 회원가입, 이메일 인증 안내, 비밀번호 재설정 요청, callback error 처리, 소셜 로그인 약관 동의 화면이 route map에 잡혀 있다.

### Active TODO

| 우선순위 | 항목 | 판단 | 근거 |
| --- | --- | --- | --- |
| P3 | X-16 새 비밀번호 설정: recovery session 없는 직접 진입을 사전에 판별하는 guard 없음 | 부분 구현. 현재는 저장 시도 후 실패 알림을 보여주는 reactive 방식이다. | `docs/Wireframe/38-X-16-password-reset-confirm/functional-spec.md`, `src/components/auth/PasswordResetConfirmForm.tsx` |
| P3 | X-11 인증 에러: dedicated help/support route 없음 | 부분 구현. Wireframe은 도움말 escape route를 포함하지만, 실제 도움말/지원 화면이 없어 UI에서 제외한다. | `docs/Wireframe/33-X-11-auth-error/description.md`, `src/components/auth/AuthErrorCard.tsx` |

### 보류 / 이번 TODO에서 제외

- X-13 이용약관, X-14 개인정보처리방침은 placeholder/legal draft 상태다.
- 정식 법무 문구, 정책 versioning, 재동의 정책, 데이터 삭제 요청 흐름은 보류 범위로 본다.

## 2. 홈 / 대시보드

대상 화면: B-01 홈 대시보드, X-02 성장 대시보드.

### 현재 구현 범위

- B-01 홈 대시보드 route가 있고, 추천 학습/최근 첨삭/설정/프로필/알림/구독 흐름으로 진입한다.
- X-02 성장 대시보드 route가 있고, 현재 학습/피드백 데이터를 읽어 표시한다.

### Active TODO

이번 조사에서 보류 AI 기능을 제외한 별도 active 구현 gap은 확인되지 않았다.

### 보류 / 이번 TODO에서 제외

- 성장 지표 품질은 실제 피드백/채점 데이터에 의존한다.
- 실제 AI 채점/분석이 보류인 동안에는 대시보드가 production AI 정확도를 보장하는 것처럼 표현하면 안 된다.

## 3. 문제 선택

대상 화면: C-01 문제 유형 추천, C-02 문제 목록, C-03 다시 풀기 모달.

### 현재 구현 범위

- C-01 route는 `/practice/recommendations`에 존재한다.
- C-01은 `recommendation_runs`, `recommendation_items`를 읽고, 데이터가 없으면 fallback 추천 패널과 직접 유형 선택 카드를 보여준다.
- C-02 route는 `/practice/problems`에 존재한다.
- C-03은 C-02에서 열리는 hosted modal이며, 새 답안/이전 답안 기반 재풀이 흐름을 지원한다.

### Active TODO

| 우선순위 | 항목 | 판단 | 근거 |
| --- | --- | --- | --- |
| P1 | C-02 `추천만` 필터가 실제 RPC 결과에 적용되지 않음 | 부분 구현. UI와 URL에는 `recommended=1`이 반영되지만 현재 RPC path에서는 필터링하지 않는다. | `src/components/practice/ProblemListView.tsx`, `src/components/practice/problem-list-data.ts` |
| P1 | C-02 정렬 의미가 일부 축소됨 | 부분 구현. UI는 최신순/오래된순/난이도 오름차순/내림차순을 노출하지만 RPC는 `recent` 또는 `difficulty`로 매핑되어 일부 의미가 손실된다. | `src/components/practice/ProblemListControls.tsx`, `src/components/practice/problem-list-data.ts` |
| P2 | C-03 `힌트 포함` 재풀이 모드가 disabled 상태 | 부분 구현. 타입/UI에는 있으나 현재는 준비 중 안내와 함께 비활성화되어 있다. | `src/components/practice/RetryModal.tsx` |

### 사용자가 짚은 C-01 판단

C-01은 없는 페이지가 아니다. route, 추천 데이터 query, loading/error/empty 상태, fallback 유형 카드가 있다.

다만 "문제 유형 추천"이라는 제품 기대치 기준에서는 아직 완성도가 낮다. active recommendation data가 없으면 실제 개인화 추천이 아니라 정적 fallback과 직접 작성 화면 진입으로 대체된다. 따라서 C-01은 "페이지 미구현"이 아니라 "추천 데이터 생성/갱신 정책과 추천 품질 TODO"로 본다.

### 보류 / 이번 TODO에서 제외

- C-01 추천 생성이 실제 LLM 분석에 의존하도록 바뀐다면 그 생성 부분은 보류 범위다.
- 저장된 추천 또는 rule-based 추천 표시 자체는 active scope로 볼 수 있다.

## 4. 답안 작성

대상 화면: D-01~D-04 작성 화면, D-M1 제출 확인, D-M2 AI 분석 로딩, D-M3 자동저장 경고.

### 현재 구현 범위

- 51~54번 작성 route는 `/writing/*` 계열로 존재한다.
- 임시저장, 제출 확인, 제출 저장, 자동저장 경고 hosted modal 흐름이 현재 source에 있다.

### Active TODO

이번 조사에서 보류 AI 기능을 제외한 별도 active 구현 gap은 확인되지 않았다.

### 보류 / 이번 TODO에서 제외

- D-M2 실제 비동기 AI 분석 pipeline은 보류다.
- 작성 중 AI 대화 피드백 최대 3턴은 보류다.
- 실제 AI 분석이 끝난 것처럼 보이는 copy는 "준비중/개발중/출시 예정"으로 바꾸거나 숨겨야 한다.

## 5. 피드백 / 복습

대상 화면: E-01/E-02 피드백, R-01 비교 리포트, R-02 다음 문제 추천, X-07 약점 기반 추천, F-01 내 서재, F-M1 PDF 내보내기.

### 현재 구현 범위

- E-01/E-02 피드백 route는 `/writing/feedback/*/:id`에 존재한다.
- R-01 비교 리포트 route가 존재한다.
- R-02 다음 문제 추천 route가 존재하고 문제 선택/작성 흐름으로 돌아간다.
- X-07 약점 기반 추천 route가 존재한다.
- F-01 내 서재와 F-M1 PDF modal/API가 존재한다.

### Active TODO

| 우선순위 | 항목 | 판단 | 근거 |
| --- | --- | --- | --- |
| P1 | PDF 월 3회 제한 미구현 | 누락. 기획 문서에는 PDF 내보내기 월 3회와 월별 reset이 있지만, 현재 PDF 코드는 1회 선택 항목 수만 제한한다. | `docs/development-core-planning/07-storage-payment-notifications/README.md`, `src/lib/export/pdf-options.ts` |
| P1 | F-M1 `library_selection` PDF 범위가 submission으로 제한됨 | 부분 구현. 저장 답안은 PDF 변환 가능하지만 리포트/문제 묶음 병합은 후속이다. | `docs/Wireframe/19-F-M1-pdf-export-modal/functional-spec.md`, `src/lib/export/pdf-export-server.ts` |
| P1 | F-01 export history 재다운로드가 부분 구현 | 부분 구현. `browser_print`가 아닌 export row는 storage queue/history download 완성 전까지 disabled placeholder 버튼을 보여준다. | `src/components/library/LibraryExportsTab.tsx` |
| P2 | F-01 복습 세트 생성에 durable play/use flow가 없음 | 부분 구현. `study_events`에 intent만 기록하고, 전용 `review_sets` entity나 start-review route가 없다. | `src/components/library/review-set-data.ts` |

### 사용자가 짚은 피드백 / 복습 판단

5번 피드백/복습 영역은 보류 AI를 제외하고도 가장 미완성에 가깝다. 피드백과 리포트 페이지는 존재하지만, 복습 루프를 완성하는 내 서재/PDF/복습 세트 기능이 아직 부족하다.

### 보류 / 이번 TODO에서 제외

- 실제 LLM 기반 피드백, 채점, 문장 분석, AI 피드백 품질은 보류다.
- AI 첨삭 사용량 한도는 보류다.
- 고급 유료 비교 분석은 별도 스코프 결정 전까지 보류로 본다.

## 6. 설정 / 결제

대상 화면: G-01 설정 언어, X-05 프로필 편집, X-09 알림 설정, X-03 페이월, X-04 구독 관리, 흐름 이미지에 연결된 X-02/X-07.

### 현재 구현 범위

- G-01 언어 설정은 UI 언어, 학습 언어, 콘텐츠 선호를 저장한다.
- X-05 프로필 편집은 프로필 텍스트 저장과 `avatars` bucket 아바타 업로드를 포함한다.
- X-09 알림 설정은 알림 선호, 스케줄, 채널 선호를 저장한다.
- X-03 페이월과 X-04 구독 관리는 존재하지만 결제 provider 동작은 deferred surface다.

### Active TODO

| 우선순위 | 항목 | 판단 | 근거 |
| --- | --- | --- | --- |
| P2 | G-01 UI 언어 적용 범위가 incremental 상태 | 부분 구현. locale 저장과 refresh는 있으나, 아직 마이그레이션되지 않은 화면 문구는 원문 언어로 남을 수 있다는 안내가 있다. | `src/components/settings/LanguageForm.tsx` |
| P2 | X-09 timezone 편집 UI 없음 | 부분 구현. `notification_settings.timezone` 계약은 있으나, 알림 설정 문서는 timezone 편집 UI가 없다고 기록한다. | `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`, `src/components/settings/learning-settings-data.ts` |
| P3 | X-05 아바타 삭제/기본 이미지 정책 미확정 | 정책 gap. 업로드는 구현되어 있지만, 아바타 삭제 시 `avatar_path`를 null로 둘지 기본 이미지로 둘지 결정이 남아 있다. | `docs/Wireframe/27-X-05-profile-editing/screen-data-summary.md`, `src/components/profile/avatar-upload.ts` |

### 사용자가 짚은 설정 판단

"설정" 부분은 없는 상태가 아니라 부분 구현 상태다.

- 언어 설정은 저장되지만 전체 UI 번역 적용 범위는 incremental이다.
- 알림 설정은 선호/스케줄 저장이 되지만 timezone UI와 외부 transport가 남아 있다.
- 프로필 편집은 예상보다 구현이 많이 되어 있고, 아바타 업로드도 실제 Supabase Storage에 연결되어 있다. 남은 부분은 삭제/기본 이미지 정책이다.

### 보류 / 이번 TODO에서 제외

- X-03/X-04 실제 checkout, 결제수단 변경, 취소 flow write-back, provider 영수증, webhook은 보류다.
- X-09 email/Zalo/push 외부 발송 transport는 보류다.
- 외부 email/Zalo/push 발송이 구현/검증되기 전에는 UI에서 실제 발송 성공처럼 표현하면 안 된다.

## 권장 실행 순서

1. C-02 문제 목록 정확성부터 수정한다: `추천만` 필터와 정렬 의미는 문제 선택 경험에 바로 영향을 준다.
2. F-01/F-M1 PDF와 내 서재 루프를 완성한다: 월 3회 제한, export history 재다운로드, PDF export 범위는 AI provider와 별개인 제품 약속이다.
3. 복습 세트 persistence/play flow를 정의한다: `review_sets` table, saved collection, 또는 query 기반 중 하나로 결정한다.
4. 설정 polish를 진행한다: G-01 번역 적용 범위 audit, X-09 timezone UI, X-05 아바타 삭제/기본 이미지 정책.
5. C-01 추천 데이터 생성/refresh 정책은 rule-based로 갈지, deferred AI scope가 열릴 때까지 기다릴지 먼저 결정한다.

## 검증 메모

- route/page 존재 여부는 `src/lib/routes.ts`와 현재 `src/app` path 기준으로 확인했다.
- 1~6 큰 카테고리는 `docs/flow/user-flow.md`, `docs/flow/sitemap.md`, `docs/Wireframe/README.md`, 첨부 이미지의 흐름을 맞춰 정리했다.
- 기존 SOT 문서는 수정하지 않았다.
