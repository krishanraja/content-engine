-- A stand-in for the live content_ideas and its intake vocabularies, for the
-- manual-is-his-words replay on a clean Postgres (CI's control-plane-sql
-- job). content_ideas is created in neither repository's migrations, and
-- intake_owners and intake_sources are created in Control Center's
-- supabase/migrations/20260919120000_one_intake.sql (lines 75 to 109).
-- This copies their shape and seeds the owner and source slugs live has
-- (read 2026-10-13), less shift_write and pilot_build, which
-- 20261021080000_honest_sources.sql adds. Synthetic and minimal: no live row
-- is copied. The live tables already exist and are never touched by this file.
create table if not exists public.intake_owners (
  slug        text primary key,
  label       text not null,
  what        text not null,
  sort_order  int not null default 50
);

create table if not exists public.intake_sources (
  slug        text primary key,
  label       text not null,
  what        text not null,
  active      boolean not null default true,
  owner       text not null,
  formerly    text,
  sort_order  int not null default 50,
  created_at  timestamptz not null default now()
);

insert into public.intake_owners (slug, label, what, sort_order) values
  ('n8n',            'n8n',            'A synthetic owner row.', 10),
  ('content-engine', 'content-engine', 'A synthetic owner row.', 20),
  ('mm-ctrl',        'mm-ctrl',        'A synthetic owner row.', 30),
  ('manual',         'manual',         'A synthetic owner row.', 40),
  ('openclaw',       'openclaw',       'A synthetic owner row.', 50)
on conflict (slug) do nothing;

alter table public.intake_sources drop constraint if exists intake_sources_owner_fkey;
alter table public.intake_sources
  add constraint intake_sources_owner_fkey
  foreign key (owner) references public.intake_owners(slug) on update cascade;

insert into public.intake_sources (slug, label, what, active, owner)
select s.slug, s.slug, 'A synthetic source row.', s.active, s.owner
  from (values
    ('aeo_signal', 'content-engine', true), ('build_signal', 'content-engine', true),
    ('creator_move', 'content-engine', true), ('drive_files', 'content-engine', true),
    ('pool_headline', 'content-engine', true), ('week_research', 'content-engine', true),
    ('manual', 'manual', true), ('requested_research', 'manual', false),
    ('mm_ctrl_gather', 'mm-ctrl', false),
    ('agatha_chat', 'n8n', false), ('cleo_chat', 'n8n', false), ('crm_opportunity', 'n8n', false),
    ('customer_voice', 'n8n', false), ('gmail_newsletters', 'n8n', true),
    ('hunter_newsletter_posts', 'n8n', false), ('inspiration_sweep', 'n8n', true),
    ('lane_sourcing', 'n8n', true), ('signal_inbox', 'n8n', false), ('synthesis', 'n8n', false),
    ('synthesis_hypothesis', 'n8n', true), ('zara_signal', 'n8n', false),
    ('events_attend', 'openclaw', true), ('openclaw_workspace', 'openclaw', false)
  ) as s(slug, owner, active)
on conflict (slug) do nothing;

-- content_ideas may be a stand-in an earlier fixture created; give it the
-- columns the CHECK reads, as the live table has them.
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid()
);
alter table public.content_ideas add column if not exists source_type text;
alter table public.content_ideas add column if not exists source_ref text;
alter table public.content_ideas add column if not exists created_at timestamptz not null default now();
alter table public.content_ideas drop constraint if exists content_ideas_source_type_fkey;
alter table public.content_ideas
  add constraint content_ideas_source_type_fkey
  foreign key (source_type) references public.intake_sources(slug) on update cascade;
