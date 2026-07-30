\set ON_ERROR_STOP on

-- Disposable PostgreSQL fixture only. No production identifiers or content.
\ir phase2b_learning_foundation_fixture.sql
\ir ../../supabase/migrations/202607300002_create_phase_2b_attempt_engine.sql

insert into public.learning_courses (
  id,
  course_code,
  internal_name,
  subject_name
)
values (
  'a1000000-0000-4000-8000-000000000001',
  'attempt-fixture-course',
  'Attempt Fixture Course',
  'Attempt Fixture Subject'
);

insert into public.learning_units (
  id,
  course_id,
  unit_code,
  display_title,
  sort_order
)
values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'attempt-fixture-unit',
  'Attempt Fixture Unit',
  1
);

insert into public.learning_content_versions (
  id,
  unit_id,
  version_no,
  content_hash
)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  1,
  repeat('a', 64)
);

insert into public.learning_stages (
  id,
  content_version_id,
  display_order,
  display_title,
  difficulty
)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    1,
    'Attempt Stage One',
    'seed'
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000001',
    2,
    'Attempt Stage Two',
    'leaf'
  );

insert into public.learning_questions (
  id,
  stage_id,
  display_order,
  prompt,
  explanation
)
select
  (
    'a5'
    || lpad(stage_no::text, 2, '0')
    || lpad(question_no::text, 2, '0')
    || '00-0000-4000-8000-000000000001'
  )::uuid,
  case stage_no
    when 1 then 'a4000000-0000-4000-8000-000000000001'::uuid
    else 'a4000000-0000-4000-8000-000000000002'::uuid
  end,
  question_no,
  format('Stage %s question %s', stage_no, question_no),
  format('Stage %s explanation %s', stage_no, question_no)
from generate_series(1, 2) stage_no
cross join generate_series(1, 5) question_no;

insert into public.learning_question_options (
  id,
  question_id,
  display_order,
  option_text,
  is_correct
)
select
  (
    'a6'
    || lpad(stage_no::text, 2, '0')
    || lpad(question_no::text, 2, '0')
    || lpad(option_no::text, 2, '0')
    || '-0000-4000-8000-000000000001'
  )::uuid,
  (
    'a5'
    || lpad(stage_no::text, 2, '0')
    || lpad(question_no::text, 2, '0')
    || '00-0000-4000-8000-000000000001'
  )::uuid,
  option_no,
  format('Stage %s question %s option %s', stage_no, question_no, option_no),
  option_no = 1
from generate_series(1, 2) stage_no
cross join generate_series(1, 5) question_no
cross join generate_series(1, 2) option_no;

select public.publish_learning_content_version(
  'a3000000-0000-4000-8000-000000000001'
);

select assignment_id as hagyeom_assignment_id
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000001'
)
\gset

select assignment_id as dayul_assignment_id
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000001'
)
\gset

select assignment_id as other_family_assignment_id
from public.create_learning_assignment(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  'a3000000-0000-4000-8000-000000000001'
)
\gset

select public.retire_learning_content_version(
  'a3000000-0000-4000-8000-000000000001'
);

select public.fixture_expect_error(
  'locked stage start',
  format(
    $sql$
      select *
      from public.start_or_resume_learning_attempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002',
        %L,
        'a4000000-0000-4000-8000-000000000002',
        'b0000000-0000-4000-8000-000000000001'
      )
    $sql$,
    :'hagyeom_assignment_id'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'other child start',
  format(
    $sql$
      select *
      from public.start_or_resume_learning_attempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000002',
        %L,
        'a4000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000002'
      )
    $sql$,
    :'hagyeom_assignment_id'
  ),
  array['42501']
);

select public.fixture_expect_error(
  'inactive child start',
  format(
    $sql$
      select *
      from public.start_or_resume_learning_attempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000004',
        '20000000-0000-4000-8000-000000000002',
        %L,
        'a4000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000003'
      )
    $sql$,
    :'hagyeom_assignment_id'
  ),
  array['42501']
);

select attempt_id as passed_attempt_id
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  'a4000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001'
)
\gset

