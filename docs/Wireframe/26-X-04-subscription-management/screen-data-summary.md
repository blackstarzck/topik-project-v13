# X-04 구독 관리 화면 데이터 계약

## 화면 요약
사용자가 현재 구독, 결제 주기, 결제 이력, 해지 예정 상태를 보는 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |
| 3 | hifi.png | 보조 |
| 4 | wireframe.png | 보조 |

소스 우선순위는 description.md, functional-spec.md, hifi.png, wireframe.png 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 현재 플랜명
- 구독 상태
- 현재 기간
- 해지 예정일
- 결제 이력
- 영수증 링크

## 사용자 입력/상태 데이터
- 플랜 변경 선택
- 해지 선택
- 영수증 열기
- 결제 이력 페이지 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 현재 구독 | 현재 스키마로 충족 | subscriptions가 user_id, plan_key, billing_cadence, status, current_period_start/end, cancel_at을 제공한다. | 쓰기 권한은 결제 서비스 흐름이다. |
| 플랜명/혜택 | 현재 스키마로 충족 | subscription_plans가 플랜 표시 데이터를 제공한다. | plan_key로 subscriptions와 연결된다. |
| 결제 이력 | 현재 스키마로 충족 | payment_history가 amount_cents, currency, status, receipt_url, paid_at을 제공한다. | 본인 이력만 조회된다. |
| 플랜 변경/해지 요청 ledger | 스키마 보강 필요 | 사용자 요청 상태를 public schema에 별도로 저장하는 구조는 없다. | 현재는 provider/서비스 처리 결과 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| subscription_plans | 플랜명/혜택 | 20260602120100_billing.sql: plan_key, name, cadence, price_cents, currency, features, recommended, active, created_at, updated_at. |
| subscriptions | 현재 구독 | 20260602120100_billing.sql: id, user_id, plan_key, billing_cadence, status, current_period_start, current_period_end, cancel_at, provider, provider_subscription_id, created_at, updated_at. |
| payment_history | 결제 이력 | 20260602120100_billing.sql: id, user_id, subscription_id, amount_cents, currency, status, receipt_url, paid_at, created_at. |
| profiles | 사용자 플랜 라벨 보조 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
화면은 subscriptions와 plan, payment_history를 조회한다. 변경/해지 액션은 외부 결제 provider 또는 서버 서비스로 위임하고 결과 row를 다시 읽는다.

## RLS/권한 기준
- subscriptions와 payment_history는 본인 select만 가능하다.
- client insert/update/delete 정책은 없다.
- subscription_plans는 active plan을 authenticated 사용자가 읽을 수 있고 쓰기는 운영 권한 흐름이다.
- subscriptions는 본인 select만 가능하고 쓰기는 결제 서비스 권한 흐름이다.
- payment_history는 본인 select만 가능하고 쓰기는 결제 서비스 권한 흐름이다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
조회 데이터는 현재 스키마로 충족된다. 변경 요청 workflow를 DB에 남기려면 스키마 보강 필요다.

## 검수 필요 항목
- 해지 예약 상태 문구를 subscriptions.cancel_at 기준으로 고정한다.
- receipt_url 노출 보안 기준을 정한다.
