-- The edit ledger learns from the publish board.
--
-- Krish, 2026-10-21: "I need to be able to comment on them to iterate or just
-- edit in line myself and save changes to get picked up. The system needs to
-- not just capture it but learn why I'm giving that feedback and figure out
-- what patterns it's observing." His saves on the week's publish board
-- (content.krishraja.com, edits/<day>-<item>) never reached
-- content_edit_events, so the weekly compiler (api/learning/compile.ts) never
-- saw them. A session now relays each one after scripts/post-pack/edit_sweep.py
-- has classified it: surface 'publish_board', action 'manual_edit', actor
-- Krish (decided_by: 'Krish', his own saved words), reason_code the class
-- (number_fact, claim, structure, tone or wording). api/_editEvents.ts admits
-- the surface; this lets the table take it.
--
-- The CHECK is replaced, not loosened: the same surfaces as before plus one.
-- content_edit_events stays append-only (its trigger is untouched: altering a
-- constraint changes no row). Every stored row already passes the new CHECK,
-- because it is the old one with one more value.
--
-- Run twice, it changes nothing the second time.

alter table public.content_edit_events drop constraint if exists content_edit_events_surface_check;
alter table public.content_edit_events add constraint content_edit_events_surface_check
  check (surface in ('composer', 'brief_editor', 'mobile_deck', 'video_review', 'carousel_review', 'triage', 'api', 'publish_board'));
