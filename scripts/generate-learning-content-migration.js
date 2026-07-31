const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson, loadAndValidate } = require("./validate-learning-content");

const DEFAULT_INPUT = path.join(__dirname, "..", "content", "learning", "math", "make-ten-v1.json");
const DEFAULT_OUTPUT = path.join(__dirname, "..", "supabase", "migrations", "202607310002_seed_make_ten_learning_content.sql");
const DEFAULT_VERIFICATION = path.join(__dirname, "..", "supabase", "verification", "202607310002_seed_make_ten_learning_content_verify.sql");
const DEFAULT_ROLLBACK = path.join(__dirname, "..", "supabase", "rollbacks", "202607310002_rollback_make_ten_learning_content.sql");

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function rows(values) {
  return values.map((row) => `  (${row.join(", ")})`).join(",\n");
}

function sourceName(content) {
  if (content.unit.slug === "make-ten") return `content/learning/math/make-ten-${content.version.label}.json`;
  return `content/learning/math/${content.unit.slug}-${content.version.label}.json`;
}

function generateMigration(content) {
  const hash = crypto.createHash("sha256").update(canonicalJson(content), "utf8").digest("hex");
  const stages = [...content.stages].sort((a, b) => a.displayOrder - b.displayOrder);
  const questions = stages.flatMap((stage) => [...stage.questions]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((question) => ({ ...question, stageId: stage.id })));
  const options = questions.flatMap((question) => [...question.options]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((option) => ({ ...option, questionId: question.id })));
  const recommendation = content.recommendation;
  const recommendationPreflight = recommendation ? `

  if to_regclass('public.learning_unit_recommendation_metadata') is null then
    raise exception using errcode = 'P0002', message = 'learning recommendation metadata table is missing';
  end if;

  if exists (
    select 1
    from public.learning_unit_recommendation_metadata metadata
    where metadata.unit_id = ${quote(content.unit.id)}::uuid
      and (
        metadata.subject is distinct from ${quote(recommendation.subject)}
        or metadata.recommended_start_level_code is distinct from ${quote(recommendation.recommendedStartLevelCode)}
        or metadata.recommended_end_level_code is distinct from ${quote(recommendation.recommendedEndLevelCode)}
        or metadata.parent_sort_order is distinct from ${recommendation.parentSortOrder}
      )
  ) then
    raise exception using errcode = '23505', message = 'learning unit recommendation metadata conflicts with different content';
  end if;` : "";
  const recommendationInsert = recommendation ? `insert into public.learning_unit_recommendation_metadata (
  unit_id, subject, recommended_start_level_code, recommended_end_level_code, parent_sort_order
)
select ${quote(content.unit.id)}::uuid, ${quote(recommendation.subject)}, ${quote(recommendation.recommendedStartLevelCode)}, ${quote(recommendation.recommendedEndLevelCode)}, ${recommendation.parentSortOrder}
where not exists (
  select 1
  from public.learning_unit_recommendation_metadata metadata
  where metadata.unit_id = ${quote(content.unit.id)}::uuid
);

` : "";

  const legacyMakeTen = content.unit.slug === "make-ten";
  const sharedPreflight = content.version.number === 1 && legacyMakeTen ? `if exists (
    select 1 from public.learning_courses
    where id = ${quote(content.course.id)}::uuid
       or course_code = ${quote(content.course.slug)}
  ) then
    raise exception using errcode = '23505', message = 'make-ten course identifier already exists';
  end if;

  if exists (
    select 1 from public.learning_units
    where id = ${quote(content.unit.id)}::uuid
       or unit_code = ${quote(content.unit.slug)}
  ) then
    raise exception using errcode = '23505', message = 'make-ten unit identifier already exists';
  end if;` : content.version.number === 1 ? `if exists (
    select 1 from public.learning_courses
    where (id = ${quote(content.course.id)}::uuid or course_code = ${quote(content.course.slug)})
      and not (
        id = ${quote(content.course.id)}::uuid
        and course_code = ${quote(content.course.slug)}
        and internal_name = ${quote(content.course.internalName)}
        and subject_name = ${quote(content.course.subject)}
      )
  ) then
    raise exception using errcode = '23505', message = 'learning course identifier conflicts with different content';
  end if;

  if exists (
    select 1 from public.learning_units
    where id = ${quote(content.unit.id)}::uuid
       or unit_code = ${quote(content.unit.slug)}
  ) then
    raise exception using errcode = '23505', message = 'learning unit identifier already exists';
  end if;` : `if not exists (
    select 1
    from public.learning_courses course
    join public.learning_units unit on unit.course_id = course.id
    where course.id = ${quote(content.course.id)}::uuid
      and course.course_code = ${quote(content.course.slug)}
      and course.internal_name = ${quote(content.course.internalName)}
      and course.subject_name = ${quote(content.course.subject)}
      and unit.id = ${quote(content.unit.id)}::uuid
      and unit.unit_code = ${quote(content.unit.slug)}
      and unit.display_title = ${quote(content.unit.title)}
      and unit.sort_order = ${content.unit.displayOrder}
  ) then
    raise exception using errcode = 'P0002', message = 'make-ten shared course or unit is missing or changed';
  end if;`;
  const sharedInserts = content.version.number === 1 && legacyMakeTen ? `insert into public.learning_courses (id, course_code, internal_name, subject_name)
values (${quote(content.course.id)}, ${quote(content.course.slug)}, ${quote(content.course.internalName)}, ${quote(content.course.subject)});

insert into public.learning_units (id, course_id, unit_code, display_title, sort_order)
values (${quote(content.unit.id)}, ${quote(content.course.id)}, ${quote(content.unit.slug)}, ${quote(content.unit.title)}, ${content.unit.displayOrder});
` : content.version.number === 1 ? `insert into public.learning_courses (id, course_code, internal_name, subject_name)
select ${quote(content.course.id)}::uuid, ${quote(content.course.slug)}, ${quote(content.course.internalName)}, ${quote(content.course.subject)}
where not exists (
  select 1 from public.learning_courses where id = ${quote(content.course.id)}::uuid
);

insert into public.learning_units (id, course_id, unit_code, display_title, sort_order)
values (${quote(content.unit.id)}, ${quote(content.course.id)}, ${quote(content.unit.slug)}, ${quote(content.unit.title)}, ${content.unit.displayOrder});
` : "";
  return `-- Generated by scripts/generate-learning-content-migration.js.
-- Source: ${sourceName(content)}
-- Canonical content SHA-256: ${hash}
-- Content-only and additive: no assignment, attempt, progress, first-pass, ledger, ACL, or Realtime changes.

begin;

do $preflight$
begin
  ${sharedPreflight}${recommendationPreflight}

  if exists (
    select 1 from public.learning_content_versions
    where id = ${quote(content.version.id)}::uuid
       or content_hash = ${quote(hash)}
  ) then
    raise exception using errcode = '23505', message = 'make-ten content version already exists';
  end if;

  if exists (
    select 1 from (
      values
${rows([...stages, ...questions, ...options].map((item) => [quote(item.id) + "::uuid"]))}
    ) as expected_id(id)
    where exists (
      select 1 from public.learning_stages where id = expected_id.id
      union all
      select 1 from public.learning_questions where id = expected_id.id
      union all
      select 1 from public.learning_question_options where id = expected_id.id
    )
  ) then
    raise exception using errcode = '23505', message = 'make-ten child content identifier already exists';
  end if;
end
$preflight$;

${sharedInserts}
${recommendationInsert}insert into public.learning_content_versions (id, unit_id, version_no, content_hash)
values (${quote(content.version.id)}, ${quote(content.unit.id)}, ${content.version.number}, ${quote(hash)});

insert into public.learning_stages (id, content_version_id, display_order, display_title, difficulty)
values
${rows(stages.map((stage) => [quote(stage.id), quote(content.version.id), stage.displayOrder, quote(stage.title), quote(stage.difficulty)]))};

insert into public.learning_questions (id, stage_id, display_order, prompt, explanation)
values
${rows(questions.map((question) => [quote(question.id), quote(question.stageId), question.displayOrder, quote(question.prompt), quote(question.explanation)]))};

insert into public.learning_question_options (id, question_id, display_order, option_text, is_correct)
values
${rows(options.map((option) => [quote(option.id), quote(option.questionId), option.displayOrder, quote(option.text), option.isCorrect ? "true" : "false"]))};

select (public.publish_learning_content_version(${quote(content.version.id)}::uuid)).id;

commit;
`;
}

