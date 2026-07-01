# GA4 Learning Funnel Analytics

## 목적

TALKPIK AI의 Google Analytics 4 설정 목적은 단순 방문자 수 집계가 아니라, 사용자가 TOPIK 쓰기 문제를 푸는 흐름에서 어디까지 도달하고 어디서 이탈하는지 확인하는 것이다.

주요 분석 목표는 다음과 같다.

- 사용자 유입 분석: 사용자가 어떤 채널, 기기, 브라우저로 들어오는지 확인한다.
- 학습 퍼널 분석: `문제 시작 -> 답안 제출 -> 피드백 확인 -> 다시 풀기/다음 문제/비교 리포트` 전환률을 확인한다.
- 문제 인기도 분석: 어떤 `question_no`, 어떤 `problem_id`가 많이 풀리는지 확인한다.
- CTA 행동 분석: 피드백 화면과 비교 리포트 화면에서 어떤 버튼을 누르는지 확인한다.
- API 품질 분석: 주요 API의 성공/실패 상태와 응답 시간을 확인한다.
- 개인정보 보호: 답안 원문, 이메일, 사용자 ID, 제출 ID 등 개인 식별 가능하거나 학습자 소유 콘텐츠인 값은 GA로 보내지 않는다.

## 적용 위치

| 위치 | 역할 |
| --- | --- |
| `src/app/layout.tsx` | 모든 페이지에 `GoogleAnalyticsTags`를 삽입한다. |
| `src/components/analytics/GoogleAnalyticsTags.tsx` | `NEXT_PUBLIC_GA_MEASUREMENT_ID`가 유효할 때 GA4 `gtag.js`를 로드한다. |
| `src/lib/analytics/google-analytics.ts` | GA 이벤트 이름, 파라미터 필터링, 버튼/API/학습 이벤트 전송 유틸리티를 관리한다. |
| `src/lib/events/study-events.ts` | 기존 내부 `study_events`를 GA4 이벤트로 안전하게 미러링한다. |
| `src/components/feedback/FeedbackPageContent.tsx` | 피드백 결과 화면 조회를 기록한다. |
| `src/components/feedback/NextActionBar.tsx` | 피드백 화면의 주요 버튼 클릭과 비교 리포트 생성 API 결과를 기록한다. |
| `src/components/reports/ComparisonReportView.tsx` | 비교 리포트 화면의 주요 버튼 클릭을 기록한다. |
| `src/lib/writing/queries.ts` | 피드백 분석 상태 조회 API 결과를 기록한다. |
| `src/components/practice/recommendations-data.ts` | 추천 문제 API 결과를 기록한다. |
| `src/components/practice/writing-availability-data.ts` | 쓰기 가능 여부 API 결과를 기록한다. |
| `.env.example` | `NEXT_PUBLIC_GA_MEASUREMENT_ID` 환경변수 사용을 문서화한다. |

## 환경변수

GA4를 활성화하려면 환경별로 다음 값을 설정한다.

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

- 값이 비어 있거나 `G-...` 형식이 아니면 GA 스크립트를 렌더링하지 않는다.
- 이 값은 브라우저에 노출되는 GA4 웹 스트림 측정 ID이며 secret이 아니다.
- `.env.local` 또는 Vercel 환경변수에 설정한 뒤 Next.js dev server 또는 배포를 다시 시작해야 반영된다.

## 자동 수집

GA4 태그가 로드되면 Google Analytics가 기본적으로 아래 정보를 자동 수집한다.

| 값 | 의미 |
| --- | --- |
| `page_view` | 페이지 조회 |
| `session_start` | 세션 시작 |
| `first_visit` | 첫 방문 |
| `user_engagement` | 페이지 체류와 참여 정보 |
| device 정보 | desktop, mobile, tablet, 브라우저, OS 등 |
| acquisition 정보 | source, medium, channel, campaign 등 유입 경로 |

이 값들은 코드에서 직접 이벤트를 넣은 것이 아니라 GA4 기본/향상된 측정 영역에서 수집된다.

## 커스텀 이벤트 사전

| 이벤트 이름 | 언제 들어오는가 | 들어가는 주요 값 | 의미 |
| --- | --- | --- | --- |
| `practice_started` | 문제 풀이 화면을 시작할 때 | `problem_id`, `question_no` | 어떤 문제/유형을 시작했는지 |
| `answer_submitted` | 답안을 제출할 때 | `problem_id`, `question_no`, `char_count` | 어떤 문제를 제출했고 답안 길이가 어느 정도인지 |
| `feedback_viewed` | 피드백 화면이 실제 피드백 데이터와 함께 열릴 때 | `problem_id`, `question_no` | 제출 후 피드백까지 도달했는지 |
| `comparison_report_viewed` | 비교 리포트 화면을 조회할 때 | 안전 파라미터만 허용 | 비교 리포트까지 도달했는지 |
| `recommended_problem_clicked` | 추천/약점/다음 문제 목록에서 문제를 클릭할 때 | `problem_id`, `source` | 추천 흐름에서 어떤 문제를 클릭했는지 |
| `button_clicked` | 주요 버튼을 클릭할 때 | `button_id`, `surface`, `question_no`, `problem_id` | 어느 화면에서 어떤 CTA를 눌렀는지 |
| `api_request_finished` | 주요 API 요청이 끝날 때 | `api_name`, `api_status`, `http_status`, `duration_ms` | API 성공/실패/응답시간 |

## 파라미터 의미

