\set ON_ERROR_STOP on

-- Disposable PostgreSQL fixture only. No production identifiers or content.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create extension if not exists pgcrypto;
create extension if not exists dblink;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  family_key text not null unique,
  display_name text not null
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  member_key text not null,
  display_name text not null,
  role text not null check (role in ('parent', 'child')),
  is_active boolean not null default true,
  unique (family_id, member_key)
);

create unique index family_members_family_id_id_uidx
  on public.family_members (family_id, id);

create table public.sticker_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  member_id uuid not null references public.family_members(id),
  amount integer not null,
  transaction_type text not null,
  source_type text not null,
  source_id text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (member_id, source_type, source_id)
);

\ir ../../supabase/migrations/202607300001_create_phase_2b_learning_foundation.sql

create function public.fixture_assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $function$
begin
  if not coalesce(p_condition, false) then
    raise exception using
      errcode = 'P0001',
      message = 'fixture assertion failed: ' || p_message;
  end if;
end
$function$;

create function public.fixture_expect_error(
  p_case text,
  p_sql text,
  p_expected_states text[]
)
returns void
language plpgsql
as $function$
declare
  actual_state text;
begin
  begin
    execute p_sql;
  exception
    when others then
      actual_state := sqlstate;
  end;

  if actual_state is null then
    raise exception using
      errcode = 'P0001',
      message = 'fixture expected an error: ' || p_case;
  end if;

  if not actual_state = any(p_expected_states) then
    raise exception using
      errcode = 'P0001',
      message = format(
        'fixture case %s returned SQLSTATE %s',
        p_case,
        actual_state
      );
  end if;
end
$function$;

insert into public.families (id, family_key, display_name)
values
  ('10000000-0000-4000-8000-000000000001', 'fixture-one', 'Fixture One'),
  ('10000000-0000-4000-8000-000000000002', 'fixture-two', 'Fixture Two');

insert into public.family_members (
  id,
  family_id,
  member_key,
  display_name,
  role,
  is_active
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'parent-one',
    'Parent One',
    'parent',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'child-one',
    'Child One',
    'child',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'child-two',
    'Child Two',
    'child',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'child-inactive',
    'Child Inactive',
    'child',
    false
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000002',
    'parent-two',
    'Parent Two',
    'parent',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000002',
    'child-three',
    'Child Three',
    'child',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    'child-concurrent',
    'Child Concurrent',
    'child',
    true
  );

insert into public.learning_courses (
  id,
  course_code,
  internal_name,
  subject_name
)
values (
  '30000000-0000-4000-8000-000000000001',
  'fixture-course',
  'Fixture Course',
  'Fixture Subject'
);

insert into public.learning_units (
  id,
  course_id,
  unit_code,
  display_title,
  sort_order
)
values
  (
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    'fixture-unit',
    'Fixture Unit',
    1
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001',
    'other-unit',
    'Other Unit',
    2
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    'concurrent-unit',
    'Concurrent Unit',
    3
  );

