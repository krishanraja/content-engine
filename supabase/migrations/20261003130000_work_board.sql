-- The work board: what is waiting on Krish, what is in progress, what is done.
--
-- Krish, 2026-10-03: "I need the boards to not be Claude pages, but accessible
-- by Codex too and workable using Codex too". Until now the board lived in a
-- Claude page that only Claude sessions could write. These three tables hold it
-- in the shared database instead: Control Center shows it (on the phone too),
-- and any agent session, Claude Code or Codex, reads and writes it through
-- /api/workbench with the engine key.
--
-- Only the service role touches these tables. Krish reaches them through the
-- engine route with his Control Center cookie; agents with the engine key. His
-- replies are written only from the cookie: an agent cannot put words in his
-- mouth (AGENTS.md, "Krish decides").

create table if not exists public.work_board_items (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  lane text not null check (lane in ('on_you', 'in_progress', 'done', 'archived')),
  rank integer not null default 50 check (rank between 0 and 999),
  area text not null default '' check (char_length(area) <= 80),
  title text not null check (char_length(title) between 1 and 200),
  detail text not null default '' check (char_length(detail) <= 2000),
  link text check (link is null or (link ~ '^https://' and char_length(link) <= 500)),
  link_label text check (link_label is null or char_length(link_label) <= 60),
  prompt text check (prompt is null or char_length(prompt) <= 120),
  updated_by text not null default 'agent' check (char_length(updated_by) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_board_items_lane_rank_idx
  on public.work_board_items (lane, rank, updated_at desc);

create table if not exists public.work_board_replies (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.work_board_items(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  by text not null default 'Krish' check (by = 'Krish'),
  at timestamptz not null default now(),
  seen_at timestamptz,
  seen_by text check (seen_by is null or char_length(seen_by) <= 40)
);

create index if not exists work_board_replies_item_idx
  on public.work_board_replies (item_id, at desc);
create index if not exists work_board_replies_unseen_idx
  on public.work_board_replies (at desc) where seen_at is null;

create table if not exists public.work_board_state (
  id text primary key default 'board' check (id = 'board'),
  headline text not null default '' check (char_length(headline) <= 400),
  signals jsonb not null default '[]'::jsonb check (jsonb_typeof(signals) = 'array'),
  updated_by text not null default 'agent' check (char_length(updated_by) <= 40),
  updated_at timestamptz not null default now()
);

insert into public.work_board_state (id) values ('board') on conflict (id) do nothing;

alter table public.work_board_items enable row level security;
alter table public.work_board_replies enable row level security;
alter table public.work_board_state enable row level security;

revoke all on public.work_board_items from anon, authenticated;
revoke all on public.work_board_replies from anon, authenticated;
revoke all on public.work_board_state from anon, authenticated;
