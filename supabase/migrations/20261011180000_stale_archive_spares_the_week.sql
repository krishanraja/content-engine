-- The stale-archive job spares the week Krish is planning (2026-10-11).
--
-- archive_stale_content_ideas buried any row idle 14 days, whatever it was
-- for. Since the week is planned on Sunday, three kinds of row can sit idle
-- on purpose and still be wanted:
--   * a piece scheduled for a day that has not come yet (scheduled_for);
--   * a row Krish restored from triage, which is never to be swept again
--     (protected_at, the same guard triage/sweep.ts and _grader.ts honour);
--   * an option the Sunday session offered for this week or the next
--     (meta.week_option.week_start), which waits on his pick.
-- Everything else is unchanged.

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
    AND COALESCE(state, 'seeded') NOT IN ('published', 'absorbed')
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
