# Notification catalog and delivery boundary SOT proposal

## 목적

v13 TALKPIK AI의 알림 기능을 `사용자 앱에서 받아보는 인앱 알림`과 `외부 채널 실제 발송`으로 분리하고, 알림 종류, 발송 유형, 메시지 의미, 보류 범위를 SOT에 명확히 반영하기 위한 제안이다.

## 한 줄 결론

v13 MVP 알림은 `feedback_ready`, `study_reminder`, `weekly_summary` 3개를 인앱 중심으로 정의하고, email/Zalo/push 실제 발송과 운영자 대량 발송, 마케팅 캠페인은 외부 연동과 운영 소유권이 확정될 때까지 보류한다.

## 대상 SOT

- `docs/development-core-planning/07-storage-payment-notifications/README.md`
- `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`
- `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`
- `docs/ia.md`
- `supabase/migrations/INDEX.md`

## 현재 확인한 사실

- v13은 user-facing 앱이며 admin/운영 발송 UI를 새로 만들거나 확장하지 않는다.
- `docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md`는 외부 알림/채널 연동을 보류 범위로 둔다. Zalo, 운영 이메일, 외부 리마인더는 실제 발송 가능 상태가 검증되기 전까지 준비중으로 표시해야 한다.
- `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`는 알림 설정 화면에서 `weekly_summary`, `feedback_ready`, `study_reminder` preference와 `in_app/email/zalo` 채널 설정을 다룬다.
- `user_notifications`는 v13 사용자 인앱 수신함이다. owner select와 `read_at` update만 허용하고 insert/delete는 service-role pipeline 전용이다.
- DB dispatcher는 `study_reminder`, `weekly_summary`, `feedback_ready` 같은 자동 알림 흐름을 암시한다.
- email pipeline과 worker route는 존재하지만 실제 provider, cron, 운영 검증 전에는 v13 완료 기능으로 간주하면 안 된다.
- v13 migration 안에 완성된 `notification_templates` seed/catalog는 보이지 않는다. 현재는 template system을 참조하는 구조가 있고, 구체적인 템플릿 목록과 문구 카탈로그는 SOT로 정리되어야 한다.

## 알림 분류 정책 제안

| 분류 | 의미 | v13 정책 |
| --- | --- | --- |
| learning | 학습 재개, 피드백 확인, 주간 리캡처럼 학습 루프를 돕는 알림 | MVP 허용. 인앱 우선 |
| exam_schedule | 목표 시험일, 마감, 시험 대비 일정 알림 | 후속. 목표 시험일 데이터 품질 확인 후 |
| notice | 서비스 공지, 정책 안내, 학습 공지 | v13은 수신/표시만. 생성/발송 운영은 topik-ai 또는 별도 운영 시스템 소유 |
| event | 이벤트 안내 | 후속 또는 보류. 운영/마케팅 동의 경계 필요 |
| marketing | 프로모션, 뉴스레터, 캠페인 | 보류. 명시적 동의, 수신거부, 발송 주체 확정 전까지 v13 MVP 제외 |
| transactional/operational | 계정, 보안, 결제, 시스템 운영 알림 | 후속. 결제/운영 범위가 deferred인 동안 MVP 제외 |

## MVP 알림 카탈로그 제안

| template_key | 사용자 의미 | 발송 유형 | 기본 채널 | 사용자 제어 | MVP 판단 |
| --- | --- | --- | --- | --- | --- |
| `feedback_ready` | 제출한 답안의 첨삭/피드백이 준비됐음을 알림 | 이벤트형 | in-app | on/off 가능. 기본 on 권장 | MVP 핵심 |
| `study_reminder` | 사용자가 정한 요일/시간에 학습 재개를 알림 | 스케줄형 | in-app | 명시적 opt-in, 요일/시간 설정 필수 | MVP 조건부 |
| `weekly_summary` | 이번 주 학습 기록과 다음 학습 진입점을 알림 | 스케줄형 digest | in-app | on/off 가능. 기본 off 또는 onboarding 동의 후 on 권장 | MVP 조건부 |

## 후속 알림 후보

