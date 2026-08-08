\set ON_ERROR_STOP on

-- Disposable Phase E-2 fixture. No production project or user data is used.
\ir phase2e_mistake_review_foundation_fixture.sql
\ir ../../supabase/migrations/202608080003_learning_mistake_review_lifecycle.sql

create temporary table phase2e_lifecycle_official_before as
select
  (select count(*) from public.learning_attempts)::bigint as attempts,
  (select count(*) from public.learning_attempt_answers)::bigint as answers,
  (select count(*) from public.learning_stage_progress)::bigint as progress,
  (select count(*) from public.learning_stage_first_passes)::bigint as first_passes,
  (select count(*) from public.sticker_transactions)::bigint as rewards;

select item.id as first_item_id,
  question.correct_option_id as first_correct_option_id,
  (
    select (option_row ->> 'id')::uuid
    from jsonb_array_elements(question.options_snapshot) option_row
    where (option_row ->> 'id')::uuid <> question.correct_option_id
    limit 1
  ) as first_wrong_option_id
from public.learning_mistake_review_items item
join public.learning_attempt_questions question
  on question.id = item.source_attempt_question_id
where item.session_id = :'parent_review_id'
order by item.display_order
limit 1
\gset

set role service_role;
select * from public.submit_learning_mistake_review_answer(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'parent_review_id', :'first_item_id', :'first_wrong_option_id',
  'e6000000-0000-4000-8000-000000000001'
)
\gset first_submit_

select * from public.submit_learning_mistake_review_answer(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'parent_review_id', :'first_item_id', :'first_wrong_option_id',
  'e6000000-0000-4000-8000-000000000001'
)
\gset first_retry_
reset role;

select public.fixture_assert(
  :'first_submit_is_correct'::boolean = false
  and :'first_submit_review_answer_id'::uuid = :'first_retry_review_answer_id'::uuid
  and :'first_submit_selected_answer' <> :'first_submit_correct_answer'
  and length(:'first_submit_explanation') > 0,
  'incorrect review answer or request idempotency failed'
);

set role service_role;
select format(
  'select * from public.submit_learning_mistake_review_answer(%L,%L,%L,%L,%L,%L);',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  item.session_id,
  item.id,
  question.correct_option_id,
  gen_random_uuid()
)
from public.learning_mistake_review_items item
join public.learning_attempt_questions question
  on question.id = item.source_attempt_question_id
where item.session_id = :'parent_review_id'
  and item.id <> :'first_item_id'
order by item.display_order
\gexec
reset role;

select public.fixture_assert(
  (select status = 'completed' and completed_at is not null
   from public.learning_mistake_review_sessions where id = :'parent_review_id')
  and (select count(*) = :'parent_review_items'::integer
       from public.learning_mistake_review_answers where session_id = :'parent_review_id'),
  'all submitted review items did not complete the session'
);

set role service_role;
select * from public.submit_learning_mistake_review_answer(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'parent_review_id', :'first_item_id', :'first_wrong_option_id',
  'e6000000-0000-4000-8000-000000000001'
)
\gset completed_retry_
reset role;

select public.fixture_assert(
  :'completed_retry_review_answer_id'::uuid = :'first_submit_review_answer_id'::uuid
  and :'completed_retry_session_status' = 'completed',
  'same answer request was not idempotent after completion'
);

select public.fixture_expect_error(
  'completed review rejects a new answer request',
  format(
    'select * from public.submit_learning_mistake_review_answer(%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'parent_review_id', :'first_item_id', :'first_wrong_option_id',
    'e6000000-0000-4000-8000-000000000002'
  ),
  array['55000']
);

set role service_role;
select review_session_id as second_review_id
from public.start_learning_mistake_review(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  'all', null, null,
  'e7000000-0000-4000-8000-000000000001'
)
\gset
reset role;

select item.id as second_item_id, question.correct_option_id as second_correct_option_id
from public.learning_mistake_review_items item
join public.learning_attempt_questions question on question.id = item.source_attempt_question_id
where item.session_id = :'second_review_id'
order by item.display_order
limit 1
\gset

