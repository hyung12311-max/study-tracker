-- Disposable behavior checks for Grade 2 classification definitions and published content.

do $fixture$
declare
  target_question_id uuid;
  target_snapshot text[];
begin
  if (select count(*) from public.learning_skill_definitions
      where skill_code in (
        'identify-classification-rule','classify-by-given-rule','compare-classification-rules',
        'infer-rule-from-groups','find-misclassified-item','find-missing-classified-item',
        'classify-by-two-properties','explain-classification-reasoning'
      )) <> 8 then
    raise exception 'grade2 classification skill definitions are incomplete';
  end if;

  if not exists (
    select 1
    from public.learning_content_versions version
    join public.learning_units unit on unit.id = version.unit_id
    where version.id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
      and version.status = 'published'
      and unit.unit_code = 'grade2-classification'
      and unit.sort_order = 6
  ) then
    raise exception 'grade2 classification published identity is missing';
  end if;

  if (select count(*) from public.learning_stages
      where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) <> 4
     or (select count(*) from public.learning_questions question
         join public.learning_stages stage on stage.id = question.stage_id
         where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) <> 40
     or (select count(*) from public.learning_question_options option
         join public.learning_questions question on question.id = option.question_id
         join public.learning_stages stage on stage.id = question.stage_id
         where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) <> 160 then
    raise exception 'grade2 classification 4/40/160 structure failed';
  end if;

  if (select count(*) from public.learning_question_skills mapping
      join public.learning_questions question on question.id = mapping.question_id
      join public.learning_stages stage on stage.id = question.stage_id
      where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
        and mapping.is_primary) <> 40
     or (select count(distinct mapping.skill_code)
         from public.learning_question_skills mapping
         join public.learning_questions question on question.id = mapping.question_id
         join public.learning_stages stage on stage.id = question.stage_id
         where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) <> 8 then
    raise exception 'grade2 classification skill mapping coverage failed';
  end if;

  select question.id, array_agg(mapping.skill_code order by mapping.is_primary desc, mapping.skill_code)
  into target_question_id, target_snapshot
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  join public.learning_question_skills mapping on mapping.question_id = question.id
  where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
  group by question.id, stage.display_order, question.display_order
  order by stage.display_order, question.display_order
  limit 1;

  if pg_typeof(target_snapshot) <> 'text[]'::regtype or cardinality(target_snapshot) <> 1 then
    raise exception 'grade2 classification snapshot compatibility failed';
  end if;

  begin
    update public.learning_question_skills set is_primary = false where question_id = target_question_id;
    raise exception 'published classification mapping update was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from public.learning_question_skills where question_id = target_question_id;
    raise exception 'published classification mapping delete was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

  if (select count(*) from public.learning_content_versions
      where id in (
        '51000000-0000-4000-8000-000000000003'::uuid,
        '61000000-0000-4000-8000-000000000003'::uuid,
        '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid,
        '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid,
        'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid,
        '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid
      ) and status = 'published') <> 6 then
    raise exception 'existing published content identities changed';
  end if;

  if exists (select 1 from public.learning_attempts)
     or exists (select 1 from public.learning_attempt_answers)
     or exists (select 1 from public.learning_stage_progress)
     or exists (select 1 from public.learning_stage_first_passes)
     or exists (select 1 from public.sticker_transactions)
     or exists (select 1 from public.learning_mistake_review_answers) then
    raise exception 'content rollout changed official or review result data';
  end if;

  if has_table_privilege('anon','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','public.learning_question_skills','INSERT,UPDATE,DELETE') then
    raise exception 'grade2 classification mapping ACL failed';
  end if;
end
$fixture$;

select 'grade2 classification content fixture passed' as result;
