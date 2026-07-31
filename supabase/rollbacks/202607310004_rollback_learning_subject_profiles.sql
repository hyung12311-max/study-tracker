begin;

do $guard$
begin
  if to_regclass('public.learning_member_subject_profiles') is not null
     and exists (select 1 from public.learning_member_subject_profiles) then
    raise exception using errcode = '55000', message = 'learning subject profiles contain data';
  end if;
  if to_regclass('public.learning_unit_recommendation_metadata') is not null
     and exists (
       select 1 from public.learning_unit_recommendation_metadata
       where unit_id <> '51000000-0000-4000-8000-000000000002'::uuid
          or subject <> 'math'
          or recommended_start_level_code <> 'elementary_1'
          or recommended_end_level_code is distinct from 'elementary_1'
          or parent_sort_order <> 1
     ) then
    raise exception using errcode = '55000', message = 'learning recommendation metadata contains unexpected data';
  end if;
end
$guard$;

revoke all on function public.upsert_learning_member_subject_profile(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
drop function public.upsert_learning_member_subject_profile(uuid, uuid, uuid, text, text);
drop trigger learning_member_subject_profiles_scope_trigger on public.learning_member_subject_profiles;
drop function public.validate_learning_member_subject_profile();
drop table public.learning_unit_recommendation_metadata;
drop table public.learning_member_subject_profiles;

commit;
