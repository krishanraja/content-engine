-- Reference material on the taste ledger (Krish, 2026-11-18: record hygiene he approved).
--
-- The 17 Nov Instagram profile-grid backfill filed 3,682 posts of other accounts into taste_evidence (source
-- drive_cold, refs instagram:, attribution observation, venture publication, one collector run). They are other people's
-- posts: context at most, never his signal. withdrawn_at cannot hold that, for two reasons. It means a row taken back,
-- and the Instagram collector restores a withdrawn row it reads again (inspirationhouse src/evidence.ts,
-- withdrawUncollected), so a withdrawal would be undone by the next run.
--
-- So a row can be marked reference material: kept whole, in its venture, never deleted, and left out of anything that
-- counts his signal. reference_at says when, reference_note why. Readers that should skip it (inspirationhouse's
-- distil, repeats and explain reads) add `reference_at is null` in a change of their own; this migration only records
-- the mark. Nothing here moves a row between ventures, and the venture trigger is untouched.

alter table public.taste_evidence
  add column if not exists reference_at timestamptz,
  add column if not exists reference_note text;

alter table public.taste_evidence
  add constraint taste_evidence_reference_note_check
    check (reference_note is null or (char_length(btrim(reference_note)) between 1 and 300)),
  add constraint taste_evidence_reference_noted
    check ((reference_at is null) = (reference_note is null));

comment on column public.taste_evidence.reference_at is
  'When this row was marked reference material: kept, but never counted as Krish''s signal. Null for every row that counts.';

-- The 17 Nov backfill, by the same rule that found it: one run's Instagram posts, observations of Make Your Mind Up.
update public.taste_evidence
set reference_at = now(),
    reference_note = '17 Nov Instagram profile-grid backfill: other accounts'' posts, reference material only (Krish approved, 2026-11-18).'
where source = 'drive_cold'
  and source_ref like 'instagram:%'
  and attribution = 'observation'
  and venture = 'publication'
  and created_at >= '2026-11-17T00:00:00Z' and created_at < '2026-11-18T00:00:00Z'
  and reference_at is null;
