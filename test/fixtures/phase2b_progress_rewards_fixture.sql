\set ON_ERROR_STOP on

-- Disposable PostgreSQL fixture only. No production identifiers or content.
\ir phase2b_attempt_engine_fixture.sql
\ir ../../supabase/migrations/202607310001_create_phase_2b_progress_rewards.sql

create function public.fixture_complete_reward_stage(
  p_assignment_id uuid,
  p_stage_id uuid,
  p_child_id uuid,
  p_correct_count integer,
  p_start_request_id uuid
)
returns uuid
language plpgsql
as $function$
declare
  target_attempt_id uuid;
  question_row public.learning_attempt_questions%rowtype;
  selected_option_id uuid;
begin
  select attempt.attempt_id
  into target_attempt_id
  from public.start_or_resume_learning_attempt(
    (select family_id from public.learning_assignments where id = p_assignment_id),
    p_child_id,
    p_child_id,
    p_assignment_id,
    p_stage_id,
    p_start_request_id
  ) attempt;

  for question_row in
    select *
    from public.learning_attempt_questions
    where attempt_id = target_attempt_id
    order by display_order
  loop
    if question_row.display_order <= p_correct_count then
      selected_option_id := question_row.correct_option_id;
    else
      select (option_row ->> 'id')::uuid
      into selected_option_id
      from jsonb_array_elements(question_row.options_snapshot) option_row
      where (option_row ->> 'id')::uuid <> question_row.correct_option_id
      order by (option_row ->> 'displayOrder')::integer
      limit 1;
    end if;

    perform *
    from public.submit_learning_attempt_answer(
      p_child_id,
      target_attempt_id,
      question_row.id,
      selected_option_id,
      gen_random_uuid()
    );
  end loop;

  return target_attempt_id;
end
$function$;

create function public.fixture_create_reward_version(
  p_version_id uuid,
  p_version_no integer,
  p_stage_id uuid,
  p_difficulty text
)
returns void
language plpgsql
as $function$
begin
  insert into public.learning_content_versions (
    id, unit_id, version_no, content_hash
  ) values (
    p_version_id,
    'c2000000-0000-4000-8000-000000000001',
    p_version_no,
    repeat(p_version_no::text, 64)
  );

  insert into public.learning_stages (
    id, content_version_id, display_order, display_title, difficulty
  ) values (
    p_stage_id, p_version_id, 1, 'Independent Reward Stage', p_difficulty
  );

  insert into public.learning_questions (
    id, stage_id, display_order, prompt, explanation
  )
  select
    gen_random_uuid(),
    p_stage_id,
    question_no,
    format('Independent question %s', question_no),
    format('Independent explanation %s', question_no)
  from generate_series(1, 5) question_no;

  insert into public.learning_question_options (
    id, question_id, display_order, option_text, is_correct
  )
  select
    gen_random_uuid(),
    question.id,
    option_no,
    format('Independent option %s', option_no),
    option_no = 1
  from public.learning_questions question
  cross join generate_series(1, 2) option_no
  where question.stage_id = p_stage_id;

  perform public.publish_learning_content_version(p_version_id);
end
$function$;

insert into public.learning_courses (
  id, course_code, internal_name, subject_name
) values (
  'c1000000-0000-4000-8000-000000000001',
  'progress-reward-fixture',
  'Progress Reward Fixture',
  'Fixture Subject'
);

insert into public.learning_units (
  id, course_id, unit_code, display_title, sort_order
) values (
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'progress-reward-unit',
  'Progress Reward Unit',
  1
);

insert into public.learning_content_versions (
  id, unit_id, version_no, content_hash
) values (
  'c3000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  1,
  repeat('1', 64)
);

insert into public.learning_stages (
  id, content_version_id, display_order, display_title, difficulty
)
values
  (
    'c4000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001', 1, 'Seed Stage', 'seed'
  ),
  (
    'c4000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000001', 2, 'Leaf Stage', 'leaf'
  ),
  (
    'c4000000-0000-4000-8000-000000000003',
    'c3000000-0000-4000-8000-000000000001', 3, 'Tree Stage', 'tree'
  ),
  (
    'c4000000-0000-4000-8000-000000000004',
    'c3000000-0000-4000-8000-000000000001', 4, 'Crown Stage', 'crown'
  );