select public.fixture_assert(
  (
    select count(*) = 5
       and min(display_order) = 1
       and max(display_order) = 5
       and bool_and(
         jsonb_array_length(options_snapshot) = 2
         and not (options_snapshot @? '$[*].isCorrect')
       )
    from public.learning_attempt_questions
    where attempt_id = :'passed_attempt_id'
  ),
  'attempt snapshot did not preserve five ordered public options'
);

select public.fixture_assert(
  (
    select resumed
       and attempt_id = :'passed_attempt_id'
       and total_questions = 5
       and required_correct_answers = 4
    from public.start_or_resume_learning_attempt(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      :'hagyeom_assignment_id',
      'a4000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002'
    )
  ),
  'in-progress attempt did not resume for the active parent'
);

select public.fixture_expect_error(
  'incomplete finalize',
  format(
    $sql$
      select *
      from public.finalize_learning_stage_attempt(
        '20000000-0000-4000-8000-000000000002',
        %L,
        'b2000000-0000-4000-8000-000000000001'
      )
    $sql$,
    :'passed_attempt_id'
  ),
  array['55000']
);

select id as first_question_id, correct_option_id as first_correct_option_id
from public.learning_attempt_questions
where attempt_id = :'passed_attempt_id'
  and display_order = 1
\gset

select id as second_question_id
from public.learning_attempt_questions
where attempt_id = :'passed_attempt_id'
  and display_order = 2
\gset

select public.fixture_expect_error(
  'skipped question',
  format(
    $sql$
      select *
      from public.submit_learning_attempt_answer(
        '20000000-0000-4000-8000-000000000002',
        %L,
        %L,
        (
          select correct_option_id
          from public.learning_attempt_questions
          where id = %L
        ),
        'b3000000-0000-4000-8000-000000000001'
      )
    $sql$,
    :'passed_attempt_id',
    :'second_question_id',
    :'second_question_id'
  ),
  array['55000']
);

select answer_id as first_answer_id
from public.submit_learning_attempt_answer(
  '20000000-0000-4000-8000-000000000002',
  :'passed_attempt_id',
  :'first_question_id',
  :'first_correct_option_id',
  'b3000000-0000-4000-8000-000000000002'
)
\gset

select public.fixture_assert(
  (
    select answer_id = :'first_answer_id'
       and is_correct
       and correct_option_text is not null
       and explanation is not null
       and answered_count = 1
       and not is_complete
    from public.submit_learning_attempt_answer(
      '20000000-0000-4000-8000-000000000002',
      :'passed_attempt_id',
      :'first_question_id',
      :'first_correct_option_id',
      'b3000000-0000-4000-8000-000000000002'
    )
  ),
  'same answer request was not idempotent'
);

select public.fixture_expect_error(
  'answer change',
  format(
    $sql$
      select *
      from public.submit_learning_attempt_answer(
        '20000000-0000-4000-8000-000000000002',
        %L,
        %L,
        (
          select (item->>'id')::uuid
          from public.learning_attempt_questions question,
               jsonb_array_elements(question.options_snapshot) item
          where question.id = %L
            and (item->>'id')::uuid <> question.correct_option_id
          limit 1
        ),
        'b3000000-0000-4000-8000-000000000003'
      )
    $sql$,
    :'passed_attempt_id',
    :'first_question_id',
    :'first_question_id'
  ),
  array['23505']
);

do $pass_attempt$
declare
  target_attempt_id uuid;
  question_row record;
  chosen_option uuid;
  request_id uuid;
begin
  select id
  into target_attempt_id
  from public.learning_attempts
  where start_request_id = 'b1000000-0000-4000-8000-000000000001';

  for question_row in
    select *
    from public.learning_attempt_questions
    where attempt_id = target_attempt_id
      and display_order between 2 and 5
    order by display_order
  loop
    if question_row.display_order < 5 then
      chosen_option := question_row.correct_option_id;
    else
      select (item->>'id')::uuid
      into chosen_option
      from jsonb_array_elements(question_row.options_snapshot) item
      where (item->>'id')::uuid <> question_row.correct_option_id
      limit 1;
    end if;

    request_id := (
      'b31'
      || lpad(question_row.display_order::text, 2, '0')
      || '000-0000-4000-8000-000000000001'
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
$pass_attempt$;

select public.fixture_assert(
  (
    select status = 'passed'
       and total_questions = 5
       and correct_answers = 4
       and required_correct_answers = 4
       and finalized_at is not null
    from public.learning_attempts
    where id = :'passed_attempt_id'
  ),
  '4 of 5 answers did not auto-finalize as passed'
);

select public.fixture_assert(
  (
    select attempt_status = 'passed'
       and correct_answers = 4
       and required_correct_answers = 4
       and passed
    from public.finalize_learning_stage_attempt(
      '20000000-0000-4000-8000-000000000002',
      :'passed_attempt_id',
      'b4000000-0000-4000-8000-000000000001'
    )
  ),
  'explicit finalize was not idempotent'
);

select attempt_id as failed_attempt_id
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  'a4000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001'
)
\gset

