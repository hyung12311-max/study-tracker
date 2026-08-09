-- Roll back only unused Grade 2 four-digit-number skills.
begin;
do $guard$
declare target_skill_codes text[]:=array['understand-thousands','read-four-digit-number','write-four-digit-number','represent-four-digit-place-units','compose-four-digit-number','decompose-four-digit-number','compare-four-digit-numbers','order-four-digit-numbers','build-four-digit-number-from-digits']::text[];
begin
  if exists(select 1 from public.learning_question_skills where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_attempt_questions where skill_codes_snapshot && target_skill_codes)
  or exists(select 1 from public.learning_mistake_review_sessions where filter_skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_overrides where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_events where skill_code=any(target_skill_codes)) then raise exception using errcode='55000',message='grade2 four digit skills are in use'; end if;
end
$guard$;
delete from public.learning_skill_definitions where skill_code=any(array['understand-thousands','read-four-digit-number','write-four-digit-number','represent-four-digit-place-units','compose-four-digit-number','decompose-four-digit-number','compare-four-digit-numbers','order-four-digit-numbers','build-four-digit-number-from-digits']::text[]);
commit;
