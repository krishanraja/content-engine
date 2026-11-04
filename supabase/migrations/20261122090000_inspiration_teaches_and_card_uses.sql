-- What each Inspiration card teaches a cut, and every cut it shaped.
--
-- Krish, 2026-11-03: "I'm also still a bit disappointed with how poorly the inspiration board is used right now."
-- Before this a spec named a card by its file name and nothing checked it was on the board, nothing said what a card
-- was for beyond its platform and creator, and no card knew which cut it shaped, how the Critic scored that cut
-- against it, or whether the piece published (docs/handovers/2026-11-03-engine-audit.md, Wave 3).
--
--   teaches         what a cut can learn from the card: look, motion, captions, hook, pacing, layout. Read by
--                   GET /api/inspiration/candidates to offer cards for a role.
--   teaches_source  krish (he said it on the page) or engine_guess (the engine's reading, a guess until he answers;
--                   silence is not feedback). Set together with teaches, never alone.
--
--   card_uses       one row per card, per spec, per cut, per role: written by `ve verdict` through
--                   POST /api/inspiration/uses with the Critic's score against that card; `published` turns true when
--                   the piece's making record gets a posted channel (api/content-ideas/[id]/making.ts).
--                   krish_verdict is his words on the use, and only his.
--
-- Nothing here is ever deleted. Service role only, like the rest of the taste ledger. Idempotent: safe to run twice.
-- Nothing here is applied by a session; the parent session applies it.

alter table public.inspiration_items
  add column if not exists teaches text[] not null default '{}',
  add column if not exists teaches_source text;

alter table public.inspiration_items drop constraint if exists inspiration_items_teaches_check;
alter table public.inspiration_items add constraint inspiration_items_teaches_check
  check (teaches <@ array['look', 'motion', 'captions', 'hook', 'pacing', 'layout']::text[] and cardinality(teaches) <= 6);
alter table public.inspiration_items drop constraint if exists inspiration_items_teaches_source_check;
alter table public.inspiration_items add constraint inspiration_items_teaches_source_check
  check (teaches_source is null or teaches_source in ('krish', 'engine_guess'));
alter table public.inspiration_items drop constraint if exists inspiration_items_teaches_has_source;
alter table public.inspiration_items add constraint inspiration_items_teaches_has_source
  check ((cardinality(teaches) = 0) = (teaches_source is null));

create index if not exists inspiration_items_teaches_idx on public.inspiration_items using gin (teaches)
  where dismissed_at is null and lane = 'production';

create table if not exists public.card_uses (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.inspiration_items (id) on delete restrict,
  -- The piece (content_ideas.id), read from the plan folder's post.json; null when the spec's folder names none yet.
  piece_id uuid references public.content_ideas (id) on delete set null,
  spec_path text not null check (char_length(spec_path) between 1 and 300),
  cut text not null default '' check (char_length(cut) <= 40),
  role text not null check (role in ('look', 'motion', 'captions', 'hook', 'pacing', 'layout')),
  critic_score numeric check (critic_score is null or (critic_score >= 0 and critic_score <= 10)),
  published boolean not null default false,
  krish_verdict text check (krish_verdict is null or char_length(krish_verdict) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A verdict written again for the same cut replaces its score; it never adds a second use.
  constraint card_uses_one_per_role unique (card_id, spec_path, cut, role)
);

create index if not exists card_uses_card_idx on public.card_uses (card_id);
create index if not exists card_uses_piece_idx on public.card_uses (piece_id) where piece_id is not null;

alter table public.card_uses enable row level security;
revoke all on public.card_uses from public, anon, authenticated;
grant select, insert, update on public.card_uses to service_role;
drop policy if exists card_uses_service_all on public.card_uses;
create policy card_uses_service_all on public.card_uses for all to service_role using (true) with check (true);

comment on table public.card_uses is
  'Every cut an Inspiration card shaped: the spec and cut, the role it served, the Critic''s score against it, whether the piece published, and Krish''s verdict (his words only). Written by ve verdict through POST /api/inspiration/uses.';
comment on column public.inspiration_items.teaches is
  'What a cut can learn from the card (look, motion, captions, hook, pacing, layout); teaches_source says whether Krish said it or the engine guessed.';
