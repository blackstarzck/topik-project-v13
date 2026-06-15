-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Email notification pipeline (provider-AGNOSTIC) — SQL dispatcher extension
--
-- 계약 SoT: topik-ai docs/specs/notification-contract.md
--   - 채널: in_app / email / push / zalo. class: transactional / operational /
--     learning / marketing. marketing=동의 필수(저장소 H-2 미구현 → 전원 opted_out).
--
-- 정직성 경계 (CRITICAL):
--   이 파이프라인은 이메일 발송을 "결정·기록"하고, 성공/실패를 모사하는 TEST
--   transport를 제공한다. 실제 메일 provider 통합이 아니다(H-4 — provider 미선정).
--   attempt.status='sent'의 의미는 "파이프라인이 설정된 transport에 메시지를
--   넘겼고 transport가 성공을 반환했다"일 뿐, "실제 받은편지함에 도달했다"가 아니다.
--   기본 transport mode='disabled' → 'skipped'(reason no_transport)로 기록하여
--   provider 부재 시 프로덕션 동작이 정직하도록 한다.
--   'live' 모드 본문은 향후 실제 provider HTTP 호출이 들어갈 지점이며, 본 마이그
--   레이션은 실제 호출을 구현하지 않는다(placeholder).
--
-- 시각 출처: DB now() 단일 기준 (계약 §7). idempotency 2단 유지.
-- 함수는 private 스키마(PostgREST 미노출) + SECURITY DEFINER.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Email transport config (단일 행, service-role/SECURITY DEFINER only)
-- ---------------------------------------------------------------------
create table if not exists public.notification_email_config (
  id         boolean primary key default true check (id),
  mode       text not null default 'disabled'
             check (mode in ('disabled','test_success','test_fail','test_fail_once','live')),
  updated_at timestamptz not null default now()
);

insert into public.notification_email_config (id, mode)
values (true, 'disabled')
on conflict (id) do nothing;

comment on table public.notification_email_config is
  'Email transport 모드 단일 행. disabled(기본,프로덕션 정직) / test_* (검증용) / live(H-4 provider 미구현). '
  'RLS force + 정책 없음 → SECURITY DEFINER 함수와 service_role만 접근.';

-- RLS: enable + force, 정책 없음 (client 전면 차단).
alter table public.notification_email_config enable row level security;
alter table public.notification_email_config force  row level security;
revoke all on public.notification_email_config from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Transport stub — config.mode에 따라 성공/실패/스킵을 모사한다.
--    실제 provider 호출은 'live' 분기(아래 명시)에 들어갈 미래 통합 지점.
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
  v_mode  text;
  v_retry int;
begin
  select mode into v_mode from public.notification_email_config where id = true;
  v_mode := coalesce(v_mode, 'disabled');

  if v_mode = 'disabled' then
    -- provider 미구성 — 정직하게 스킵. 'sent'로 위장하지 않는다.
    return jsonb_build_object('ok', false, 'skip', true, 'reason', 'no_transport');

  elsif v_mode = 'test_success' then
    return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));

  elsif v_mode = 'test_fail' then
    return jsonb_build_object('ok', false, 'error_code', 'test_error',
                             'error_message', 'simulated provider failure');

  elsif v_mode = 'test_fail_once' then
    -- 첫 시도(retry_count=0)는 실패, 재시도(retry_count>=1)는 성공 →
    -- 재시도-후-성공 + 중복 무발송을 검증할 수 있게 한다.
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
    -- FUTURE PROVIDER INTEGRATION POINT (H-4)
    -- 실제 메일 provider가 선정되면 이곳에서 HTTP 호출(pg_net 또는 외부
    -- 워커 큐)을 수행하고 그 결과를 {ok, provider_message_id|error_code,
    -- error_message} 형태로 반환한다. 현재는 provider 미선정 — 실제 호출을
    -- 구현하지 않으며, 'sent'를 거짓으로 반환하지 않는다.
    -- ===============================================================
    return jsonb_build_object('ok', false, 'error_code', 'no_live_provider',
                             'error_message', 'live transport not configured (H-4)');

  else
    return jsonb_build_object('ok', false, 'error_code', 'unknown_mode',
                             'error_message', 'unrecognized transport mode: ' || v_mode);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2b. 이메일 1건 집행 헬퍼 — pending attempt를 받아 transport 호출 후 종결 처리.
--     dispatcher 분기에서 공유한다(중복 코드 방지). attempt는 이미 'pending'으로
--     존재해야 한다. transport 결과로 sent/skipped/failed를 확정한다.
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

-- ---------------------------------------------------------------------
-- 3a. 스케줄형 (study_reminder / weekly_summary) — channel-aware.
--     기존 함수는 channel='in_app' 고정이었다. p_channel 파라미터로 확장하되
--     in_app 경로의 시맨틱스는 그대로 보존한다.
--       - in_app: 후보 평가 → attempt(in_app) + user_notifications insert.
--       - email : user_notifications insert 안 함. 자격 평가(pref+channels.email),
--                 eligible는 'pending' attempt 후 transport 호출로 종결.
--                 dedupe_key/dispatch dedupe에 channel을 포함해 in_app과 충돌 방지.
-- ---------------------------------------------------------------------
-- 기존 single-arg overload 제거 (channel 파라미터가 추가된 2-arg 버전으로 대체).
drop function if exists private.dispatch_scheduled_notifications(text);