insert into public.learning_questions (
  id, stage_id, display_order, prompt, explanation
)
select
  gen_random_uuid(),
  stage.id,
  question_no,
  format('%s question %s', stage.display_title, question_no),
  format('%s explanation %s', stage.display_title, question_no)
from public.learning_stages stage
cross join generate_series(1, 5) question_no
where stage.content_version_id = 'c3000000-0000-4000-8000-000000000001';

insert into public.learning_question_options (
  id, question_id, display_order, option_text, is_correct
)
select
  gen_random_uuid(),
  question.id,
  option_no,
  format('Reward option %s', option_no),
  option_no = 1
from public.learning_questions question
join public.learning_stages stage on stage.id = question.stage_id
cross join generate_series(1, 2) option_no
where stage.content_version_id = 'c3000000-0000-4000-8000-000000000001';

select public.publish_learning_content_version(
  'c3000000-0000-4000-8000-000000000001'
);

select assignment_id as reward_assignment_id
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000001'
)
\gset

select public.fixture_complete_reward_stage(
  :'reward_assignment_id',
  'c4000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  4,
  'c5000000-0000-4000-8000-000000000001'
) as seed_attempt_id
\gset

select public.fixture_assert(
  (
    select first_pass.reward_amount = 1
      and transaction_row.amount = 1
      and transaction_row.source_type = 'learning_stage_first_pass'
      and transaction_row.source_id = first_pass.id::text
    from public.learning_stage_first_passes first_pass
    join public.sticker_transactions transaction_row
      on transaction_row.id = first_pass.reward_transaction_id
    where first_pass.assignment_id = :'reward_assignment_id'
      and first_pass.stage_id = 'c4000000-0000-4000-8000-000000000001'
  ),
  'seed first pass did not award exactly 1 sticker'
);

select public.fixture_assert(
  (
    select count(*) filter (where status = 'passed') = 1
       and count(*) filter (where status = 'unlocked') = 1
       and count(*) filter (where status = 'locked') = 2
    from public.learning_stage_progress
    where assignment_id = :'reward_assignment_id'
  ),
  'first stage pass did not unlock exactly the next stage'
);

select public.fixture_complete_reward_stage(
  :'reward_assignment_id',
  'c4000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  4,
  'c5000000-0000-4000-8000-000000000002'
) as leaf_attempt_id
\gset

select public.fixture_assert(
  (
    select reward_amount = 2
    from public.learning_stage_first_passes
    where assignment_id = :'reward_assignment_id'
      and stage_id = 'c4000000-0000-4000-8000-000000000002'
  ),
  'leaf first pass did not award exactly 2 stickers'
);

select public.fixture_complete_reward_stage(
  :'reward_assignment_id',
  'c4000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000002',
  4,
  'c5000000-0000-4000-8000-000000000003'
) as tree_attempt_id
\gset

select public.fixture_assert(
  (
    select reward_amount = 3
    from public.learning_stage_first_passes
    where assignment_id = :'reward_assignment_id'
      and stage_id = 'c4000000-0000-4000-8000-000000000003'
  ),
  'tree first pass did not award exactly 3 stickers'
);

select public.fixture_complete_reward_stage(
  :'reward_assignment_id',
  'c4000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000002',
  4,
  'c5000000-0000-4000-8000-000000000004'
) as crown_attempt_id
\gset

select public.fixture_assert(
  (
    select reward_amount = 5
    from public.learning_stage_first_passes
    where assignment_id = :'reward_assignment_id'
      and stage_id = 'c4000000-0000-4000-8000-000000000004'
  ),
  'crown first pass did not award exactly 5 stickers'
);

select public.fixture_assert(
  (
    select status = 'completed' and completed_at is not null
    from public.learning_assignments
    where id = :'reward_assignment_id'
  ),
  'last stage pass did not complete the assignment'
);

select public.fixture_assert(
  (
    select count(*) = 4 and sum(amount) = 11
    from public.sticker_transactions
    where member_id = '20000000-0000-4000-8000-000000000002'
      and source_type = 'learning_stage_first_pass'
      and source_id in (
        select id::text
        from public.learning_stage_first_passes
        where assignment_id = :'reward_assignment_id'
      )
  ),
  'sticker ledger sum did not match the four difficulty rewards'
);

