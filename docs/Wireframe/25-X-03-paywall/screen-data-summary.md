# X-03 페이월 화면 데이터 계약

## 화면 요약
유료 기능 접근 시 사용 가능한 플랜과 가격을 보여주고 결제 흐름으로 넘기는 화면이다.

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
- 접근 제한 안내
- 플랜 카드
- 가격/결제 주기
- 혜택 목록
- 추천 플랜 표시
- 결제 CTA

## 사용자 입력/상태 데이터
- 플랜 선택
- 결제 주기 선택
- 결제 CTA 클릭
- 뒤로가기

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 플랜/가격 카드 | 현재 스키마로 충족 | subscription_plans가 plan_key, name, cadence, price_cents, currency, features, recommended, active를 제공한다. | active plan만 사용자에게 표시한다. |
| 현재 구독 상태 | 현재 스키마로 충족 | subscriptions가 사용자의 status와 current_period 정보를 제공한다. | 본인 구독만 조회한다. |
| 결제 checkout | DB 계약 없음 | 실제 결제 승인과 카드 정보 처리는 외부 결제 provider 흐름이다. | public schema는 결제 결과를 subscriptions/payment_history로 반영하는 구조다. |
| paywall 문구/권한 설명 | 스키마 보강 필요 | 기능별 제한 문구와 upsell 카피를 운영 데이터로 관리하는 구조는 없다. | 현재는 plan catalog와 앱 문구를 조합한다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| subscription_plans | 결제 주기/가격 카드 | 20260602120100_billing.sql: plan_key, name, cadence, price_cents, currency, features, recommended, active, created_at, updated_at. |
| subscriptions | 현재 구독 상태 | 20260602120100_billing.sql: id, user_id, plan_key, billing_cadence, status, current_period_start, current_period_end, cancel_at, provider, provider_subscription_id, created_at, updated_at. |
| profiles | 접근 제한 보조 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
화면은 active subscription_plans와 현재 subscriptions를 조회한다. 사용자가 플랜을 선택하면 외부 결제 provider checkout으로 이동하고 결과는 결제 서비스가 DB에 반영한다.

## RLS/권한 기준
- subscription_plans는 active plan read만 허용된다.
- subscriptions는 본인 select만 가능하다.
- 결제 쓰기는 클라이언트 직접 DB 쓰기가 아니다.
- subscription_plans는 active plan을 authenticated 사용자가 읽을 수 있고 쓰기는 운영 권한 흐름이다.
- subscriptions는 본인 select만 가능하고 쓰기는 결제 서비스 권한 흐름이다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
가격과 구독 상태는 현재 스키마로 충족된다. checkout 세션과 paywall 문구 운영 구조는 없다.

## 검수 필요 항목
- plan_label과 subscriptions.status의 권한 판정 우선순위를 정한다.
- 결제 실패 후 사용자 메시지 source를 정한다.
