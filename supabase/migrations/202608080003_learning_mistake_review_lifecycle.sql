begin;

do $preflight$
begin
  if to_regclass('public.learning_mistake_review_sessions') is null
     or to_regclass('public.learning_mistake_review_items') is null
     or to_regclass('public.learning_mistake_review_answers') is null
     or to_regclass('public.learning_mistake_review_events') is null then
    raise exception using errcode = 'P0001', message = 'Phase E-2 review lifecycle prerequisites are missing';
  end if;
  if to_regprocedure('public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)') is not null
     or to_regprocedure('public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)') is not null then
    raise exception using errcode = 'P0001', message = 'Phase E-2 review lifecycle target already exists';
  end if;
end
$preflight$;

alter table public.learning_mistake_review_events
  drop constraint learning_mistake_review_events_type_check,
  add constraint learning_mistake_review_events_type_check
    check (event_type in ('solution_revealed', 'session_abandoned'));

create function public.submit_learning_mistake_review_answer(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_session_id uuid,
  p_review_item_id uuid,
  p_selected_option_id uuid,
  p_request_id uuid
)
returns table (
  review_answer_id uuid,
  review_session_id uuid,
  review_item_id uuid,
  selected_answer text,
  correct_answer text,
  explanation text,
  is_correct boolean,
  answered_count integer,
  total_items integer,
  session_status text,
  submitted_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor public.family_members%rowtype;
  target_session public.learning_mistake_review_sessions%rowtype;
  target_item public.learning_mistake_review_items%rowtype;
  target_question public.learning_attempt_questions%rowtype;
  prior_answer public.learning_mistake_review_answers%rowtype;
  saved_answer public.learning_mistake_review_answers%rowtype;
  selected_text text;
  correct_text text;
  correct_result boolean;
  submitted_total integer;
  item_total integer;
begin
  if p_family_id is null or p_actor_member_id is null or p_session_id is null
     or p_review_item_id is null or p_selected_option_id is null or p_request_id is null then
    raise exception using errcode = '22004', message = 'review answer fields are required';
  end if;

  select member.* into actor
  from public.family_members member
  where member.family_id = p_family_id
    and member.id = p_actor_member_id
    and member.is_active = true
    and member.role in ('parent', 'child')
  for update;
  if actor.id is null then
    raise exception using errcode = '42501', message = 'active review actor is required';
  end if;

  select session.* into target_session
  from public.learning_mistake_review_sessions session
  where session.id = p_session_id
    and session.family_id = p_family_id
    and (actor.role = 'parent' or session.assigned_member_id = p_actor_member_id)
  for update;
  if target_session.id is null then
    raise exception using errcode = 'P0002', message = 'review session was not found';
  end if;
  select item.* into target_item
  from public.learning_mistake_review_items item
  where item.id = p_review_item_id
    and item.session_id = p_session_id;
  if target_item.id is null then
    raise exception using errcode = 'P0002', message = 'review item was not found';
  end if;

  select question.* into target_question
  from public.learning_attempt_questions question
  where question.id = target_item.source_attempt_question_id
    and question.attempt_id = target_item.source_attempt_id;
  if target_question.id is null then
    raise exception using errcode = 'P0002', message = 'review snapshot was not found';
  end if;

  select option_row ->> 'text' into selected_text
  from jsonb_array_elements(target_question.options_snapshot) option_row
  where option_row ->> 'id' = p_selected_option_id::text
  limit 1;
  if selected_text is null then
    raise exception using errcode = '23514', message = 'review option is not in the immutable snapshot';
  end if;
  select option_row ->> 'text' into correct_text
  from jsonb_array_elements(target_question.options_snapshot) option_row
  where option_row ->> 'id' = target_question.correct_option_id::text
  limit 1;
  if correct_text is null then
    raise exception using errcode = '55000', message = 'review snapshot answer is missing';
  end if;
  correct_result := p_selected_option_id = target_question.correct_option_id;

  select answer.* into prior_answer
  from public.learning_mistake_review_answers answer
  where answer.session_id = p_session_id
    and answer.client_request_id = p_request_id;
  if prior_answer.id is not null then
    if prior_answer.review_item_id <> p_review_item_id
       or prior_answer.selected_option_id <> p_selected_option_id then
      raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    saved_answer := prior_answer;
  else
    if target_session.status = 'completed' then
      raise exception using errcode = '55000', message = 'REVIEW_SESSION_COMPLETED';
    elsif target_session.status = 'abandoned' then
      raise exception using errcode = '55000', message = 'REVIEW_SESSION_ABANDONED';
    end if;
    select answer.* into prior_answer
    from public.learning_mistake_review_answers answer
    where answer.review_item_id = p_review_item_id;
    if prior_answer.id is not null then
      if prior_answer.selected_option_id <> p_selected_option_id then
        raise exception using errcode = '55000', message = 'REVIEW_ANSWER_CONFLICT';
      end if;
      saved_answer := prior_answer;
    else
      insert into public.learning_mistake_review_answers (
        session_id, review_item_id, selected_option_id, is_correct, client_request_id
      ) values (
        p_session_id, p_review_item_id, p_selected_option_id, correct_result, p_request_id
      ) returning * into saved_answer;
    end if;
  end if;

  select count(*)::integer into item_total
  from public.learning_mistake_review_items item
  where item.session_id = p_session_id;
  select count(*)::integer into submitted_total
  from public.learning_mistake_review_answers answer
  where answer.session_id = p_session_id;

  if submitted_total = item_total and target_session.status = 'in_progress' then
    update public.learning_mistake_review_sessions session
    set status = 'completed', completed_at = coalesce(session.completed_at, now())
    where session.id = p_session_id and session.status = 'in_progress'
    returning session.* into target_session;
  end if;

  return query select
    saved_answer.id,
    target_session.id,
    target_item.id,
    selected_text,
    correct_text,
    target_question.explanation_snapshot,
    saved_answer.is_correct,
    submitted_total,
    item_total,
    target_session.status,
    saved_answer.submitted_at,
    target_session.completed_at;
end
$function$;

create function public.abandon_learning_mistake_review(
  p_family_id uuid,
  p_actor_member_id uuid,
  p_session_id uuid,
  p_request_id uuid
)
returns table (
  review_session_id uuid,
  session_status text,
  answered_count integer,
  total_items integer,
  abandoned_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor public.family_members%rowtype;
  target_session public.learning_mistake_review_sessions%rowtype;
  prior_event public.learning_mistake_review_events%rowtype;
  submitted_total integer;
  item_total integer;
begin
  if p_family_id is null or p_actor_member_id is null or p_session_id is null or p_request_id is null then
    raise exception using errcode = '22004', message = 'review abandon fields are required';
  end if;

  select member.* into actor
  from public.family_members member
  where member.family_id = p_family_id
    and member.id = p_actor_member_id
    and member.is_active = true
    and member.role in ('parent', 'child')
  for update;
  if actor.id is null then
    raise exception using errcode = '42501', message = 'active review actor is required';
  end if;

  select session.* into target_session
  from public.learning_mistake_review_sessions session
  where session.id = p_session_id
    and session.family_id = p_family_id
    and (actor.role = 'parent' or session.assigned_member_id = p_actor_member_id)
  for update;
  if target_session.id is null then
    raise exception using errcode = 'P0002', message = 'review session was not found';
  end if;

  select event.* into prior_event
  from public.learning_mistake_review_events event
  where event.session_id = p_session_id and event.request_id = p_request_id;
  if prior_event.id is not null and (
    prior_event.event_type <> 'session_abandoned'
    or prior_event.actor_member_id <> p_actor_member_id
  ) then
    raise exception using errcode = '55000', message = 'IDEMPOTENCY_CONFLICT';
  end if;

  if target_session.status = 'completed' then
    raise exception using errcode = '55000', message = 'REVIEW_SESSION_COMPLETED';
  elsif target_session.status = 'in_progress' then
    update public.learning_mistake_review_sessions session
    set status = 'abandoned', abandoned_at = now()
    where session.id = p_session_id
    returning session.* into target_session;
    insert into public.learning_mistake_review_events (
      session_id, review_item_id, actor_member_id, event_type, request_id
    ) values (
      p_session_id, null, p_actor_member_id, 'session_abandoned', p_request_id
    );
  end if;

  select count(*)::integer into item_total
  from public.learning_mistake_review_items item where item.session_id = p_session_id;
  select count(*)::integer into submitted_total
  from public.learning_mistake_review_answers answer where answer.session_id = p_session_id;
  return query select target_session.id, target_session.status, submitted_total, item_total, target_session.abandoned_at;
end
$function$;

alter function public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid) owner to postgres;
alter function public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid) owner to postgres;

revoke all on function public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_learning_mistake_review_answer(uuid,uuid,uuid,uuid,uuid,uuid)
  to service_role;
grant execute on function public.abandon_learning_mistake_review(uuid,uuid,uuid,uuid)
  to service_role;

commit;