create or replace function private.dispatch_scheduled_notifications(
  p_template_key text,
  p_channel      text default 'in_app'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_tick        text;
  v_dispatch_id uuid;
  v_sent int; v_skipped int; v_opted int; v_failed int;
  c record;
begin
  if p_channel not in ('in_app','email') then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel, 'result', 'unsupported_channel');
  end if;

  select * into v_tpl
    from public.notification_templates
   where template_key = p_template_key and channel = p_channel and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel, 'result', 'no_active_template');
  end if;

  drop table if exists _ntf_candidates;
  create temp table _ntf_candidates on commit drop as
  select ns.user_id,
         p.display_name,
         ((now() at time zone ns.timezone)::date)::text as local_date,
         coalesce((ns.channels->>'in_app')::boolean, true)  as in_app_on,
         coalesce((ns.channels->>'email')::boolean, false)  as email_on,
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
            where a.dedupe_key = case
                   when p_channel = 'email'
                     then ns.user_id::text || ':' || p_template_key || ':email:'
                          || ((now() at time zone ns.timezone)::date)::text
                   else ns.user_id::text || ':' || p_template_key || ':'
                          || ((now() at time zone ns.timezone)::date)::text
                 end
         );

  if (select count(*) from _ntf_candidates) = 0 then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel, 'result', 'no_candidates');
  end if;

  -- tick 클레임: 10분 윈도우. channel을 포함해 in_app/email 디스패치가 충돌하지 않게 한다.
  v_tick := to_char(
    date_trunc('hour', now()) + (floor(extract(minute from now())::numeric / 10) * interval '10 minutes'),
    'YYYY-MM-DD"T"HH24:MI"Z"');
  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
  values
    (v_tpl.id, p_template_key, jsonb_build_array(p_channel), 'schedule', 'running',
     'sched:' || p_channel || ':' || p_template_key || ':' || v_tick, now())
  on conflict (dedupe_key) do nothing
  returning id into v_dispatch_id;
  if v_dispatch_id is null then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel,
                              'result', 'tick_already_claimed', 'tick', v_tick);
  end if;

  if p_channel = 'in_app' then
    -- ── in_app 경로 (기존 시맨틱스 보존) ────────────────────────────────
    with ins as (
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      select v_dispatch_id, c2.user_id, 'in_app', p_template_key,
             case when not c2.pref_on then 'opted_out'
                  when not c2.in_app_on then 'skipped'
                  else 'sent' end,
             c2.user_id::text || ':' || p_template_key || ':' || c2.local_date,
             case when c2.pref_on and c2.in_app_on then now() else null end
        from _ntf_candidates c2
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id, user_id, status
    )
    insert into public.user_notifications
      (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
    select i.user_id, p_template_key, v_tpl.category,
           private.render_notification_text(v_tpl.subject, c3.display_name),
           private.render_notification_text(v_tpl.body_html, c3.display_name),
           v_tpl.link_url, i.id
      from ins i
      join _ntf_candidates c3 on c3.user_id = i.user_id
     where i.status = 'sent';

  else
    -- ── email 경로 (user_notifications insert 없음) ─────────────────────
    -- 1) 자격 미달자(opted_out/skipped)는 attempt만 기록.
    insert into public.notification_delivery_attempts
      (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
    select v_dispatch_id, c2.user_id, 'email', p_template_key,
           -- learning class: pref 존중 + channels.email 존중. (study_reminder/
           -- weekly_summary는 learning, mandatory 아님.)
           case when not c2.pref_on  then 'opted_out'
                when not c2.email_on then 'skipped'
                else 'pending' end,
           c2.user_id::text || ':' || p_template_key || ':email:' || c2.local_date,
           null
      from _ntf_candidates c2
    on conflict (dedupe_key) where dedupe_key is not null do nothing;

    -- 2) pending(자격 통과) attempt마다 transport 호출 → sent/skipped/failed 종결.
    for c in
      select a.id as attempt_id,
             private.render_notification_text(v_tpl.subject, cand.display_name)   as subject,
             private.render_notification_text(v_tpl.body_html, cand.display_name) as body
        from public.notification_delivery_attempts a
        join _ntf_candidates cand on cand.user_id = a.user_id
       where a.dispatch_id = v_dispatch_id and a.status = 'pending'
    loop
      perform private.finalize_email_attempt(
        c.attempt_id,
        null,  -- p_to: provider 통합 시 사용자 이메일 주입(현재 stub은 미사용)
        c.subject,
        c.body);
    end loop;
  end if;

  select count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'skipped'),
         count(*) filter (where status = 'opted_out'),
         count(*) filter (where status = 'failed')
    into v_sent, v_skipped, v_opted, v_failed
    from public.notification_delivery_attempts
   where dispatch_id = v_dispatch_id;

  update public.notification_dispatches
     set status = case when coalesce(v_failed,0) > 0 then 'partial_failed' else 'completed' end,
         recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0)
                           + coalesce(v_opted,0) + coalesce(v_failed,0),
         completed_at = now()
   where id = v_dispatch_id;

  return jsonb_build_object('template', p_template_key, 'channel', p_channel,
                            'dispatch_id', v_dispatch_id, 'sent', v_sent,
                            'skipped', v_skipped, 'opted_out', v_opted, 'failed', v_failed);
