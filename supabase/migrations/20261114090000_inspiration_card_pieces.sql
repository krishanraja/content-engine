-- Which piece each Inspiration card became, and whether it published.
--
-- Krish, 2026-10-26: "start the two-way build in a fresh session" (krishanraja/inspirationhouse docs/TWO_WAY.md, step
-- 3: content-engine writes back which piece a card became and whether it published). Before this the engine told the
-- taste ledger only that a Sunday plan took a card (routed_at); which piece it became was in a week's ideas.json and
-- nowhere a reader could join.
--
-- Two ways a card becomes a piece, both already recorded, now read in one place:
--   krish  he named the piece on the card himself (inspiration_items.piece_id, a corpus's piece, set only by his press)
--   plan   a Sunday plan offered the piece as answering the card (the board idea's `covers`, kept on the piece as
--          content_ideas.meta.covers by week_start, {"<Monday>": [ids]}, by POST /api/week/options, never cleared), and
--          he picked it for that week: the piece is in a picked state (drafting, review, approved or published;
--          api/week/options.ts PICKED_STATES) and scheduled inside that week (Monday to Sunday). An option offered in a
--          week he picked another piece for never makes the card this piece's, whatever becomes of it later.
-- A buried piece became nothing. `published` is the piece's own published_at (the publish watcher sets it once the
-- Substack post is live).
--
-- A view, nothing stored: it changes with the rows it reads and can never disagree with them. Read by the
-- inspirationhouse engine and Control Center. Service role only, like the rest of the taste ledger.

begin;

create view public.inspiration_card_pieces with (security_invoker = on) as
with made as (
  select i.id as card_id, i.piece_id, 'krish'::text as basis
  from public.inspiration_items i
  where i.piece_id is not null
  union
  select i.id, c.id, 'plan'
  from public.content_ideas c
  cross join lateral jsonb_each(
    case when jsonb_typeof(c.meta -> 'covers') = 'object' then c.meta -> 'covers' else '{}'::jsonb end) as wk(week_start, ids)
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(wk.ids) = 'array' then wk.ids else '[]'::jsonb end) as cov(id)
  join public.inspiration_items i on i.id::text = cov.id
  where c.state in ('drafting', 'review', 'approved', 'published')
    -- A malformed key never casts (the CASE guards the cast; a WHERE gives no order).
    and case when wk.week_start ~ '^\d{4}-\d{2}-\d{2}$'
             then c.scheduled_for between wk.week_start::date and wk.week_start::date + 6
             else false end
)
select m.card_id,
       m.piece_id,
       -- krish wins when both say the same piece.
       min(m.basis) as basis,
       c.idea as piece,
       c.state,
       c.scheduled_for,
       c.published_at,
       c.published_at is not null as published
from made m
join public.content_ideas c on c.id = m.piece_id
where c.buried_at is null
group by m.card_id, m.piece_id, c.idea, c.state, c.scheduled_for, c.published_at;

comment on view public.inspiration_card_pieces is
  'Which piece each Inspiration card became (basis krish: he named it on the card; plan: a picked piece whose Sunday option covered the card, content_ideas.meta.covers) and whether it published. Nothing stored.';

revoke all on public.inspiration_card_pieces from public, anon, authenticated;
grant select on public.inspiration_card_pieces to service_role;

commit;
