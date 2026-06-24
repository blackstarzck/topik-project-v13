-- 흔적 0 검증: 단일 DO 블록 = 단일 트랜잭션.
-- (1) 마이그레이션(인덱스 + 새 RPC)을 트랜잭션 안에서 적용,
-- (2) 4개 시나리오 단언,
-- (3) 끝에서 sentinel 예외를 던져 전체(DDL+데이터) 롤백.
-- 성공: 응답 메시지에 DEDUP_VERIFIED_OK. 실패: 어느 단계가 깨졌는지 *_FAIL_*.
do $verify$
declare
  v_user uuid;
  v_problem uuid := gen_random_uuid();
  v_dA uuid := gen_random_uuid();
  v_dB uuid := gen_random_uuid();
  v_dC uuid := gen_random_uuid();
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; cnt int;
begin
  -- ── 마이그레이션 적용 (트랜잭션 내, 롤백됨) ──
  create unique index if not exists writing_submissions_draft_active_unique
    on public.writing_submissions (draft_id)
    where draft_id is not null and feedback_status <> 'failed';

  create or replace function public.create_external_writing_submission(submission jsonb)
  returns uuid language plpgsql security definer set search_path = pg_catalog, public
  as $fnbody$
  declare
    owner_id uuid;
    external_submission_id uuid;
    v_draft_id uuid;
    next_status text;
    existing_id uuid;
  begin
    if not (submission ? 'user_id') or jsonb_typeof(submission->'user_id') <> 'string' then
      raise exception 'submission.user_id required (string uuid)';
    end if;
    begin
      owner_id := (submission->>'user_id')::uuid;
    exception when others then
      raise exception 'submission.user_id must be a valid uuid';
    end;
    perform private.assert_submission_payload(submission, '[]'::jsonb, '[]'::jsonb);
    perform private.assert_writing_problem_submittable(
      (submission->>'problem_id')::uuid, (submission->>'question_no')::smallint);
    if not (submission ? 'external_submission_id') or jsonb_typeof(submission->'external_submission_id') <> 'string' then
      raise exception 'submission.external_submission_id required (string uuid)';
    end if;
    begin
      external_submission_id := (submission->>'external_submission_id')::uuid;
    exception when others then
      raise exception 'submission.external_submission_id must be a valid uuid';
    end;
    next_status := coalesce(submission->>'feedback_status', 'analyzing');
    if next_status not in ('analyzing','failed') then
      raise exception 'submission.feedback_status must be analyzing or failed';
    end if;
    v_draft_id := case when submission ? 'draft_id' and jsonb_typeof(submission->'draft_id') = 'string'
                       then (submission->>'draft_id')::uuid else null end;
    if v_draft_id is not null and not exists (
      select 1 from public.writing_drafts
       where id = v_draft_id and user_id = owner_id
         and problem_id = (submission->>'problem_id')::uuid
         and question_no = (submission->>'question_no')::smallint
    ) then
      raise exception 'draft_not_owned';
    end if;
    if v_draft_id is not null and next_status <> 'failed' then
      select id into existing_id from public.writing_submissions
        where draft_id = v_draft_id and feedback_status <> 'failed' limit 1;
      if existing_id is not null then return existing_id; end if;
    end if;
    begin
      insert into public.writing_submissions (
        id, user_id, problem_id, draft_id, question_no,
        answer_text, answer_json, char_count, feedback_status)
      values (
        external_submission_id, owner_id, (submission->>'problem_id')::uuid, v_draft_id,
        (submission->>'question_no')::smallint, submission->>'answer_text',
        case when submission ? 'answer_json' then submission->'answer_json' else null end,
        (submission->>'char_count')::int, next_status);
    exception when unique_violation then
      if v_draft_id is not null then
        select id into existing_id from public.writing_submissions
          where draft_id = v_draft_id and feedback_status <> 'failed' limit 1;
        if existing_id is not null then return existing_id; end if;
      end if;
      raise;
    end;
    update public.writing_drafts set autosave_status = 'superseded', updated_at = now()
     where user_id = owner_id and problem_id = (submission->>'problem_id')::uuid
       and autosave_status <> 'superseded';
    return external_submission_id;
  end;
  $fnbody$;

  -- ── 테스트 데이터 ──
  select id into v_user from public.profiles order by created_at limit 1;
  if v_user is null then raise exception 'NO_PROFILE_TO_TEST'; end if;

  insert into public.problems (id, source, domain, question_no, topik_level, difficulty,
    title, prompt, tags, publish_status, review_status, visibility, lifecycle_status)
  values (v_problem, 'curated', 'writing', 51, 2, 2, 'dedup tmp', '빈칸을 채우십시오.',
    array['dedup_tmp'], 'published', 'approved', 'public', 'active');

  insert into public.writing_drafts (id, user_id, problem_id, question_no, answer_text, char_count, autosave_status)
  values (v_dA, v_user, v_problem, 51, '답안', 2, 'clean');

  -- A) 같은 draft 재제출 → 멱등 반환 + 활성 row 1건
  r1 := public.create_external_writing_submission(jsonb_build_object(
    'external_submission_id', gen_random_uuid()::text, 'user_id', v_user::text,
    'problem_id', v_problem::text, 'draft_id', v_dA::text, 'question_no', 51,
    'answer_text', '답안', 'char_count', 2, 'feedback_status', 'analyzing'));
  r2 := public.create_external_writing_submission(jsonb_build_object(
    'external_submission_id', gen_random_uuid()::text, 'user_id', v_user::text,
    'problem_id', v_problem::text, 'draft_id', v_dA::text, 'question_no', 51,
    'answer_text', '답안', 'char_count', 2, 'feedback_status', 'analyzing'));
  if r1 is null or r2 is null then raise exception 'A_FAIL_NULL r1=% r2=%', r1, r2; end if;
  if r1 <> r2 then raise exception 'A_FAIL_NOT_IDEMPOTENT r1=% r2=%', r1, r2; end if;
  select count(*) into cnt from public.writing_submissions where draft_id = v_dA and feedback_status <> 'failed';
  if cnt <> 1 then raise exception 'A_FAIL_COUNT=%', cnt; end if;

  -- B) 새 draft(재응시) → 별개 submission 허용
  insert into public.writing_drafts (id, user_id, problem_id, question_no, answer_text, char_count, autosave_status)
  values (v_dB, v_user, v_problem, 51, '답안', 2, 'clean');
  r3 := public.create_external_writing_submission(jsonb_build_object(
    'external_submission_id', gen_random_uuid()::text, 'user_id', v_user::text,
    'problem_id', v_problem::text, 'draft_id', v_dB::text, 'question_no', 51,
    'answer_text', '답안', 'char_count', 2, 'feedback_status', 'analyzing'));
  if r3 = r1 then raise exception 'B_FAIL_REATTEMPT_BLOCKED r3=%', r3; end if;

  -- C) failed 후 같은 draft analyzing → 허용
  insert into public.writing_drafts (id, user_id, problem_id, question_no, answer_text, char_count, autosave_status)
  values (v_dC, v_user, v_problem, 51, '답안', 2, 'clean');
  r4 := public.create_external_writing_submission(jsonb_build_object(
    'external_submission_id', gen_random_uuid()::text, 'user_id', v_user::text,
    'problem_id', v_problem::text, 'draft_id', v_dC::text, 'question_no', 51,
    'answer_text', '답안', 'char_count', 2, 'feedback_status', 'failed'));
  r5 := public.create_external_writing_submission(jsonb_build_object(
    'external_submission_id', gen_random_uuid()::text, 'user_id', v_user::text,
    'problem_id', v_problem::text, 'draft_id', v_dC::text, 'question_no', 51,
    'answer_text', '답안', 'char_count', 2, 'feedback_status', 'analyzing'));
  if r5 = r4 then raise exception 'C_FAIL_FAILED_RETRY r4=% r5=%', r4, r5; end if;
  select count(*) into cnt from public.writing_submissions where draft_id = v_dC and feedback_status <> 'failed';
  if cnt <> 1 then raise exception 'C_FAIL_COUNT=%', cnt; end if;

  -- 모든 단언 통과 → sentinel 예외로 전체 롤백
  raise exception 'DEDUP_VERIFIED_OK A(idempotent,1row) B(reattempt-distinct) C(failed-retry) — all rolled back';
end
$verify$;
