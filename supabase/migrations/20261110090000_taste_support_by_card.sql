-- Support counts a card while any version of it stands; a quote needs its own words to stand.
--
-- 20261108090000 counted only cited evidence rows still standing. But a claim cites particular versions, and a card
-- gets a new version whenever its evidence changes (a new pick, his note on how to read it, a corrected kind), which
-- withdraws the old one: an answer he never took back stopped counting (review of the taste ledger, 2026-10-24,
-- reproduced on Postgres 16). Now:
--   - a cited answer counts while any version of the same card (source, source_ref) still stands, so only his Undo,
--     which withdraws every version, takes its support away;
--   - a quote of his counts only while the very row it quotes stands. When that row was withdrawn (he edited or took
--     back those words), the quote is dropped and the claim keeps its support, rather than the write failing.

create or replace function public.taste_claims_count_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unresolved integer;
  quoted text;
  quoted_withdrawn timestamptz;
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

  if new.krish is not null then
    select t.excerpt, t.withdrawn_at into quoted, quoted_withdrawn
    from public.taste_evidence t
    where t.id = new.krish_source_id
      and t.id = any(new.evidence_ids)
      and t.attribution = 'krish_words';
    if quoted is not null and quoted_withdrawn is not null then
      -- He took those words back or replaced them: never quote them.
      new.krish := null;
      new.krish_source_id := null;
    elsif quoted is null or position(new.krish in quoted) = 0 then
      raise exception 'taste_claims: krish must be a verbatim excerpt of a cited krish_words evidence row';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Recount every claim now, so support already lost to a re-versioned answer comes back.
update public.taste_claims set updated_at = now();
