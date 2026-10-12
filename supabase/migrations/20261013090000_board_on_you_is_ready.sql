-- An item waiting on Krish is ready for his list, or it is not on him.
--
-- Krish, 2026-10-11, on what waits on him: one list, holding only what he
-- alone can do, what is prepared, and what says how it closes itself; and
-- "you are just capping the garbage. Surely we need to not have garbage."
-- So a row in lane on_you must carry all of it:
--
--   only_you   why only he can do it (work_board_items_only_you_check);
--   link       the https link to the prepared thing he acts on;
--   closes_on  how it closes itself (a making step, published, or
--              week_planned for the week's planning item);
--   idea_id    the piece whose step closes it, unless closes_on is
--              week_planned (Control Center's slate closes the week).
--
-- The engine route refuses such a write first, naming the missing field
-- (apps/control-plane/api/workbench.ts, 400 on_you_needs_*); this is the same
-- rule in the database, for every writer.
--
-- 1. The CHECK is added NOT VALID: from here every insert and update is held
--    to it, while the rows already there are not yet checked.
-- 2. Every row still waiting on him that fails moves to in_progress, written
--    as control_center, with its detail starting "Held from Krish's list on
--    <date>: it does not say how the system will know it is done." and then
--    the detail it had (cut to the column's 2,000 characters). The default
--    that stands (the step 2 plan, question 2): a job only he can do that no
--    machine can see finished stays off his list until an agent gives it a
--    check. On 12 October that was you-launch-today, you-engine-github-key
--    and you-welcome-days.
-- 3. The CHECK is validated.
--
-- Safe to run again: the constraint is added once, a row already moved is
-- never moved or prefixed twice, and validating a valid constraint changes
-- nothing. The purge archives the board items tied to a row before it
-- deletes the row (apps/control-plane/api/purge/run.ts), because the foreign
-- key's on delete set null would otherwise empty an idea_id this rule needs.

do $$ begin
  alter table public.work_board_items
    add constraint work_board_items_on_you_is_ready
    check (lane <> 'on_you' or (
      only_you is not null
      and link is not null
      and closes_on is not null
      and (closes_on = 'week_planned' or idea_id is not null)
    )) not valid;
exception when duplicate_object then null; end $$;

update public.work_board_items
  set lane = 'in_progress',
      updated_by = 'control_center',
      updated_at = now(),
      detail = case
        when detail like 'Held from Krish''s list on %' then detail
        else left(
          'Held from Krish''s list on '
            || to_char(now() at time zone 'America/New_York', 'FMDD FMMonth')
            || ': it does not say how the system will know it is done.'
            || case when detail = '' then '' else ' ' || detail end,
          2000)
      end
  where lane = 'on_you'
    and not (
      only_you is not null
      and link is not null
      and closes_on is not null
      and (closes_on = 'week_planned' or idea_id is not null)
    );

alter table public.work_board_items validate constraint work_board_items_on_you_is_ready;
