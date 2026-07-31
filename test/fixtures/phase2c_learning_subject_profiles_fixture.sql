-- Disposable Phase 2C-1A behavior checks. Uses synthetic identities only.

do $fixture$
declare
  family_a uuid := '71000000-0000-4000-8000-000000000001';
  family_b uuid := '71000000-0000-4000-8000-000000000002';
  parent_a uuid := '72000000-0000-4000-8000-000000000001';
  child_a uuid := '72000000-0000-4000-8000-000000000002';
  inactive_child uuid := '72000000-0000-4000-8000-000000000003';
  other_child uuid := '72000000-0000-4000-8000-000000000004';
  profile_row public.learning_member_subject_profiles;
begin
  insert into public.families (id, family_key, display_name) values
    (family_a, 'phase2c-fixture-a', 'Fixture A'),
    (family_b, 'phase2c-fixture-b', 'Fixture B');
  insert into public.family_members (id, family_id, member_key, display_name, role, is_active) values
    (parent_a, family_a, 'parent-a', 'Fixture Parent', 'parent', true),
    (child_a, family_a, 'child-a', 'Fixture Child', 'child', true),
    (inactive_child, family_a, 'inactive-child', 'Inactive Child', 'child', false),
    (other_child, family_b, 'other-child', 'Other Child', 'child', true);

  profile_row := public.upsert_learning_member_subject_profile(
    family_a, parent_a, child_a, 'math', 'elementary_1'
  );
  if profile_row.member_id <> child_a or profile_row.level_code <> 'elementary_1' then
    raise exception 'profile insert failed';
  end if;
  profile_row := public.upsert_learning_member_subject_profile(
    family_a, parent_a, child_a, 'math', 'elementary_2'
  );
  if profile_row.level_code <> 'elementary_2'
     or (select count(*) from public.learning_member_subject_profiles where member_id = child_a) <> 1 then
    raise exception 'profile idempotent update failed';
  end if;

  begin
    perform public.upsert_learning_member_subject_profile(family_a, parent_a, inactive_child, 'math', 'elementary_1');
    raise exception 'inactive child was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.upsert_learning_member_subject_profile(family_a, parent_a, other_child, 'math', 'elementary_1');
    raise exception 'other-family child was accepted';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;

  if has_table_privilege('anon','public.learning_member_subject_profiles','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.learning_member_subject_profiles','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','public.learning_member_subject_profiles','INSERT,UPDATE,DELETE') then
    raise exception 'profile table ACL failed';
  end if;
  if not has_table_privilege('service_role','public.learning_member_subject_profiles','SELECT')
     or not has_function_privilege('service_role','public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','public.upsert_learning_member_subject_profile(uuid,uuid,uuid,text,text)','EXECUTE') then
    raise exception 'profile wrapper ACL failed';
  end if;
  if exists (select 1 from pg_catalog.pg_publication_tables
    where schemaname='public' and tablename in ('learning_member_subject_profiles','learning_unit_recommendation_metadata')) then
    raise exception 'profile objects entered Realtime';
  end if;
end
$fixture$;

select 'phase2c learning subject profile fixture passed' as result;
