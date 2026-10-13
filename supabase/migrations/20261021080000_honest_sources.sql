-- Honest sources (2026-10-13): every writer of content_ideas names itself.
--
-- Step 3 of the design entropy session, PR 1 (Control Center,
-- docs/handoff/design-entropy-session/step3-plan.md). Until now
-- POST /api/content-ideas stored any missing or unknown source_type as
-- 'manual', and GET /api/week/options reports every manual row as an idea
-- Krish dropped in. Two writers that are not his words wrote 'manual' too:
-- the shift card's "Write from this shift" (apps/control-plane/api/shifts/
-- [id]/write.ts) and Control Center's pilot builder (api/pilot/build-one.ts).
-- Each gets its own source here, so 'manual' can come to mean his words only.
--
-- content_ideas.source_type is a foreign key to intake_sources.slug, and
-- intake_sources.owner is a foreign key to intake_owners.slug. No owner names
-- Control Center (live on 2026-10-13: n8n, content-engine, mm-ctrl, manual,
-- openclaw), and the owner row says who writes. So the owner row comes first.
--
-- This file only adds rows. It changes no constraint and no existing row.
-- The engine's code that writes 'shift_write' must deploy after this is
-- applied, or a shift card's write fails the foreign key.

begin;

insert into public.intake_owners (slug, label, what, sort_order) values
  ('control-center', 'control-center',
   'A Vercel route in Control Center (krishanraja/control-center) that writes the shared database directly, not through the engine.',
   60)
on conflict (slug) do nothing;

insert into public.intake_sources (slug, label, what, active, owner, formerly, sort_order) values
  ('shift_write', 'Shift write',
   'A piece started from a shift card ("Write from this shift", apps/control-plane/api/shifts/[id]/write.ts). It carries the shift''s dated evidence as its materials.',
   true, 'content-engine', 'content_ideas.source_type = manual, source_ref = shift:<slug>', 120),
  ('pilot_build', 'Pilot build',
   'A draft piece the pilot builder made from an ask (Control Center, api/pilot/build-one.ts). It writes the table directly.',
   true, 'control-center', 'content_ideas.source_type = manual, from api/pilot/build-one.ts', 130)
on conflict (slug) do nothing;

-- Read back inside the same transaction: both rows exist, each owner row
-- resolves, and the owner foreign key is still the one the rows rely on.
do $$
declare
  n int;
begin
  select count(*) into n
    from public.intake_sources s
    join public.intake_owners o on o.slug = s.owner
   where s.slug in ('shift_write', 'pilot_build');
  if n <> 2 then
    raise exception 'honest_sources: expected 2 sources with an owner row, found %', n;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'intake_sources_owner_fkey'
       and conrelid = 'public.intake_sources'::regclass
       and contype = 'f'
  ) then
    raise exception 'honest_sources: intake_sources_owner_fkey is missing';
  end if;
end
$$;

commit;