insert into public.learning_content_versions (
  id,
  unit_id,
  version_no,
  content_hash
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    1,
    repeat('1', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    2,
    repeat('2', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000003',
    1,
    repeat('3', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000003',
    2,
    repeat('4', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000003',
    3,
    repeat('5', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    4,
    repeat('6', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000007',
    '30000000-0000-4000-8000-000000000003',
    5,
    repeat('7', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000008',
    '30000000-0000-4000-8000-000000000004',
    1,
    repeat('8', 64)
  );

-- Version 1: two valid stages.
insert into public.learning_stages (
  id,
  content_version_id,
  display_order,
  display_title,
  difficulty
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    1,
    'Stage One',
    'seed'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    2,
    'Stage Two',
    'leaf'
  );

insert into public.learning_questions (
  id,
  stage_id,
  display_order,
  prompt,
  explanation
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    1,
    'Fixture question one?',
    'Fixture explanation one.'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    1,
    'Fixture question two?',
    'Fixture explanation two.'
  );

insert into public.learning_question_options (
  id,
  question_id,
  display_order,
  option_text,
  is_correct
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    1,
    'Correct one',
    true
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    2,
    'Incorrect one',
    false
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000002',
    1,
    'Correct two',
    true
  ),
  (
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000002',
    2,
    'Incorrect two',
    false
  );

-- Version 2 and the concurrency version are valid one-stage releases.
insert into public.learning_stages (
  id,
  content_version_id,
  display_order,
  display_title,
  difficulty
)
values
  (
    '50000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000002',
    1,
    'Version Two Stage',
    'tree'
  ),
  (
    '50000000-0000-4000-8000-000000000008',
    '40000000-0000-4000-8000-000000000008',
    1,
    'Concurrent Stage',
    'crown'
  );

insert into public.learning_questions (
  id,
  stage_id,
  display_order,
  prompt,
  explanation
)
values
  (
    '60000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000003',
    1,
    'Version two question?',
    'Version two explanation.'
  ),
  (
    '60000000-0000-4000-8000-000000000008',
    '50000000-0000-4000-8000-000000000008',
    1,
    'Concurrent question?',
    'Concurrent explanation.'
  );

insert into public.learning_question_options (
  id,
  question_id,
  display_order,
  option_text,
  is_correct
)
values
  (
    '70000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000003',
    1,
    'Version two correct',
    true
  ),
  (
    '70000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000003',
    2,
    'Version two incorrect',
    false
  ),
  (
    '70000000-0000-4000-8000-000000000015',
    '60000000-0000-4000-8000-000000000008',
    1,
    'Concurrent correct',
    true
  ),
  (
    '70000000-0000-4000-8000-000000000016',
    '60000000-0000-4000-8000-000000000008',
    2,
    'Concurrent incorrect',
    false
  );

-- Invalid publish fixtures.
insert into public.learning_stages (
  id,
  content_version_id,
  display_order,
  display_title,
  difficulty
)
values
  (
    '50000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000004',
    1,
    'No Question Stage',
    'seed'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000005',
    1,
    'One Option Stage',
    'seed'
  ),
  (
    '50000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000006',
    1,
    'No Correct Stage',
    'seed'
  ),
  (
    '50000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000007',
    2,
    'Gapped Stage',
    'seed'
  );

insert into public.learning_questions (
  id,
  stage_id,
  display_order,
  prompt,
  explanation
)
values
  (
    '60000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    1,
    'One option question?',
    'One option explanation.'
  ),
  (
    '60000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    1,
    'No correct question?',
    'No correct explanation.'
  ),
  (
    '60000000-0000-4000-8000-000000000007',
    '50000000-0000-4000-8000-000000000007',
    1,
    'Gapped stage question?',
    'Gapped stage explanation.'
  );

insert into public.learning_question_options (
  id,
  question_id,
  display_order,
  option_text,
  is_correct
)
values
  (
    '70000000-0000-4000-8000-000000000007',
    '60000000-0000-4000-8000-000000000005',
    1,
    'Only option',
    true
  ),
  (
    '70000000-0000-4000-8000-000000000008',
    '60000000-0000-4000-8000-000000000006',
    1,
    'No correct one',
    false
  ),
  (
    '70000000-0000-4000-8000-000000000009',
    '60000000-0000-4000-8000-000000000006',
    2,
    'No correct two',
    false
  ),
  (
    '70000000-0000-4000-8000-000000000010',
    '60000000-0000-4000-8000-000000000007',
    1,
    'Gap correct',
    true
  ),
  (
    '70000000-0000-4000-8000-000000000011',
    '60000000-0000-4000-8000-000000000007',
    2,
    'Gap incorrect',
    false
  );

select public.fixture_expect_error(
  'stage-less version publish',
  $sql$select public.publish_learning_content_version(
    '40000000-0000-4000-8000-000000000003'
  )$sql$,
  array['23514']
);
select public.fixture_expect_error(
  'question-less stage publish',
  $sql$select public.publish_learning_content_version(
    '40000000-0000-4000-8000-000000000004'
  )$sql$,
  array['23514']
);
select public.fixture_expect_error(
  'one-option question publish',
  $sql$select public.publish_learning_content_version(
    '40000000-0000-4000-8000-000000000005'
  )$sql$,
  array['23514']
);
select public.fixture_expect_error(
  'zero-correct question publish',
  $sql$select public.publish_learning_content_version(
    '40000000-0000-4000-8000-000000000006'
  )$sql$,
  array['23514']
);
select public.fixture_expect_error(
  'gapped stage order publish',
  $sql$select public.publish_learning_content_version(
    '40000000-0000-4000-8000-000000000007'
  )$sql$,
  array['23514']
);
select public.fixture_expect_error(
  'second correct option',
  $sql$insert into public.learning_question_options (
    id,
    question_id,
    display_order,
    option_text,
    is_correct
  ) values (
    '70000000-0000-4000-8000-000000000012',
    '60000000-0000-4000-8000-000000000001',
    3,
    'Second correct',
    true
  )$sql$,
  array['23505']
);

set role service_role;
select public.publish_learning_content_version(
  '40000000-0000-4000-8000-000000000001'
);
select public.publish_learning_content_version(
  '40000000-0000-4000-8000-000000000002'
);
select public.publish_learning_content_version(
  '40000000-0000-4000-8000-000000000008'
);
reset role;

select public.fixture_assert(
  (
    select status = 'published' and published_at is not null
    from public.learning_content_versions
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  'valid content did not publish'
);
select public.fixture_expect_error(
  'published question update',
  $sql$update public.learning_questions
    set prompt = 'Changed'
    where id = '60000000-0000-4000-8000-000000000001'$sql$,
  array['55000']
);
select public.fixture_expect_error(
  'published option delete',
  $sql$delete from public.learning_question_options
    where id = '70000000-0000-4000-8000-000000000001'$sql$,
  array['55000']
);
select public.fixture_expect_error(
  'published version republish',
  $sql$select public.publish_learning_content_version(
    '40000000-0000-4000-8000-000000000001'
  )$sql$,
  array['55000']
);

set role service_role;
select assignment_id as assignment_one
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001'
)
\gset
reset role;

select public.fixture_assert(
  (
    select count(*) = 2
      and count(*) filter (where status = 'unlocked') = 1
      and count(*) filter (where status = 'locked') = 1
    from public.learning_stage_progress
    where assignment_id = :'assignment_one'
  ),
  'first stage unlock contract failed'
);
select public.fixture_assert(
  (
    select progress.stage_id = '50000000-0000-4000-8000-000000000001'
      and progress.status = 'unlocked'
    from public.learning_stage_progress progress
    where progress.assignment_id = :'assignment_one'
      and progress.status = 'unlocked'
  ),
  'the first display-order stage was not unlocked'
);

select public.fixture_expect_error(
  'parent assigned as child',
  $sql$select public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001'
  )$sql$,
  array['42501']
);
select public.fixture_expect_error(
  'inactive child assignment',
  $sql$select public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000001'
  )$sql$,
  array['42501']
);
select public.fixture_expect_error(
  'cross-family child assignment',
  $sql$select public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000001'
  )$sql$,
  array['42501']
);
select public.fixture_expect_error(
  'draft version assignment',
  $sql$select public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003'
  )$sql$,
  array['55000']
);
select public.fixture_expect_error(
  'duplicate active assignment',
  $sql$select public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001'
  )$sql$,
  array['23505']
);
select public.fixture_expect_error(
  'different version of active unit',
  $sql$select public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002'
  )$sql$,
  array['23505']
);
select public.fixture_expect_error(
  'wrong direct version and unit pair',
  $sql$insert into public.learning_assignments (
    family_id,
    assigned_member_id,
    created_by_member_id,
    unit_id,
    content_version_id
  ) values (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001'
  )$sql$,
  array['55000', '23503']
);

set role service_role;
select public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000001'
);
select public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  '40000000-0000-4000-8000-000000000001'
);
select public.retire_learning_content_version(
  '40000000-0000-4000-8000-000000000001'
);
reset role;

