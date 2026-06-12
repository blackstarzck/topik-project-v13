-- =====================================================================
-- TALKPIK AI · Notification feature WP1-1 · 2026-06-12
-- 발송 파이프라인 (in_app 채널) — SQL dispatcher
--
-- 계약 SoT: topik-ai docs/specs/notification-contract.md
--   - 시각 출처: DB now() 단일 기준 (계약 §7 — 이중 시각 출처 금지)
--   - idempotency 2단: dispatch.dedupe_key(슬롯/이벤트) + attempt.dedupe_key(사용자×회차)
--   - class 정책 §2: marketing=동의 필수(저장소 미구현 — 전원 opted_out),
--     mandatory=in_app 강제, learning/transactional=pref 존중, 채널 off=skipped
-- 구현 결정: Edge Function 대신 DB 함수 + pg_cron (환경에 함수 배포 인프라 없음,
--   시각 출처 단일화에 정합 — 증적 로그 WP0-5 절). 시맨틱스는 실행계획안 §5.3 동일.
-- 함수는 private 스키마(PostgREST 미노출), SECURITY DEFINER(owner postgres —
--   bypassrls 실측 확인)로 admin 소유 dispatch/attempt 테이블에 기록한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 렌더링 헬퍼: html → plain text + {{display_name}} 치환 (결측 fallback '학습자')
-- ---------------------------------------------------------------------
create or replace function private.render_notification_text(p_source text, p_display_name text)
returns text
language sql
immutable
as $$
  select replace(
           regexp_replace(coalesce(p_source, ''), '<[^>]+>', '', 'g'),
           '{{display_name}}',
           coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), '학습자'));
$$;

-- ---------------------------------------------------------------------
-- 스케줄형 (study_reminder / weekly_summary)
--   - 후보: 사용자 timezone 기준 오늘 슬롯 도달(같은 현지 날짜 내 catch-up 허용,
--     attempt 일일 dedupe로 1회 상한 — 다운타임 소급 스톰 방지 N-SCH-11)
--   - 동시 실행: tick 단위 dispatch dedupe(N-SCH-03) + attempt dedupe 이중
-- ---------------------------------------------------------------------
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
             -- O-5: 일요일 20:00 (사용자 timezone) 고정 슬롯
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

  -- tick 클레임: 10분 윈도우. 같은 tick의 동시/재실행은 한쪽만 집행한다.
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

  -- 정책 평가 결과를 attempt로 기록 (opt-out 제외자도 opted_out/skipped 집계 — 계약 §2)
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

-- ---------------------------------------------------------------------
-- 관리자 발송 집행 (즉시 running / 예약 도래 scheduled)
--   - 대상: test=actor 본인(선호 우회 — 본인 확인용), group=정적 명단
--     (조건 기반 그룹 해석은 P2 — 미해석 그룹은 target_snapshot에 기록)
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
               when d.target_type = 'test' then 'sent'                         -- 나에게 보내기: 본인 확인용
               when v_tpl.class = 'marketing' then 'opted_out'                 -- 동의 저장소 미구현(H-2) — 전원 제외
               when v_tpl.mandatory then 'sent'                                -- mandatory: in_app 강제 (bypass)
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

-- ---------------------------------------------------------------------
-- 이벤트형 (feedback_ready 등) — 도메인 이벤트 지점에서 호출
--   p_event_id 기반 dispatch dedupe → 같은 이벤트 재처리 시 중복 0건 (N-TRG-03)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 메인 tick (pg_cron 등록 대상 — 20260612180100)
-- ---------------------------------------------------------------------
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

-- private 스키마는 PostgREST 미노출이지만 명시적으로 client 실행 권한 차단
revoke all on function private.render_notification_text(text, text) from public, anon, authenticated;
revoke all on function private.dispatch_scheduled_notifications(text) from public, anon, authenticated;
revoke all on function private.dispatch_admin_notifications() from public, anon, authenticated;
revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.dispatch_notifications() from public, anon, authenticated;

comment on function private.dispatch_notifications() is
  '알림 발송 메인 tick (pg_cron 10분 주기). 스케줄형 2종 + 관리자 발송 집행. 시각 출처 = DB now() 단일 기준.';
