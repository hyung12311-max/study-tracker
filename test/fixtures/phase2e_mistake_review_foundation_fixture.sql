\set ON_ERROR_STOP on

-- Disposable Phase E-1 fixture. No production project or user data is used.
\ir phase2b_attempt_engine_fixture.sql
\ir ../../supabase/migrations/202607310001_create_phase_2b_progress_rewards.sql
\ir ../../supabase/migrations/202607310006_learning_assignment_planning_foundation.sql
\ir ../../supabase/migrations/202607310008_learning_skill_metadata_foundation.sql
\ir ../../supabase/migrations/202608080001_learning_mistake_reveal_audit.sql
\ir ../../supabase/migrations/202608080002_learning_mistake_review_foundation.sql

create temporary table phase2e_official_before as
select
  (select count(*) from public.learning_attempts)::bigint as attempts,
  (select count(*) from public.learning_attempt_answers)::bigint as answers,
  (select count(*) from public.learning_stage_progress)::bigint as progress,
  (select count(*) from public.learning_stage_first_passes)::bigint as first_passes,
  (select count(*) from public.sticker_transactions)::bigint as rewards;

set role service_role;
select review_session_id as parent_review_id, item_count as parent_review_items
from public.start_learning_mistake_review(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  :'hagyeom_assignment_id',
  'all', null, null,
  'e1000000-0000-4000-8000-000000000001'
)
\gset
reset role;

select public.fixture_assert(
  :'parent_review_items'::integer > 0
  and (select count(*) = :'parent_review_items'::integer
       from public.learning_mistake_review_items where session_id = :'parent_review_id'),
  'parent review start did not create the expected item'
);

set role service_role;
select public.fixture_assert(
  (select review_session_id = :'parent_review_id'::uuid
       and item_count = :'parent_review_items'::integer
   from public.start_learning_mistake_review(
     '10000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000002',
     :'hagyeom_assignment_id',
     'all', null, null,
     'e1000000-0000-4000-8000-000000000001'
   )),
  'parent review request idempotency failed'
);

select public.fixture_assert(
  (select review_session_id = :'parent_review_id'::uuid
   from public.start_learning_mistake_review(
     '10000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000002',
     '20000000-0000-4000-8000-000000000002',
     :'hagyeom_assignment_id',
     'all', null, null,
     'e2000000-0000-4000-8000-000000000001'
   )),
  'child self review start failed'
);
reset role;

select public.fixture_expect_error(
  'other child review start',
  format(
    'select * from public.start_learning_mistake_review(%L,%L,%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    :'hagyeom_assignment_id',
    'all', null, null,
    'e3000000-0000-4000-8000-000000000001'
  ),
  array['42501']
);

select public.fixture_expect_error(
  'reviewable mistakes were not found',
  format(
    'select * from public.start_learning_mistake_review(%L,%L,%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    :'dayul_assignment_id',
    'all', null, null,
    'e4000000-0000-4000-8000-000000000001'
  ),
  array['P0002']
);

set role service_role;
select plan_id as paused_plan_id, plan_revision as paused_plan_revision
from public.create_learning_assignment_plan(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  :'other_family_assignment_id',
  '2026-08-08', '2026-08-15', 'Asia/Seoul',
  '[
    {"stage_id":"a4000000-0000-4000-8000-000000000001","display_order":1,"target_date":"2026-08-10"},
    {"stage_id":"a4000000-0000-4000-8000-000000000002","display_order":2,"target_date":"2026-08-15"}
  ]'::jsonb,
  'e5000000-0000-4000-8000-000000000001'
)
\gset

select plan_revision as paused_plan_revision_after
from public.pause_learning_assignment_plan(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  :'paused_plan_id', :'paused_plan_revision'::integer,
  'e5000000-0000-4000-8000-000000000002'
)
\gset
reset role;

select public.fixture_expect_error(
  'LEARNING_PLAN_PAUSED',
  format(
    'select * from public.start_learning_mistake_review(%L,%L,%L,%L,%L,%L,%L,%L)',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000006',
    :'other_family_assignment_id',
    'all', null, null,
    'e5000000-0000-4000-8000-000000000003'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'review session immutable scope',
  format(
    'update public.learning_mistake_review_sessions set assignment_id=%L where id=%L',
    :'dayul_assignment_id', :'parent_review_id'
  ),
  array['55000']
);

select public.fixture_expect_error(
  'review item immutable row',
  format(
    'update public.learning_mistake_review_items set display_order=display_order where session_id=%L',
    :'parent_review_id'
  ),
  array['55000']
);

select public.fixture_assert(
  not has_table_privilege('anon','public.learning_mistake_review_sessions','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.learning_mistake_review_items','SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role','public.learning_mistake_review_sessions','SELECT')
  and not has_table_privilege('service_role','public.learning_mistake_review_sessions','INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role','public.learning_mistake_review_items','SELECT')
  and not has_table_privilege('service_role','public.learning_mistake_review_items','INSERT,UPDATE,DELETE'),
  'review table ACL failed'
);

select public.fixture_assert(
  before.attempts = (select count(*) from public.learning_attempts)
  and before.answers = (select count(*) from public.learning_attempt_answers)
  and before.progress = (select count(*) from public.learning_stage_progress)
  and before.first_passes = (select count(*) from public.learning_stage_first_passes)
  and before.rewards = (select count(*) from public.sticker_transactions),
  'official progress or rewards changed'
)
from phase2e_official_before before;

select public.fixture_expect_error(
  'rollback guard with persisted review data',
  $$
    do $guard$
    begin
      if exists (select 1 from public.learning_mistake_review_sessions) then
        raise exception using errcode = '55000', message = 'learning mistake review data is in use';
      end if;
    end
    $guard$
  $$,
  array['55000']
);

\ir ../../supabase/verification/202608080002_learning_mistake_review_foundation_verify.sql

select 'phase2e mistake review foundation fixture passed' as result;
