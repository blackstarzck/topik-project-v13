-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Marketing consent in dispatch (H-2) — replace hard-coded marketing→opted_out
--                                       with a consent lookup. Closes N-OPT-04.
--
-- 변경 전 동작 (20260612190000): 모든 마케팅 class attempt → 'opted_out'
--   (저장소 H-2 미구현이라 전원 차단).
-- 변경 후 동작: 마케팅 class → user_marketing_consent 조회.
--   - 유효 동의(consented_at not null AND unsubscribed_at null) → eligible
--     → 다른 class와 동일하게 channel 자격 검사로 진행.
--   - 그 외(동의 행 없음 / consented_at null / unsubscribed) → 'opted_out'.
--
-- 마케팅에는 pref 토글 키가 없다(profiles.notification_prefs는 study_reminder 등
-- learning 키만 보유). 따라서 마케팅 자격은 "동의 + 채널 on"으로 정의한다:
--   동의 O + 채널 on  → eligible (in_app: 'sent', email: 'pending'→transport)
--   동의 O + 채널 off → 'skipped'
--   동의 X            → 'opted_out'
-- 비-마케팅(transactional/operational/learning/mandatory) 동작은 100% 동일.
--
-- 재선언 범위: 마케팅 분기를 포함한 함수만 재생성한다.
--   - private.dispatch_admin_notifications()        (in_app + email 마케팅 분기)
--   - private.dispatch_notification_event(...)      (in_app + email 마케팅 분기)
--   private.dispatch_scheduled_notifications(...)는 마케팅 분기가 없다
--   (study_reminder/weekly_summary = learning) → 미변경.
-- 시그니처는 전부 불변.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 유효 동의 판정 헬퍼 — 규칙을 한 곳에 둔다(파이프라인·향후 라우트 공유 가능).
-- ---------------------------------------------------------------------
create or replace function private.is_marketing_consented(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.user_marketing_consent c
     where c.user_id = p_user_id
       and c.consented_at is not null
       and c.unsubscribed_at is null
  );
$$;

revoke all on function private.is_marketing_consented(uuid) from public, anon, authenticated;

comment on function private.is_marketing_consented(uuid) is
  'H-2 유효 마케팅 동의 판정. true = consented_at not null AND unsubscribed_at null. dispatch 마케팅 자격의 단일 출처.';

-- ---------------------------------------------------------------------
-- 3b. 관리자 발송 — 마케팅 분기에 consent 검사 주입. (나머지 분기 불변.)
-- ---------------------------------------------------------------------
create or replace function private.dispatch_admin_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  d        record;
  v_tpl    public.notification_templates%rowtype;
  v_sent int; v_skipped int; v_opted int; v_failed int;
  v_results jsonb := '[]'::jsonb;
  a record;
