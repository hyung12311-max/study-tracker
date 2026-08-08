\set ON_ERROR_STOP on

-- Disposable Phase D fixture. Builds on synthetic Phase 2B attempt data only.
\ir phase2b_attempt_engine_fixture.sql
\ir ../../supabase/migrations/202608080001_learning_mistake_reveal_audit.sql

select id as wrong_question_id
from public.learning_attempt_questions
where attempt_id = :'passed_attempt_id'
  and display_order = 5
\gset

select public.fixture_assert(
  (
    select correct_answer = 'Stage 1 question 5 option 1'
       and explanation = 'Stage 1 explanation 5'
       and review_status = 'reviewed'
       and revealed_at is not null
    from public.reveal_learning_mistake_solution(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      :'hagyeom_assignment_id',
      :'wrong_question_id',
      'd1000000-0000-4000-8000-000000000001'
    )
  ),
  'parent reveal did not return the immutable snapshot solution'
);

select * from public.reveal_learning_mistake_solution(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  :'hagyeom_assignment_id',
  :'wrong_question_id',
  'd1000000-0000-4000-8000-000000000001'
);

select * from public.reveal_learning_mistake_solution(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  :'hagyeom_assignment_id',
  :'wrong_question_id',
  'd1000000-0000-4000-8000-000000000002'
);

select public.fixture_assert(
  (select count(*) = 1 from public.learning_mistake_reveal_events
   where actor_member_id = '20000000-0000-4000-8000-000000000001'
     and attempt_question_id = :'wrong_question_id'),
  'duplicate parent reveal created more than one audit event'
);

select * from public.reveal_learning_mistake_solution(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  :'wrong_question_id',
  'd2000000-0000-4000-8000-000000000001'
);

select public.fixture_assert(
  (select count(*) = 2 from public.learning_mistake_reveal_events
   where assignment_id = :'hagyeom_assignment_id'
     and attempt_question_id = :'wrong_question_id'),
  'parent and self-child reveal audit ownership was not preserved'
);

select public.fixture_expect_error(
  'other child reveal',
  format(
    'select * from public.reveal_learning_mistake_solution(%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    :'hagyeom_assignment_id',
    :'wrong_question_id',
    'd3000000-0000-4000-8000-000000000001'
  ),
  array['P0002']
);

select public.fixture_expect_error(
  'correct answer reveal',
  format(
    'select * from public.reveal_learning_mistake_solution(%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    :'hagyeom_assignment_id',
    :'first_question_id',
    'd4000000-0000-4000-8000-000000000001'
  ),
  array['P0002']
);

select public.fixture_expect_error(
  'request id reused for another target',
  format(
    'select * from public.reveal_learning_mistake_solution(%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    :'hagyeom_assignment_id',
    (
      select question.id
      from public.learning_attempt_questions question
      join public.learning_attempt_answers answer
        on answer.attempt_id = question.attempt_id
       and answer.attempt_question_id = question.id
       and answer.is_correct = false
      where question.attempt_id = :'failed_attempt_id'
      order by question.display_order
      limit 1
    ),
    'd1000000-0000-4000-8000-000000000001'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'immutable reveal event update',
  format('update public.learning_mistake_reveal_events set revealed_at = now() where attempt_question_id = %L', :'wrong_question_id'),
  array['55000']
);

select public.fixture_assert(
  not has_table_privilege('anon','public.learning_mistake_reveal_events','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.learning_mistake_reveal_events','SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role','public.learning_mistake_reveal_events','SELECT')
  and not has_table_privilege('service_role','public.learning_mistake_reveal_events','INSERT,UPDATE,DELETE'),
  'reveal audit table ACL failed'
);

select public.fixture_expect_error(
  'rollback guard with persisted audit',
  $$
    do $guard$
    begin
      if exists (select 1 from public.learning_mistake_reveal_events) then
        raise exception using errcode = '55000', message = 'learning mistake reveal audit is in use';
      end if;
    end
    $guard$
  $$,
  array['55000']
);

\ir ../../supabase/verification/202608080001_learning_mistake_reveal_audit_verify.sql

select 'phase2d mistake reveal fixture passed' as result;