select public.fixture_assert(
  (
    select result.first_pass
      and result.reward_granted
      and result.reward_amount = 5
      and result.unlocked_stage_id is null
      and result.assignment_completed
    from public.finalize_learning_stage_attempt(
      '20000000-0000-4000-8000-000000000002',
      :'crown_attempt_id',
      gen_random_uuid()
    ) result
  ),
  'same attempt finalize replay changed its stable result'
);

insert into public.learning_attempts (
  family_id, assigned_member_id, assignment_id, content_version_id,
  stage_id, attempt_no, start_request_id, status, total_questions,
  correct_answers, required_correct_answers, finalized_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'reward_assignment_id',
  'c3000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001',
  2,
  'c5100000-0000-4000-8000-000000000001',
  'passed', 5, 5, 4, now()
) returning id as later_attempt_id
\gset

select first_pass as later_first_pass,
       reward_granted as later_reward_granted,
       reward_amount as later_reward_amount
from public.finalize_learning_stage_attempt(
  '20000000-0000-4000-8000-000000000002',
  :'later_attempt_id',
  gen_random_uuid()
)
\gset

select public.fixture_assert(
  not :'later_first_pass'::boolean
    and not :'later_reward_granted'::boolean
    and :'later_reward_amount'::integer = 0
    and (
      select count(*) = 1
      from public.learning_stage_first_passes
      where assignment_id = :'reward_assignment_id'
        and stage_id = 'c4000000-0000-4000-8000-000000000001'
    ),
  'different attempt awarded the same stage twice'
);

select public.fixture_create_reward_version(
  'c3000000-0000-4000-8000-000000000002',
  2,
  'c4000000-0000-4000-8000-000000000005',
  'seed'
);

select assignment_id as retry_assignment_id
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000002'
)
\gset

select public.fixture_complete_reward_stage(
  :'retry_assignment_id',
  'c4000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000002',
  3,
  'c5000000-0000-4000-8000-000000000005'
) as failed_attempt_id
\gset

select public.fixture_assert(
  (
    select attempt.status = 'failed'
      and progress.status = 'unlocked'
      and assignment.status = 'active'
      and not exists (
        select 1
        from public.learning_stage_first_passes first_pass
        where first_pass.assignment_id = assignment.id
      )
      and not exists (
        select 1
        from public.sticker_transactions transaction_row
        where transaction_row.source_type = 'learning_stage_first_pass'
          and transaction_row.source_id in (
            select id::text from public.learning_stage_first_passes
            where assignment_id = assignment.id
          )
      )
    from public.learning_attempts attempt
    join public.learning_stage_progress progress
      on progress.assignment_id = attempt.assignment_id
     and progress.stage_id = attempt.stage_id
    join public.learning_assignments assignment
      on assignment.id = attempt.assignment_id
    where attempt.id = :'failed_attempt_id'
  ),
  'failed attempt changed progress, unlock, first-pass, or rewards'
);

select public.fixture_complete_reward_stage(
  :'retry_assignment_id',
  'c4000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000002',
  4,
  'c5000000-0000-4000-8000-000000000006'
) as version_two_pass_attempt_id
\gset

select public.fixture_assert(
  (
    select count(*) = 1 and sum(reward_amount) = 1
    from public.learning_stage_first_passes
    where assignment_id = :'retry_assignment_id'
  ),
  'new content version did not receive an independent first-pass reward'
);

select public.fixture_expect_error(
  'other family finalize',
  format(
    'select * from public.finalize_learning_stage_attempt(%L, %L, %L)',
    '20000000-0000-4000-8000-000000000006',
    :'seed_attempt_id',
    gen_random_uuid()
  ),
  array['42501']
);

create function public.fixture_hold_reward_finalize(p_attempt_id uuid)
returns jsonb
language plpgsql
as $function$
declare
  payload jsonb;
begin
  select to_jsonb(result)
  into payload
  from public.finalize_learning_stage_attempt(
    '20000000-0000-4000-8000-000000000002',
    p_attempt_id,
    gen_random_uuid()
  ) result;
  perform pg_sleep(2);
  return payload;
end
$function$;

select public.fixture_create_reward_version(
  'c3000000-0000-4000-8000-000000000003',
  3,
  'c4000000-0000-4000-8000-000000000006',
  'leaf'
);

select assignment_id as same_attempt_assignment_id
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000003'
)
\gset

