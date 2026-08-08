-- Pre-use rollback for the current-content skill mapping rollout only.
begin;

do $guard$
declare
  rollout_codes text[] := array[
    'make-ten.compose',
    'build-second-largest-number',
    'build-smallest-number-above-bound',
    'compare-after-swapping-digits',
    'compare-three-digit-numbers',
    'complete-number-sequence',
    'compose-three-digit-number',
    'correct-comparison-order-error',
    'correct-zero-place-value-error',
    'decompose-three-digit-number',
    'exchange-ten-bundles-for-hundred',
    'find-predecessor-successor',
    'identify-place-value',
    'infer-digit-after-swap-comparison',
    'infer-number-from-digit-relations',
    'infer-number-from-place-conditions',
    'order-three-digit-numbers',
    'read-three-digit-number',
    'recognize-equivalent-bundle-expression',
    'represent-hundreds-tens-ones',
    'understand-zero-placeholder',
    'value-of-digit',
    'write-three-digit-number'
  ]::text[];
begin
  if exists (
    select 1 from public.learning_attempt_questions
    where skill_codes_snapshot && rollout_codes
  ) or exists (
    select 1 from public.learning_mistake_review_sessions
    where filter_skill_code = any(rollout_codes)
  ) or exists (
    select 1 from public.learning_review_schedule_overrides
    where skill_code = any(rollout_codes)
  ) or exists (
    select 1 from public.learning_review_schedule_events
    where skill_code = any(rollout_codes)
  ) then
    raise exception using errcode = '55000', message = 'content skill rollout is in use';
  end if;

  if exists (
    select 1
    from public.learning_question_skills mapping
    join public.learning_questions question on question.id = mapping.question_id
    join public.learning_stages stage on stage.id = question.stage_id
    where mapping.skill_code = any(rollout_codes)
      and stage.content_version_id not in (
        '51000000-0000-4000-8000-000000000003'::uuid,
        '61000000-0000-4000-8000-000000000003'::uuid,
        '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
      )
  ) then
    raise exception using errcode = '55000', message = 'content skill definitions are used by other content';
  end if;
end
$guard$;

select pg_catalog.set_config('session_replication_role', 'replica', true);

delete from public.learning_question_skills mapping
using public.learning_questions question, public.learning_stages stage
where mapping.question_id = question.id
  and question.stage_id = stage.id
  and stage.content_version_id in (
    '51000000-0000-4000-8000-000000000003'::uuid,
    '61000000-0000-4000-8000-000000000003'::uuid,
    '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
  );

delete from public.learning_skill_definitions
where skill_code = any(array[
  'make-ten.compose',
  'build-second-largest-number',
  'build-smallest-number-above-bound',
  'compare-after-swapping-digits',
  'compare-three-digit-numbers',
  'complete-number-sequence',
  'compose-three-digit-number',
  'correct-comparison-order-error',
  'correct-zero-place-value-error',
  'decompose-three-digit-number',
  'exchange-ten-bundles-for-hundred',
  'find-predecessor-successor',
  'identify-place-value',
  'infer-digit-after-swap-comparison',
  'infer-number-from-digit-relations',
  'infer-number-from-place-conditions',
  'order-three-digit-numbers',
  'read-three-digit-number',
  'recognize-equivalent-bundle-expression',
  'represent-hundreds-tens-ones',
  'understand-zero-placeholder',
  'value-of-digit',
  'write-three-digit-number'
]::text[]);

select pg_catalog.set_config('session_replication_role', 'origin', true);

commit;
