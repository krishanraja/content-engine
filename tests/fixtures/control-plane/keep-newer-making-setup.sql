-- A stand-in content_ideas for the keep-newer-making regression on a clean
-- Postgres (CI's control-plane-sql job): only the columns the trigger and
-- the regression touch. The live table already exists and is never touched
-- by this file.
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  state text,
  meta jsonb,
  updated_at timestamptz not null default now()
);