begin
  for d in
    select * from public.notification_dispatches
     where (status = 'running' and target_type in ('group','test'))
        or (status = 'scheduled' and scheduled_at <= now())
     order by created_at
       for update skip locked
  loop
    if d.status = 'scheduled' then
      update public.notification_dispatches
         set status = 'running', started_at = now()
       where id = d.id;
    end if;

    select * into v_tpl from public.notification_templates where id = d.template_id;
    if v_tpl.id is null then
      update public.notification_dispatches set status = 'failed', completed_at = now() where id = d.id;
      v_results := v_results || jsonb_build_object('dispatch', d.id, 'result', 'template_missing');
      continue;
    end if;

    drop table if exists _ntf_audience;
    create temp table _ntf_audience on commit drop as
    select u.user_id,
           p.display_name,
           coalesce((ns.channels->>'in_app')::boolean, true)  as in_app_on,
           coalesce((ns.channels->>'email')::boolean, false)  as email_on,
           coalesce((p.notification_prefs->>v_tpl.template_key)::boolean, false) as pref_on,
           private.is_marketing_consented(u.user_id) as mkt_consented
      from (
        select d.actor_id as user_id
         where d.target_type = 'test' and d.actor_id is not null
        union
        select (jsonb_array_elements_text(g.static_member_ids))::uuid
          from public.notification_groups g
         where d.target_type = 'group'
           and exists (select 1 from jsonb_array_elements_text(d.target_group_ids) t(gid)
                        where t.gid = g.id::text)
      ) u
      join public.profiles p on p.id = u.user_id
      left join public.notification_settings ns on ns.user_id = u.user_id;

    if v_tpl.channel = 'in_app' then
      -- ── in_app 경로 (기존 시맨틱스 보존 + 마케팅 consent) ─────────────
      with ins as (
        insert into public.notification_delivery_attempts
          (dispatch_id, user_id, channel, template_key, status, sent_at)
        select d.id, a2.user_id, 'in_app', v_tpl.template_key,
               case
                 when d.target_type = 'test' then 'sent'
                 when v_tpl.class = 'marketing' then
                   case when not a2.mkt_consented then 'opted_out'
                        when not a2.in_app_on then 'skipped'
                        else 'sent' end
                 when v_tpl.mandatory then 'sent'
                 when v_tpl.class in ('learning','transactional') and not a2.pref_on then 'opted_out'
                 when not a2.in_app_on then 'skipped'
                 else 'sent' end,
               now()
          from _ntf_audience a2
        on conflict (dispatch_id, user_id, channel) do nothing
        returning id, user_id, status
      )
      insert into public.user_notifications
        (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
      select i.user_id, v_tpl.template_key, v_tpl.category,
             private.render_notification_text(v_tpl.subject, a3.display_name),
             private.render_notification_text(v_tpl.body_html, a3.display_name),
             v_tpl.link_url, i.id
        from ins i
        join _ntf_audience a3 on a3.user_id = i.user_id
       where i.status = 'sent';

    elsif v_tpl.channel = 'email' then
      -- ── email 경로 (user_notifications insert 없음 + 마케팅 consent) ──
      --   test 대상: 본인 확인용 → 자격 평가 우회하고 발송 시도(pending).
      --   marketing: H-2 consent 조회 → 동의 O + email_on → pending, 동의 O +
      --     email off → skipped, 동의 X → opted_out.
      --   mandatory + operational: in_app만 강제 가능(계약 §2) — email은 pref/channel 존중.
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, sent_at)
      select d.id, a2.user_id, 'email', v_tpl.template_key,
             case
               when d.target_type = 'test' then 'pending'
               when v_tpl.class = 'marketing' then
                 case when not a2.mkt_consented then 'opted_out'
                      when not a2.email_on then 'skipped'
                      else 'pending' end
               when v_tpl.class in ('learning','transactional','operational') and not a2.pref_on then 'opted_out'
               when not a2.email_on then 'skipped'
               else 'pending' end,
             null
        from _ntf_audience a2
      on conflict (dispatch_id, user_id, channel) do nothing;

      for a in
        select x.id as attempt_id,
               private.render_notification_text(v_tpl.subject, aud.display_name)   as subject,
               private.render_notification_text(v_tpl.body_html, aud.display_name) as body
          from public.notification_delivery_attempts x
          join _ntf_audience aud on aud.user_id = x.user_id
         where x.dispatch_id = d.id and x.status = 'pending'
      loop
        perform private.finalize_email_attempt(
          a.attempt_id,
          null,
          a.subject,
          a.body);
      end loop;

    else
      update public.notification_dispatches set status = 'failed', completed_at = now() where id = d.id;
      v_results := v_results || jsonb_build_object('dispatch', d.id, 'result', 'unsupported_channel', 'channel', v_tpl.channel);
      continue;
    end if;

    select count(*) filter (where status = 'sent'),
           count(*) filter (where status = 'skipped'),
           count(*) filter (where status = 'opted_out'),
           count(*) filter (where status = 'failed')
      into v_sent, v_skipped, v_opted, v_failed
      from public.notification_delivery_attempts
     where dispatch_id = d.id;

    update public.notification_dispatches
       set status = case when coalesce(v_failed,0) > 0 then 'partial_failed' else 'completed' end,
           recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0)
                             + coalesce(v_opted,0) + coalesce(v_failed,0),
           completed_at = now()
     where id = d.id;

    v_results := v_results || jsonb_build_object('dispatch', d.id, 'channel', v_tpl.channel,
                  'sent', v_sent, 'skipped', v_skipped, 'opted_out', v_opted, 'failed', v_failed);
  end loop;

  return jsonb_build_object('processed', jsonb_array_length(v_results), 'dispatches', v_results);
end;
$$;

