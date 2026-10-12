-- Board items remember who closed them.
--
-- An item Krish closed himself (his Clear or Purge in Control Center, or a
-- close an agent relays from his words with decided_by 'Krish') stays closed:
-- the engine key cannot move it back to on_you or in_progress
-- (apps/control-plane/api/workbench.ts, 409 krish_closed_it). That rule used to
-- read updated_by, the last writer, so one in-place edit by an agent (a detail,
-- or done to archived) made the agent the last writer and let the next agent
-- write reopen it.
--
-- closed_by  who moved the item into done or archived: 'Krish', an agent's
--            client, a Control Center job, or the engine's own close
--            (_boardClose.ts). Set when an item moves from an open lane into a
--            closed one, kept through later edits and through done to
--            archived (unless Krish makes that move himself), and cleared when
--            the item moves back to an open lane.
--
-- The backfill takes updated_by for every closed row, the best record there
-- is of who closed it. Idempotent; additive.

alter table public.work_board_items
  add column if not exists closed_by text;

update public.work_board_items
  set closed_by = updated_by
  where lane in ('done', 'archived') and closed_by is null;
