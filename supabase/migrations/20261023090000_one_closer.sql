-- One closer: only a check, Krish, or a session on its own work ends a
-- board item.
--
-- Krish, 2026-10-11: "I think closing what you can check is already done is
-- one of the most obvious things I've ever heard of as a suggestion." And:
-- "I am happy to Clear(complete)/Bump/Purge things off my lists as I go but
-- the rest should be automatically done." Step 4 of his operating system is
-- one done-check sweep (Control Center's api/_doneChecks.ts). The engine's
-- own closers are gone (step 4, part C); this holds the rule in the
-- database too, so no script, flow or new repository can quietly become a
-- second closer.
--
-- Applied after both backfill steps of step 4 and after part C deploys. It
-- needs 20261022090000_board_close_columns.sql (close_ref, closed_proof,
-- board_close_ref_ok) and 20261022091000_on_you_closes_itself.sql.
--
-- 1. work_board_items_open_says_how_it_ends: every open item (on_you or
--    in_progress) has a closes_on and what its kind needs. Validated: the
--    backfill gave every open row a kind.
-- 2. only_a_check_or_krish_closes: a move from an open lane to done or
--    archived goes through only when closed_by is 'Krish', a check
--    ('check: <kind>' with its proof in closed_proof), or an agent client on
--    an item that closes_on session. The agent clients are AGENT_CLIENTS in
--    apps/control-plane/api/_editEvents.ts (scripts/check-one-close.ts fails
--    when the two lists differ). Anything else raises check_closes_it. It
--    stops mistakes: an old closer left in a script, a session closing a
--    check's item, a flow writing done. It does not stop forgery: a writer
--    with the service role can still set closed_by 'Krish'. The engine's
--    board route asks a relayed close for his exact words and keeps them on
--    the row, which is what makes a forged relay visible.
-- 3. archive_stale_content_ideas spares pieces in the making (drafting,
--    review, approved) as well as published and absorbed: burying one would
--    let go of every item waiting on it.
--
-- Safe to run again: the constraint is dropped and added the same way, the
-- function and trigger are replaced.

alter table public.work_board_items drop constraint if exists work_board_items_open_says_how_it_ends;
alter table public.work_board_items
  add constraint work_board_items_open_says_how_it_ends
  check (lane not in ('on_you', 'in_progress') or (
    closes_on is not null
    and public.board_close_ref_ok(closes_on, close_ref, idea_id, id))) not valid;
alter table public.work_board_items validate constraint work_board_items_open_says_how_it_ends;

create or replace function public.only_a_check_or_krish_closes() returns trigger
language plpgsql as $$
begin
  if old.lane in ('on_you', 'in_progress') and new.lane in ('done', 'archived') then
    if new.closed_by = 'Krish'
       or (new.closed_by like 'check: %' and new.closed_proof is not null)
       or (old.closes_on = 'session' and new.closed_by in ('codex', 'claude_code', 'claude_ai', 'chatgpt', 'runner', 'cron')) then
      return new;
    end if;
    raise exception 'check_closes_it: % may not close % (closes_on %)', coalesce(new.closed_by, 'nobody'), old.id, coalesce(old.closes_on, 'none')
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists only_a_check_or_krish_closes on public.work_board_items;
create trigger only_a_check_or_krish_closes
  before update of lane on public.work_board_items
  for each row execute function public.only_a_check_or_krish_closes();

CREATE OR REPLACE FUNCTION public.archive_stale_content_ideas(p_days integer DEFAULT NULL::integer, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_days int;
  v_cutoff timestamptz;
  v_rows jsonb;
  v_ids uuid[];
  v_n int := 0;
BEGIN
  v_days := COALESCE(
    p_days,
    NULLIF((SELECT value FROM public.system_config WHERE key = 'content_staleness_archive_days'), '')::int,
    14);
  v_days := GREATEST(3, LEAST(v_days, 180));
  v_cutoff := now() - make_interval(days => v_days);

  SELECT COALESCE(array_agg(id), '{}')
  INTO v_ids
  FROM public.content_ideas
  WHERE buried_at IS NULL
    AND COALESCE(state_changed_at, created_at) < v_cutoff
    -- published or absorbed: done with; drafting, review, approved: in the making,
    -- and board items wait on its steps (step 4).
    AND COALESCE(state, 'seeded') NOT IN ('published', 'absorbed', 'drafting', 'review', 'approved')
    AND shift_id IS NULL       -- feeding a live shift: Krish committed to it
    AND library_at IS NULL     -- graduated: evergreen by decision
    AND protected_at IS NULL   -- restored by Krish: never swept again
    AND (scheduled_for IS NULL OR scheduled_for < current_date)  -- holds a day still to come
    AND NOT (                  -- offered for this week or the next, waiting on his pick
      COALESCE(meta->'week_option'->>'week_start', '') ~ '^\d{4}-\d{2}-\d{2}$'
      AND (meta->'week_option'->>'week_start')::date >= current_date - 6
    );

  v_n := COALESCE(array_length(v_ids, 1), 0);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', id, 'idea', left(idea, 90), 'state', state,
           'idle_days', round(extract(epoch FROM (now() - COALESCE(state_changed_at, created_at))) / 86400)
         ) ORDER BY COALESCE(state_changed_at, created_at)), '[]'::jsonb)
  INTO v_rows
  FROM (SELECT id, idea, state, state_changed_at, created_at
        FROM public.content_ideas
        WHERE id = ANY(v_ids)
        ORDER BY COALESCE(state_changed_at, created_at)
        LIMIT 25) s;

  IF NOT p_dry_run AND v_n > 0 THEN
    UPDATE public.content_ideas ci
    SET buried_at = now(),
        -- The 'stale:' prefix is load-bearing. detect.ts re-admits these to the
        -- trend corpus; rows buried as duplicates stay out, because their
        -- citations already live in their keeper's meta.recurrences.
        buried_reason = 'stale: no state change in ' || v_days || ' days (was ' || COALESCE(ci.state,'seeded') || ')'
    WHERE ci.id = ANY(v_ids);
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run, 'idle_days_threshold', v_days,
    'archived', CASE WHEN p_dry_run THEN 0 ELSE v_n END,
    'would_archive', v_n, 'sample', v_rows);
END $function$;
