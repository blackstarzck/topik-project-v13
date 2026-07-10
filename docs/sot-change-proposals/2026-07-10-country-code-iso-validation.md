# 국가 코드 ISO 3166-1 alpha-2 검증 강화 (implementation brief)

작성일: 2026-07-10

상태: 승인·구현 완료 (2026-07-10). 사용자 승인 후 migration `20260710095000_profiles_country_code_iso_check.sql`로 구현했다. 아래 "결정 기록 (2026-07-10)" 참조. 원격 apply는 v13에서 수행하지 않고 운영 절차 소관이다.

## 배경

`profiles.nationality_country_code`와 `profiles.phone_country_code`는 DB 계층에서 **정규식 `^[A-Z]{2}$`로만** 검증된다. 이는 대문자 2글자면 무엇이든 통과시켜, 실제로 배정되지 않은 코드(`ZZ`, `XX`, `QQ` 등)도 저장을 허용한다.

애플리케이션 계층은 이미 실제 ISO 목록으로 제한한다:
- `src/lib/geo/country-codes.ts`: `ISO_COUNTRY_CODES`, `isSupportedCountryCode()`.
- `src/components/shared/CountryRegionSelect.tsx`: 위 목록만 렌더.
- `src/lib/auth/profile-completion.ts:107`: `isRequiredProfileInputValid`가 `isSupportedCountryCode`로 검증.

따라서 UI/서버 액션 경로로는 비정상 코드가 들어오지 않는다. 그러나 DB/RPC를 직접 호출하거나 향후 다른 코드 경로가 생기면 `ZZ` 등이 그대로 저장될 수 있다. **defense-in-depth 데이터 정합성 갭**이다.

## 현재 검증 지점 (근거)

DB CHECK 제약:
- `supabase/migrations/20260617195000_profiles_nationality.sql:19` — `nationality_country_code ~ '^[A-Z]{2}$'`
- `supabase/migrations/20260709153000_profiles_optional_gender_phone.sql:35`, `20260709165000_profiles_split_phone_country_code.sql:21` — `phone_country_code ~ '^[A-Z]{2}$'`

RPC 내부 검증/정규화 (`complete_auth_gate` 계열):
- `20260623103000:135,137`, `20260629120000:81,83`, `20260710094000:97,99` — nationality
- `20260709153000:103,190`, `20260709165000:70,160` — phone_country_code

## 제안 (구현 시)

1. **단일 소스**: DB에 ISO 3166-1 alpha-2 코드 집합을 두고, 앱의 `ISO_COUNTRY_CODES`와 값이 일치하도록 유지한다. 두 방식 중 택1:
   - (A) reference 테이블 `public.iso_country_codes(code text primary key)` seed + `EXISTS` 기반 CHECK/검증.
   - (B) immutable 함수 `private.is_iso_3166_alpha2(text) returns boolean` (정적 배열) 후 CHECK/RPC에서 사용.
   - 권장: (A). 앱 목록과의 drift를 seed 마이그레이션 한 곳에서 관리하고, 추후 목록 갱신이 값 변경만으로 끝난다.
2. **forward-only 마이그레이션**으로:
   - `profiles` CHECK 제약을 정규식 → ISO 집합 검증으로 교체(기존 제약 drop + 신규 add, idempotent).
   - `complete_auth_gate` 계열 RPC의 `^[A-Z]{2}$` 검증을 ISO 집합 검증으로 교체(현재 최신 base는 `20260710094000`; phone은 `20260709165000`).
   - 기존 데이터 중 비-ISO 코드가 있으면 backfill 정책 결정 필요(예: `null`로 정리 또는 유지). **적용 전 실측 필요**.
3. **`ZZ` 취급**: ISO 3166 예약(“unknown”). 앱 목록에 없으므로 **불허**로 통일한다(사용자 선택지에 없음).
4. 앱 계층은 이미 검증하므로 코드 변경은 원칙적으로 불필요. 단 DB 검증 강화 후 오류 메시지 UX 회귀만 확인.

## Acceptance Criteria

- DB에 비-ISO alpha-2 코드(`ZZ`, `XX` 등) 저장 시도가 거부된다(CHECK/RPC 양쪽).
- 유효 ISO 코드(`KR`, `US`, `VN` 등)는 그대로 저장된다.
- 앱 `ISO_COUNTRY_CODES`와 DB 허용 집합이 일치한다(drift 없음).
- 기존 `profiles` 행에 대한 backfill/무결성 영향이 문서화되고, 적용 전 실측으로 검증된다.
- 마이그레이션은 forward-only, idempotent. 원격 적용은 운영 절차 소관(v13에서 원격 apply하지 않음).

## 범위 밖 / 주의

- 국가별 표시명·전화 국가번호 매핑 변경.
- 앱 UI 목록 자체의 변경(추가/삭제).
- 원격 DB 직접 적용 — v13 작업면에서 수행하지 않는다.

## 검토한 대안

- **현행 유지(정규식)**: 앱이 이미 막으므로 사용자 경로 위험은 낮음. 그러나 직접 RPC/API·향후 신규 경로에서 무결성 보장 없음. 감사에서 지적된 갭이라 강화 권장.
- **앱 계층만 강화**: 이미 강화돼 있어 추가 이득 없음. DB 갭이 핵심.

## 결정 기록 (2026-07-10)

- **결정**: 사용자 승인으로 국가코드 ISO 검증 강화를 구현. migration `20260710095000_profiles_country_code_iso_check.sql`.
- **무엇을**: IMMUTABLE `public.is_supported_country_code(text)`(249개 ISO 3166-1 alpha-2 집합)를 추가하고, 실제로 느슨했던 `profiles_phone_country_code_check`를 정규식 `^[A-Z]{2}$`에서 ISO 집합으로 강화. `profiles_nationality_country_code_format`는 이미 동일 249배열을 강제하고 있었으므로(20260617195000) 같은 함수로 **단일 소스화**(무동작-변경). 두 CHECK 모두 `null` 허용 유지, `NOT VALID → VALIDATE`.
- **이유/근거**: 앱 `ISO_COUNTRY_CODES`(country-flag-icons@1.6.17 파생 249개)와 20260617195000 정적 배열이 **완전 동일**(249==249, zero-diff)함을 확인. dev 실데이터(197행) 국가코드가 전부 유효 ISO(비-ISO 0건, phone 전부 null)라 backfill 불필요·VALIDATE 안전. 감사가 지적한 "DB가 ZZ 등 허용" 갭은 실제로는 phone 컬럼에만 존재했다.
- **검토한 대안(제외)**: (a) RPC/트리거(`handle_new_user`, `complete_auth_gate` 오버로드)의 `^[A-Z]{2}$` 정규식까지 ISO로 강화 → base `complete_auth_gate(text,text,text,boolean)` 재작성이 `20260710094000`의 신뢰-동의문서 필터를 훼손해 consent 무한 바운스 회귀 위험이 커서 제외([[consent-gate-untrusted-doc-bounce]]). CHECK를 권위 있는 backstop으로 두는 최소 변경을 채택하고, RPC 정규식 강화는 후속 선택 작업으로 남김(앱이 이미 ISO로 선검증하므로 앱 경로 도달 불가·fail-closed). (b) phone CHECK에 배열 인라인 → nationality와 사본 2벌 유지되어 함수 단일화보다 열위.
- **검증**: 249코드가 앱·기존 nationality 배열과 zero-diff, dev 15개 코드 전부 포함, 적대적 검증 SOUND. 원격 apply(운영)에서 실효.