select public.fixture_assert(
  (
    select status = 'retired'
    from public.learning_content_versions
    where id = '40000000-0000-4000-8000-000000000001'
  )
  and exists (
    select 1
    from public.learning_assignments
    where id = :'assignment_one'
  ),
  'retired content did not preserve existing assignments'
);
select public.fixture_expect_error(
  'retired version assignment',
  $sql$select public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000001'
  )$sql$,
  array['55000']
);
select public.fixture_expect_error(
  'retired version to published',
  $sql$update public.learning_content_versions
    set status = 'published', retired_at = null
    where id = '40000000-0000-4000-8000-000000000001'$sql$,
  array['55000']
);
select public.fixture_expect_error(
  'retired version to draft',
  $sql$update public.learning_content_versions
    set status = 'draft', published_at = null, retired_at = null
    where id = '40000000-0000-4000-8000-000000000001'$sql$,
  array['55000']
);

set role service_role;
select public.cancel_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'assignment_one'
);
select assignment_id as assignment_two
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000002'
)
\gset
reset role;

select public.fixture_assert(
  (
    select status = 'cancelled'
    from public.learning_assignments
    where id = :'assignment_one'
  )
  and (
    select count(*) = 2
    from public.learning_stage_progress
    where assignment_id = :'assignment_one'
  )
  and exists (
    select 1
    from public.learning_assignments
    where id = :'assignment_two'
      and status = 'active'
      and content_version_id = '40000000-0000-4000-8000-000000000002'
  ),
  'cancel did not preserve progress or allow a new version assignment'
);
select public.fixture_expect_error(
  'terminal assignment recancel',
  format(
    'select public.cancel_learning_assignment(%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'assignment_one'
  ),
  array['55000']
);

