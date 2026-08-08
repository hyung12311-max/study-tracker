\set ON_ERROR_STOP on

-- Disposable Phase G-2 fixture. No production project or user data is used.
\ir phase2e_mistake_review_lifecycle_fixture.sql
\ir ../../supabase/migrations/202608080004_learning_review_schedule_overrides.sql

-- The Phase E prerequisite creates its terminal attempts before skill metadata is
-- installed, so those immutable snapshots are intentionally empty. Create one
-- post-metadata official retry with a real mapped skill for the schedule fixture.
insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name
) values (
  'attempt-fixture.skill', 'math', '합성 복습 개념'
);

insert into public.learning_question_skills (
  question_id, skill_code, is_primary
)
select question.id, 'attempt-fixture.skill', true
from public.learning_questions question
where question.stage_id = 'a4000000-0000-4000-8000-000000000001'
  and question.display_order = 1;

select public.abandon_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  :'retry_attempt_id'
);

select attempt_id as schedule_attempt_id
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  'a4000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001'
)
\gset

create temporary table phase2g_schedule_attempt_input as
select :'schedule_attempt_id'::uuid as attempt_id;

do $schedule_attempt$
declare
  target_attempt_id uuid;
  question_row record;
  chosen_option uuid;
  request_id uuid;
begin
  select attempt_id
  into strict target_attempt_id
  from phase2g_schedule_attempt_input;

  for question_row in
    select id, display_order, correct_option_id, options_snapshot
    from public.learning_attempt_questions
    where attempt_id = target_attempt_id
    order by display_order
  loop
    if question_row.display_order = 1 then
      select (item->>'id')::uuid
      into chosen_option
      from jsonb_array_elements(question_row.options_snapshot) item
      where (item->>'id')::uuid <> question_row.correct_option_id
      limit 1;
    else
      chosen_option := question_row.correct_option_id;
    end if;

    request_id := (
      'f0'
      || lpad(question_row.display_order::text, 2, '0')
      || '0000-0000-4000-8000-000000000001'
    )::uuid;

    perform *
    from public.submit_learning_attempt_answer(
      '20000000-0000-4000-8000-000000000002',
      target_attempt_id,
      question_row.id,
      chosen_option,
      request_id
    );
  end loop;
end
$schedule_attempt$;

select public.fixture_assert(
  (
    select status = 'passed'
       and correct_answers = 4
    from public.learning_attempts
    where id = :'schedule_attempt_id'
  )
  and (
    select skill_codes_snapshot = array['attempt-fixture.skill']::text[]
       and answer.is_correct = false
    from public.learning_attempt_questions question
    join public.learning_attempt_answers answer
      on answer.attempt_question_id = question.id
    where question.attempt_id = :'schedule_attempt_id'
      and question.display_order = 1
  ),
  'post-metadata terminal attempt skill snapshot setup failed'
);

create temporary table phase2g_official_review_before as
select
  (select count(*) from public.learning_attempts)::bigint as attempts,
  (select count(*) from public.learning_attempt_answers)::bigint as answers,
  (select count(*) from public.learning_stage_progress)::bigint as progress,
  (select count(*) from public.learning_stage_first_passes)::bigint as first_passes,
  (select count(*) from public.sticker_transactions)::bigint as rewards,
  (select count(*) from public.learning_mistake_review_sessions)::bigint as review_sessions,
  (select count(*) from public.learning_mistake_review_answers)::bigint as review_answers;

set role service_role;
select * from public.set_learning_review_schedule_override(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id', 'attempt-fixture.skill', 'snooze', 1,
  'f1000000-0000-4000-8000-000000000001'
)
\gset snooze_first_

select * from public.set_learning_review_schedule_override(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id', 'attempt-fixture.skill', 'snooze', 1,
  'f1000000-0000-4000-8000-000000000001'
)
\gset snooze_retry_
reset role;

select public.fixture_assert(
  :'snooze_first_schedule_override_id'::uuid = :'snooze_retry_schedule_override_id'::uuid
  and :'snooze_first_schedule_override_due_at'::timestamptz = :'snooze_retry_schedule_override_due_at'::timestamptz
  and :'snooze_first_schedule_revision'::integer = 1
  and (select count(*) = 1 from public.learning_review_schedule_events
       where actor_member_id = '20000000-0000-4000-8000-000000000001'
         and request_id = 'f1000000-0000-4000-8000-000000000001'),
  'idempotent snooze failed'
);

set role service_role;
select * from public.set_learning_review_schedule_override(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id', 'attempt-fixture.skill', 'snooze', 3,
  'f1000000-0000-4000-8000-000000000002'
)
\gset snooze_changed_

