-- Manual is his words (step 3 of the design entropy session, PR 6).
--
-- GET /api/week/options reports every 'manual' idea as one Krish dropped in.
-- So 'manual' must mean his words and nothing else. Control Center's filer is
-- the only writer of it: it files an idea he said and names the part as
-- source_ref 'said:<said_parts id>'. POST /api/content-ideas refuses a manual
-- idea without that ref (400 manual_needs_his_words). This CHECK refuses the
-- same at write, for every writer, including a direct insert (an n8n node, an
-- agent session, a Control Center route that skips the engine).
--
-- Rows from before 2026-10-13 pass on their date. That day the honest-sources
-- migration (20261021080000) gave the shift card and the pilot builder their
-- own sources, and live then held one manual row (2026-09-23), with its own
-- provenance ref. It keeps it untouched. The plan named 2026-10-21 as the
-- cutoff; that is a future date, so a new manual row with no ref would pass
-- until then. The cutoff is the day manual stopped being a default instead.
--
-- source_ref is wrapped in coalesce: a CHECK passes when it evaluates to
-- null, so a manual row with a null ref would otherwise pass. source_type is
-- compared with "is distinct from" for the same reason.
--
-- Added NOT VALID: existing rows are not scanned now. Step 3 PR 8 validates
-- it once the engine log shows no manual_needs_his_words for 7 days.
--
-- Run twice, it changes nothing the second time.

begin;

alter table public.content_ideas drop constraint if exists content_ideas_manual_is_his_words;

alter table public.content_ideas add constraint content_ideas_manual_is_his_words
  check (source_type is distinct from 'manual'
         or coalesce(source_ref, '') ~ '^said:[0-9a-f-]{36}$'
         or created_at < timestamptz '2026-10-13 00:00:00+00') not valid;

-- Read back inside the same transaction: the constraint is there, is a
-- CHECK, and is not yet validated.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'content_ideas_manual_is_his_words'
       and conrelid = 'public.content_ideas'::regclass
       and contype = 'c'
       and not convalidated
  ) then
    raise exception 'manual_is_his_words: the NOT VALID check is missing';
  end if;
end
$$;

commit;
