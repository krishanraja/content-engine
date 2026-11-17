-- A card can teach a thumbnail: `thumbnail` joins the roles an Inspiration card teaches and a card use serves.
--
-- Krish, 2026-11-17: "The stories I get recommended, the caption styles, motion styles I get recommended, the narrative
-- styles I get recommended, and the content pieces that I want to write next should all be propagating from this engine
-- being really intelligent at understanding my feedback and what I'm putting in." inspirationhouse's tagger (tag-v4,
-- krishanraja/inspirationhouse #54) reads every card into this repository's style vocabulary (facets.style) and keeps
-- `thumbnail` only there, because inspiration_items_teaches_check refused it. His thumbnail study set (a collection, e.g.
-- "VEED Studio - Instagram Thumbnail Study") is what thumbnail-designer reads as its reference set before drawing
-- (GET /api/inspiration/candidates?role=thumbnail), and a thumbnail a card shaped is recorded as a card use like any
-- other role.
--
--   inspiration_items.teaches   may now hold thumbnail (seven roles, at most seven).
--   card_uses.role              may now be thumbnail.
--
-- Widening only: every row the old checks allowed still passes. Nothing is deleted or rewritten. Idempotent: safe to run
-- twice. Nothing here is applied by a session; the parent session applies it.

alter table public.inspiration_items drop constraint if exists inspiration_items_teaches_check;
alter table public.inspiration_items add constraint inspiration_items_teaches_check
  check (teaches <@ array['look', 'motion', 'captions', 'hook', 'pacing', 'layout', 'thumbnail']::text[] and cardinality(teaches) <= 7);

-- The role check was written inline in 20261122090000, so Postgres named it card_uses_role_check.
alter table public.card_uses drop constraint if exists card_uses_role_check;
alter table public.card_uses add constraint card_uses_role_check
  check (role in ('look', 'motion', 'captions', 'hook', 'pacing', 'layout', 'thumbnail'));

comment on column public.inspiration_items.teaches is
  'What a cut can learn from the card (look, motion, captions, hook, pacing, layout, thumbnail); teaches_source says whether Krish said it or the engine guessed.';