do $fail_attempt$
declare
  target_attempt_id uuid;
  question_row record;
  chosen_option uuid;
  request_id uuid;
begin
  select id
  into target_attempt_id
  from public.learning_attempts
  where start_request_id = 'b5000000-0000-4000-8000-000000000001';

  for question_row in
    select *
    from public.learning_attempt_questions
    where attempt_id = target_attempt_id
    order by display_order
  loop
    if question_row.display_order <= 3 then
      chosen_option := question_row.correct_option_id;
    else
      select (item->>'id')::uuid
      into chosen_option
      from jsonb_array_elements(question_row.options_snapshot) item
      where (item->>'id')::uuid <> question_row.correct_option_id
      limit 1;
    end if;

    request_id := (
      'b51'
      || lpad(question_row.display_order::text, 2, '0')
      || '000-0000-4000-8000-000000000001'
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
$fail_attempt$;

select public.fixture_assert(
  (
    select status = 'failed'
       and correct_answers = 3
       and required_correct_answers = 4
    from public.learning_attempts
    where id = :'failed_attempt_id'
  ),
  '3 of 5 answers did not auto-finalize as failed'
);

select attempt_id as retry_attempt_id
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  'a4000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001'
)
\gset

select public.fixture_assert(
  :'retry_attempt_id'::uuid <> :'failed_attempt_id'::uuid
  and (
    select attempt_no = 3
    from public.learning_attempts
    where id = :'retry_attempt_id'
  ),
  'failed attempt retry did not create an isolated third attempt'
);

select attempt_id as dayul_attempt_id
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  :'dayul_assignment_id',
  'a4000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000001'
)
\gset

select id as dayul_question_id, correct_option_id as dayul_option_id
from public.learning_attempt_questions
where attempt_id = :'dayul_attempt_id'
  and display_order = 1
\gset

select *
from public.submit_learning_attempt_answer(
  '20000000-0000-4000-8000-000000000003',
  :'dayul_attempt_id',
  :'dayul_question_id',
  :'dayul_option_id',
  'b7000000-0000-4000-8000-000000000002'
);

select public.abandon_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  :'dayul_assignment_id',
  :'dayul_attempt_id'
);

select public.fixture_assert(
  (
    select status = 'abandoned'
       and abandoned_at is not null
       and abandoned_by_member_id =
         '20000000-0000-4000-8000-000000000001'
    from public.learning_attempts
    where id = :'dayul_attempt_id'
  )
  and (
    select count(*) = 5
    from public.learning_attempt_questions
    where attempt_id = :'dayul_attempt_id'
  )
  and (
    select count(*) = 1
    from public.learning_attempt_answers
    where attempt_id = :'dayul_attempt_id'
  ),
  'parent abandon did not preserve snapshot and answer audit rows'
);

select public.fixture_expect_error(
  'child abandon',
  format(
    $sql$
      select public.abandon_learning_attempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000003',
        %L,
        %L
      )
    $sql$,
    :'dayul_assignment_id',
    :'dayul_attempt_id'
  ),
  array['42501']
);

select attempt_id as dayul_retry_attempt_id
from public.start_or_resume_learning_attempt(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000003',
  :'dayul_assignment_id',
  'a4000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000003'
)
\gset

select public.cancel_learning_assignment(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  :'dayul_assignment_id'
);

