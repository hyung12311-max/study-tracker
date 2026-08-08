-- Disposable behavior checks for Grade 2 shapes definitions and published content.

do $fixture$
declare
  target_question_id uuid;
begin
  if (select count(*) from public.learning_skill_definitions
      where skill_code in (
        'identify-plane-shape','identify-solid-shape','connect-object-to-shape','classify-shapes',
        'describe-shape-properties','compose-decompose-shapes','infer-shape-from-properties','correct-shape-reasoning'
      )) <> 8 then
    raise exception 'grade2 shapes skill definitions are incomplete';
  end if;

  if not exists (
    select 1
    from public.learning_content_versions version
    join public.learning_units unit on unit.id = version.unit_id
    where version.id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
      and version.status = 'published'
      and unit.unit_code = 'grade2-shapes'
      and unit.sort_order = 3
  ) then
    raise exception 'grade2 shapes published identity is missing';
  end if;

  if (select count(*) from public.learning_stages
      where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) <> 4
     or (select count(*) from public.learning_questions question
         join public.learning_stages stage on stage.id = question.stage_id
         where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) <> 40
     or (select count(*) from public.learning_question_options option
         join public.learning_questions question on question.id = option.question_id
         join public.learning_stages stage on stage.id = question.stage_id
         where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) <> 160 then
    raise exception 'grade2 shapes 4/40/160 structure failed';
  end if;

  if (select count(*) from public.learning_question_skills mapping
      join public.learning_questions question on question.id = mapping.question_id
      join public.learning_stages stage on stage.id = question.stage_id
      where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
        and mapping.is_primary) <> 40 then
    raise exception 'grade2 shapes primary mapping coverage failed';
  end if;

  if (select count(distinct mapping.skill_code)
      from public.learning_question_skills mapping
      join public.learning_questions question on question.id = mapping.question_id
      join public.learning_stages stage on stage.id = question.stage_id
      where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) <> 8 then
    raise exception 'grade2 shapes skill coverage failed';
  end if;

  select question.id into target_question_id
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
  order by stage.display_order, question.display_order
  limit 1;

  begin
    update public.learning_question_skills
    set is_primary = false
    where question_id = target_question_id;
    raise exception 'published grade2 shapes mapping update was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from public.learning_question_skills
    where question_id = target_question_id;
    raise exception 'published grade2 shapes mapping delete was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

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
    raise exception 'grade2 shapes mapping ACL failed';
  end if;
end
$fixture$;

select 'grade2 shapes content fixture passed' as result;
