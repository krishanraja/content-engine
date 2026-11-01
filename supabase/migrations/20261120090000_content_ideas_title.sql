-- One title of record for every piece.
--
-- Krish, 2026-10-31: the publish board's titles did not match the article's.
-- The board named a day from content_ideas.idea, the original pitch, which is
-- never updated once he picks his title. This column holds the title of
-- record: his long_title pick on the board's Titles press (the board API
-- writes it, apps/control-plane/api/board/_presses.ts afterPress), or the
-- article title a session records. GET /api/week/options exposes it as
-- scheduled[].title, and week_board.py prefers it over idea.
--
-- Nullable: a piece without a picked title keeps showing its idea. Safe to run
-- again.

alter table public.content_ideas add column if not exists title text;

comment on column public.content_ideas.title is
  'The title of record (Krish''s long_title pick on the publish board, or the published article title); null until picked. The board shows it over idea.';
