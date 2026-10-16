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
--              week_planned for the week's planning item, whose id is
--              week-<its Monday>: Control Center closes the week by that id,
--              so the week's close on any other item would never fire);
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
--    as control_center, with its detail starting "Held from your list on
--    <date>: it ..." and the gates it fails, in Control Center's words for
--    them (its heldWhy: "does not need you", "is not ready for one press",
--    "does not say how it closes itself"), then the detail it had (cut to the
--    column's 2,000 characters). The default that stands (the step 2 plan,
--    question 2): a job only he can do that no machine can see finished stays
--    off his list until an agent gives it a check. On 12 October that was
--    you-launch-today, you-engine-github-key, you-welcome-days and
--    week-publish-board-2026-10-12.
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
      and case when closes_on = 'week_planned'
        then id ~ '^week-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        else idea_id is not null end
    )) not valid;
exception when duplicate_object then null; end $$;

with failing as (
  select id,
    array_remove(array[
      case when only_you is null then 'does not need you' end,
      case when link is null then 'is not ready for one press' end,
      case when closes_on is null
             or (closes_on = 'week_planned' and id !~ '^week-[0-9]{4}-[0-9]{2}-[0-9]{2}$')
             or (closes_on <> 'week_planned' and idea_id is null)
        then 'does not say how it closes itself' end
    ], null) as gates
  from public.work_board_items
  where lane = 'on_you'
)
update public.work_board_items b
  set lane = 'in_progress',
      updated_by = 'control_center',
      updated_at = now(),
      detail = case
        when b.detail like 'Held from your list on %' then b.detail
        else left(
          'Held from your list on '
            || to_char(now() at time zone 'America/New_York', 'FMDD FMMonth')
            || ': it '
            || case cardinality(f.gates)
                 when 1 then f.gates[1]
                 when 2 then f.gates[1] || ' and ' || f.gates[2]
                 else f.gates[1] || ', ' || f.gates[2] || ' and ' || f.gates[3]
               end
            || '.'
            || case when b.detail = '' then '' else ' ' || b.detail end,
          2000)
      end
  from failing f
  where b.id = f.id and cardinality(f.gates) > 0;

alter table public.work_board_items validate constraint work_board_items_on_you_is_ready;