function contentHash(content) {
  return crypto.createHash("sha256").update(canonicalJson(content), "utf8").digest("hex");
}

function generateVerification(content) {
  const legacyMakeTen = content.unit.slug === "make-ten";
  const recommendation = content.recommendation;
  const hash = contentHash(content);
  const expected = quote(canonicalJson(content));
  const questionCount = content.stages.reduce((sum, stage) => sum + stage.questions.length, 0);
  const optionCount = questionCount * 4;
  const questionsPerStage = content.stages[0].questions.length;
  const v2Checks = legacyMakeTen && content.version.number === 2 ? `

  union all
  select 12, 'make_ten_v1_preserved',
    exists (
      select 1 from public.learning_content_versions version
      where version.id = '51000000-0000-4000-8000-000000000003'::uuid
        and version.unit_id = ${quote(content.unit.id)}::uuid
        and version.version_no = 1
        and version.status = 'published'
    )
    and (select count(*) from public.learning_stages where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 4
    and (select count(*) from public.learning_questions question join public.learning_stages stage on stage.id = question.stage_id where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 20
    and (select count(*) from public.learning_question_options option join public.learning_questions question on question.id = option.question_id join public.learning_stages stage on stage.id = question.stage_id where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 80,
    jsonb_build_object('preserved', true)

  union all
  select 13, 'make_ten_latest_published_is_v2',
    (select version.id from public.learning_content_versions version where version.unit_id = ${quote(content.unit.id)}::uuid and version.status = 'published' order by version.version_no desc limit 1) = ${quote(content.version.id)}::uuid,
    jsonb_build_object('version_no', 2)

  union all
  select 14, 'make_ten_v1_assignment_references_preserved',
    not exists (
      select 1 from public.learning_assignments assignment
      where assignment.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
        and assignment.unit_id is distinct from ${quote(content.unit.id)}::uuid
    ),
    jsonb_build_object('v1_assignments', (select count(*) from public.learning_assignments where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid))

  union all
  select 15, 'make_ten_v2_pass_threshold_snapshot',
    ceil(10 * 8 / 10.0)::integer = 8
      and pg_get_functiondef(to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)')) ~* 'ceil\\(question_count \\* 8 / 10\\.0\\)',
    jsonb_build_object('total_questions', 10, 'required_correct_answers', 8)` : "";
  const nonMatchingLevelCode = recommendation?.recommendedStartLevelCode === "ready" ? "elementary_6" : "ready";
  const recommendationChecks = recommendation ? `

  union all
  select 20, 'learning_recommendation_metadata_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_unit_recommendation_metadata metadata
  where metadata.unit_id = ${quote(content.unit.id)}::uuid
    and metadata.subject = ${quote(recommendation.subject)}
    and metadata.recommended_start_level_code = ${quote(recommendation.recommendedStartLevelCode)}
    and metadata.recommended_end_level_code = ${quote(recommendation.recommendedEndLevelCode)}
    and metadata.parent_sort_order = ${recommendation.parentSortOrder}

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = ${quote(content.version.id)}::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = ${quote(content.unit.id)}::uuid
    order by version.unit_id, version.version_no desc
  ) latest_version

  union all
  select 22, 'learning_recommendation_profile_classification',
    count(*) filter (
      where profile.level_code = metadata.recommended_start_level_code
        and (metadata.recommended_end_level_code is null or profile.level_code = metadata.recommended_end_level_code)
    ) = 1
      and count(*) filter (
        where profile.level_code = ${quote(nonMatchingLevelCode)}
          and profile.level_code = metadata.recommended_start_level_code
          and (metadata.recommended_end_level_code is null or profile.level_code = metadata.recommended_end_level_code)
      ) = 0,
    jsonb_build_object('matching_level', ${quote(recommendation.recommendedStartLevelCode)}, 'non_matching_level', ${quote(nonMatchingLevelCode)})
  from public.learning_unit_recommendation_metadata metadata
  cross join (values (${quote(recommendation.recommendedStartLevelCode)}), (${quote(nonMatchingLevelCode)})) profile(level_code)
  where metadata.unit_id = ${quote(content.unit.id)}::uuid` : "";
  const verificationLabel = legacyMakeTen
    ? (content.version.number === 1 ? "pilot content" : `${content.version.label} content`)
    : `${content.unit.slug} ${content.version.label} content`;
  const rewardEmptyCheck = legacyMakeTen && content.version.number === 1
    ? `(select count(*) from public.sticker_transactions where source_type = 'learning_stage_first_pass') = 0`
    : `(select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = ${quote(content.version.id)}::uuid) = 0`;
  const rewardCount = legacyMakeTen && content.version.number === 1
    ? `(select count(*) from public.sticker_transactions where source_type = 'learning_stage_first_pass')`
    : `(select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = ${quote(content.version.id)}::uuid)`;
  return `-- Phase 2B ${verificationLabel} verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select ${expected}::jsonb as document
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
  where content_version_id = ${quote(content.version.id)}::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = ${quote(content.version.id)}::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = ${quote(content.version.id)}::uuid
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
    and version.content_hash = ${quote(hash)}
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
    (select count(*) from actual_questions) = ${questionCount}
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'make_ten_options_exact',
    (select count(*) from actual_options) = ${optionCount}
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'make_ten_structure_and_orders',
    count(*) = ${questionCount}
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
    where stage.content_version_id = ${quote(content.version.id)}::uuid
    group by question.id
  ) structure

  union all
  select 8, 'make_ten_stage_question_counts',
    count(*) = 4 and bool_and(question_count = ${questionsPerStage}),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = ${quote(content.version.id)}::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'make_ten_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = ${quote(content.version.id)}::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = ${quote(content.version.id)}::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = ${quote(content.version.id)}::uuid) = 0
      and ${rewardEmptyCheck},
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = ${quote(content.version.id)}::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = ${quote(content.version.id)}::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = ${quote(content.version.id)}::uuid),
                       'learning_rewards', ${rewardCount})

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
    jsonb_build_object('preserved', true)${v2Checks}${recommendationChecks}
)
select check_order, check_name, passed, result_data
from checks
union all
select 999, 'make_ten_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
`;
}

