\set ON_ERROR_STOP on

-- Disposable Phase B-1 behavior checks. All identities belong to the local fixture.

set role service_role;
select assignment_id as planning_assignment
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '61000000-0000-4000-8000-000000000003'
)
\gset

select attempt_id as planning_attempt
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  :'planning_assignment',
  '62000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001'
)
\gset

select plan_id as planning_plan, plan_revision as planning_revision
from public.create_learning_assignment_plan(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'planning_assignment',
  '2026-08-01', '2026-08-20', 'Asia/Seoul',
  '[
    {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-05"},
    {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-10"},
    {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-15"},
    {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-20"}
  ]'::jsonb,
  '82000000-0000-4000-8000-000000000001'
)
\gset
reset role;

select public.fixture_assert(:'planning_revision'::integer = 1, 'plan did not start at revision 1');
select public.fixture_assert(
  (select count(*) = 4 from public.learning_assignment_stage_targets where plan_id = :'planning_plan')
  and (select count(*) = 1 and min(operation) = 'create'
       from public.learning_assignment_plan_revisions where plan_id = :'planning_plan'),
  'plan creation did not atomically create four targets and revision 1'
);
select public.fixture_assert(
  not public.is_learning_assignment_plan_paused(:'planning_assignment'),
  'new plan was unexpectedly paused'
);

set role service_role;
select public.fixture_assert(
  (select plan_id = :'planning_plan' and plan_revision = 1
   from public.create_learning_assignment_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'planning_assignment',
    '2026-08-01', '2026-08-20', 'Asia/Seoul',
    '[
      {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-05"},
      {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-10"},
      {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-15"},
      {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-20"}
    ]'::jsonb,
    '82000000-0000-4000-8000-000000000001'
  )),
  'create idempotency did not return the original result'
);
reset role;

select public.fixture_expect_error(
  'create request payload mismatch',
  format($sql$select * from public.create_learning_assignment_plan(
    %L,%L,%L,%L,'2026-08-01','2026-08-21','Asia/Seoul',%L::jsonb,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_assignment',
    '[{"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-05"},{"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-10"},{"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-15"},{"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-21"}]',
    '82000000-0000-4000-8000-000000000001'),
  array['55000']
);
select public.fixture_expect_error(
  'assignment plan duplicate',
  format($sql$select * from public.create_learning_assignment_plan(
    %L,%L,%L,%L,'2026-08-01','2026-08-20','Asia/Seoul',%L::jsonb,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_assignment',
    '[{"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-05"},{"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-10"},{"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-15"},{"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-20"}]',
    '82000000-0000-4000-8000-000000000002'),
  array['23505']
);

set role service_role;
select plan_revision as planning_revision
from public.update_learning_assignment_plan(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'planning_plan', 1,
  '2026-08-02', '2026-08-24', 'Asia/Seoul',
  '[
    {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-06"},
    {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-12"},
    {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-18"},
    {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-24"}
  ]'::jsonb,
  '82000000-0000-4000-8000-000000000003'
)
\gset
reset role;

select public.fixture_assert(
  :'planning_revision'::integer = 2
  and (select revision = 2 and planned_start_date = '2026-08-02'
       from public.learning_assignment_plans where id = :'planning_plan')
  and (select count(*) = 2 and count(*) filter (where previous_snapshot is not null) = 1
       from public.learning_assignment_plan_revisions where plan_id = :'planning_plan'),
  'plan update or immutable before snapshot failed'
);

select public.fixture_expect_error(
  'stale plan revision',
  format($sql$select * from public.update_learning_assignment_plan(
    %L,%L,%L,%L,1,'2026-08-02','2026-08-24','Asia/Seoul',%L::jsonb,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_plan',
    '[{"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-06"},{"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-12"},{"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-18"},{"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-24"}]',
    '82000000-0000-4000-8000-000000000004'),
  array['55000']
);

create function public.fixture_hold_plan_update(p_plan_id uuid)
returns integer
language plpgsql
as $function$
declare updated_revision integer;
begin
  select plan_revision into updated_revision
  from public.update_learning_assignment_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    p_plan_id, 2, '2026-08-03', '2026-08-25', 'Asia/Seoul',
    '[
      {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"},
      {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-13"},
      {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-19"},
      {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-25"}
    ]'::jsonb,
    '82000000-0000-4000-8000-000000000005'
  );
  perform pg_sleep(1);
  return updated_revision;
end
$function$;

do $concurrent_update$
declare stale_state text; remote_result record; planning_plan_id uuid;
begin
  select plan.id into strict planning_plan_id
  from public.learning_assignment_plans plan
  where plan.assignment_id = (
    select assignment.id from public.learning_assignments assignment
    where assignment.family_id = '10000000-0000-4000-8000-000000000001'
      and assignment.assigned_member_id = '20000000-0000-4000-8000-000000000002'
      and assignment.content_version_id = '61000000-0000-4000-8000-000000000003'
  );
  perform dblink_connect('planning_update', 'dbname=' || current_database() || ' user=postgres');
  perform dblink_send_query('planning_update', format(
    'select public.fixture_hold_plan_update(%L)', planning_plan_id
  ));
  perform pg_sleep(0.2);
  begin
    perform * from public.update_learning_assignment_plan(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      planning_plan_id, 2, '2026-08-04', '2026-08-26', 'Asia/Seoul',
      '[
        {"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-08"},
        {"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-14"},
        {"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-20"},
        {"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-26"}
      ]'::jsonb,
      '82000000-0000-4000-8000-000000000006'
    );
  exception when others then stale_state := sqlstate;
  end;
  select result.* into remote_result from dblink_get_result('planning_update') as result(revision integer);
  perform dblink_disconnect('planning_update');
  if stale_state is distinct from '55000' or remote_result.revision <> 3 then
    raise exception 'concurrent update contract failed: %, %', stale_state, remote_result.revision;
  end if;
end
$concurrent_update$;

do $pause_resume$
declare
  before_assignment jsonb;
  before_attempt jsonb;
  before_progress jsonb;
  before_first_pass bigint;
  before_rewards bigint;
  result_revision integer;
  planning_assignment_id uuid;
  planning_attempt_id uuid;
  planning_plan_id uuid;
begin
  select assignment.id into strict planning_assignment_id
  from public.learning_assignments assignment
  where assignment.family_id = '10000000-0000-4000-8000-000000000001'
    and assignment.assigned_member_id = '20000000-0000-4000-8000-000000000002'
    and assignment.content_version_id = '61000000-0000-4000-8000-000000000003';
  select plan.id into strict planning_plan_id
  from public.learning_assignment_plans plan
  where plan.assignment_id = planning_assignment_id;
  select attempt.id into strict planning_attempt_id
  from public.learning_attempts attempt
  where attempt.assignment_id = planning_assignment_id
    and attempt.start_request_id = '81000000-0000-4000-8000-000000000001';

  select to_jsonb(assignment.*) into before_assignment
  from public.learning_assignments assignment where assignment.id = planning_assignment_id;
  select to_jsonb(attempt.*) into before_attempt
  from public.learning_attempts attempt where attempt.id = planning_attempt_id;
  select jsonb_agg(to_jsonb(progress.*) order by progress.stage_id) into before_progress
  from public.learning_stage_progress progress where progress.assignment_id = planning_assignment_id;
  select count(*) into before_first_pass from public.learning_stage_first_passes
    where assignment_id = planning_assignment_id;
  select count(*) into before_rewards from public.sticker_transactions
    where source_type = 'learning_stage_first_pass';

  select plan_revision into result_revision from public.pause_learning_assignment_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', planning_plan_id, 3,
    '82000000-0000-4000-8000-000000000007'
  );
  if result_revision <> 4 or not public.is_learning_assignment_plan_paused(planning_assignment_id) then
    raise exception 'pause failed';
  end if;
  select plan_revision into result_revision from public.pause_learning_assignment_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', planning_plan_id, 3,
    '82000000-0000-4000-8000-000000000007'
  );
  if result_revision <> 4 then raise exception 'pause retry was not idempotent'; end if;
  select plan_revision into result_revision from public.pause_learning_assignment_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', planning_plan_id, 4,
    '82000000-0000-4000-8000-000000000008'
  );
  if result_revision <> 5 then raise exception 'same-state pause was not audited'; end if;
  select plan_revision into result_revision from public.resume_learning_assignment_plan(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', planning_plan_id, 5,
    '82000000-0000-4000-8000-000000000009'
  );
  if result_revision <> 6 or public.is_learning_assignment_plan_paused(planning_assignment_id) then
    raise exception 'resume failed';
  end if;

  if before_assignment <> (select to_jsonb(assignment.*) from public.learning_assignments assignment where assignment.id = planning_assignment_id)
     or before_attempt <> (select to_jsonb(attempt.*) from public.learning_attempts attempt where attempt.id = planning_attempt_id)
     or before_progress <> (select jsonb_agg(to_jsonb(progress.*) order by progress.stage_id) from public.learning_stage_progress progress where progress.assignment_id = planning_assignment_id)
     or before_first_pass <> (select count(*) from public.learning_stage_first_passes where assignment_id = planning_assignment_id)
     or before_rewards <> (select count(*) from public.sticker_transactions where source_type = 'learning_stage_first_pass') then
    raise exception 'pause or resume changed assignment learning data';
  end if;
end
$pause_resume$;

select public.fixture_expect_error(
  'wrong family plan update',
  format('select * from public.pause_learning_assignment_plan(%L,%L,%L,%L,6,%L)',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000006', :'planning_plan',
    '82000000-0000-4000-8000-000000000010'),
  array['P0002','42501']
);
select public.fixture_expect_error(
  'invalid plan timezone',
  format($sql$select * from public.update_learning_assignment_plan(
    %L,%L,%L,%L,6,'2026-08-03','2026-08-25','Not/A_Zone',%L::jsonb,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_plan',
    '[{"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"},{"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-13"},{"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-19"},{"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-25"}]',
    '82000000-0000-4000-8000-000000000011'),
  array['22023']
);
select public.fixture_expect_error(
  'decreasing target dates',
  format($sql$select * from public.update_learning_assignment_plan(
    %L,%L,%L,%L,6,'2026-08-03','2026-08-25','Asia/Seoul',%L::jsonb,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_plan',
    '[{"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-10"},{"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-09"},{"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-19"},{"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-25"}]',
    '82000000-0000-4000-8000-000000000012'),
  array['23514']
);
select public.fixture_expect_error(
  'stage from another content version',
  format($sql$select * from public.update_learning_assignment_plan(
    %L,%L,%L,%L,6,'2026-08-03','2026-08-25','Asia/Seoul',%L::jsonb,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_plan',
    '[{"stage_id":"52000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"},{"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-13"},{"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-19"},{"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-25"}]',
    '82000000-0000-4000-8000-000000000013'),
  array['23514']
);

do $permission_tests$
declare role_name text; table_name text; action_name text; actual_state text; probe_sql text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach table_name in array array[
      'learning_assignment_plans','learning_assignment_stage_targets','learning_assignment_plan_revisions'
    ] loop
      foreach action_name in array array['select','insert','update','delete'] loop
        probe_sql := case action_name
          when 'select' then format('select 1 from public.%I where false', table_name)
          when 'insert' then format('insert into public.%I default values', table_name)
          when 'update' then case table_name
            when 'learning_assignment_stage_targets' then
              'update public.learning_assignment_stage_targets set plan_id=plan_id where false'
            else format('update public.%I set id=id where false', table_name)
          end
          when 'delete' then format('delete from public.%I where false', table_name) end;
        actual_state := null;
        execute format('set local role %I', role_name);
        begin execute probe_sql; exception when others then actual_state := sqlstate; end;
        execute 'reset role';
        if actual_state is distinct from '42501' then
          raise exception '% % on % returned %', role_name, action_name, table_name, coalesce(actual_state,'success');
        end if;
      end loop;
    end loop;
  end loop;
end
$permission_tests$;

select public.fixture_expect_error(
  'revision update',
  format('update public.learning_assignment_plan_revisions set operation=operation where plan_id=%L', :'planning_plan'),
  array['55000']
);
select public.fixture_expect_error(
  'revision delete',
  format('delete from public.learning_assignment_plan_revisions where plan_id=%L', :'planning_plan'),
  array['55000']
);

update public.learning_assignments
set status = 'completed', completed_at = now(), updated_at = now()
where id = :'planning_assignment';

select public.fixture_expect_error(
  'completed plan update',
  format($sql$select * from public.update_learning_assignment_plan(
    %L,%L,%L,%L,6,'2026-08-03','2026-08-25','Asia/Seoul',%L::jsonb,%L)$sql$,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_plan',
    '[{"stage_id":"62000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-07"},{"stage_id":"62000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-13"},{"stage_id":"62000000-0000-4000-8000-000000000003","display_order":3,"target_date":"2026-08-19"},{"stage_id":"62000000-0000-4000-8000-000000000004","display_order":4,"target_date":"2026-08-25"}]',
    '82000000-0000-4000-8000-000000000014'),
  array['55000']
);
select public.fixture_expect_error(
  'completed plan pause',
  format('select * from public.pause_learning_assignment_plan(%L,%L,%L,%L,6,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_plan',
    '82000000-0000-4000-8000-000000000015'),
  array['55000']
);
select public.fixture_expect_error(
  'completed plan resume',
  format('select * from public.resume_learning_assignment_plan(%L,%L,%L,%L,6,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', :'planning_plan',
    '82000000-0000-4000-8000-000000000016'),
  array['55000']
);

-- A pre-existing assignment without a plan remains valid and can complete.
update public.learning_assignments
set status = 'completed', completed_at = now(), updated_at = now()
where family_id = '10000000-0000-4000-8000-000000000001'
  and assigned_member_id = '20000000-0000-4000-8000-000000000003'
  and status = 'active'
  and not exists (
    select 1 from public.learning_assignment_plans plan
    where plan.assignment_id = learning_assignments.id
  );

select public.fixture_assert(
  exists (
    select 1 from public.learning_assignments assignment
    where assignment.family_id = '10000000-0000-4000-8000-000000000001'
      and assignment.assigned_member_id = '20000000-0000-4000-8000-000000000003'
      and assignment.status = 'completed'
      and not exists (select 1 from public.learning_assignment_plans plan where plan.assignment_id = assignment.id)
  ),
  'plan-less legacy completed assignment was not preserved'
);

select public.fixture_assert(
  (select count(*) = 1 from public.learning_assignment_plans where id = :'planning_plan')
  and (select count(*) = 4 from public.learning_assignment_stage_targets where plan_id = :'planning_plan')
  and (select count(*) = 6 and count(distinct revision) = 6
       from public.learning_assignment_plan_revisions where plan_id = :'planning_plan')
  and not exists (
    select 1 from pg_catalog.pg_publication_tables
    where schemaname = 'public' and tablename in (
      'learning_assignment_plans','learning_assignment_stage_targets','learning_assignment_plan_revisions'
    )
  ),
  'final planning counts, revisions, or Realtime exclusion failed'
);

select 'phase2b assignment planning fixture passed' as result;
