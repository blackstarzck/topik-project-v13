-- =====================================================================
-- DOWN · 20260612200100_marketing_consent_in_dispatch
-- 마케팅 consent 분기를 되돌려 hard-coded marketing→'opted_out'(20260612190000)
-- 정의로 dispatch 함수를 복원하고, consent 헬퍼를 제거한다.
--   - private.dispatch_admin_notifications()  → 20260612190000 정의
--   - private.dispatch_notification_event(...) → 20260612190000 정의
--   - private.is_marketing_consented(uuid)    → drop
-- =====================================================================

-- ── 3b. 관리자 발송 (20260612190000 hard-coded opted_out 정의 복원) ──────
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
           coalesce((p.notification_prefs->>v_tpl.template_key)::boolean, false) as pref_on
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
      with ins as (
        insert into public.notification_delivery_attempts
          (dispatch_id, user_id, channel, template_key, status, sent_at)
        select d.id, a2.user_id, 'in_app', v_tpl.template_key,
               case
                 when d.target_type = 'test' then 'sent'
                 when v_tpl.class = 'marketing' then 'opted_out'
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
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, sent_at)
      select d.id, a2.user_id, 'email', v_tpl.template_key,
             case
               when d.target_type = 'test' then 'pending'
               when v_tpl.class = 'marketing' then 'opted_out'
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

-- ── 3c. 이벤트형 (20260612190000 hard-coded opted_out 정의 복원) ─────────
create or replace function private.dispatch_notification_event(
  p_template_key text,
  p_user_id      uuid,
  p_event_id     text,
  p_payload      jsonb default '{}'::jsonb,
  p_channel      text  default null
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
  v_results     jsonb := '[]'::jsonb;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'user_id and event_id required';
  end if;

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
        when v_tpl.class = 'marketing' then 'opted_out'
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
      v_status := case
        when v_tpl.class = 'marketing' then 'opted_out'
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

drop function if exists private.is_marketing_consented(uuid);
