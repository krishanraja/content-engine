-- What kind of thing each Inspiration card is, so each is asked only its own question and its inspiration goes where
-- that kind belongs. Krish, 2026-10-24: "if I post a video in here, it's because I like either the script, the
-- narrative, or the production style. When I post images in here, it's because I like the clarity." A sheet like
-- Instagram inspo "is always being updated and I likely want to pull the latest fresh posts", and a corpus is "all the
-- research from Perplexity" on an idea, "for a specific article or a specific content piece".
--
--   kind        video | image | feed (a sheet that keeps itself fresh) | corpus (research for one piece)
--               | idea (a seed or script for a piece) | document (anything else)
--   kind_source rule (the file proves it) | model (the tagger's reading) | krish (he set it on the page)
--   piece_id    the piece a corpus is for, set only when he confirms it; the tagger's guess stays in facets.piece_guess
--
-- A clear opinion about AI is not a kind: it rides on any card as facets.opinion {topic, stance}.
-- Written by the inspirationhouse tagger and Control Center's /api/inspiration; nothing here is ever deleted.

alter table public.inspiration_items
  add column kind text check (kind is null or kind in ('video', 'image', 'feed', 'corpus', 'idea', 'document')),
  add column kind_source text check (kind_source is null or kind_source in ('rule', 'model', 'krish')),
  add column piece_id uuid references public.content_ideas (id) on delete set null;

alter table public.inspiration_items
  add constraint inspiration_items_kind_has_source check ((kind is null) = (kind_source is null));

-- A corpus is answered by naming its piece, with no words needed.
alter table public.inspiration_items drop constraint inspiration_items_answered_has_words;
alter table public.inspiration_items add constraint inspiration_items_answered_has_words check (
  answered_at is null or coalesce(why_here, why_like, would_do) is not null or route is not null
  or cardinality(routes) > 0 or cardinality(picked_likes) > 0 or piece_id is not null);

create index inspiration_items_kind_idx on public.inspiration_items (kind) where dismissed_at is null;
create index inspiration_items_piece_idx on public.inspiration_items (piece_id) where piece_id is not null;

-- What a feed holds, for its card: the posts the taste ledger read from it (one taste_evidence row per post version,
-- source drive_cold, source_ref instagram:<post id>), counted once each, how many arrived in the last week, and the
-- newest. Read by Control Center's /api/inspiration.
create view public.inspiration_feed_stats with (security_invoker = on) as
select count(distinct source_ref)::int as posts,
       (count(distinct source_ref) filter (where occurred_at > now() - interval '7 days'))::int as fresh,
       max(occurred_at) as newest
from public.taste_evidence
where source = 'drive_cold' and source_ref like 'instagram:%';