select public.fixture_expect_error(
  'invalid immutable snapshot option',
  format(
    'select * from public.submit_learning_mistake_review_answer(%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    :'second_review_id', :'second_item_id',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'e7000000-0000-4000-8000-000000000002'
  ),
  array['23514']
);

set role service_role;
select * from public.submit_learning_mistake_review_answer(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  :'second_review_id', :'second_item_id', :'second_correct_option_id',
  'e7000000-0000-4000-8000-000000000003'
)
\gset parent_submit_

select * from public.abandon_learning_mistake_review(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  :'second_review_id',
  'e7000000-0000-4000-8000-000000000004'
)
\gset abandon_first_

select * from public.abandon_learning_mistake_review(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  :'second_review_id',
  'e7000000-0000-4000-8000-000000000004'
)
\gset abandon_retry_
reset role;

select public.fixture_assert(
  :'parent_submit_is_correct'::boolean
  and :'abandon_first_session_status' = 'abandoned'
  and :'abandon_first_abandoned_at'::timestamptz = :'abandon_retry_abandoned_at'::timestamptz
  and (select count(*) = 1 from public.learning_mistake_review_events
       where session_id = :'second_review_id' and event_type = 'session_abandoned'),
  'parent answer or idempotent abandon lifecycle failed'
);

select public.fixture_expect_error(
  'abandoned review rejects answers',
  format(
    'select * from public.submit_learning_mistake_review_answer(%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'second_review_id', :'second_item_id', :'second_correct_option_id',
    'e7000000-0000-4000-8000-000000000005'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'other child review answer is hidden',
  format(
    'select * from public.submit_learning_mistake_review_answer(%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    :'second_review_id', :'second_item_id', :'second_correct_option_id',
    'e7000000-0000-4000-8000-000000000006'
  ),
  array['P0002']
);

select public.fixture_expect_error(
  'wrong review item is hidden',
  format(
    'select * from public.submit_learning_mistake_review_answer(%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    :'second_review_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    :'second_correct_option_id', 'e7000000-0000-4000-8000-000000000007'
  ),
  array['P0002']
);

select public.fixture_expect_error(
  'review answer immutable row',
  format(
    'update public.learning_mistake_review_answers set is_correct = not is_correct where id=%L',
    :'first_submit_review_answer_id'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'review abandon event immutable row',
  format(
    'delete from public.learning_mistake_review_events where session_id=%L and event_type=%L',
    :'second_review_id', 'session_abandoned'
  ),
  array['55000']
);

select public.fixture_assert(
  has_function_privilege('service_role','public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
  and has_function_privilege('service_role','public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)','EXECUTE')
  and has_table_privilege('service_role','public.learning_mistake_review_answers','SELECT')
  and not has_table_privilege('service_role','public.learning_mistake_review_answers','INSERT,UPDATE,DELETE'),
  'review lifecycle ACL failed'
);

select public.fixture_assert(
  before.attempts = (select count(*) from public.learning_attempts)
  and before.answers = (select count(*) from public.learning_attempt_answers)
  and before.progress = (select count(*) from public.learning_stage_progress)
  and before.first_passes = (select count(*) from public.learning_stage_first_passes)
  and before.rewards = (select count(*) from public.sticker_transactions),
  'official score progress or rewards changed during review lifecycle'
)
from phase2e_lifecycle_official_before before;

select public.fixture_expect_error(
  'lifecycle rollback guard with persisted review data',
  $sql$
    do $guard$
    begin
      if exists (select 1 from public.learning_mistake_review_answers)
         or exists (select 1 from public.learning_mistake_review_events where event_type = 'session_abandoned')
         or exists (select 1 from public.learning_mistake_review_sessions where status <> 'in_progress') then
        raise exception using errcode = '55000', message = 'learning mistake review lifecycle data is in use';
      end if;
    end
    $guard$
  $sql$,
  array['55000']
);

\ir ../../supabase/verification/202608080003_learning_mistake_review_lifecycle_verify.sql

select 'phase2e mistake review lifecycle fixture passed' as result;
