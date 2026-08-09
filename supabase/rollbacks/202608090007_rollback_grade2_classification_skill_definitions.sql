-- Roll back only unused Grade 2 classification skill definitions.
begin;

do $guard$
declare
  target_skill_codes text[] := array[
    'identify-classification-rule','classify-by-given-rule','compare-classification-rules',
    'infer-rule-from-groups','find-misclassified-item','find-missing-classified-item',
    'classify-by-two-properties','explain-classification-reasoning'
  ]::text[];
begin
  if exists (
    select 1 from public.learning_question_skills where skill_code = any(target_skill_codes)
  ) or exists (
    select 1 from public.learning_attempt_questions where skill_codes_snapshot && target_skill_codes
  ) or exists (
    select 1 from public.learning_mistake_review_sessions where filter_skill_code = any(target_skill_codes)
  ) or exists (
    select 1 from public.learning_review_schedule_overrides where skill_code = any(target_skill_codes)
  ) or exists (
    select 1 from public.learning_review_schedule_events where skill_code = any(target_skill_codes)
  ) then
    raise exception using errcode = '55000', message = 'grade2 classification skills are in use';
  end if;
end
$guard$;

delete from public.learning_skill_definitions
where skill_code = any(array[
  'identify-classification-rule','classify-by-given-rule','compare-classification-rules',
  'infer-rule-from-groups','find-misclassified-item','find-missing-classified-item',
  'classify-by-two-properties','explain-classification-reasoning'
]::text[]);

commit;
