-- Roll back only unused Grade 2 shapes skill definitions.
begin;

do $guard$
declare
  shape_skill_codes text[] := array[
    'identify-plane-shape','identify-solid-shape','connect-object-to-shape','classify-shapes',
    'describe-shape-properties','compose-decompose-shapes','infer-shape-from-properties','correct-shape-reasoning'
  ]::text[];
begin
  if exists (
    select 1 from public.learning_question_skills where skill_code = any(shape_skill_codes)
  ) or exists (
    select 1 from public.learning_attempt_questions where skill_codes_snapshot && shape_skill_codes
  ) or exists (
    select 1 from public.learning_mistake_review_sessions where filter_skill_code = any(shape_skill_codes)
  ) or exists (
    select 1 from public.learning_review_schedule_overrides where skill_code = any(shape_skill_codes)
  ) or exists (
    select 1 from public.learning_review_schedule_events where skill_code = any(shape_skill_codes)
  ) then
    raise exception using errcode = '55000', message = 'grade2 shapes skills are in use';
  end if;
end
$guard$;

delete from public.learning_skill_definitions
where skill_code = any(array[
  'identify-plane-shape','identify-solid-shape','connect-object-to-shape','classify-shapes',
  'describe-shape-properties','compose-decompose-shapes','infer-shape-from-properties','correct-shape-reasoning'
]::text[]);

commit;