select public.fixture_assert(
  (
    select status = 'abandoned'
    from public.learning_attempts
    where id = :'dayul_retry_attempt_id'
  )
  and (
    select status = 'cancelled'
    from public.learning_assignments
    where id = :'dayul_assignment_id'
  ),
  'assignment cancellation did not abandon its active attempt atomically'
);

create function public.fixture_hold_attempt_start()
returns uuid
language plpgsql
as $function$
declare
  created_id uuid;
  target_assignment_id uuid;
begin
  select id
  into target_assignment_id
  from public.learning_assignments
  where family_id = '10000000-0000-4000-8000-000000000002'
    and assigned_member_id = '20000000-0000-4000-8000-000000000006'
    and unit_id = 'a2000000-0000-4000-8000-000000000001';

  select attempt.attempt_id
  into created_id
  from public.start_or_resume_learning_attempt(
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000006',
    target_assignment_id,
    'a4000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000001'
  ) attempt;
  perform pg_sleep(2);
  return created_id;
end
$function$;

do $start_concurrency$
declare
  target_assignment_id uuid;
  local_attempt uuid;
  remote_attempt uuid;
begin
  select id
  into target_assignment_id
  from public.learning_assignments
  where family_id = '10000000-0000-4000-8000-000000000002'
    and assigned_member_id = '20000000-0000-4000-8000-000000000006'
    and unit_id = 'a2000000-0000-4000-8000-000000000001';

  perform dblink_connect(
    'phase2b_attempt_start',
    'dbname=' || current_database() || ' user=postgres'
  );
  perform dblink_send_query(
    'phase2b_attempt_start',
    'select public.fixture_hold_attempt_start()'
  );
  perform pg_sleep(0.3);

  select attempt.attempt_id
  into local_attempt
  from public.start_or_resume_learning_attempt(
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000006',
    target_assignment_id,
    'a4000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000002'
  ) attempt;

  select result.attempt_id
  into remote_attempt
  from dblink_get_result('phase2b_attempt_start')
    as result(attempt_id uuid);
  perform dblink_disconnect('phase2b_attempt_start');

  if local_attempt is distinct from remote_attempt then
    raise exception using
      errcode = 'P0001',
      message = 'concurrent start returned different attempts';
  end if;
end
$start_concurrency$;

select public.fixture_assert(
  (
    select count(*) = 1
    from public.learning_attempts
    where assignment_id = :'other_family_assignment_id'
      and stage_id = 'a4000000-0000-4000-8000-000000000001'
      and status = 'in_progress'
  ),
  'concurrent start created more than one active attempt'
);

select public.fixture_expect_error(
  'terminal attempt abandon',
  format(
    $sql$
      select public.abandon_learning_attempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        %L,
        %L
      )
    $sql$,
    :'hagyeom_assignment_id',
    :'passed_attempt_id'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'cross-attempt question answer',
  format(
    $sql$
      select *
      from public.submit_learning_attempt_answer(
        '20000000-0000-4000-8000-000000000002',
        %L,
        %L,
        %L,
        'b9000000-0000-4000-8000-000000000001'
      )
    $sql$,
    :'retry_attempt_id',
    :'first_question_id',
    :'first_correct_option_id'
  ),
  array['P0002']
);

