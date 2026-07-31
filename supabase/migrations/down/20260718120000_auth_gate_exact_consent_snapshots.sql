-- down: 20260718120000_auth_gate_exact_consent_snapshots 롤백.
--
-- forward 가 추가한 snapshot-aware jsonb 오버로드 3개를 제거하고, forward 가
-- 클라이언트에서 회수한 boolean-only 오버로드 3개의 authenticated EXECUTE 를
-- 복원한다.
--
--   제거: complete_auth_gate(text,text,text,boolean,jsonb)                      -- 5-arg base
--         complete_auth_gate(text,text,text,text,text,text,boolean,jsonb)       -- 8-arg
--         complete_auth_gate(text,text,text,text,text,text,boolean,jsonb,text,text) -- 10-arg
--   복원: 4-arg / 7-arg / 9-arg boolean-only 오버로드의 authenticated EXECUTE
--
-- 권한 복원 범위: authenticated 만이다. `public`·`anon` 은 forward **이전에도**
-- 이미 회수된 상태였으므로(4-arg=20260625001257 / 20260710094000, 7·9-arg=
-- 20260709165000) 재부여하지 않는다.
--
-- 본문 무변경: 이 down 은 boolean-only 오버로드의 본문을 재정의하지 않는다
-- (forward 도 재정의하지 않았다). ⚠️ 그 결과 롤백 후 라이브 본문은 환경마다
-- 다르다 — dev 는 `20260623103000` 판, 운영은 `20260710094000` 판(신뢰 문서
-- 필터 포함, 컷오버 전 적용된 정당한 역사)이다. 어느 쪽도 이메일 인증 가드를
-- 호출하지 않는다: 그 가드는 forward 의 jsonb base 가 복구한 것이므로 이
-- 롤백으로 다시 사라진다.
--
-- 기능·보안 경고(창 전체 롤백의 일부로만 실행):
--   * 동의 기록이 "호출 중 legal_documents 재조회" 방식으로 되돌아간다 —
--     사용자가 보지 않은 신규 published 버전이 기록될 수 있는 창(forward 가
--     닫은 stale 문제)이 다시 열린다.
--   * 이메일 미인증 사용자의 게이트 통과 차단이 사라진다.
--   * 창 이후 v13 앱은 jsonb 오버로드(정확한 {id,version} 배열 제출)를
--     호출하므로 이 롤백에는 앱 버전 동시 롤백이 필수다.
--
-- 실행 순서: 운영 백로그 7건 롤백의 **마지막**이다(적용 순서의 첫 번째였다).
-- 선행 조건으로 down/20260722120000(B4 쌍)까지 이미 실행돼 있어야 한다.
-- 이 창에서 `20260527113000` false-record 수리를 함께 적용했다면
-- down/20260527113000 은 이 파일보다 **뒤에** 실행한다(forward 의 jsonb base 가
-- private.is_email_confirmed 를 호출하므로 먼저 이 파일이 그 의존을 제거해야
-- 한다).

begin;

drop function if exists public.complete_auth_gate(
  text, text, text, text, text, text, boolean, jsonb, text, text
);
drop function if exists public.complete_auth_gate(
  text, text, text, text, text, text, boolean, jsonb
);
drop function if exists public.complete_auth_gate(text, text, text, boolean, jsonb);

grant execute on function public.complete_auth_gate(text, text, text, boolean)
  to authenticated;
grant execute on function public.complete_auth_gate(
  text, text, text, text, text, text, boolean
) to authenticated;
grant execute on function public.complete_auth_gate(
  text, text, text, text, text, text, boolean, text, text
) to authenticated;

commit;