-- Actual table and function permission probes in the disposable database.
do $permission_tests$
declare
  role_name text;
  table_name text;
  action_name text;
  probe_sql text;
  actual_state text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    foreach table_name in array array[
      'learning_courses',
      'learning_units',
      'learning_content_versions',
      'learning_stages',
      'learning_questions',
      'learning_question_options',
      'learning_assignments',
      'learning_stage_progress'
    ]
    loop
      foreach action_name in array array[
        'select',
        'insert',
        'update',
        'delete'
      ]
      loop
        probe_sql := case action_name
          when 'select' then format(
            'select 1 from public.%I where false',
            table_name
          )
          when 'insert' then format(
            'insert into public.%I default values',
            table_name
          )
          when 'update' then format(
            'update public.%I set id = id where false',
            table_name
          )
          when 'delete' then format(
            'delete from public.%I where false',
            table_name
          )
        end;
        actual_state := null;
        execute format('set local role %I', role_name);
        begin
          execute probe_sql;
        exception
          when others then
            actual_state := sqlstate;
        end;
        execute 'reset role';

        if actual_state is distinct from '42501' then
          raise exception using
            errcode = 'P0001',
            message = format(
              '%s %s on %s returned %s instead of 42501',
              role_name,
              action_name,
              table_name,
              coalesce(actual_state, 'success')
            );
        end if;
      end loop;
    end loop;
  end loop;
end
$permission_tests$;

do $service_role_table_permissions$
declare
  table_name text;
  action_name text;
  probe_sql text;
  actual_state text;
begin
  foreach table_name in array array[
    'learning_courses',
    'learning_units',
    'learning_content_versions',
    'learning_stages',
    'learning_questions',
    'learning_question_options',
    'learning_assignments',
    'learning_stage_progress'
  ]
  loop
    execute 'set local role service_role';
    execute format('select 1 from public.%I where false', table_name);
    execute 'reset role';

    foreach action_name in array array['insert', 'update', 'delete']
    loop
      probe_sql := case action_name
        when 'insert' then format(
          'insert into public.%I default values',
          table_name
        )
        when 'update' then format(
          'update public.%I set id = id where false',
          table_name
        )
        when 'delete' then format(
          'delete from public.%I where false',
          table_name
        )
      end;
      actual_state := null;
      execute 'set local role service_role';
      begin
        execute probe_sql;
      exception
        when others then
          actual_state := sqlstate;
      end;
      execute 'reset role';

      if actual_state is distinct from '42501' then
        raise exception using
          errcode = 'P0001',
          message = format(
            'service_role %s on %s returned %s instead of 42501',
            action_name,
            table_name,
            coalesce(actual_state, 'success')
          );
      end if;
    end loop;
  end loop;
