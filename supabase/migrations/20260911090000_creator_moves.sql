-- The creator move becomes a record instead of a field nothing reads.
--
-- The Tuesday scout already extracts the transferable move from a curated
-- creator's post: hook type, structure, named concept, proof pattern, CTA. It
-- writes that to content_ideas.meta.move, where nothing has ever read it. So
-- the engine has been paying Sonnet to describe what works about a post and
-- then throwing the description away, while the same post arriving as a
-- screenshot minted a second row under a different source_type with no idea the
-- scout had already seen it.
--
-- Three things this makes possible, none of which the meta field could:
--
--   Both lanes dedupe against each other. The scout and the Drive screenshot
--   lane now write the same creator_moves row, keyed by the post. Krish
--   screenshotting a post the scout already found is one move, not two ideas.
--
--   A move has an outcome. seeded, advanced, published or buried, kept current
--   by a trigger on content_ideas. Without it there is no way to know which
--   creator's moves actually convert, and creator_yield below is the same
--   question newsletter_source_yield already answers for newsletters.
--
--   The excerpt is stored deliberately and bounded, so a later "shape like this"
--   edit can be checked against the source for verbatim overlap rather than
--   trusting a prompt not to plagiarise.
--
-- ANTI-ECHO. A move records FORM: the hook, the structure, the proof device.
-- Nothing here records what the post was about, and creator_yield ranks
-- creators by whether their moves convert, never by subject.

create table if not exists public.creator_moves (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.content_creators(id) on delete set null,
  creator_slug text,
  post_url text not null,
  -- sha256 of the normalised post text. Two screenshots of one post, or a
  -- scrape and a screenshot of one post, collapse here.
  post_hash text not null,
  move jsonb not null default '{}'::jsonb,
  why_it_works text,
  krish_angle text,
  -- Bounded at 400 chars by the writers, the same bound content_ideas.
  -- source_snippet already uses. This is the text a verbatim check compares
  -- against; it is not a copy of the post.
  excerpt text,
  -- Which lane saw it: the Tuesday scrape or a screenshot Krish saved.
  seen_via text not null default 'scout',
  content_idea_id uuid references public.content_ideas(id) on delete set null,
  outcome text not null default 'seeded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creator_moves_post_hash_uq on public.creator_moves (post_hash);
create index if not exists creator_moves_creator_idx on public.creator_moves (creator_id, created_at desc);
create index if not exists creator_moves_idea_idx on public.creator_moves (content_idea_id) where content_idea_id is not null;

alter table public.creator_moves enable row level security;

drop policy if exists creator_moves_read on public.creator_moves;
create policy creator_moves_read on public.creator_moves for select to anon, authenticated using (true);

-- The outcome follows the idea, so nobody has to remember to update it. A move
-- whose idea is binned is buried; one that reaches drafting or beyond has
-- advanced; one that published, published.
create or replace function public.creator_moves_track_outcome()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.creator_moves m
     set outcome = case
           when new.published_at is not null then 'published'
           when new.buried_at is not null then 'buried'
           when new.state in ('drafting', 'review', 'approved') then 'advanced'
           else m.outcome
         end,
         updated_at = now()
   where m.content_idea_id = new.id;
  return new;
end $$;

-- Not an RPC. A trigger function reachable at /rest/v1/rpc is a write primitive
-- pointed at the ledger, which is exactly what the advisor flagged on the edit
-- ledger's triggers in the same week.
revoke execute on function public.creator_moves_track_outcome() from public, anon, authenticated;

drop trigger if exists trg_creator_moves_track_outcome on public.content_ideas;
create trigger trg_creator_moves_track_outcome
  after update of state, buried_at, published_at on public.content_ideas
  for each row execute function public.creator_moves_track_outcome();

-- The creator equivalent of newsletter_source_yield, and read the same way: a
-- creator whose last several moves were all buried gets a higher bar, never a
-- deletion. Krish curated these people; the engine's job is to notice which of
-- their moves travel, not to overrule the list.
create or replace view public.creator_yield as
select
  c.id                                                        as creator_id,
  c.slug,
  c.name,
  count(m.*)                                                  as moves,
  count(*) filter (where m.outcome = 'advanced')              as advanced,
  count(*) filter (where m.outcome = 'published')             as published,
  count(*) filter (where m.outcome = 'buried')                as buried,
  count(*) filter (where m.seen_via = 'screenshot')           as saved_by_krish,
  max(m.created_at)                                           as last_move_at
from public.content_creators c
left join public.creator_moves m on m.creator_id = c.id
group by c.id, c.slug, c.name;

alter view public.creator_yield set (security_invoker = true);

-- Deliberately NOT added here: substack_url and rss_url. Not every creator
-- worth reading posts on LinkedIn, and the scout's only source is an Apify
-- actor that costs money per run, so a free feed is the obvious next source.
-- But a column nothing reads is the exact fault this table exists to fix
-- (meta.move was written for weeks and read by nothing), so those columns
-- arrive with the reader that uses them and not before.