select * from public.set_learning_review_schedule_override(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id', 'attempt-fixture.skill', 'clear', null,
  'f1000000-0000-4000-8000-000000000003'
)
\gset cleared_
reset role;

select public.fixture_assert(
  :'snooze_changed_schedule_revision'::integer = 2
  and :'snooze_changed_schedule_operation' = 'override_changed'
  and :'cleared_schedule_revision'::integer = 3
  and :'cleared_schedule_operation' = 'override_cleared'
  and (select override_due_at is null and duration_days is null and revision = 3
       from public.learning_review_schedule_overrides
       where id = :'cleared_schedule_override_id'),
  'clear returns to default failed'
);

set role service_role;
select * from public.set_learning_review_schedule_override(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id', 'attempt-fixture.skill', 'snooze', 7,
  'f1000000-0000-4000-8000-000000000007'
)
\gset snooze_seven_
reset role;

select public.fixture_assert(
  :'snooze_seven_schedule_revision'::integer = 4
  and :'snooze_seven_schedule_operation' = 'override_created'
  and :'snooze_seven_schedule_override_due_at'::timestamptz is not null
  and (select duration_days = 7 and revision = 4
       from public.learning_review_schedule_overrides
       where id = :'snooze_seven_schedule_override_id'),
  'seven day snooze failed'
);

select public.fixture_expect_error(
  'invalid snooze duration',
  format(
    'select * from public.set_learning_review_schedule_override(%L,%L,%L,%L,%L,%L,%s,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'hagyeom_assignment_id', 'attempt-fixture.skill', 'snooze', 2,
    'f1000000-0000-4000-8000-000000000004'
  ),
  array['22023']
);

select public.fixture_expect_error(
  'unknown snapshot skill',
  format(
    'select * from public.set_learning_review_schedule_override(%L,%L,%L,%L,%L,%L,%s,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'hagyeom_assignment_id', 'missing-fixture.skill', 'snooze', 1,
    'f1000000-0000-4000-8000-000000000008'
  ),
  array['P0002']
);

select public.fixture_expect_error(
  'other child schedule is hidden',
  format(
    'select * from public.set_learning_review_schedule_override(%L,%L,%L,%L,%L,%L,%s,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    :'hagyeom_assignment_id', 'attempt-fixture.skill', 'snooze', 1,
    'f1000000-0000-4000-8000-000000000005'
  ),
  array['P0002']
);

select public.fixture_expect_error(
  'child actor cannot schedule',
  format(
    'select * from public.set_learning_review_schedule_override(%L,%L,%L,%L,%L,%L,%s,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    :'hagyeom_assignment_id', 'attempt-fixture.skill', 'snooze', 1,
    'f1000000-0000-4000-8000-000000000006'
  ),
  array['42501']
);

select public.fixture_expect_error(
  'schedule event immutable',
  'delete from public.learning_review_schedule_events',
  array['55000']
);

select public.fixture_expect_error(
  'schedule override cannot be deleted',
  'delete from public.learning_review_schedule_overrides',
  array['55000']
);

select public.fixture_assert(
  has_function_privilege('service_role','public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.set_learning_review_schedule_override(uuid,uuid,uuid,uuid,text,text,integer,uuid)','EXECUTE')
  and has_table_privilege('service_role','public.learning_review_schedule_overrides','SELECT')
  and not has_table_privilege('service_role','public.learning_review_schedule_overrides','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.learning_review_schedule_events','SELECT,INSERT,UPDATE,DELETE'),
  'schedule ACL failed'
);

select public.fixture_assert(
  before.attempts = (select count(*) from public.learning_attempts)
  and before.answers = (select count(*) from public.learning_attempt_answers)
  and before.progress = (select count(*) from public.learning_stage_progress)
  and before.first_passes = (select count(*) from public.learning_stage_first_passes)
  and before.rewards = (select count(*) from public.sticker_transactions)
  and before.review_sessions = (select count(*) from public.learning_mistake_review_sessions)
  and before.review_answers = (select count(*) from public.learning_mistake_review_answers),
  'official or review state changed'
)
from phase2g_official_review_before before;

select public.fixture_expect_error(
  'rollback guard with schedule data',
  $sql$
    do $guard$
    begin
      if exists (select 1 from public.learning_review_schedule_overrides)
         or exists (select 1 from public.learning_review_schedule_events) then
        raise exception using errcode = '55000', message = 'learning review schedule data is in use';
      end if;
    end
    $guard$
  $sql$,
  array['55000']
);

\ir ../../supabase/verification/202608080004_learning_review_schedule_overrides_verify.sql

select 'phase2g review schedule fixture passed' as result;
