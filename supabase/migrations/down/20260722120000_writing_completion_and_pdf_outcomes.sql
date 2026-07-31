-- down: 20260722120000_writing_completion_and_pdf_outcomes 롤백 (B4 배치 전체).
--
-- 이 파일은 B4 배치(20260722120000 + 20260729120000, 단일 트랜잭션 적용)의
-- 롤백 본체다. down/20260729120000 은 문서화된 no-op 이며, 반드시 그 파일에
-- 이어 같은 트랜잭션에서 이 파일을 실행한다. 수행 내용:
--
--   1) list_user_problems 를 배치 적용 직전 라이브 정의로 복원:
--      20260713083000 본문(반환 23필드, 완료/시도 집계 분리 없음)에
--      20260714140000 이 pg_get_functiondef 치환으로 확립한 post-cutover
--      catalog CTE 를 얹은 형태. 반환 테이블이 다르므로 drop 후 create.
--   2) get_dashboard_kpi 를 직전 정의(20260709120000, 제출 수 기준 카운트)로
--      복원. 창 전체 롤백에서는 down/20260723234527 이 먼저 함수를 public 으로
--      되돌려 두므로 create or replace 로 본문만 교체된다.
--   3) export_files 의 failure_code / failed_at 컬럼과 제약 2개 제거.
--
-- 데이터 손실 경고:
--   * failure_code / failed_at 컬럼 drop 은 실패 분류·실패 시각 데이터를
--     삭제한다. 운영 환경에서는 실행 전 백업 필수.
--   * forward 의 데이터 정규화(기존 failed 행의 ready_at -> failed_at 이동 후
--     ready_at=null)는 되돌리지 않는다. 20260724140000 의 cutover 도 같은
--     failure_code('legacy_unknown')를 쓰므로 두 출처를 구분할 수 없고,
--     복원 전 상태에서도 failed 행의 ready_at 은 필수가 아니었다(일방향).

begin;

-- ---------------------------------------------------------------------
-- 1. list_user_problems: pre-B4 라이브 정의(23필드) 복원
-- ---------------------------------------------------------------------
drop function if exists public.list_user_problems(jsonb, text, integer, integer);

