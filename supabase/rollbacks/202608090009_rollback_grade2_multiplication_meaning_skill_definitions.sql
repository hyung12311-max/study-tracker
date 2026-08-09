-- Roll back only unused Grade 2 multiplication meaning skill definitions.
begin;

do $guard$
declare
  target_skill_codes text[] := array[
    'identify-equal-groups','count-equal-groups','connect-repeated-addition-to-multiplication',
    'represent-equal-groups-as-multiplication','interpret-multiplication-expression',
    'model-multiplication-situation','infer-missing-group-value','correct-multiplication-reasoning'
  ]::text[];
begin
  if exists (select 1 from public.learning_question_skills where skill_code = any(target_skill_codes))
  or exists (select 1 from public.learning_attempt_questions where skill_codes_snapshot && target_skill_codes)
  or exists (select 1 from public.learning_mistake_review_sessions where filter_skill_code = any(target_skill_codes))
  or exists (select 1 from public.learning_review_schedule_overrides where skill_code = any(target_skill_codes))
  or exists (select 1 from public.learning_review_schedule_events where skill_code = any(target_skill_codes)) then
    raise exception using errcode = '55000', message = 'grade2 multiplication meaning skills are in use';
  end if;
end
$guard$;

delete from public.learning_skill_definitions
where skill_code = any(array[
  'identify-equal-groups','count-equal-groups','connect-repeated-addition-to-multiplication',
  'represent-equal-groups-as-multiplication','interpret-multiplication-expression',
  'model-multiplication-situation','infer-missing-group-value','correct-multiplication-reasoning'
]::text[]);

commit;