function generateRollback(content) {
  const recommendation = content.recommendation;
  const sharedCleanup = content.version.number === 1 && recommendation ? `delete from public.learning_units unit
where unit.id = ${quote(content.unit.id)}::uuid
  and unit.course_id = ${quote(content.course.id)}::uuid
  and not exists (
    select 1 from public.learning_content_versions version
    where version.unit_id = unit.id
  );` : content.version.number === 1 ? `delete from public.learning_units unit
where unit.id = ${quote(content.unit.id)}::uuid
  and unit.course_id = ${quote(content.course.id)}::uuid
  and not exists (
    select 1 from public.learning_content_versions version
    where version.unit_id = unit.id
  );

delete from public.learning_courses course
where course.id = ${quote(content.course.id)}::uuid
  and not exists (
    select 1 from public.learning_units unit
    where unit.course_id = course.id
  );` : "";
  const recommendationGuard = recommendation ? `

  if to_regclass('public.learning_unit_recommendation_metadata') is null
    or (
      select count(*)
      from public.learning_unit_recommendation_metadata metadata
      where metadata.unit_id = ${quote(content.unit.id)}::uuid
        and metadata.subject = ${quote(recommendation.subject)}
        and metadata.recommended_start_level_code = ${quote(recommendation.recommendedStartLevelCode)}
        and metadata.recommended_end_level_code = ${quote(recommendation.recommendedEndLevelCode)}
        and metadata.parent_sort_order = ${recommendation.parentSortOrder}
    ) <> 1
    or exists (
      select 1
      from public.learning_unit_recommendation_metadata metadata
      where metadata.unit_id = ${quote(content.unit.id)}::uuid
        and (
          metadata.subject is distinct from ${quote(recommendation.subject)}
          or metadata.recommended_start_level_code is distinct from ${quote(recommendation.recommendedStartLevelCode)}
          or metadata.recommended_end_level_code is distinct from ${quote(recommendation.recommendedEndLevelCode)}
          or metadata.parent_sort_order is distinct from ${recommendation.parentSortOrder}
        )
    ) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: recommendation metadata is missing or changed';
  end if;` : "";
  const recommendationDelete = recommendation ? `delete from public.learning_unit_recommendation_metadata metadata
where metadata.unit_id = ${quote(content.unit.id)}::uuid
  and metadata.subject = ${quote(recommendation.subject)}
  and metadata.recommended_start_level_code = ${quote(recommendation.recommendedStartLevelCode)}
  and metadata.recommended_end_level_code = ${quote(recommendation.recommendedEndLevelCode)}
  and metadata.parent_sort_order = ${recommendation.parentSortOrder};

` : "";
  const rollbackLabel = content.version.number === 1 ? "v1 pilot content" : `${content.version.label} content version`;
  return `-- Pre-use rollback for the Make Ten ${rollbackLabel} only.
begin;

do $guard$
begin
  if exists (
    select 1 from public.learning_assignments
    where content_version_id = ${quote(content.version.id)}::uuid
  ) or exists (
    select 1 from public.learning_attempts
    where content_version_id = ${quote(content.version.id)}::uuid
  ) or exists (
    select 1 from public.learning_stage_first_passes
    where content_version_id = ${quote(content.version.id)}::uuid
  ) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: make-ten content has assignment or learning history';
  end if;${recommendationGuard}
end
$guard$;

${recommendationDelete}select pg_catalog.set_config('session_replication_role', 'replica', true);

delete from public.learning_question_options option
using public.learning_questions question, public.learning_stages stage
where option.question_id = question.id
  and question.stage_id = stage.id
  and stage.content_version_id = ${quote(content.version.id)}::uuid;

delete from public.learning_questions question
using public.learning_stages stage
where question.stage_id = stage.id
  and stage.content_version_id = ${quote(content.version.id)}::uuid;

delete from public.learning_stages
where content_version_id = ${quote(content.version.id)}::uuid;

delete from public.learning_content_versions
where id = ${quote(content.version.id)}::uuid;

${sharedCleanup}

select pg_catalog.set_config('session_replication_role', 'origin', true);

commit;
`;
}

if (require.main === module) {
  const input = path.resolve(process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(process.argv[3] || DEFAULT_OUTPUT);
  const content = loadAndValidate(input);
  const verification = path.resolve(process.argv[4] || DEFAULT_VERIFICATION);
  const rollback = path.resolve(process.argv[5] || DEFAULT_ROLLBACK);
  fs.writeFileSync(output, generateMigration(content), "utf8");
  fs.writeFileSync(verification, generateVerification(content), "utf8");
  fs.writeFileSync(rollback, generateRollback(content), "utf8");
  console.log([output, verification, rollback].join("\n"));
}

module.exports = { generateMigration, generateRollback, generateVerification };
