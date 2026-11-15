-- The weekly standards check-in (Ruling, Krish, 2026-11-15: the weekly standards check-in is one pinned claude.ai
-- artifact refreshed weekly, an exception to "No Claude artifact, ever").
--
--   standards_checkins           one row per weekly build: the week it covers, when it was built, and the payload the
--                                page shows (new floor standards proposed into groups, evolutions of decided groups,
--                                and for each item why: his quotes, the piece, up to two stills). Written by
--                                scripts/standards_checkin.py in .github/workflows/standards-checkin.yml, code only.
--   standards_checkin_decisions  his answers on a check-in, one per item, relayed from the page: the choice (approve,
--                                corrected, reject or amend), its label, his words for a correction or amendment, a
--                                note. The next build applies each through the one decision write (status only while
--                                proposed, decided_by 'Krish') and stamps applied_at and applied_result.
--
-- Service role only, like the taste tables. Nothing here is ever deleted. Idempotent: safe to run twice.

begin;

create table if not exists public.standards_checkins (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  built_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.standards_checkin_decisions (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.standards_checkins (id) on delete restrict,
  item_key text not null check (item_key ~ '^(group|evolution|standard):[A-Za-z0-9_]{1,80}$'),
  choice text not null check (choice in ('approve', 'corrected', 'reject', 'amend')),
  label text,
  words text check (words is null or char_length(btrim(words)) between 8 and 800),
  note text check (note is null or char_length(note) <= 2000),
  decided_at timestamptz not null default now(),
  decided_by text not null check (decided_by = 'Krish'),
  applied_at timestamptz,
  applied_result text,
  created_at timestamptz not null default now(),
  constraint standards_checkin_decisions_words_needed check (choice not in ('corrected', 'amend') or words is not null),
  constraint standards_checkin_decisions_no_long_dash check (
    strpos(coalesce(words, ''), chr(8212)) = 0 and strpos(coalesce(words, ''), chr(8211)) = 0),
  unique (checkin_id, item_key)
);

create index if not exists standards_checkin_decisions_open_idx
  on public.standards_checkin_decisions (decided_at) where applied_at is null;

alter table public.standards_checkins enable row level security;
alter table public.standards_checkin_decisions enable row level security;
revoke all on public.standards_checkins from public, anon, authenticated;
revoke all on public.standards_checkin_decisions from public, anon, authenticated;
grant select, insert, update on public.standards_checkins to service_role;
grant select, insert, update on public.standards_checkin_decisions to service_role;
revoke delete, truncate on public.standards_checkins from service_role;
revoke delete, truncate on public.standards_checkin_decisions from service_role;

drop policy if exists standards_checkins_service_all on public.standards_checkins;
create policy standards_checkins_service_all on public.standards_checkins
  for all to service_role using (true) with check (true);
drop policy if exists standards_checkin_decisions_service_all on public.standards_checkin_decisions;
create policy standards_checkin_decisions_service_all on public.standards_checkin_decisions
  for all to service_role using (true) with check (true);

commit;
