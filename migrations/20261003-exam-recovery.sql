-- Run once in the Supabase SQL Editor. Keeps existing data and attempts.
-- Allows existing papers to resume after registration closes, and retries
-- an initial start with the token already stored by the browser.
begin;
create or replace function public.exam_start(
  p_name       text,
  p_student_id text,
  p_batch      text,
  p_email      text,
  p_phone      text,
  p_user_agent text default null,
  p_resume_token uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cfg      public.exam_settings;
  v_student  uuid;
  v_att      public.exam_attempts;
  v_id       uuid;
  v_token    uuid;
  v_deadline timestamptz;
  v_seconds  int;
  v_pos      int := 0;
  v_row      record;
  v_opts     jsonb;
begin
  select * into v_cfg from public.exam_settings where id = 1;

  -- All five fields are required. Trim first so a row of spaces is not
  -- accepted as a name.
  if nullif(trim(p_name), '')       is null then raise exception 'need_name';    end if;
  if nullif(trim(p_student_id), '') is null then raise exception 'need_student';  end if;
  if nullif(trim(p_batch), '')      is null then raise exception 'need_batch';    end if;
  if nullif(trim(p_email), '')      is null then raise exception 'need_email';    end if;
  if nullif(trim(p_phone), '')      is null then raise exception 'need_phone';    end if;

  if position('@' in p_email) = 0 then
    raise exception 'bad_email';
  end if;

  -- Serialize registrations for a student; never overwrite an existing
  -- student's contact details before proving ownership of their attempt.
  insert into public.exam_students (student_id, name, batch, email, phone)
  values (
    left(upper(trim(p_student_id)), 40),
    left(trim(p_name), 80),
    left(trim(p_batch), 40),
    left(lower(trim(p_email)), 120),
    left(trim(p_phone), 20)
  )
  on conflict (student_id) do nothing;

  select id into v_student from public.exam_students
  where student_id = left(upper(trim(p_student_id)), 40)
  for update;

  -- An exam already running for this student? Hand it straight back.
  select * into v_att
  from public.exam_attempts
  where student = v_student and status = 'in_progress' and deadline > now()
  order by started_at desc
  limit 1;

  if found then
    if p_resume_token is distinct from v_att.token then
      raise exception 'bad_attempt';
    end if;
    if v_att.config <> '{}'::jsonb then
      v_cfg := jsonb_populate_record(null::public.exam_settings, v_att.config);
    end if;
    return jsonb_build_object(
      'attempt',    v_att.id,
      'token',      v_att.token,
      'resumed',    true,
      'deadline',   v_att.deadline,
      'seconds_left', greatest(0, floor(extract(epoch from (v_att.deadline - now())))::int),
      'violations', v_att.violation_count,
      'config',     jsonb_build_object(
        'mcq_seconds',        v_cfg.mcq_seconds,
        'max_violations',     v_cfg.max_violations,
        'require_fullscreen', v_cfg.require_fullscreen,
        'block_copy',         v_cfg.block_copy,
        'detect_tab_switch',  v_cfg.detect_tab_switch,
        'end_on_exit',        v_cfg.end_on_exit
      ),
      'questions',  public.exam_paper(v_att.id)
    );
  end if;

  -- Closing registration must not prevent an existing student from resuming.
  if not coalesce(v_cfg.exam_open, false) then
    raise exception 'exam_closed';
  end if;

  -- Not resuming. If one sitting per student is on, a finished attempt
  -- blocks a second one.
  if coalesce(v_cfg.one_attempt_per_student, true) and exists (
    select 1 from public.exam_attempts
    where student = v_student
  ) then
    raise exception 'already_attempted';
  end if;

  -- Total time = every MCQ at its own allowance, plus the two written
  -- sections' budgets.
  v_seconds := greatest(60,
      v_cfg.mcq_count * greatest(v_cfg.mcq_seconds, 5)
    + v_cfg.written_minutes * 60
    + v_cfg.practical_minutes * 60);
  v_deadline := now() + make_interval(secs => v_seconds);

  insert into public.exam_attempts (student, deadline, user_agent, config, token)
  values (v_student, v_deadline, left(coalesce(p_user_agent, ''), 400), to_jsonb(v_cfg), coalesce(p_resume_token,gen_random_uuid()))
  returning id, token into v_id, v_token;

  -- Draw the paper: each section, random pick from the active pool,
  -- MCQ first so the timed section is over before the long answers.
  for v_row in
    select q.*, x.want
    from (values
      ('mcq',       coalesce(v_cfg.mcq_count, 0),       1),
      ('written',   coalesce(v_cfg.written_count, 0),   2),
      ('practical', coalesce(v_cfg.practical_count, 0), 3)
    ) as x(t, want, band)
    cross join lateral (
      select * from public.exam_questions eq
      where eq.is_active and eq.qtype = x.t
      order by case when coalesce(v_cfg.shuffle_questions, true)
                    then random()
                    else eq.sort_order::double precision end
      limit x.want
    ) q
    order by x.band, case when coalesce(v_cfg.shuffle_questions, true)
                         then random() else q.sort_order::double precision end
  loop
    v_pos := v_pos + 1;

    -- Shuffle the options for this student, keeping the correct flag
    -- attached. It is stored, never sent.
    if v_row.qtype = 'mcq' and coalesce(v_cfg.shuffle_options, true) then
      select coalesce(jsonb_agg(o order by random()), '[]'::jsonb)
        into v_opts
      from jsonb_array_elements(v_row.options) as o;
    else
      v_opts := coalesce(v_row.options, '[]'::jsonb);
    end if;

    insert into public.exam_answers
      (attempt, question, qtype, position, prompt_snapshot, hint_snapshot,
       model_snapshot, shown_options, max_marks)
    values
      (v_id, v_row.id, v_row.qtype, v_pos, v_row.prompt, v_row.hint,
       v_row.model_answer, v_opts, greatest(v_row.marks, 1));
  end loop;

  if v_pos = 0 then
    -- No questions loaded yet: bin the empty attempt rather than leave
    -- the student staring at a blank paper.
    delete from public.exam_attempts where id = v_id;
    raise exception 'no_questions';
  end if;

  -- Record what the paper is worth, per section.
  update public.exam_attempts a set
    mcq_total       = (select coalesce(sum(max_marks),0) from public.exam_answers where attempt = v_id and qtype = 'mcq'),
    written_total   = (select coalesce(sum(max_marks),0) from public.exam_answers where attempt = v_id and qtype = 'written'),
    practical_total = (select coalesce(sum(max_marks),0) from public.exam_answers where attempt = v_id and qtype = 'practical')
  where a.id = v_id;

  return jsonb_build_object(
    'attempt',    v_id,
    'token',      v_token,
    'resumed',    false,
    'deadline',   v_deadline,
    'seconds_left', v_seconds,
    'violations', 0,
    'config',     jsonb_build_object(
      'mcq_seconds',        v_cfg.mcq_seconds,
      'max_violations',     v_cfg.max_violations,
      'require_fullscreen', v_cfg.require_fullscreen,
      'block_copy',         v_cfg.block_copy,
      'detect_tab_switch',  v_cfg.detect_tab_switch,
      'end_on_exit',        v_cfg.end_on_exit
    ),
    'questions',  public.exam_paper(v_id)
  );
end
$fn$;
commit;