select public.fixture_expect_error(
  'snapshot update',
  format(
    'update public.learning_attempt_questions set prompt_snapshot = %L where id = %L',
    'Changed snapshot',
    :'first_question_id'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'answer delete',
  format(
    'delete from public.learning_attempt_answers where id = %L',
    :'first_answer_id'
  ),
  array['55000']
);

create function public.fixture_hold_retry_answer()
returns uuid
language plpgsql
as $function$
declare
  target_attempt_id uuid;
  target_question_id uuid;
  target_option_id uuid;
  stored_answer_id uuid;
begin
  select id
  into target_attempt_id
  from public.learning_attempts
  where start_request_id = 'b6000000-0000-4000-8000-000000000001';

  select id, correct_option_id
  into target_question_id, target_option_id
  from public.learning_attempt_questions
  where attempt_id = target_attempt_id
    and display_order = 1;

  select answer.answer_id
  into stored_answer_id
  from public.submit_learning_attempt_answer(
    '20000000-0000-4000-8000-000000000002',
    target_attempt_id,
    target_question_id,
    target_option_id,
    'b9100000-0000-4000-8000-000000000001'
  ) answer;
  perform pg_sleep(2);
  return stored_answer_id;
end
$function$;

do $answer_double_click$
declare
  target_attempt_id uuid;
  target_question_id uuid;
  target_option_id uuid;
  local_answer_id uuid;
  remote_answer_id uuid;
begin
  select id
  into target_attempt_id
  from public.learning_attempts
  where start_request_id = 'b6000000-0000-4000-8000-000000000001';

  select id, correct_option_id
  into target_question_id, target_option_id
  from public.learning_attempt_questions
  where attempt_id = target_attempt_id
    and display_order = 1;

  perform dblink_connect(
    'phase2b_answer_double_click',
    'dbname=' || current_database() || ' user=postgres'
  );
  perform dblink_send_query(
    'phase2b_answer_double_click',
    'select public.fixture_hold_retry_answer()'
  );
  perform pg_sleep(0.3);

  select answer.answer_id
  into local_answer_id
  from public.submit_learning_attempt_answer(
    '20000000-0000-4000-8000-000000000002',
    target_attempt_id,
    target_question_id,
    target_option_id,
    'b9100000-0000-4000-8000-000000000002'
  ) answer;

  select result.answer_id
  into remote_answer_id
  from dblink_get_result('phase2b_answer_double_click')
    as result(answer_id uuid);
  perform dblink_disconnect('phase2b_answer_double_click');

  if local_answer_id is distinct from remote_answer_id then
    raise exception using
      errcode = 'P0001',
      message = 'concurrent identical answer returned different rows';
  end if;
end
$answer_double_click$;

select public.fixture_assert(
  (
    select count(*) = 1
    from public.learning_attempt_answers
    where attempt_id = :'retry_attempt_id'
  ),
  'concurrent identical answer created duplicate rows'
);

create function public.fixture_hold_other_family_answer()
returns uuid
language plpgsql
as $function$
declare
  target_attempt_id uuid;
  target_question_id uuid;
  target_option_id uuid;
  stored_answer_id uuid;
begin
  select attempt.id
  into target_attempt_id
  from public.learning_attempts attempt
  join public.learning_assignments assignment
    on assignment.id = attempt.assignment_id
  where assignment.family_id =
      '10000000-0000-4000-8000-000000000002'
    and assignment.assigned_member_id =
      '20000000-0000-4000-8000-000000000006'
    and attempt.status = 'in_progress';

  select id, correct_option_id
  into target_question_id, target_option_id
  from public.learning_attempt_questions
  where attempt_id = target_attempt_id
    and display_order = 1;

  select answer.answer_id
  into stored_answer_id
  from public.submit_learning_attempt_answer(
    '20000000-0000-4000-8000-000000000006',
    target_attempt_id,
    target_question_id,
    target_option_id,
    'b9200000-0000-4000-8000-000000000001'
  ) answer;
  perform pg_sleep(2);
  return stored_answer_id;
end
$function$;

do $answer_abandon_race$
declare
  target_assignment_id uuid;
  target_attempt_id uuid;
  remote_answer_id uuid;
  reset_result public.learning_attempts%rowtype;
begin
  select assignment.id, attempt.id
  into target_assignment_id, target_attempt_id
  from public.learning_assignments assignment
  join public.learning_attempts attempt
    on attempt.assignment_id = assignment.id
  where assignment.family_id =
      '10000000-0000-4000-8000-000000000002'
    and assignment.assigned_member_id =
      '20000000-0000-4000-8000-000000000006'
    and attempt.status = 'in_progress';

  perform dblink_connect(
    'phase2b_answer_abandon',
    'dbname=' || current_database() || ' user=postgres'
  );
  perform dblink_send_query(
    'phase2b_answer_abandon',
    'select public.fixture_hold_other_family_answer()'
  );
  perform pg_sleep(0.3);

  select *
  into reset_result
  from public.abandon_learning_attempt(
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000006',
    target_assignment_id,
    target_attempt_id
  );

  select result.answer_id
  into remote_answer_id
  from dblink_get_result('phase2b_answer_abandon')
    as result(answer_id uuid);
  perform dblink_disconnect('phase2b_answer_abandon');

  if reset_result.status <> 'abandoned'
     or remote_answer_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'answer and parent abandon race was not serialized safely';
  end if;
end
$answer_abandon_race$;

select public.fixture_assert(
  (
    select attempt.status = 'abandoned'
       and (
         select count(*)
         from public.learning_attempt_answers answer
         where answer.attempt_id = attempt.id
       ) = 1
    from public.learning_attempts attempt
    join public.learning_assignments assignment
      on assignment.id = attempt.assignment_id
    where assignment.family_id =
        '10000000-0000-4000-8000-000000000002'
      and assignment.assigned_member_id =
        '20000000-0000-4000-8000-000000000006'
  ),
  'answer and parent abandon race lost its audit answer'
);

do $table_permissions$
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
      'learning_attempts',
      'learning_attempt_questions',
      'learning_attempt_answers'
    ]
    loop
      foreach action_name in array array['select', 'insert', 'update', 'delete']
      loop
        probe_sql := case action_name
          when 'select' then format(
            'select 1 from public.%I limit 1',
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
$table_permissions$;

do $function_permissions$
declare
  role_name text;
  function_call text;
  actual_state text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    foreach function_call in array array[
      $sql$select * from public.start_or_resume_learning_attempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003'
      )$sql$,
      $sql$select * from public.submit_learning_attempt_answer(
        '20000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000004'
      )$sql$,
      $sql$select * from public.finalize_learning_stage_attempt(
        '20000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002'
      )$sql$,
      $sql$select public.abandon_learning_attempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002'
      )$sql$
    ]
    loop
      actual_state := null;
      execute format('set local role %I', role_name);
      begin
        execute function_call;
      exception
        when others then
          actual_state := sqlstate;
      end;
      execute 'reset role';

      if actual_state is distinct from '42501' then
        raise exception using
          errcode = 'P0001',
          message = format(
            '%s function probe returned %s instead of 42501',
            role_name,
            coalesce(actual_state, 'success')
          );
      end if;
    end loop;
  end loop;