revoke all on function private.dispatch_admin_notifications() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3c. 이벤트형 — 마케팅 분기에 consent 검사 주입. (나머지 분기/시그니처 불변.)
-- ---------------------------------------------------------------------
create or replace function private.dispatch_notification_event(
  p_template_key text,
  p_user_id      uuid,
  p_event_id     text,
  p_payload      jsonb default '{}'::jsonb,
  p_channel      text  default null   -- null = 모든 활성 channel
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_dispatch_id uuid;
  v_status      text;
  v_attempt_id  uuid;
  v_display     text;
  v_in_app_on   boolean;
  v_email_on    boolean;
  v_pref_on     boolean;
  v_mkt_consented boolean;
  v_results     jsonb := '[]'::jsonb;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'user_id and event_id required';
  end if;

  -- 수신자 컨텍스트 1회 조회 (모든 channel 공유).
  select p.display_name,
         coalesce((ns.channels->>'in_app')::boolean, true),
         coalesce((ns.channels->>'email')::boolean, false),
         coalesce((p.notification_prefs->>p_template_key)::boolean, false)
    into v_display, v_in_app_on, v_email_on, v_pref_on
    from public.profiles p
    left join public.notification_settings ns on ns.user_id = p.id
   where p.id = p_user_id;
  if not found then
    return jsonb_build_object('result', 'unknown_user');
  end if;

  v_mkt_consented := private.is_marketing_consented(p_user_id);

  -- 활성 템플릿(들)을 channel별로 순회. p_channel 지정 시 해당 channel만.
  for v_tpl in
    select * from public.notification_templates
     where template_key = p_template_key
       and status = 'active'
       and (p_channel is null or channel = p_channel)
     order by case channel when 'in_app' then 0 else 1 end
  loop
    insert into public.notification_dispatches
      (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
    values
      (v_tpl.id, p_template_key, jsonb_build_array(v_tpl.channel), 'event', 'running',
       'event:' || v_tpl.channel || ':' || p_template_key || ':' || p_event_id, now())
    on conflict (dedupe_key) do nothing
    returning id into v_dispatch_id;
    if v_dispatch_id is null then
      v_results := v_results || jsonb_build_object('channel', v_tpl.channel, 'result', 'deduped');
      continue;
    end if;

    v_attempt_id := null;

    if v_tpl.channel = 'in_app' then
      v_status := case
        when v_tpl.class = 'marketing' then
          case when not v_mkt_consented then 'opted_out'
               when not v_in_app_on then 'skipped'
               else 'sent' end
        when v_tpl.mandatory then 'sent'
        when v_tpl.class in ('learning','transactional') and not v_pref_on then 'opted_out'
        when not v_in_app_on then 'skipped'
        else 'sent' end;

      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      values
        (v_dispatch_id, p_user_id, 'in_app', p_template_key, v_status,
         p_user_id::text || ':' || p_template_key || ':' || p_event_id,
         case when v_status = 'sent' then now() else null end)
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id into v_attempt_id;

      if v_attempt_id is not null and v_status = 'sent' then
        insert into public.user_notifications
          (user_id, template_key, category, title, body, link_url, payload, delivery_attempt_id)
        values
          (p_user_id, p_template_key, v_tpl.category,
           private.render_notification_text(v_tpl.subject, v_display),
           private.render_notification_text(v_tpl.body_html, v_display),
           coalesce(nullif(p_payload->>'link_url', ''), v_tpl.link_url),
           p_payload, v_attempt_id);
      end if;

    else  -- email
      -- 자격 평가: marketing→consent(동의 O+email_on→pending), learning/transactional/
      -- operational→pref+channels.email. mandatory operational은 email 강제 불가(계약 §2).
      v_status := case
        when v_tpl.class = 'marketing' then
          case when not v_mkt_consented then 'opted_out'
               when not v_email_on then 'skipped'
               else 'pending' end
        when v_tpl.class in ('learning','transactional','operational') and not v_pref_on then 'opted_out'
        when not v_email_on then 'skipped'
        else 'pending' end;

      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      values
        (v_dispatch_id, p_user_id, 'email', p_template_key, v_status,
         p_user_id::text || ':' || p_template_key || ':email:' || p_event_id, null)
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id into v_attempt_id;

      -- pending이면 transport 호출로 종결. (email은 user_notifications 미기록.)
      if v_attempt_id is not null and v_status = 'pending' then
        v_status := private.finalize_email_attempt(
          v_attempt_id, null,
          private.render_notification_text(v_tpl.subject, v_display),
          private.render_notification_text(v_tpl.body_html, v_display));
      end if;
    end if;

    update public.notification_dispatches
       set status = case when v_status = 'failed' then 'partial_failed' else 'completed' end,
           recipient_count = 1, completed_at = now()
     where id = v_dispatch_id;

    v_results := v_results || jsonb_build_object(
      'channel', v_tpl.channel, 'result', v_status,
      'dispatch_id', v_dispatch_id, 'attempt_id', v_attempt_id);
  end loop;

  if jsonb_array_length(v_results) = 0 then
    return jsonb_build_object('result', 'no_active_template', 'template', p_template_key);
  end if;

  return jsonb_build_object('template', p_template_key, 'event_id', p_event_id, 'channels', v_results);
end;
$$;

revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb, text) from public, anon, authenticated;