| template_key | 사용자 의미 | 발송 유형 | 보류/후속 이유 |
| --- | --- | --- | --- |
| `exam_schedule_reminder` | 목표 TOPIK 시험일까지 남은 기간과 준비 행동을 알림 | 스케줄형 | 목표 시험일 데이터와 알림 빈도 정책 필요 |
| `review_due` | 저장한 문제, 피드백, 단어를 다시 볼 시점임을 알림 | 스케줄/상태형 | 복습 대상 산정 규칙 필요 |
| `weak_point_review_due` | 취약 유형 복습을 제안 | 추천형 | 고급 AI/약점 추천 범위와 충돌하지 않게 rule-based부터 정의 필요 |
| `mock_exam_reminder` | 모의고사 시작/이어풀기/결과 확인을 알림 | 이벤트/상태형 | 모의고사 기능 안정화 후 |
| `mock_exam_result_ready` | 모의고사 결과 또는 리포트가 준비됐음을 알림 | 이벤트형 | 리포트 생성 흐름 확정 후 |
| `new_notice` | 새 공지나 서비스 안내가 있음을 알림 | 공지형 | v13은 수신/표시만. 운영 발송 주체는 별도 소유 |

## 보류해야 하는 알림

| 항목 | 보류 이유 |
| --- | --- |
| email 실제 발송 | provider, secret, cron, retry, unsubscribe, deliverability 검증 전까지 완료 기능으로 취급하면 안 됨 |
| Zalo 실제 발송 | 외부 채널 연동 deferred |
| browser/mobile push 실제 발송 | 권한, token, service worker/mobile app surface가 필요 |
| 운영자 수동 대량 발송 UI | v13은 user-facing 앱이며 admin 기능 확장 금지 |
| marketing campaign | 명시적 동의, 수신거부, 법무/운영 정책 필요 |
| 결제/구독 알림 | payment provider와 subscription 운영 범위가 deferred |
| AI 분석 기반 weekly report | AI 고급 분석/예측 범위와 충돌 가능. MVP에서는 단순 리캡만 허용 |

## 메시지 템플릿 계약 제안

알림 템플릿 SOT에는 최소한 아래 필드를 정의한다.

| 필드 | 의미 |
| --- | --- |
| `template_key` | 알림 종류의 안정적인 식별자 |
| `category` | `study`, `exam_schedule`, `notice`, `event`, `marketing` 등 |
| `class` | `learning`, `transactional`, `operational`, `marketing` 등 정책 분류 |
| `title` | 인앱 알림 제목 |
| `body` | 인앱 알림 본문 |
| `link_url` | 클릭 시 이동할 사용자 앱 경로 |
| `default_enabled` | 신규 사용자 기본값 |
| `channels_allowed` | 현재는 `in_app`만 MVP 완료 채널로 둔다 |
| `frequency_cap` | 일/주 단위 최대 발송 제한 |
| `dedupe_key` | 같은 이벤트 중복 발송 방지 키 |
| `requires_consent` | marketing/external channel 동의 필요 여부 |

## 권장 기본값

- `feedback_ready`: 기본 on.
- `study_reminder`: 기본 off. 사용자가 요일/시간을 설정하고 켠 경우만 발송.
- `weekly_summary`: 기본 off 또는 onboarding에서 명시 동의 후 on.
- 외부 채널 `email`, `zalo`, `push`: 설정 저장 또는 준비중 표시만 허용. 실제 발송은 SOT 변경과 운영 검증 전까지 비활성.

## 사용자 경험 원칙

- 알림은 학습 행동으로 바로 이어지는 경우에만 MVP에 넣는다.
- 인앱 알림과 외부 채널을 같은 완료 기능처럼 표현하지 않는다.
- 같은 이벤트가 여러 번 보이지 않도록 dedupe와 빈도 제한을 둔다.
- 학습 리마인더 문구는 압박보다 재진입을 돕는 톤으로 작성한다.
- 알림 설정 화면은 유형별 on/off와 채널 준비 상태를 분명히 보여준다.
- 발송 실패/준비중 상태는 실제 발송 성공처럼 표현하지 않는다.

## 수용 기준

