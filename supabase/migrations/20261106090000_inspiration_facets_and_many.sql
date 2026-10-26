-- What a saved inspiration file is, read as fully as the engine can, and answers that hold more than one pick.
--
-- Krish, 2026-10-24: "You should be auto-tagging as much as humanly possible and watching videos when they come in
-- because I think a lot of the important stuff in the content here is: where it came from, who it's about, what
-- format it's in, Is it video? Is it a picture? Is it a carousel? What social platform is it on?" and "I want to be
-- able to click more than one of the click chips."
--
-- facets: the taste ledger's reading of the file (inspirationhouse, tag-v2): platform, format, media, source,
--   creator, people, organisations, topics, duration and whether it was watched. A guess, labelled as one, like
--   auto_tags; never his answer.
-- transcript: the words of a video the ledger watched (speech to text on its runner), for every later reader.
-- picked_likes: the guessed reasons he tapped, several allowed; his typed words stay in why_like.
-- routes: every place he sends it, several allowed. `route` keeps the first, so older readers still work.

alter table public.inspiration_items
  add column facets jsonb not null default '{}'::jsonb check (jsonb_typeof(facets) = 'object'),
  add column tag_rev text check (tag_rev is null or char_length(tag_rev) <= 40),
  add column transcript text check (transcript is null or char_length(transcript) <= 20000),
  add column watched_at timestamptz,
  add column picked_likes text[] not null default '{}' check (cardinality(picked_likes) <= 6),
  add column routes text[] not null default '{}'
    check (routes <@ array['study_style', 'make_piece', 'visibility', 'taste_only']::text[]);

-- The cards answered before today carry their one route in both places.
update public.inspiration_items set routes = array[route] where route is not null and routes = '{}';
-- And a tapped reason saved as why_like before picked_likes existed is a pick.
update public.inspiration_items set picked_likes = array[why_like] where why_like_source = 'picked' and picked_likes = '{}';

-- An answer may now be only picks.
alter table public.inspiration_items drop constraint inspiration_items_answered_has_words;
alter table public.inspiration_items add constraint inspiration_items_answered_has_words check (
  answered_at is null or coalesce(why_here, why_like, would_do) is not null or route is not null
  or cardinality(routes) > 0 or cardinality(picked_likes) > 0
);