insert into public.learning_attempts (
  family_id, assigned_member_id, assignment_id, content_version_id,
  stage_id, attempt_no, start_request_id, status, total_questions,
  correct_answers, required_correct_answers, finalized_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'same_attempt_assignment_id',
  'c3000000-0000-4000-8000-000000000003',
  'c4000000-0000-4000-8000-000000000006',
  1,
  'c5100000-0000-4000-8000-000000000002',
  'passed', 5, 5, 4, now()
) returning id as same_concurrent_attempt_id
\gset

do $same_attempt_concurrency$
declare
  target_attempt_id uuid;
  remote_payload jsonb;
  local_payload jsonb;
begin
  select id
  into target_attempt_id
  from public.learning_attempts
  where start_request_id = 'c5100000-0000-4000-8000-000000000002';

  perform dblink_connect(
    'phase2b_same_finalize',
    'dbname=' || current_database() || ' user=postgres'
  );
  perform dblink_send_query(
    'phase2b_same_finalize',
    format(
      'select public.fixture_hold_reward_finalize(%L)',
      target_attempt_id
    )
  );
  perform pg_sleep(0.3);

  select to_jsonb(result)
  into local_payload
  from public.finalize_learning_stage_attempt(
    '20000000-0000-4000-8000-000000000002',
    target_attempt_id,
    gen_random_uuid()
  ) result;

  select result.payload
  into remote_payload
  from dblink_get_result('phase2b_same_finalize')
    as result(payload jsonb);
  perform dblink_disconnect('phase2b_same_finalize');

  if remote_payload ->> 'attempt_id' is distinct from
       local_payload ->> 'attempt_id'
     or not (remote_payload ->> 'first_pass')::boolean
     or not (local_payload ->> 'first_pass')::boolean
     or not (remote_payload ->> 'reward_granted')::boolean
     or not (local_payload ->> 'reward_granted')::boolean then
    raise exception using
      errcode = 'P0001',
      message = 'concurrent same-attempt finalize was not idempotent';
  end if;
end
$same_attempt_concurrency$;

select public.fixture_create_reward_version(
  'c3000000-0000-4000-8000-000000000004',
  4,
  'c4000000-0000-4000-8000-000000000007',
  'tree'
);

select assignment_id as distinct_attempt_assignment_id
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000004'
)
\gset

insert into public.learning_attempts (
  family_id, assigned_member_id, assignment_id, content_version_id,
  stage_id, attempt_no, start_request_id, status, total_questions,
  correct_answers, required_correct_answers, finalized_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'distinct_attempt_assignment_id',
    'c3000000-0000-4000-8000-000000000004',
    'c4000000-0000-4000-8000-000000000007',
    1, 'c5100000-0000-4000-8000-000000000003',
    'passed', 5, 5, 4, now()
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    :'distinct_attempt_assignment_id',
    'c3000000-0000-4000-8000-000000000004',
    'c4000000-0000-4000-8000-000000000007',
    2, 'c5100000-0000-4000-8000-000000000004',
    'passed', 5, 5, 4, now()
  );

select id as distinct_attempt_one_id
from public.learning_attempts
where start_request_id = 'c5100000-0000-4000-8000-000000000003'
\gset

select id as distinct_attempt_two_id
from public.learning_attempts
where start_request_id = 'c5100000-0000-4000-8000-000000000004'
\gset

do $distinct_attempt_concurrency$
declare
  first_attempt_id uuid;
  second_attempt_id uuid;
  remote_payload jsonb;
  local_payload jsonb;
begin
  select id
  into first_attempt_id
  from public.learning_attempts
  where start_request_id = 'c5100000-0000-4000-8000-000000000003';

  select id
  into second_attempt_id
  from public.learning_attempts
  where start_request_id = 'c5100000-0000-4000-8000-000000000004';

  perform dblink_connect(
    'phase2b_distinct_finalize',
    'dbname=' || current_database() || ' user=postgres'
  );
  perform dblink_send_query(
    'phase2b_distinct_finalize',
    format(
      'select public.fixture_hold_reward_finalize(%L)',
      first_attempt_id
    )
  );
  perform pg_sleep(0.3);

  select to_jsonb(result)
  into local_payload
  from public.finalize_learning_stage_attempt(
    '20000000-0000-4000-8000-000000000002',
    second_attempt_id,
    gen_random_uuid()
  ) result;

  select result.payload
  into remote_payload
  from dblink_get_result('phase2b_distinct_finalize')
    as result(payload jsonb);
  perform dblink_disconnect('phase2b_distinct_finalize');

  if ((remote_payload ->> 'first_pass')::boolean::integer
      + (local_payload ->> 'first_pass')::boolean::integer) <> 1
     or ((remote_payload ->> 'reward_granted')::boolean::integer
      + (local_payload ->> 'reward_granted')::boolean::integer) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'concurrent distinct-attempt finalize created duplicate rewards';
  end if;
