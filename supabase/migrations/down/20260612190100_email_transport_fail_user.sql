-- =====================================================================
-- DOWN · 20260612190100_email_transport_fail_user
-- per-user 실패 다이얼을 되돌린다.
--   - notification_email_config.fail_user_id 컬럼 제거
--   - private.notification_email_transport 를 20260612190000 정의(전역 mode 만)로 복원
-- =====================================================================

alter table public.notification_email_config
  drop column if exists fail_user_id;

-- ── 20260612190000 transport 정의 복원 (per-user 분기 없음) ──────────────
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
  v_mode  text;
  v_retry int;
begin
  select mode into v_mode from public.notification_email_config where id = true;
  v_mode := coalesce(v_mode, 'disabled');

  if v_mode = 'disabled' then
    return jsonb_build_object('ok', false, 'skip', true, 'reason', 'no_transport');

  elsif v_mode = 'test_success' then
    return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));

  elsif v_mode = 'test_fail' then
    return jsonb_build_object('ok', false, 'error_code', 'test_error',
                             'error_message', 'simulated provider failure');

  elsif v_mode = 'test_fail_once' then
    select coalesce(retry_count, 0) into v_retry
      from public.notification_delivery_attempts where id = p_attempt_id;
    if coalesce(v_retry, 0) = 0 then
      return jsonb_build_object('ok', false, 'error_code', 'test_error',
                               'error_message', 'simulated first-try failure');
    else
      return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));
    end if;

  elsif v_mode = 'live' then
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
  'Email transport STUB (provider-agnostic). disabled→skip(no_transport); test_*→모사 성공/실패; live→placeholder(H-4, 실제 호출 미구현). sent는 "transport 성공 반환"이지 "실제 수신"이 아니다.';