end;
$$;

-- ---------------------------------------------------------------------
-- 3b. 관리자 발송 — v_tpl.channel로 분기.
--     템플릿은 단일 channel을 가지므로 디스패치별로 분기한다.
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
      -- ── in_app 경로 (기존 시맨틱스 보존) ──────────────────────────────
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
      -- ── email 경로 (user_notifications insert 없음) ───────────────────
      -- 자격 평가 후 'pending'으로 attempt 기록(또는 opted_out/skipped 종결).
      --   test 대상: 본인 확인용 → 자격 평가 우회하고 발송 시도(pending).
      --   marketing: 동의 저장소 H-2 미구현 → opted_out.
      --   mandatory + operational: in_app만 강제 가능(계약 §2) — email은 강제 불가
      --     하므로 pref/channel 존중. (operational pref 키 부재 시 pref_on=false →
      --     opted_out. 현행 계약상 operational email 토글 노출 범위 O-8 미정.)
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

-- ---------------------------------------------------------------------
-- 3c. 이벤트형 (feedback_ready 등) — 활성 channel별로 분기 디스패치.
--     계약 §3: feedback_ready는 in_app+email 양쪽으로 발송될 수 있다. 활성
--     템플릿이 여러 channel을 가지면 각 channel을 독립 dispatch로 집행한다.
--     p_channel을 지정하면 해당 channel만 집행한다(검증/선택 발송용).
--     각 dispatch dedupe_key·attempt dedupe_key에 channel을 포함해 충돌 방지.
-- ---------------------------------------------------------------------
-- 이전 4-arg 버전을 새 5-arg(p_channel 추가) 버전으로 교체.
drop function if exists private.dispatch_notification_event(text, uuid, text, jsonb);

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
      -- 자격 평가: marketing→opted_out, learning/transactional/operational→pref+channels.email.
      -- mandatory operational은 email 강제 불가(계약 §2)이므로 pref/channel 존중.
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

-- ---------------------------------------------------------------------
-- 4. 실패 email attempt 재시도 (최대 3회). 3회 도달 시 terminal.
--    transport 재호출 → 성공이면 'sent', 실패면 retry_count++ 후 'failed' 유지.
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
    -- retry_count를 먼저 증가시킨다(transport가 retry_count를 읽는 test_fail_once
    -- 모드가 증가분을 본다 → 재시도-후-성공 검증).
    update public.notification_delivery_attempts
       set retry_count = retry_count + 1
     where id = r.id;

    -- 렌더 텍스트 재구성 (display_name fallback 동일).
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
      -- 실패 유지(retry_count는 이미 증가). 3회 도달 시 다음 호출부터 제외.
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

-- ---------------------------------------------------------------------
-- 5. 메인 tick — in_app 경로 보존 + email 스케줄형 2종 + email 재시도 추가.
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
    'study_reminder',       private.dispatch_scheduled_notifications('study_reminder', 'in_app'),
    'weekly_summary',       private.dispatch_scheduled_notifications('weekly_summary', 'in_app'),
    'study_reminder_email', private.dispatch_scheduled_notifications('study_reminder', 'email'),
    'weekly_summary_email', private.dispatch_scheduled_notifications('weekly_summary', 'email'),
    'admin',                private.dispatch_admin_notifications(),
    'email_retry',          private.retry_failed_email_attempts()
  );
end;
$$;

-- private 스키마는 PostgREST 미노출이지만 명시적으로 client 실행 권한 차단.
revoke all on function private.notification_email_transport(text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.finalize_email_attempt(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.dispatch_scheduled_notifications(text, text) from public, anon, authenticated;
revoke all on function private.dispatch_admin_notifications() from public, anon, authenticated;
revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function private.retry_failed_email_attempts() from public, anon, authenticated;
revoke all on function private.dispatch_notifications() from public, anon, authenticated;

comment on function private.notification_email_transport(text, text, text, uuid) is
  'Email transport STUB (provider-agnostic). disabled→skip(no_transport); test_*→모사 성공/실패; live→placeholder(H-4, 실제 호출 미구현). sent는 "transport 성공 반환"이지 "실제 수신"이 아니다.';
comment on function private.retry_failed_email_attempts() is
  'failed email attempt 재시도 (최대 3회, 3회 도달 시 terminal). dispatch_notifications tick에서 호출.';
comment on function private.dispatch_notifications() is
  '알림 발송 메인 tick (pg_cron 10분 주기). 스케줄형 in_app·email + 관리자 발송 + email 재시도. 시각 출처 = DB now() 단일 기준.';
