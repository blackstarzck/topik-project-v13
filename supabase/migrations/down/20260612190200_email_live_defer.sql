-- =====================================================================
-- DOWN · 20260612190200_email_live_defer
-- 'live' app-worker DEFER 를 되돌린다.
--   - private.notification_email_transport: 'live' → defer 대신 실패
--     ('no_live_provider')로 복원 (20260612190100 정의, per-user 다이얼 보존).
--   - private.finalize_email_attempt: defer 분기 제거 (20260612190000 정의 복원).
--   - private.retry_failed_email_attempts: defer 분기 제거 (20260612190000 정의 복원).
-- =====================================================================

-- ── transport: 20260612190100 정의(live=실패) 복원 ──────────────────────
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
    return jsonb_build_object('ok', false, 'skip', true, 'reason', 'no_transport');

  elsif v_mode = 'test_success' then
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
  'Email transport STUB (provider-agnostic). disabled→skip(no_transport); test_success→성공('
  'config.fail_user_id 일치 attempt 는 test_partial_fail 실패); test_fail→실패; '
  'test_fail_once→첫 시도 실패·재시도 성공; live→placeholder(H-4). '
  'sent 는 "stub 성공 반환"이지 "실제 수신"이 아니다.';

-- ── finalize_email_attempt: 20260612190000 정의(defer 분기 없음) 복원 ────
create or replace function private.finalize_email_attempt(
  p_attempt_id uuid,
  p_to         text,
  p_subject    text,
  p_body       text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_res    jsonb;
  v_status text;
begin
  v_res := private.notification_email_transport(p_to, p_subject, p_body, p_attempt_id);

  if coalesce((v_res->>'ok')::boolean, false) then
    update public.notification_delivery_attempts
       set status = 'sent',
           provider_message_id = v_res->>'provider_message_id',
           error_code = null,
           error_message = null,
           sent_at = now()
     where id = p_attempt_id;
    v_status := 'sent';

  elsif coalesce((v_res->>'skip')::boolean, false) then
    update public.notification_delivery_attempts
       set status = 'skipped',
           error_message = v_res->>'reason',
           sent_at = null
     where id = p_attempt_id;
    v_status := 'skipped';

  else
    update public.notification_delivery_attempts
       set status = 'failed',
           error_code = v_res->>'error_code',
           error_message = v_res->>'error_message',
           sent_at = null
     where id = p_attempt_id;
    v_status := 'failed';
  end if;

  return v_status;
end;
$$;

revoke all on function private.finalize_email_attempt(uuid, text, text, text) from public, anon, authenticated;

-- ── retry_failed_email_attempts: 20260612190000 정의(defer 분기 없음) 복원 ──
create or replace function private.retry_failed_email_attempts()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r record;
  v_retried int := 0;
  v_succeeded int := 0;
  v_still_failed int := 0;
  v_res jsonb;
  v_display text;
  v_subject text;
  v_body text;
begin
  for r in
    select a.id, a.user_id, a.template_key, a.retry_count
      from public.notification_delivery_attempts a
     where a.channel = 'email'
       and a.status = 'failed'
       and a.retry_count < 3
       for update skip locked
  loop
    update public.notification_delivery_attempts
       set retry_count = retry_count + 1
     where id = r.id;

    select p.display_name into v_display from public.profiles p where p.id = r.user_id;
    select t.subject, t.body_html into v_subject, v_body
      from public.notification_templates t
     where t.template_key = r.template_key and t.channel = 'email'
     order by case when t.status = 'active' then 0 else 1 end
     limit 1;

    v_res := private.notification_email_transport(
      null,
      private.render_notification_text(v_subject, v_display),
      private.render_notification_text(v_body, v_display),
      r.id);

    v_retried := v_retried + 1;

    if coalesce((v_res->>'ok')::boolean, false) then
      update public.notification_delivery_attempts
         set status = 'sent',
             provider_message_id = v_res->>'provider_message_id',
             error_code = null, error_message = null, sent_at = now()
       where id = r.id;
      v_succeeded := v_succeeded + 1;
    else
      update public.notification_delivery_attempts
         set status = 'failed',
             error_code = coalesce(v_res->>'error_code', 'retry_failed'),
             error_message = v_res->>'error_message'
       where id = r.id;
      v_still_failed := v_still_failed + 1;
    end if;
  end loop;

  return jsonb_build_object('retried', v_retried, 'succeeded', v_succeeded, 'still_failed', v_still_failed);
end;
$$;

revoke all on function private.retry_failed_email_attempts() from public, anon, authenticated;

comment on function private.retry_failed_email_attempts() is
  'failed email attempt 재시도 (최대 3회, 3회 도달 시 terminal). dispatch_notifications tick에서 호출.';
