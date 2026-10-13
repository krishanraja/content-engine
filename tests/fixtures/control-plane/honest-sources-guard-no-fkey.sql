-- Guard case: the owner foreign key is missing. The honest-sources migration
-- must refuse to commit (CI expects it to fail after this file).
alter table public.intake_sources drop constraint if exists intake_sources_owner_fkey;
