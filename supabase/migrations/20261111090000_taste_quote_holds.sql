-- His quote stays on its claim while the row it quotes is withdrawn, and a reader shows it only while that row stands.
-- And a claim he has been shown is never rewritten.
--
-- 20261110090000 dropped a claim's quote (krish, krish_source_id) the first time the claim was recounted after the
-- row it quotes was withdrawn. When that row stood again (he gave the answer back as it was, and inspirationhouse's
-- withdrawUncollected restored it), the next recount brought the claim's support back but not the quote: the quote
-- is a phrase the distiller picked out of his words, nothing kept it, and the excerpt alone cannot say which phrase it
-- was. The weekly distil puts one back only if the model drafts the very same claim and picks the same line again.
--
-- Now nothing is dropped. The trigger keeps the quote, and still refuses one that is not a verbatim excerpt of a cited
-- krish_words row (a withdrawal never changes an excerpt). Every reader shows it only while the very row it quotes
-- stands: taste_profile_current below, and ELIGIBLE_SQL in inspirationhouse src/publish/propose.ts, which already did.
-- So his words come back with his answer, and never from a guess. Nothing to backfill: read live 2026-10-26, no
-- evidence row had ever been restored, and no claim without a quote cited a withdrawn row of his words.
--
-- The weekly distil could rewrite a claim's evidence and quote after it was put to Krish, while he decided and after
-- he approved (inspirationhouse src/distil/claims.ts updated 'proposed' as well as 'candidate'), so an approved rule
-- could change its quote, support and confidence with no word from him. inspirationhouse now rewrites only a
-- candidate; this trigger refuses the rest, so no writer can. Once a claim is on a proposal its words, evidence and
-- quote are fixed; a recount (updated_at only) and a status change still pass. Read live 2026-10-26: no approved
-- claim, and no proposed claim rewritten yet.

create or replace function public.taste_claims_count_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unresolved integer;
  quoted text;
begin
  select count(*) into unresolved
  from unnest(new.evidence_ids || new.counterexample_ids) as e(id)
  where not exists (select 1 from public.taste_evidence t where t.id = e.id);
  if unresolved > 0 then
    raise exception 'taste_claims: % cited evidence id(s) do not exist', unresolved;
  end if;

  -- One source entry counts once, however many versions of it are cited, while any version of it stands.
  select count(distinct (t.source, t.source_ref)) into new.support_n
  from public.taste_evidence t
  where t.id = any(new.evidence_ids)
    and t.attribution in ('krish_words', 'krish_action')
    and exists (select 1 from public.taste_evidence s
                where s.source = t.source and s.source_ref = t.source_ref and s.withdrawn_at is null);

  select count(distinct (t.source, t.source_ref)) into new.counter_n
  from public.taste_evidence t
  where t.id = any(new.counterexample_ids)
    and t.attribution in ('krish_words', 'krish_action')
    and exists (select 1 from public.taste_evidence s
                where s.source = t.source and s.source_ref = t.source_ref and s.withdrawn_at is null);

  -- His quote is kept while its row is withdrawn; readers hide it until that row stands again.
  if new.krish is not null then
    select t.excerpt into quoted
    from public.taste_evidence t
    where t.id = new.krish_source_id
      and t.id = any(new.evidence_ids)
      and t.attribution = 'krish_words';
    if quoted is null or position(new.krish in quoted) = 0 then
      raise exception 'taste_claims: krish must be a verbatim excerpt of a cited krish_words evidence row';
    end if;
  end if;

  -- What he was shown is what he decides: a claim on a proposal is never rewritten. Nested, so OLD is read on an
  -- update only.
  if tg_op = 'UPDATE' then
    if old.proposal_id is not null and (
         new.statement is distinct from old.statement or new.why is distinct from old.why
      or new.means is distinct from old.means or new.flip_rule is distinct from old.flip_rule
      or new.lane is distinct from old.lane or new.layer is distinct from old.layer
      or new.kind is distinct from old.kind
      or new.evidence_ids is distinct from old.evidence_ids
      or new.counterexample_ids is distinct from old.counterexample_ids
      or new.krish is distinct from old.krish or new.krish_source_id is distinct from old.krish_source_id) then
      raise exception 'taste_claims: a claim on a proposal is never rewritten; draft a new claim instead';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- The same view, columns and order unchanged (taste_profile_form selects from it), with his quote shown only while the
-- row it quotes stands. A reword is his own words, so it is shown whatever became of the quote.
create or replace view public.taste_profile_current
with (security_invoker = true) as
select
  c.id,
  c.lane,
  c.layer,
  c.kind,
  -- A reword is his wording of the claim; it replaces the engine's.
  coalesce(p.decision_note, c.statement) as statement,
  coalesce(p.decision_note,
           case when exists (select 1 from public.taste_evidence k
                             where k.id = c.krish_source_id and k.withdrawn_at is null)
                then c.krish end) as krish,
  c.why,
  c.means,
  c.support_n,
  c.counter_n,
  c.confidence,
  p.status as decision,
  p.decided_at
from public.taste_claims c
join public.mindmake_studio_learning_proposals p on p.id = c.proposal_id
where p.status in ('approved', 'corrected')
  and p.decided_by = 'Krish'
  and c.status not in ('retired', 'superseded');
