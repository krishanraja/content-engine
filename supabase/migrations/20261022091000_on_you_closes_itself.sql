-- An item on Krish says how it ends, in a way a check or he can end it.
--
-- Krish, 2026-10-11: "I am happy to Clear(complete)/Bump/Purge things off
-- my lists as I go but the rest should be automatically done." Applied after
-- the engine code that knows the new kinds is live
-- (apps/control-plane/api/workbench.ts refuses the same writes first, by
-- name). It needs 20261022090000_board_close_columns.sql.
--
-- The rule on lane on_you is rewritten per kind: a reason only he can do it,
-- an https link, and a closes_on that is never work a session holds
-- (session) or a machine question (post_matched, take_placed), carrying what
-- its kind needs (board_close_ref_ok: a piece's step names the piece, the
-- week's kinds sit on the week's own item, a share image names the post and
-- the image it had, a job names itself and a time).
--
-- Every row on him today passes it (on 12 October: a step of a piece each).
-- Safe to run again: the constraint is dropped and added the same way, then
-- validated.

alter table public.work_board_items drop constraint if exists work_board_items_on_you_is_ready;
alter table public.work_board_items
  add constraint work_board_items_on_you_is_ready
  check (lane <> 'on_you' or (
    only_you is not null
    and link is not null
    and closes_on is not null
    and closes_on not in ('session','post_matched','take_placed')
    and public.board_close_ref_ok(closes_on, close_ref, idea_id, id))) not valid;
alter table public.work_board_items validate constraint work_board_items_on_you_is_ready;
