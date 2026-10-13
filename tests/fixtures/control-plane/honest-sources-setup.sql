-- A stand-in for the intake vocabularies Control Center's
-- supabase/migrations/20260919120000_one_intake.sql creates, for the
-- honest-sources replay on a clean Postgres (CI's control-plane-sql job):
-- intake_owners, intake_sources with its owner foreign key, the owner and
-- source rows the replay needs, and content_ideas.source_type with its
-- foreign key. Synthetic and minimal. The live tables already exist and are
-- never touched by this file.
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

alter table public.intake_sources drop constraint if exists intake_sources_owner_fkey;
delete from public.intake_sources where slug in ('shift_write', 'pilot_build');
delete from public.intake_owners where slug = 'control-center';

insert into public.intake_owners (slug, label, what, sort_order) values
  ('content-engine', 'content-engine', 'A synthetic owner row.', 20),
  ('manual',         'manual',         'A synthetic owner row.', 40)
on conflict (slug) do nothing;

alter table public.intake_sources
  add constraint intake_sources_owner_fkey
  foreign key (owner) references public.intake_owners(slug) on update cascade;

insert into public.intake_sources (slug, label, what, owner) values
  ('manual', 'Manual', 'A synthetic source row.', 'manual')
on conflict (slug) do nothing;

-- content_ideas is the stand-in an earlier fixture created; give it the
-- column and the foreign key the live table has.
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid()
);
alter table public.content_ideas add column if not exists source_type text;
alter table public.content_ideas add column if not exists source_ref text;
alter table public.content_ideas drop constraint if exists content_ideas_source_type_fkey;
alter table public.content_ideas
  add constraint content_ideas_source_type_fkey
  foreign key (source_type) references public.intake_sources(slug) on update cascade;
