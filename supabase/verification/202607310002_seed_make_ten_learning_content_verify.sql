-- Phase 2B pilot content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"52000000-0000-4000-8000-000000000001","questions":[{"displayOrder":1,"explanation":"7에 3을 더하면 10이 됩니다.","id":"53000000-0000-4000-8000-000000000001","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000001","isCorrect":false,"text":"1"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000002","isCorrect":false,"text":"2"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000003","isCorrect":true,"text":"3"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000004","isCorrect":false,"text":"4"}],"prompt":"7에 얼마를 더하면 10이 될까요?","weight":1},{"displayOrder":2,"explanation":"4에 6을 더하면 10이 됩니다.","id":"53000000-0000-4000-8000-000000000002","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000005","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000006","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000007","isCorrect":true,"text":"6"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000008","isCorrect":false,"text":"7"}],"prompt":"4에 얼마를 더하면 10이 될까요?","weight":1},{"displayOrder":3,"explanation":"2에 8을 더하면 10이 됩니다.","id":"53000000-0000-4000-8000-000000000003","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000009","isCorrect":false,"text":"1"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000010","isCorrect":true,"text":"2"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000011","isCorrect":false,"text":"3"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000012","isCorrect":false,"text":"4"}],"prompt":"얼마에 8을 더하면 10이 될까요?","weight":1},{"displayOrder":4,"explanation":"5와 5를 더하면 10이 됩니다.","id":"53000000-0000-4000-8000-000000000004","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000013","isCorrect":false,"text":"3"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000014","isCorrect":false,"text":"4"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000015","isCorrect":true,"text":"5"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000016","isCorrect":false,"text":"6"}],"prompt":"5에 얼마를 더하면 10이 될까요?","weight":1},{"displayOrder":5,"explanation":"9에 1을 더하면 10이 됩니다.","id":"53000000-0000-4000-8000-000000000005","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000017","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000018","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000019","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000020","isCorrect":false,"text":"10"}],"prompt":"얼마에 1을 더하면 10이 될까요?","weight":1}],"title":"짝을 찾아요"},{"difficulty":"leaf","displayOrder":2,"id":"52000000-0000-4000-8000-000000000002","questions":[{"displayOrder":1,"explanation":"3에서 네 칸 더 가면 7입니다.","id":"53000000-0000-4000-8000-000000000006","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000021","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000022","isCorrect":true,"text":"7"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000023","isCorrect":false,"text":"8"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000024","isCorrect":false,"text":"9"}],"prompt":"3 + 4는 얼마일까요?","weight":1},{"displayOrder":2,"explanation":"2와 5를 더하면 7입니다.","id":"53000000-0000-4000-8000-000000000007","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000025","isCorrect":false,"text":"5"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000026","isCorrect":false,"text":"6"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000027","isCorrect":true,"text":"7"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000028","isCorrect":false,"text":"8"}],"prompt":"2 + 5는 얼마일까요?","weight":1},{"displayOrder":3,"explanation":"6에 3을 더하면 9입니다.","id":"53000000-0000-4000-8000-000000000008","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000029","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000030","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000031","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000032","isCorrect":false,"text":"10"}],"prompt":"6 + 3은 얼마일까요?","weight":1},{"displayOrder":4,"explanation":"1과 8을 더하면 9입니다.","id":"53000000-0000-4000-8000-000000000009","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000033","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000034","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000035","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000036","isCorrect":false,"text":"10"}],"prompt":"1 + 8은 얼마일까요?","weight":1},{"displayOrder":5,"explanation":"4를 두 번 더하면 8입니다.","id":"53000000-0000-4000-8000-000000000010","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000037","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000038","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000039","isCorrect":true,"text":"8"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000040","isCorrect":false,"text":"9"}],"prompt":"4 + 4는 얼마일까요?","weight":1}],"title":"더해 보아요"},{"difficulty":"tree","displayOrder":3,"id":"52000000-0000-4000-8000-000000000003","questions":[{"displayOrder":1,"explanation":"3에 5를 더하면 8이므로 빈칸은 5입니다.","id":"53000000-0000-4000-8000-000000000011","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000041","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000042","isCorrect":true,"text":"5"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000043","isCorrect":false,"text":"6"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000044","isCorrect":false,"text":"7"}],"prompt":"3 + □ = 8입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":2,"explanation":"6에 4를 더하면 10이므로 빈칸은 6입니다.","id":"53000000-0000-4000-8000-000000000012","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000045","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000046","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000047","isCorrect":true,"text":"6"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000048","isCorrect":false,"text":"7"}],"prompt":"□ + 4 = 10입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":3,"explanation":"9에서 4를 빼면 5이므로 빈칸은 4입니다.","id":"53000000-0000-4000-8000-000000000013","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000049","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000050","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000051","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000052","isCorrect":false,"text":"5"}],"prompt":"9 - □ = 5입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":4,"explanation":"5에 2를 더하면 7이므로 빈칸은 5입니다.","id":"53000000-0000-4000-8000-000000000014","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000053","isCorrect":false,"text":"3"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000054","isCorrect":false,"text":"4"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000055","isCorrect":true,"text":"5"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000056","isCorrect":false,"text":"6"}],"prompt":"□ + 2 = 7입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":5,"explanation":"10에서 7을 빼면 3이므로 빈칸은 7입니다.","id":"53000000-0000-4000-8000-000000000015","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000057","isCorrect":false,"text":"5"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000058","isCorrect":false,"text":"6"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000059","isCorrect":true,"text":"7"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000060","isCorrect":false,"text":"8"}],"prompt":"10 - □ = 3입니다. □에 들어갈 수는 무엇일까요?","weight":1}],"title":"빈칸을 채워요"},{"difficulty":"crown","displayOrder":4,"id":"52000000-0000-4000-8000-000000000004","questions":[{"displayOrder":1,"explanation":"3개와 2개를 더하면 모두 5개입니다.","id":"53000000-0000-4000-8000-000000000016","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000061","isCorrect":false,"text":"4개"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000062","isCorrect":true,"text":"5개"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000063","isCorrect":false,"text":"6개"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000064","isCorrect":false,"text":"7개"}],"prompt":"사과가 3개 있었는데 2개를 더 받았어요. 모두 몇 개일까요?","weight":1},{"displayOrder":2,"explanation":"7에 3을 더하면 10이므로 3자루가 더 필요합니다.","id":"53000000-0000-4000-8000-000000000017","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000065","isCorrect":false,"text":"1자루"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000066","isCorrect":false,"text":"2자루"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000067","isCorrect":true,"text":"3자루"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000068","isCorrect":false,"text":"4자루"}],"prompt":"연필이 7자루 있어요. 10자루가 되려면 몇 자루가 더 필요할까요?","weight":1},{"displayOrder":3,"explanation":"6에 4를 더하면 10이므로 빈칸은 4입니다.","id":"53000000-0000-4000-8000-000000000018","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000069","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000070","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000071","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000072","isCorrect":false,"text":"5"}],"prompt":"6 + □ = 10입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":4,"explanation":"9에서 2를 빼면 7이므로 공은 7개 남습니다.","id":"53000000-0000-4000-8000-000000000019","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000073","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000074","isCorrect":false,"text":"6개"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000075","isCorrect":true,"text":"7개"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000076","isCorrect":false,"text":"8개"}],"prompt":"공 9개 중에서 2개를 사용했어요. 남은 공은 몇 개일까요?","weight":1},{"displayOrder":5,"explanation":"2와 3을 더한 5에 4를 더하면 9입니다.","id":"53000000-0000-4000-8000-000000000020","options":[{"displayOrder":1,"id":"54000000-0000-4000-8000-000000000077","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"54000000-0000-4000-8000-000000000078","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"54000000-0000-4000-8000-000000000079","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"54000000-0000-4000-8000-000000000080","isCorrect":false,"text":"10"}],"prompt":"2 + 3 + 4는 얼마일까요?","weight":1}],"title":"이야기로 풀어요"}],"unit":{"displayOrder":1,"id":"51000000-0000-4000-8000-000000000002","slug":"make-ten","title":"10을 만들어요"},"version":{"id":"51000000-0000-4000-8000-000000000003","label":"v1","number":1}}'::jsonb as document
), expected_stages as (
  select
    stage->>'id' as id,
    (stage->>'displayOrder')::integer as display_order,
    stage->>'title' as display_title,
    stage->>'difficulty' as difficulty,
    stage->'questions' as questions
  from expected_content,
       jsonb_array_elements(document->'stages') stage
), expected_questions as (
  select
    question->>'id' as id,
    stage.id as stage_id,
    (question->>'displayOrder')::integer as display_order,
    question->>'prompt' as prompt,
    question->>'explanation' as explanation,
    question->'options' as options
  from expected_stages stage,
       jsonb_array_elements(stage.questions) question
), expected_options as (
  select
    option->>'id' as id,
    question.id as question_id,
    (option->>'displayOrder')::integer as display_order,
    option->>'text' as option_text,
    (option->>'isCorrect')::boolean as is_correct
  from expected_questions question,
       jsonb_array_elements(question.options) option
), actual_stages as (
  select id::text, display_order, display_title, difficulty
  from public.learning_stages
  where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'make_ten_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'make_ten_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = (expected.document->'unit'->>'displayOrder')::integer

  union all
  select 3, 'make_ten_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '0b8af9c77d5dae197fb77619025ba21958de7f768d05e1ec06be986ba1f73bbc'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'make_ten_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'make_ten_questions_exact',
    (select count(*) from actual_questions) = 20
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'make_ten_options_exact',
    (select count(*) from actual_options) = 80
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'make_ten_structure_and_orders',
    count(*) = 20
      and bool_and(option_count = 4 and correct_count = 1
                   and min_option_order = 1 and max_option_order = 4),
    jsonb_build_object('questions', count(*))
  from (
    select question.id,
      count(option.*) as option_count,
      count(*) filter (where option.is_correct) as correct_count,
      min(option.display_order) as min_option_order,
      max(option.display_order) as max_option_order
    from public.learning_questions question
    join public.learning_stages stage on stage.id = question.stage_id
    join public.learning_question_options option on option.question_id = question.id
    where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'make_ten_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 5),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'make_ten_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 0
      and (select count(*) from public.sticker_transactions where source_type = 'learning_stage_first_pass') = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions where source_type = 'learning_stage_first_pass'))

  union all
  select 10, 'learning_content_not_in_realtime_publication', count(*) = 0,
    jsonb_build_object('published_tables', count(*))
  from pg_catalog.pg_publication_tables publication
  where publication.pubname = 'supabase_realtime'
    and publication.schemaname = 'public'
    and publication.tablename in ('learning_courses','learning_units','learning_content_versions','learning_stages','learning_questions','learning_question_options')

  union all
  select 11, 'learning_engine_prerequisites_preserved',
    to_regclass('public.learning_assignments') is not null
      and to_regclass('public.learning_attempts') is not null
      and to_regclass('public.learning_stage_first_passes') is not null
      and to_regprocedure('public.publish_learning_content_version(uuid)') is not null
      and to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null,
    jsonb_build_object('preserved', true)
)
select check_order, check_name, passed, result_data
from checks
union all
select 999, 'make_ten_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