end
$service_role_table_permissions$;

do $function_permissions$
declare
  actual_state text;
begin
  execute 'set local role anon';
  begin
    execute $probe$
      select public.publish_learning_content_version(
        '40000000-0000-4000-8000-000000000003'
      )
    $probe$;
  exception
    when others then
      actual_state := sqlstate;
  end;
  execute 'reset role';

  if actual_state is distinct from '42501' then
    raise exception 'anon publish probe expected 42501, got %',
      coalesce(actual_state, 'success');
  end if;

  actual_state := null;
  execute 'set local role authenticated';
  begin
    execute $probe$
      select public.create_learning_assignment(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000002'
      )
    $probe$;
  exception
    when others then
      actual_state := sqlstate;
  end;
  execute 'reset role';

  if actual_state is distinct from '42501' then
    raise exception 'authenticated assignment probe expected 42501, got %',
      coalesce(actual_state, 'success');
  end if;
end
$function_permissions$;

-- Concurrency: one connection holds the uncommitted active row while the
-- second attempts the same child/unit assignment.
create function public.fixture_hold_concurrent_assignment()
returns uuid
language plpgsql
as $function$
declare
  created_id uuid;
begin
  select assignment.assignment_id
  into created_id
  from public.create_learning_assignment(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000008'
  ) assignment;
  perform pg_sleep(2);
  return created_id;
end
$function$;

do $concurrency_test$
declare
  duplicate_state text;
  remote_result record;
begin
  perform dblink_connect(
    'phase2b_concurrent',
    'dbname=' || current_database() || ' user=postgres'
  );
  perform dblink_send_query(
    'phase2b_concurrent',
    'select public.fixture_hold_concurrent_assignment()'
  );
  perform pg_sleep(0.3);

  begin
    perform *
    from public.create_learning_assignment(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000007',
      '40000000-0000-4000-8000-000000000008'
    );
  exception
    when others then
      duplicate_state := sqlstate;
  end;

  select result.*
  into remote_result
  from dblink_get_result('phase2b_concurrent')
    as result(assignment_id uuid);
  perform dblink_disconnect('phase2b_concurrent');

  if duplicate_state is distinct from '23505' then
    raise exception using
      errcode = 'P0001',
      message = format(
        'concurrent assignment returned %s instead of 23505',
        coalesce(duplicate_state, 'success')
      );
  end if;
end
$concurrency_test$;

select public.fixture_assert(
  (
    select count(*) = 1
    from public.learning_assignments
    where family_id = '10000000-0000-4000-8000-000000000001'
      and assigned_member_id = '20000000-0000-4000-8000-000000000007'
      and unit_id = '30000000-0000-4000-8000-000000000004'
      and status = 'active'
  ),
  'concurrent assignment created more than one active row'
);

select public.fixture_assert(
  (
    select count(*) = 8
    from pg_catalog.pg_class class
    where class.oid in (
      'public.learning_courses'::regclass,
      'public.learning_units'::regclass,
      'public.learning_content_versions'::regclass,
      'public.learning_stages'::regclass,
      'public.learning_questions'::regclass,
      'public.learning_question_options'::regclass,
      'public.learning_assignments'::regclass,
      'public.learning_stage_progress'::regclass
    )
      and class.relrowsecurity
      and class.relforcerowsecurity
  ),
  'RLS/FORCE RLS contract failed'
);

select 'phase2b_learning_foundation_fixture_passed' as result;
