-- =====================================================================
-- DOWN · 20260612190000_notification_email_pipeline
-- Email 파이프라인을 되돌리고 in_app-only dispatcher(20260612180000)를 복원한다.
--   - email 전용 함수(transport stub, finalize, retry) drop
--   - config 테이블 drop
--   - dispatch_* 함수를 20260612180000의 in_app-only 정의로 재선언
-- =====================================================================

-- email 파이프라인 전용 객체 제거 (signature가 바뀐 scheduled 함수도 drop 후 재선언).
drop function if exists private.retry_failed_email_attempts();
drop function if exists private.finalize_email_attempt(uuid, text, text, text);
drop function if exists private.notification_email_transport(text, text, text, uuid);
drop function if exists private.dispatch_scheduled_notifications(text, text);
drop function if exists private.dispatch_notification_event(text, uuid, text, jsonb, text);

drop table if exists public.notification_email_config;

-- ── 20260612180000 in_app-only 정의 복원 ───────────────────────────────

create or replace function private.dispatch_scheduled_notifications(p_template_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_tick        text;
  v_dispatch_id uuid;
  v_sent int; v_skipped int; v_opted int;
begin
  select * into v_tpl
    from public.notification_templates
   where template_key = p_template_key and channel = 'in_app' and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('template', p_template_key, 'result', 'no_active_template');
  end if;

  drop table if exists _ntf_candidates;
  create temp table _ntf_candidates on commit drop as
  select ns.user_id,
         p.display_name,
         ((now() at time zone ns.timezone)::date)::text as local_date,
         coalesce((ns.channels->>'in_app')::boolean, true) as in_app_on,
         coalesce((p.notification_prefs->>p_template_key)::boolean, false) as pref_on
    from public.notification_settings ns
    join public.profiles p on p.id = ns.user_id
   where case
           when p_template_key = 'study_reminder' then
             ns.reminder_time is not null
             and ns.reminder_days @> to_jsonb(extract(dow from (now() at time zone ns.timezone))::int)
             and (now() at time zone ns.timezone)::time >= ns.reminder_time
           when p_template_key = 'weekly_summary' then
             extract(dow from (now() at time zone ns.timezone))::int = 0
             and (now() at time zone ns.timezone)::time >= time '20:00'
           else false
         end
     and not exists (
           select 1 from public.notification_delivery_attempts a
            where a.dedupe_key = ns.user_id::text || ':' || p_template_key || ':'
                                 || ((now() at time zone ns.timezone)::date)::text
         );

  if (select count(*) from _ntf_candidates) = 0 then
    return jsonb_build_object('template', p_template_key, 'result', 'no_candidates');
  end if;

  v_tick := to_char(
    date_trunc('hour', now()) + (floor(extract(minute from now())::numeric / 10) * interval '10 minutes'),
    'YYYY-MM-DD"T"HH24:MI"Z"');
  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
  values
    (v_tpl.id, p_template_key, jsonb_build_array('in_app'), 'schedule', 'running',
     'sched:' || p_template_key || ':' || v_tick, now())
  on conflict (dedupe_key) do nothing
  returning id into v_dispatch_id;
  if v_dispatch_id is null then
    return jsonb_build_object('template', p_template_key, 'result', 'tick_already_claimed', 'tick', v_tick);
  end if;

  with ins as (
    insert into public.notification_delivery_attempts
      (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
    select v_dispatch_id, c.user_id, 'in_app', p_template_key,
           case when not c.pref_on then 'opted_out'
                when not c.in_app_on then 'skipped'
                else 'sent' end,
           c.user_id::text || ':' || p_template_key || ':' || c.local_date,
           case when c.pref_on and c.in_app_on then now() else null end
      from _ntf_candidates c
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning id, user_id, status
  )
  insert into public.user_notifications
    (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
  select i.user_id, p_template_key, v_tpl.category,
         private.render_notification_text(v_tpl.subject, c.display_name),
         private.render_notification_text(v_tpl.body_html, c.display_name),
         v_tpl.link_url, i.id
    from ins i
    join _ntf_candidates c on c.user_id = i.user_id
   where i.status = 'sent';

  select count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'skipped'),
         count(*) filter (where status = 'opted_out')
    into v_sent, v_skipped, v_opted
    from public.notification_delivery_attempts
   where dispatch_id = v_dispatch_id;

  update public.notification_dispatches
     set status = 'completed',
         recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0) + coalesce(v_opted,0),
         completed_at = now()
   where id = v_dispatch_id;

  return jsonb_build_object('template', p_template_key, 'dispatch_id', v_dispatch_id,
                            'sent', v_sent, 'skipped', v_skipped, 'opted_out', v_opted);
end;
$$;

create or replace function private.dispatch_admin_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  d        record;
  v_tpl    public.notification_templates%rowtype;
  v_sent int; v_skipped int; v_opted int;
  v_results jsonb := '[]'::jsonb;
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
           coalesce((ns.channels->>'in_app')::boolean, true) as in_app_on,
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

    with ins as (
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, sent_at)
      select d.id, a.user_id, 'in_app', v_tpl.template_key,
             case
               when d.target_type = 'test' then 'sent'
               when v_tpl.class = 'marketing' then 'opted_out'
               when v_tpl.mandatory then 'sent'
               when v_tpl.class in ('learning','transactional') and not a.pref_on then 'opted_out'
               when not a.in_app_on then 'skipped'
               else 'sent' end,
             now()
        from _ntf_audience a
      on conflict (dispatch_id, user_id, channel) do nothing
      returning id, user_id, status
    )
    insert into public.user_notifications
      (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
    select i.user_id, v_tpl.template_key, v_tpl.category,
           private.render_notification_text(v_tpl.subject, a.display_name),
           private.render_notification_text(v_tpl.body_html, a.display_name),
           v_tpl.link_url, i.id
      from ins i
      join _ntf_audience a on a.user_id = i.user_id
     where i.status = 'sent';

    select count(*) filter (where status = 'sent'),
           count(*) filter (where status = 'skipped'),
           count(*) filter (where status = 'opted_out')
      into v_sent, v_skipped, v_opted
      from public.notification_delivery_attempts
     where dispatch_id = d.id;

    update public.notification_dispatches
       set status = 'completed',
           recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0) + coalesce(v_opted,0),
           completed_at = now()
     where id = d.id;

    v_results := v_results || jsonb_build_object('dispatch', d.id,
                  'sent', v_sent, 'skipped', v_skipped, 'opted_out', v_opted);
  end loop;

  return jsonb_build_object('processed', jsonb_array_length(v_results), 'dispatches', v_results);
