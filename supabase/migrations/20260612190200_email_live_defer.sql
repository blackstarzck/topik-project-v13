-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Email 'live' mode → APP-WORKER DEFER (SQL dispatcher는 발송하지 않는다)
--
-- 동기 / 아키텍처 (확정):
--   in-DB SQL dispatcher는 HTTP 호출이 불가하고(pg_net 미설치), provider API
--   키를 어시스턴트 컨텍스트 밖에 두어야 한다. 따라서 실제 이메일 발송은 v13
--   앱-사이드 워커 라우트(src/app/api/notifications/dispatch-email/route.ts)가
--   담당한다. 워커는 서버 env에서 RESEND_API_KEY를 읽어 Resend를 fetch로 호출한다.
--
--   이 마이그레이션은 'live' 모드의 SQL 동작을 다음과 같이 바꾼다:
--     - private.notification_email_transport: 'live' 분기 → 실패('no_live_provider')
--       대신 DEFER 신호를 반환한다: {ok:false, defer:true, reason:'app_worker'}.
--     - private.finalize_email_attempt: defer=true 결과를 받으면 attempt를
--       'pending' 상태로 그대로 둔다(failed/sent로 만들지 않음). error 필드는 정리.
--   다른 모드(disabled / test_* )는 일체 불변.
--
-- 정직성 경계 (유지·강화):
--   SQL dispatcher는 'live'에서 attempt를 'sent'로 만들지 않는다. 발송 성공의
--   기록은 오직 워커가 Resend로부터 성공 응답을 받은 뒤에만 일어난다. live 모드
--   에서 SQL이 남기는 상태는 'pending'(= 워커가 처리해야 할 큐)뿐이다.
--
-- 재시도 상호작용:
--   private.retry_failed_email_attempts는 status='failed' attempt만 처리하므로
--   defer로 'pending'에 머무는 attempt는 재시도 대상이 아니다(워커 소관).
--   단, 과거에 failed가 된 attempt가 live 모드에서 재시도될 경우 transport가
--   defer를 반환할 수 있으므로, retry 함수도 defer를 '아무것도 하지 않음(pending
--   복귀)'으로 안전하게 처리하도록 함께 갱신한다(거짓 sent/failed 방지).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. transport: 'live' 분기를 DEFER 신호로 교체. 나머지 분기/시그니처 불변.
--    (20260612190100의 per-user 실패 다이얼 분기를 그대로 보존한다.)
-- ---------------------------------------------------------------------
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
    -- APP-WORKER DEFER: SQL은 발송하지 않는다. attempt를 'pending'으로 두고
    -- 앱 워커 라우트가 RESEND_API_KEY로 실제 발송한다(아키텍처 확정).
    -- 'sent'를 거짓으로 반환하지 않는다.
    -- ===============================================================
    return jsonb_build_object('ok', false, 'defer', true, 'reason', 'app_worker');

  else
    return jsonb_build_object('ok', false, 'error_code', 'unknown_mode',
                             'error_message', 'unrecognized transport mode: ' || v_mode);
  end if;
end;
$$;

revoke all on function private.notification_email_transport(text, text, text, uuid) from public, anon, authenticated;

comment on function private.notification_email_transport(text, text, text, uuid) is
  'Email transport STUB + live DEFER. disabled→skip(no_transport); test_success→성공('
  'config.fail_user_id 일치 attempt 는 test_partial_fail 실패); test_fail→실패; '
  'test_fail_once→첫 시도 실패·재시도 성공; live→DEFER(app_worker, attempt를 pending 유지). '
  'sent 는 "성공 반환"이지 SQL가 직접 보낸 것이 아니다(live는 앱 워커가 발송).';

-- ---------------------------------------------------------------------
-- 2. finalize_email_attempt: defer=true → attempt를 'pending' 유지(no-op 종결).
--    error 필드 정리, sent_at/provider_message_id 미설정. 나머지 분기 불변.
-- ---------------------------------------------------------------------
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

  if coalesce((v_res->>'defer')::boolean, false) then
    -- live 모드 — 앱 워커가 발송한다. attempt를 'pending'으로 두고 error 정리.
    update public.notification_delivery_attempts
       set status = 'pending',
           error_code = null,
           error_message = null,
           provider_message_id = null,
           sent_at = null
     where id = p_attempt_id;
    v_status := 'pending';

  elsif coalesce((v_res->>'ok')::boolean, false) then
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

comment on function private.finalize_email_attempt(uuid, text, text, text) is
  'pending email attempt 1건을 transport 결과로 종결. defer=true(live)→pending 유지(앱 워커 발송), '
  'ok→sent, skip→skipped, 그 외→failed. live 모드에서 SQL은 절대 sent로 만들지 않는다.';

-- ---------------------------------------------------------------------
-- 3. retry_failed_email_attempts: live 모드에서 transport가 defer를 반환하면
--    거짓 sent/failed로 만들지 않고 'pending'으로 되돌린다(워커 소관으로 이관).
--    (defer 분기만 추가, 나머지 동작 불변.)
-- ---------------------------------------------------------------------
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
  v_deferred int := 0;
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

    if coalesce((v_res->>'defer')::boolean, false) then
      -- live 모드 — 앱 워커가 발송. 'pending'으로 이관(거짓 sent/failed 방지).
      update public.notification_delivery_attempts
         set status = 'pending',
             error_code = null, error_message = null,
             provider_message_id = null, sent_at = null
       where id = r.id;
      v_deferred := v_deferred + 1;

    elsif coalesce((v_res->>'ok')::boolean, false) then
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

  return jsonb_build_object('retried', v_retried, 'succeeded', v_succeeded,
                            'still_failed', v_still_failed, 'deferred', v_deferred);
end;
$$;

revoke all on function private.retry_failed_email_attempts() from public, anon, authenticated;

comment on function private.retry_failed_email_attempts() is
  'failed email attempt 재시도 (최대 3회, 3회 도달 시 terminal). live 모드 transport가 defer를 '
  '반환하면 pending으로 이관(앱 워커 발송). dispatch_notifications tick에서 호출.';