end
$function_permissions$;

do $service_role_permissions$
declare
  table_name text;
  actual_state text;
begin
  foreach table_name in array array[
    'learning_attempts',
    'learning_attempt_questions',
    'learning_attempt_answers'
  ]
  loop
    execute 'set local role service_role';
    execute format('select 1 from public.%I where false', table_name);
    actual_state := null;
    begin
      execute format('delete from public.%I where false', table_name);
    exception
      when others then
        actual_state := sqlstate;
    end;
    execute 'reset role';

    if actual_state is distinct from '42501' then
      raise exception using
        errcode = 'P0001',
        message = format(
          'service_role mutation on %s returned %s instead of 42501',
          table_name,
          coalesce(actual_state, 'success')
        );
    end if;
  end loop;
end
$service_role_permissions$;

do $service_role_function_permissions$
declare
  actual_state text;
  target_assignment_id uuid;
begin
  select id
  into target_assignment_id
  from public.learning_assignments
  where family_id = '10000000-0000-4000-8000-000000000001'
    and assigned_member_id = '20000000-0000-4000-8000-000000000002'
    and unit_id = 'a2000000-0000-4000-8000-000000000001';

  execute 'set local role service_role';
  perform *
  from public.start_or_resume_learning_attempt(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    target_assignment_id,
    'a4000000-0000-4000-8000-000000000001',
    'b9300000-0000-4000-8000-000000000001'
  );

  actual_state := null;
  begin
    perform public.guard_learning_attempt_change();
  exception
    when others then
      actual_state := sqlstate;
  end;
  execute 'reset role';

  if actual_state is distinct from '42501' then
    raise exception using
      errcode = 'P0001',
      message = format(
        'service_role internal helper returned %s instead of 42501',
        coalesce(actual_state, 'success')
      );
  end if;
end
$service_role_function_permissions$;

select public.fixture_assert(
  not exists (
    select 1
    from pg_catalog.pg_publication_tables publication
    where publication.schemaname = 'public'
      and publication.tablename in (
        'learning_attempts',
        'learning_attempt_questions',
        'learning_attempt_answers'
      )
  ),
  'attempt tables unexpectedly joined a Realtime publication'
);

select 'phase2b_attempt_engine_fixture_passed' as result;