end;
$$;

create or replace function private.dispatch_notification_event(
  p_template_key text,
  p_user_id      uuid,
  p_event_id     text,
  p_payload      jsonb default '{}'::jsonb
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
  v_pref_on     boolean;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'user_id and event_id required';
  end if;

  select * into v_tpl
    from public.notification_templates
   where template_key = p_template_key and channel = 'in_app' and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('result', 'no_active_template', 'template', p_template_key);
  end if;

  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
  values
    (v_tpl.id, p_template_key, jsonb_build_array('in_app'), 'event', 'running',
     'event:' || p_template_key || ':' || p_event_id, now())
  on conflict (dedupe_key) do nothing
  returning id into v_dispatch_id;
  if v_dispatch_id is null then
    return jsonb_build_object('result', 'deduped', 'event_id', p_event_id);
  end if;

  select p.display_name,
         coalesce((ns.channels->>'in_app')::boolean, true),
         coalesce((p.notification_prefs->>p_template_key)::boolean, false)
    into v_display, v_in_app_on, v_pref_on
    from public.profiles p
    left join public.notification_settings ns on ns.user_id = p.id
   where p.id = p_user_id;
  if not found then
    update public.notification_dispatches set status = 'failed', completed_at = now() where id = v_dispatch_id;
    return jsonb_build_object('result', 'unknown_user');
  end if;

  v_status := case
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

  update public.notification_dispatches
     set status = 'completed', recipient_count = 1, completed_at = now()
   where id = v_dispatch_id;

  return jsonb_build_object('result', v_status, 'dispatch_id', v_dispatch_id, 'attempt_id', v_attempt_id);
end;
$$;

create or replace function private.dispatch_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return jsonb_build_object(
    'at', now(),
    'study_reminder', private.dispatch_scheduled_notifications('study_reminder'),
    'weekly_summary', private.dispatch_scheduled_notifications('weekly_summary'),
    'admin', private.dispatch_admin_notifications()
  );
end;
$$;

revoke all on function private.dispatch_scheduled_notifications(text) from public, anon, authenticated;
revoke all on function private.dispatch_admin_notifications() from public, anon, authenticated;
revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.dispatch_notifications() from public, anon, authenticated;