- [ ] SOT가 v13 완료 범위를 `in-app notification receive/display/settings`로 명확히 제한한다.
- [ ] `feedback_ready`, `study_reminder`, `weekly_summary`의 의미, 트리거, 기본값, 채널, 사용자 제어가 문서화된다.
- [ ] email/Zalo/push 실제 발송은 deferred로 유지된다.
- [ ] admin/운영자 발송 UI는 v13 scope 밖으로 명시된다.
- [ ] `notification_templates` 또는 동등한 템플릿 카탈로그의 필수 필드가 SOT에 추가된다.
- [ ] marketing/event/notice 알림은 동의, 수신거부, 운영 소유권이 정리되기 전 MVP에서 제외된다.

## 검토한 대안

| 대안 | 장점 | 거절/보류 이유 |
| --- | --- | --- |
| 모든 알림 유형을 MVP에 포함 | 리텐션 실험 범위가 넓음 | user-facing v13 범위 과다, 스팸 리스크, 외부 연동 deferred와 충돌 |
| email/Zalo까지 MVP 완료로 표시 | 사용자 기대에 부합할 수 있음 | 실제 발송 검증 전 완료 기능으로 표현하면 SOT 위반 |
| 운영자 공지/마케팅 발송 UI를 v13에 추가 | 운영 편의성 | admin 기능 확장 금지, topik-ai/운영 소유 경계 위반 |
| weekly summary를 AI 분석 리포트로 정의 | 제품 매력도 상승 | AI 고급 분석 deferred와 충돌 가능. MVP는 단순 리캡으로 제한 |

## 외부 사례 근거

- Google Classroom은 댓글, 멘션, 과제/질문/공지, 채점/반환, 마감 임박 알림을 유형별로 제공하고 class별/유형별 on/off를 둔다: https://support.google.com/edu/classroom/answer/6141557?hl=en
- Canvas는 마감일, 공지, 과제/콘텐츠 변경, 성적, 제출 댓글, 토론, 일정 알림을 두고 즉시/일간/주간/off 같은 빈도 제어를 제공한다: https://community.instructure.com/en/kb/articles/662894-how-do-i-manage-my-canvas-notification-settings
- Moodle은 활동/메시지/이벤트 알림과 사용자 preference, 관리자 설정을 분리한다: https://docs.moodle.org/en/Notifications
- Blackboard는 stream/email/push/SMS와 due date, 성적/피드백, 토론, 메시지 알림을 구분한다: https://help.anthology.com/blackboard/student/en/getting-started/your-account/notifications.html
- Notion은 inbox, desktop/mobile push, email, Slack 채널을 분리하고 앱 사용 중에는 inbox badge 중심으로 처리할 수 있다: https://www.notion.com/help/notification-settings
- Todoist는 activity별 email/mobile/desktop/web 알림 설정과 reminder를 분리한다: https://www.todoist.com/help/articles/manage-your-notifications-in-todoist-QxQGXkMu
- Slack은 workspace/channel/DM별 알림, mention, keyword, DND/schedule을 분리한다: https://slack.com/help/articles/201355156-Configure-your-Slack-notifications

## 멀티에이전트 검토 메모

GPT-5.5 researcher는 외부 학습/LMS/생산성 서비스의 알림 유형을 조사했고, 공통 축을 `학습 이벤트`, `마감/스케줄`, `공지`, `상호작용`, `성과/피드백`, `마케팅/뉴스레터`, `거래성/계정성`으로 정리했다.

GPT-5.5 critic은 v13 범위에서 MVP를 `feedback_ready`, `study_reminder`, `weekly_summary` 3개로 제한하는 것이 안전하다고 봤다. 특히 외부 채널 실제 발송, 운영자 대량 발송, 마케팅, 결제/구독 알림은 현재 SOT와 충돌하거나 후속 범위로 분리해야 한다고 판단했다.

## 다음 단계

1. 이 제안을 수락하면 `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`에 MVP 알림 카탈로그와 보류 경계를 반영한다.
2. `docs/development-core-planning/07-storage-payment-notifications/README.md`에 알림 발송 기준과 템플릿 필드 계약을 추가한다.
3. `supabase/migrations/INDEX.md`에는 `user_notifications`, dispatcher, email pipeline의 완료/보류 경계를 더 명확히 주석화한다.
4. 구현은 SOT 반영 후 `notification_templates` seed/catalog와 UI 문구를 별도 작업으로 다룬다.