end
$distinct_attempt_concurrency$;

select public.fixture_assert(
  (
    select count(*) = 1 and sum(reward_amount) = 3
    from public.learning_stage_first_passes
    where assignment_id = :'distinct_attempt_assignment_id'
  ) and (
    select count(*) = 1 and sum(amount) = 3
    from public.sticker_transactions transaction_row
    where transaction_row.source_type = 'learning_stage_first_pass'
      and transaction_row.source_id in (
        select id::text
        from public.learning_stage_first_passes
        where assignment_id = :'distinct_attempt_assignment_id'
      )
  ),
  'concurrent distinct-attempt finalize created duplicate rewards'
);

select public.fixture_expect_error(
  'first pass update',
  format(
    'update public.learning_stage_first_passes set reward_amount = reward_amount where assignment_id = %L',
    :'reward_assignment_id'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'first pass delete',
  format(
    'delete from public.learning_stage_first_passes where assignment_id = %L',
    :'reward_assignment_id'
  ),
  array['55000']
);

do $browser_permissions$
declare
  role_name text;
  statement text;
  actual_state text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    foreach statement in array array[
      'select * from public.learning_stage_first_passes limit 1',
      'insert into public.learning_stage_first_passes default values',
      'update public.learning_stage_first_passes set reward_amount = reward_amount where false',
      'delete from public.learning_stage_first_passes where false',
      format(
        'select * from public.finalize_learning_stage_attempt(%L, %L, %L)',
        '20000000-0000-4000-8000-000000000002',
        (
          select id
          from public.learning_attempts
          where start_request_id =
            'c5000000-0000-4000-8000-000000000001'
        ),
        gen_random_uuid()
      )
    ]
    loop
      actual_state := null;
      begin
        execute format('set local role %I', role_name);
        execute statement;
      exception
        when others then
          actual_state := sqlstate;
      end;
      execute 'reset role';

      if actual_state is distinct from '42501' then
        raise exception using
          errcode = 'P0001',
          message = format(
            '%s browser permission probe returned %s instead of 42501',
            role_name,
            coalesce(actual_state, 'success')
          );
      end if;
    end loop;
  end loop;
end
$browser_permissions$;

do $service_role_permissions$
declare
  actual_state text;
  finalize_result record;
  target_attempt_id uuid;
begin
  select id
  into target_attempt_id
  from public.learning_attempts
  where start_request_id = 'c5000000-0000-4000-8000-000000000001';

  execute 'set local role service_role';
  perform count(*) from public.learning_stage_first_passes;

  actual_state := null;
  begin
    update public.learning_stage_first_passes
    set reward_amount = reward_amount
    where false;
  exception
    when others then
      actual_state := sqlstate;
  end;
  if actual_state is distinct from '42501' then
    raise exception using
      errcode = 'P0001',
      message = 'service_role direct mutation was not blocked';
  end if;

  select *
  into finalize_result
  from public.finalize_learning_stage_attempt(
    '20000000-0000-4000-8000-000000000002',
    target_attempt_id,
    gen_random_uuid()
  );

  actual_state := null;
  begin
    perform public.guard_learning_stage_first_pass_immutable();
  exception
    when others then
      actual_state := sqlstate;
  end;
  execute 'reset role';

  if actual_state is distinct from '42501' then
    raise exception using
      errcode = 'P0001',
      message = 'service_role internal first-pass helper was executable';
  end if;
  if not finalize_result.first_pass
     or not finalize_result.reward_granted then
    raise exception using
      errcode = 'P0001',
      message = 'service_role approved finalize did not return stable ownership';
  end if;
end
$service_role_permissions$;

select public.fixture_assert(
  not exists (
    select 1
    from pg_catalog.pg_publication_tables publication
    where publication.schemaname = 'public'
      and publication.tablename = 'learning_stage_first_passes'
  ),
  'first-pass table unexpectedly joined a Realtime publication'
);

select 'phase2b_progress_rewards_fixture_passed' as result;
