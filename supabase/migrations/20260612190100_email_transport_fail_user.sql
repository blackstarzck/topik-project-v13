-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Email transport STUB — per-user failure control (QA N-EDGE-04 부분 실패)
--
-- 동기:
--   기존 stub은 mode 전역으로만 성공/실패를 모사한다(test_success=전원 성공,
--   test_fail=전원 실패). 이 때문에 "한 배치 안에서 일부 수신자만 실패하고
--   나머지는 정상, 1명 실패가 배치를 중단시키지 않음"(N-EDGE-04 부분 실패)을
--   검증할 수 없다. 사용자별 실패를 주입할 수 있는 단일 다이얼을 추가한다.
--
-- 변경:
--   1) notification_email_config.fail_user_id (nullable uuid) 추가.
--   2) private.notification_email_transport 갱신 — mode='test_success' 이고
--      config.fail_user_id 가 NULL 이 아니며 해당 attempt 의 user_id 가
--      fail_user_id 와 같으면 실패(error_code 'test_partial_fail')를 반환한다.
--      그 외 test_success 대상은 기존대로 성공. 다른 mode 는 일체 불변.
--      (attempt 의 user_id 는 p_attempt_id 로 조회한다.)
--
-- 정직성 경계 (유지): transport 는 여전히 STUB 이다. 'sent' 는 "stub 이 성공을
--   반환했다"일 뿐 "실제 메일 수신"이 아니다. 기본 mode 는 'disabled'.
--   fail_user_id 는 QA 주입용 다이얼이며 평시 NULL 이어야 한다.
-- =====================================================================

-- 1. 사용자별 실패 주입 다이얼.
alter table public.notification_email_config
  add column if not exists fail_user_id uuid;

comment on column public.notification_email_config.fail_user_id is
  'QA 전용: mode=test_success 일 때 이 user_id 의 attempt 만 실패(test_partial_fail)로 모사. '
  '부분 실패(N-EDGE-04) 검증용. 평시 NULL. 다른 mode 에는 영향 없음.';

-- 2. transport stub 에 per-user 실패 분기 추가 (test_success 한정).
create or replace function private.notification_email_transport(
  p_to         text,
  p_subject    text,
  p_body       text,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mode    text;
  v_fail_id uuid;
  v_user_id uuid;
  v_retry   int;
begin
  select mode, fail_user_id into v_mode, v_fail_id
    from public.notification_email_config where id = true;
  v_mode := coalesce(v_mode, 'disabled');

  if v_mode = 'disabled' then
    -- provider 미구성 — 정직하게 스킵. 'sent'로 위장하지 않는다.
    return jsonb_build_object('ok', false, 'skip', true, 'reason', 'no_transport');

  elsif v_mode = 'test_success' then
    -- per-user 실패 주입(N-EDGE-04): fail_user_id 가 지정되고 이 attempt 의
    -- 소유자가 그 사용자면 실패를 모사한다. 그 외에는 성공.
    if v_fail_id is not null then
      select user_id into v_user_id
        from public.notification_delivery_attempts where id = p_attempt_id;
      if v_user_id = v_fail_id then
        return jsonb_build_object('ok', false, 'error_code', 'test_partial_fail',
                                 'error_message', 'simulated per-user failure (N-EDGE-04)');
      end if;
    end if;
    return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));

  elsif v_mode = 'test_fail' then
    return jsonb_build_object('ok', false, 'error_code', 'test_error',
                             'error_message', 'simulated provider failure');

  elsif v_mode = 'test_fail_once' then
    -- 첫 시도(retry_count=0)는 실패, 재시도(retry_count>=1)는 성공.
    select coalesce(retry_count, 0) into v_retry
      from public.notification_delivery_attempts where id = p_attempt_id;
    if coalesce(v_retry, 0) = 0 then
      return jsonb_build_object('ok', false, 'error_code', 'test_error',
                               'error_message', 'simulated first-try failure');
    else
      return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));
    end if;

  elsif v_mode = 'live' then
    -- ===============================================================
    -- FUTURE PROVIDER INTEGRATION POINT (H-4) — 실제 호출 미구현.
    -- ===============================================================
    return jsonb_build_object('ok', false, 'error_code', 'no_live_provider',
                             'error_message', 'live transport not configured (H-4)');

  else
    return jsonb_build_object('ok', false, 'error_code', 'unknown_mode',
                             'error_message', 'unrecognized transport mode: ' || v_mode);
  end if;
end;
$$;

revoke all on function private.notification_email_transport(text, text, text, uuid) from public, anon, authenticated;

comment on function private.notification_email_transport(text, text, text, uuid) is
  'Email transport STUB (provider-agnostic). disabled→skip(no_transport); test_success→성공('
  'config.fail_user_id 일치 attempt 는 test_partial_fail 실패); test_fail→실패; '
  'test_fail_once→첫 시도 실패·재시도 성공; live→placeholder(H-4). '
  'sent 는 "stub 성공 반환"이지 "실제 수신"이 아니다.';
