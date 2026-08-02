\set ON_ERROR_STOP on

-- Disposable Phase B-2 behavior checks. All identities belong to the local fixture.

insert into public.family_members (
  id, family_id, member_key, display_name, role, is_active
)
values
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'child-planning-api', 'Child Planning API', 'child', true),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 'child-planning-rollback', 'Child Planning Rollback', 'child', true),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'child-planning-race', 'Child Planning Race', 'child', true);

set role service_role;
select assignment_id as api_assignment, plan_id as api_plan, plan_revision as api_revision
from public.create_learning_assignment_with_plan(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000008',
  '61000000-0000-4000-8000-000000000003',
  '2026-08-03', '2026-08-22', 'Asia/Seoul',
  '[
    {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"},
    {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-12"},
    {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-17"},
    {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-22"}
  ]'::jsonb,
  '83000000-0000-4000-8000-000000000001'
)
\gset
reset role;

select public.fixture_assert(
  :'api_revision'::integer = 1
  and (select count(*) = 1 from public.learning_assignments where id = :'api_assignment')
  and (select count(*) = 1 from public.learning_assignment_plans where id = :'api_plan')
  and (select count(*) = 4 from public.learning_assignment_stage_targets where plan_id = :'api_plan')
  and (select count(*) = 1 and min(operation) = 'create'
       from public.learning_assignment_plan_revisions where plan_id = :'api_plan'),
  'atomic assignment and plan creation was incomplete'
);

set role service_role;
select public.fixture_assert(
  (select assignment_id = :'api_assignment' and plan_id = :'api_plan' and plan_revision = 1
   from public.create_learning_assignment_with_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000008',
    '61000000-0000-4000-8000-000000000003',
    '2026-08-03', '2026-08-22', 'Asia/Seoul',
    '[
      {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"},
      {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-12"},
      {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-17"},
      {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-22"}
    ]'::jsonb,
    '83000000-0000-4000-8000-000000000001'
  )),
  'atomic create idempotency did not return the original rows'
);
reset role;

select public.fixture_expect_error(
  'atomic request payload mismatch',
  $sql$select * from public.create_learning_assignment_with_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000008',
    '61000000-0000-4000-8000-000000000003',
    '2026-08-03', '2026-08-23', 'Asia/Seoul',
    '[
      {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"},
      {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-12"},
      {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-17"},
      {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-23"}
    ]'::jsonb,
    '83000000-0000-4000-8000-000000000001'
  )$sql$,
  array['55000']
);

select public.fixture_expect_error(
  'atomic invalid targets',
  $sql$select * from public.create_learning_assignment_with_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000009',
    '61000000-0000-4000-8000-000000000003',
    '2026-08-03', '2026-08-22', 'Asia/Seoul',
    '[{"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"}]'::jsonb,
    '83000000-0000-4000-8000-000000000002'
  )$sql$,
  array['22023','23514']
);
select public.fixture_assert(
  not exists (select 1 from public.learning_assignments where assigned_member_id = '20000000-0000-4000-8000-000000000009')
  and not exists (select 1 from public.learning_assignment_plans where assigned_member_id = '20000000-0000-4000-8000-000000000009'),
  'failed plan creation left a partial assignment or plan'
);

set role service_role;
select attempt_id as api_attempt
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000008',
  :'api_assignment',
  '62000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000003'
)
\gset
select plan_revision as api_revision
from public.pause_learning_assignment_plan(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000008',
  :'api_plan', 1,
  '83000000-0000-4000-8000-000000000004'
)
\gset

select id as api_question, correct_option_id as api_option
from public.learning_attempt_questions
where attempt_id = :'api_attempt'
order by display_order
limit 1
\gset

select answer_id as api_answer
from public.submit_learning_attempt_answer(
  '20000000-0000-4000-8000-000000000008',
  :'api_attempt', :'api_question', :'api_option',
  '83000000-0000-4000-8000-000000000005'
)
\gset
reset role;

select public.fixture_assert(
  :'api_revision'::integer = 2
  and (select plan_state = 'paused' from public.learning_assignment_plans where id = :'api_plan')
  and (select count(*) = 1 from public.learning_attempt_answers where id = :'api_answer'),
  'paused plan did not preserve submission for an existing attempt'
);

set role service_role;
select * from public.abandon_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000008',
  :'api_assignment', :'api_attempt'
);
reset role;

select public.fixture_expect_error(
  'paused new official attempt',
  format($sql$select * from public.start_or_resume_learning_attempt(
    %L,%L,%L,%L,%L,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000008',
    :'api_assignment',
    '62000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000006'),
  array['55000']
);

set role service_role;
select plan_revision as api_revision
from public.resume_learning_assignment_plan(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000008',
  :'api_plan', 2,
  '83000000-0000-4000-8000-000000000007'
)
\gset
select attempt_id as resumed_attempt
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000008',
  :'api_assignment',
  '62000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000008'
)
\gset
reset role;

select public.fixture_assert(
  :'api_revision'::integer = 3
  and :'resumed_attempt'::uuid <> :'api_attempt'::uuid,
  'resumed plan did not permit a new official attempt'
);

create function public.fixture_hold_atomic_plan_create()
returns uuid
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  created_id uuid;
begin
  select assignment.assignment_id into created_id
  from public.create_learning_assignment_with_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000010',
    '61000000-0000-4000-8000-000000000003',
    '2026-08-04', '2026-08-23', 'Asia/Seoul',
    '[
      {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-08"},
      {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-13"},
      {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-18"},
      {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-23"}
    ]'::jsonb,
    '83000000-0000-4000-8000-000000000009'
  ) assignment;
  perform pg_sleep(1);
  return created_id;
end
$function$;

select dblink_connect('planning_api_race', 'dbname=' || current_database());
select dblink_send_query('planning_api_race', 'select public.fixture_hold_atomic_plan_create()');
select pg_sleep(0.2);

do $concurrency$
declare
  concurrent_state text;
begin
  begin
    perform * from public.create_learning_assignment_with_plan(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000010',
      '61000000-0000-4000-8000-000000000003',
      '2026-08-04', '2026-08-23', 'Asia/Seoul',
      '[
        {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-08"},
        {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-13"},
        {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-18"},
        {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-23"}
      ]'::jsonb,
      '83000000-0000-4000-8000-000000000010'
    );
  exception when others then
    concurrent_state := sqlstate;
  end;
  if concurrent_state <> '23505' then
    raise exception 'atomic assignment race returned unexpected SQLSTATE %', concurrent_state;
  end if;
end
$concurrency$;

select * from dblink_get_result('planning_api_race') as result(assignment_id uuid);
select dblink_disconnect('planning_api_race');
drop function public.fixture_hold_atomic_plan_create();

select public.fixture_assert(
  (select count(*) = 1 from public.learning_assignments
   where assigned_member_id = '20000000-0000-4000-8000-000000000010' and status = 'active')
  and (select count(*) = 1 from public.learning_assignment_plans
       where assigned_member_id = '20000000-0000-4000-8000-000000000010')
  and (select count(*) = 4 from public.learning_assignment_stage_targets target
       join public.learning_assignment_plans plan on plan.id = target.plan_id
       where plan.assigned_member_id = '20000000-0000-4000-8000-000000000010'),
  'concurrent atomic create left duplicate or partial rows'
);

select public.fixture_expect_error(
  'cross-family atomic create',
  $sql$select * from public.create_learning_assignment_with_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    '61000000-0000-4000-8000-000000000003',
    '2026-08-04', '2026-08-23', 'Asia/Seoul', '[]'::jsonb,
    '83000000-0000-4000-8000-000000000011'
  )$sql$,
  array['42501']
);

select public.fixture_assert(
  (select count(*) = 0 from public.learning_stage_first_passes
   where assigned_member_id in (
     '20000000-0000-4000-8000-000000000008',
     '20000000-0000-4000-8000-000000000009',
     '20000000-0000-4000-8000-000000000010'
   ))
  and (select count(*) = 0 from public.sticker_transactions
       where member_id in (
         '20000000-0000-4000-8000-000000000008',
         '20000000-0000-4000-8000-000000000009',
         '20000000-0000-4000-8000-000000000010'
       )),
  'planning or pause unexpectedly created first-pass or reward rows'
);