| 파라미터 | 예시 | 의미 |
| --- | --- | --- |
| `problem_id` | `problem-uuid` | 문제 식별자. 어떤 문제가 많이 시작/제출/추천 클릭되는지 보기 위한 값이다. |
| `question_no` | `51`, `52`, `53`, `54` | TOPIK 쓰기 문항 번호. 유형별 사용량과 전환률을 보기 위한 값이다. |
| `char_count` | `612` | 제출 답안의 글자 수. 원문은 보내지 않고 길이만 보낸다. |
| `source` | `next`, `weakness` | 추천 문제가 어디에서 클릭됐는지 구분한다. |
| `button_id` | `feedback_retry` | 클릭한 버튼의 안정적인 식별자다. |
| `surface` | `feedback_report` | 버튼이 위치한 화면/영역이다. |
| `api_name` | `writing_evaluation_status` | 호출한 API를 URL이 아닌 안전한 이름으로 구분한다. |
| `api_status` | `success`, `error`, `network_error` | API 결과 상태다. |
| `http_status` | `200`, `500` | HTTP 응답 상태 코드다. |
| `duration_ms` | `438` | API 요청부터 응답까지 걸린 시간(ms)이다. |

## 버튼 값

| `button_id` | 위치 | 의미 |
| --- | --- | --- |
| `feedback_retry` | 피드백 화면 | 다시 풀기 |
| `feedback_next_problem` | 피드백 화면 | 다음 문제 풀기 |
| `feedback_compare_report` | 피드백 화면 | 비교 리포트 생성 |
| `feedback_export_pdf` | 피드백 화면 | 피드백 PDF 내보내기 |
| `feedback_save_library` | 피드백 화면 | 라이브러리에 저장 |
| `comparison_retry` | 비교 리포트 화면 | 다시 풀기 |
| `comparison_next` | 비교 리포트 화면 | 다음 문제 |
| `comparison_weakness` | 비교 리포트 화면 | 약점 문제 보기 |
| `comparison_share` | 비교 리포트 화면 | 공유 |

## API 값

| `api_name` | 의미 |
| --- | --- |
| `writing_evaluation_status` | 답안 제출 후 피드백 분석 상태 조회 |
| `practice_recommendations` | 추천 문제 목록 조회 |
| `practice_writing_availability` | 쓰기 문제 가능 여부 조회 |
| `create_comparison_report` | 비교 리포트 생성 요청 |

| `api_status` | 의미 |
| --- | --- |
| `success` | API 응답 성공 |
| `error` | 서버 응답은 왔지만 실패 상태 |
| `network_error` | 네트워크 오류 또는 요청 자체 실패 |

## 수집 예시

피드백 화면에서 다시 풀기 버튼을 누르면 다음처럼 수집된다.

```js
event_name: "button_clicked"
button_id: "feedback_retry"
surface: "feedback_report"
```

피드백 분석 상태 API가 성공하면 다음처럼 수집된다.

```js
event_name: "api_request_finished"
api_name: "writing_evaluation_status"
api_status: "success"
http_status: 200
duration_ms: 438
```

53번 문제 답안을 제출하면 다음처럼 수집된다.

```js
event_name: "answer_submitted"
problem_id: "problem-uuid"
question_no: 53
char_count: 612
```

## 퍼널 분석 예시

GA Explore의 Funnel exploration에서 다음 순서로 퍼널을 만들 수 있다.

```text
practice_started
-> answer_submitted
-> feedback_viewed
-> button_clicked
```

`button_clicked` 단계는 `button_id`로 나눠 보면 된다.

| 분석하려는 전환 | 조건 |
| --- | --- |
| 다시 풀기 전환률 | `button_id = feedback_retry` |
| 다음 문제 전환률 | `button_id = feedback_next_problem` |
| 비교 리포트 생성 전환률 | `button_id = feedback_compare_report` |
| 비교 리포트 이후 다음 문제 전환률 | `comparison_report_viewed -> button_clicked`, `button_id = comparison_next` |
| 약점 문제 이동 전환률 | `comparison_report_viewed -> button_clicked`, `button_id = comparison_weakness` |

## GA custom definition 권장 등록

GA 관리자 화면에서 아래 항목을 custom dimension 또는 custom metric으로 등록하면 탐색 보고서에서 쓰기 쉽다.

| 이름 | 타입 | 목적 |
| --- | --- | --- |
| `problem_id` | Custom dimension | 문제별 시작/제출/추천 클릭 분석 |
| `question_no` | Custom dimension | 51~54번 유형별 분석 |
| `button_id` | Custom dimension | CTA별 클릭/전환 분석 |
| `surface` | Custom dimension | 화면/영역별 CTA 분석 |
| `api_name` | Custom dimension | API별 성공/실패 분석 |
| `api_status` | Custom dimension | API 결과 상태 분석 |
| `duration_ms` | Custom metric | API 응답 시간 분석 |

## 개인정보 및 콘텐츠 보호

다음 값은 GA로 보내지 않도록 `src/lib/analytics/google-analytics.ts`에서 차단한다.

- `email`
- `user_id`
- `session_id`
- `submission_id`
- `report_id`
- `answer_text`
- `draft_text`
- `corrected_text`
- `comment`
- `narrative`
- `overall_summary`

즉, GA에는 "누가 어떤 답안을 썼는지"가 아니라 "어떤 흐름에서 어디까지 도달했는지"만 들어간다.

## 범위 밖

이번 설정에는 아래 작업이 포함되지 않는다.

- Google Analytics 계정/속성 생성
- Google Tag Manager 컨테이너 구성
- GA Measurement Protocol 기반 서버사이드 전송
- 원문 답안, 첨삭문, 피드백 narrative의 외부 분석 전송
- active SOT 문서 직접 수정