create function public.list_user_problems(
  filter jsonb default '{}'::jsonb,
  sort text default 'newest',
  page int default 1,
  page_size int default 20
)
returns table (
  problem_id uuid,
  title text,
  domain text,
  topik_level smallint,
  question_no smallint,
  difficulty smallint,
  tags text[],
  attempt_count int,
  is_solved boolean,
  last_attempt_at timestamptz,
  created_at timestamptz,
  total_count bigint,
  solve_state text,
  has_draft boolean,
  draft_status text,
  writing_submission_count int,
  latest_submission_id uuid,
  latest_submission_at timestamptz,
  writing_feedback_status text,
  lifecycle_status text,
  lifecycle_reason text,
  publish_status text,
  review_status text
)
language plpgsql
set search_path = pg_catalog, public, private
stable
as $$
declare
  caller_id uuid := auth.uid();
  v_page int := greatest(coalesce(page, 1), 1);
  v_size int := least(greatest(coalesce(page_size, 20), 1), 100);
  v_offset int;
  f jsonb := coalesce(filter, '{}'::jsonb);
  f_domain text := nullif(f->>'domain', '');
  f_level int := nullif(f->>'topik_level', '')::int;
  f_qno int := nullif(f->>'question_no', '')::int;
  f_diff int := nullif(f->>'difficulty', '')::int;
  f_status text := nullif(f->>'status', '');
  f_search text := nullif(btrim(coalesce(f->>'search', '')), '');
  f_recommended boolean := coalesce((f->>'recommended')::boolean, false);
  f_review_set_id uuid := nullif(f->>'review_set_id', '')::uuid;
  v_sort text := coalesce(nullif(sort, ''), 'newest');
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  v_offset := (v_page - 1) * v_size;

  return query
  with catalog as (
    select
      problem.id,
      problem.title,
      problem.domain,
      problem.topik_level,
      problem.question_no,
      problem.difficulty,
      problem.tags,
      problem.created_at,
      problem.lifecycle_status,
      problem.lifecycle_reason,
      problem.publish_status,
      problem.review_status
    from public.problems problem
    where problem.publish_status = 'published'
      and problem.domain <> 'writing'

    union all

    select
      canonical.problem_id,
      canonical.title,
      'writing'::text,
      canonical.topik_level,
      canonical.item_number,
      canonical.difficulty,
      canonical.tags,
      canonical.source_created_at,
      'active'::text,
      null::text,
      'published'::text,
      'approved'::text
    from public.get_available_writing_questions(null, null) canonical
  ),
  visible as (
    select catalog.*
    from catalog
    where (f_domain is null or catalog.domain = f_domain)
      and (f_level is null or catalog.topik_level = f_level)
      and (f_qno is null or catalog.question_no = f_qno)
      and (f_diff is null or catalog.difficulty = f_diff)
      and (f_search is null or catalog.title ilike '%' || f_search || '%')
      and (
        f_review_set_id is null
        or exists (
          select 1
          from public.study_events event
          cross join lateral jsonb_array_elements_text(
            event.payload->'item_ids'
          ) as selected(item_id)
          join public.library_items library
            on library.id = selected.item_id::uuid
          left join public.writing_submissions submission
            on submission.id = library.submission_id
          where event.id = f_review_set_id
            and event.user_id = caller_id
            and event.event_type = 'review_set_created'
            and library.user_id = caller_id
            and (
              library.problem_id = catalog.id
              or submission.problem_id = catalog.id
            )
        )
      )
      and (
        not f_recommended
        or exists (
          select 1
          from public.recommendation_items item
          join public.recommendation_runs run on run.id = item.run_id
          where item.problem_id = catalog.id
            and run.user_id = caller_id
            and coalesce(item.status, 'active') = 'active'
            and (run.expires_at is null or run.expires_at > now())
        )
      )
  ),
  with_activity as (
    select
      visible.*,
      coalesce(attempt.objective_attempt_count, 0) as objective_attempt_count,
      coalesce(attempt.objective_is_solved, false) as objective_is_solved,
      attempt.objective_last_attempt_at,
      coalesce(draft.has_draft, false) as has_draft,
      draft.draft_status,
      draft.latest_draft_at,
      coalesce(submission.writing_submission_count, 0) as writing_submission_count,
      submission.latest_submission_id,
      submission.latest_submission_at,
      submission.writing_feedback_status
    from visible
    left join lateral (
      select
        count(*)::int as objective_attempt_count,
        coalesce(bool_or(problem_attempt.is_correct), false) as objective_is_solved,
        max(problem_attempt.started_at) as objective_last_attempt_at
      from public.problem_attempts problem_attempt
      where problem_attempt.problem_id = visible.id
        and problem_attempt.user_id = caller_id
    ) attempt on true
    left join lateral (
      select
        (count(*) > 0) as has_draft,
        (array_agg(
          writing_draft.autosave_status
          order by writing_draft.last_saved_at desc nulls last
        ))[1] as draft_status,
        max(writing_draft.last_saved_at) as latest_draft_at
      from public.writing_drafts writing_draft
      where writing_draft.problem_id = visible.id
        and writing_draft.user_id = caller_id
        and writing_draft.autosave_status <> 'superseded'
    ) draft on true
    left join lateral (
      select
        count(*)::int as writing_submission_count,
        (array_agg(
          writing_submission.id
          order by writing_submission.submitted_at desc
        ))[1] as latest_submission_id,
        max(writing_submission.submitted_at) as latest_submission_at,
        (array_agg(
          writing_submission.feedback_status
          order by writing_submission.submitted_at desc
        ))[1] as writing_feedback_status
      from public.writing_submissions writing_submission
      where writing_submission.problem_id = visible.id
        and writing_submission.user_id = caller_id
    ) submission on true
  ),
  with_status as (
    select
      activity.*,
      case
        when activity.domain = 'writing'
          and activity.writing_submission_count > 0 then 'submitted'
        when activity.domain = 'writing' and activity.has_draft then 'attempted'
        when activity.domain <> 'writing'
          and activity.objective_is_solved then 'submitted'
        when activity.domain <> 'writing'
          and activity.objective_attempt_count > 0 then 'attempted'
        else 'none'
      end as solve_state,
      case
        when activity.domain = 'writing' then
          activity.writing_submission_count
          + case
              when activity.has_draft
                and activity.writing_submission_count = 0 then 1
              else 0
            end
        else activity.objective_attempt_count
      end as effective_attempt_count,
      case
        when activity.domain = 'writing' then
          activity.writing_submission_count > 0
        else activity.objective_is_solved
      end as effective_is_solved,
      case
        when activity.domain = 'writing' then
          case
            when activity.latest_submission_at is not null
              and activity.latest_draft_at is not null
              then greatest(
                activity.latest_submission_at,
                activity.latest_draft_at
              )
            else coalesce(
              activity.latest_submission_at,
              activity.latest_draft_at
            )
          end
        else activity.objective_last_attempt_at
      end as effective_last_attempt_at
    from with_activity activity
  ),
  filtered as (
    select status.*
    from with_status status
    where f_status is null
       or (f_status = 'solved' and status.solve_state = 'submitted')
       or (f_status = 'attempted' and status.solve_state = 'attempted')
       or (f_status = 'unattempted' and status.solve_state = 'none')
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id,
    counted.title,
    counted.domain,
    counted.topik_level,
    counted.question_no,
    counted.difficulty,
    counted.tags,
    counted.effective_attempt_count,
    counted.effective_is_solved,
    counted.effective_last_attempt_at,
    counted.created_at,
    counted.total_count,
    counted.solve_state,
    counted.has_draft,
    counted.draft_status,
    counted.writing_submission_count,
    counted.latest_submission_id,
    counted.latest_submission_at,
    counted.writing_feedback_status,
    counted.lifecycle_status,
    counted.lifecycle_reason,
    counted.publish_status,
    counted.review_status
  from counted
  order by
    case
      when v_sort in ('difficulty-asc', 'difficulty')
        then counted.difficulty
    end asc nulls last,
    case when v_sort = 'difficulty-desc' then counted.difficulty end desc nulls last,
    case when v_sort = 'oldest' then counted.created_at end asc nulls last,
    case
      when v_sort in (
        'newest',
        'recent',
        'difficulty',
        'difficulty-asc',
        'difficulty-desc'
      ) then counted.created_at
    end desc nulls last,
    counted.id asc
  limit v_size offset v_offset;
end;
$$;

revoke all on function public.list_user_problems(jsonb, text, int, int) from public;
revoke all on function public.list_user_problems(jsonb, text, int, int) from anon;
grant execute on function public.list_user_problems(jsonb, text, int, int) to authenticated;

comment on function public.list_user_problems(jsonb, text, int, int) is
  'Mixed-domain list. In canonical DB mode, writing catalog rows come from the learner-safe canonical RPC while stable UUID activity joins remain in v13.';

-- ---------------------------------------------------------------------
-- 2. get_dashboard_kpi: 직전 정의(20260709120000) 복원
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard_kpi()
returns table (
  today_attempts int,
  total_attempts int,
  exam_days_left int,
  streak_days int
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  today_start timestamptz := (today_kst::timestamp at time zone 'Asia/Seoul');
  today_end timestamptz := ((today_kst + interval '1 day')::timestamp at time zone 'Asia/Seoul');
  exam_d date;
  edl int;
  sd int;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  select count(*)::int into today_attempts
    from public.writing_submissions
    where user_id = caller_id
      and submitted_at >= today_start
      and submitted_at < today_end;

  select count(*)::int into total_attempts
    from public.writing_submissions
    where user_id = caller_id;

  select exam_date into exam_d
    from public.learning_goals
    where user_id = caller_id
    limit 1;
  if exam_d is null then
    edl := null;
  else
    edl := (exam_d - today_kst);
    if edl < 0 then edl := null; end if;
  end if;
  exam_days_left := edl;

  with event_days as (
    select distinct (se.occurred_at at time zone 'Asia/Seoul')::date as d
    from public.study_events se
    where se.user_id = caller_id
  ),
  latest as (
    select max(d) as max_d
    from event_days
    where d <= today_kst
  ),
  ranked_days as (
    select ed.d,
           row_number() over (order by ed.d desc) as rn,
           latest.max_d
    from event_days ed
    cross join latest
    where ed.d <= today_kst
  )
  select case
    when (select max_d from latest) >= today_kst - 1
    then (
      select count(*)::int
      from ranked_days
      where d = max_d - (rn - 1)::int
    )
    else 0
  end into sd;
  streak_days := coalesce(sd, 0);

  return next;
end;
$$;

revoke all on function public.get_dashboard_kpi() from public;
grant execute on function public.get_dashboard_kpi() to authenticated;
comment on function public.get_dashboard_kpi() is
  'Dashboard KPI in 1 round-trip. Submission counts use writing_submissions; streak uses study_events KST days. No args -> caller is always auth.uid().';

-- ---------------------------------------------------------------------
-- 3. export_files: 실패 결과 컬럼/제약 제거 (데이터 손실 — 위 경고 참조)
-- ---------------------------------------------------------------------
alter table public.export_files
  drop constraint if exists export_files_failure_terminal_shape;
alter table public.export_files
  drop constraint if exists export_files_failure_code_allowed;

alter table public.export_files
  drop column if exists failure_code,
  drop column if exists failed_at;

commit;
