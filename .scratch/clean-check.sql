select
  to_regclass('public.writing_submissions_draft_active_unique') as leftover_index,
  (select count(*) from public.problems where 'dedup_tmp' = any(tags)) as leftover_problems,
  (select count(*) from public.writing_submissions s
     join public.problems p on p.id = s.problem_id
    where 'dedup_tmp' = any(p.tags)) as leftover_submissions;
