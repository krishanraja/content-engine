-- The Inspiration answers hold (audit of the feedback pipeline, 2026-10-24; 38 confirmed findings across four repos).
--
-- 1. His answers run to 2000 characters. A dictated answer over 600 was refused whole, with a bare error.
-- 2. Evidence keeps up to 2000 characters, so the tail of a dictated answer reaches the ledger. Was 400.
-- 3. Withdrawn evidence. An Undo, or an edit that replaces an answer, used to leave the old answer counting as his
--    support for a claim for good. The taste ledger now sets withdrawn_at on an inspiration_page row whose card is no
--    longer answered, or whose answer has a newer version, and support counts only rows still standing.
-- 4. explained_at: the explainer has read this evidence, even when it found no why in it. Such evidence used to be
--    sent again every day, failing quiet days and keeping older evidence from ever being read.
-- 5. first_answered_at: when he first answered a card. An edit restamps answered_at, which hid edited cards from the
--    week they were answered in on the scoreboard.
-- routed_at (since the taste ledger migration) is when a Sunday plan took a "make a piece" card into its week; the
-- plan stamps it, Undo clears it, and the plan reads every routed card it has not taken yet, so a missed Sunday
-- loses nothing and no card is offered twice.

alter table public.inspiration_items drop constraint inspiration_items_why_here_check;
alter table public.inspiration_items add constraint inspiration_items_why_here_check
  check (why_here is null or char_length(why_here) between 1 and 2000);
alter table public.inspiration_items drop constraint inspiration_items_why_like_check;
alter table public.inspiration_items add constraint inspiration_items_why_like_check
  check (why_like is null or char_length(why_like) between 1 and 2000);
alter table public.inspiration_items drop constraint inspiration_items_would_do_check;
alter table public.inspiration_items add constraint inspiration_items_would_do_check
  check (would_do is null or char_length(would_do) between 1 and 2000);

alter table public.inspiration_items add column first_answered_at timestamptz;
update public.inspiration_items set first_answered_at = answered_at where answered_at is not null and first_answered_at is null;

alter table public.taste_evidence drop constraint taste_evidence_excerpt_check;
alter table public.taste_evidence add constraint taste_evidence_excerpt_check
  check (excerpt is null or char_length(excerpt) <= 2000);

alter table public.taste_evidence
  add column withdrawn_at timestamptz,
  add column explained_at timestamptz;
create index taste_evidence_standing_idx on public.taste_evidence (source, source_ref) where withdrawn_at is null;

-- Support and counter-support count only evidence still standing. The rest of the function is unchanged.
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

  -- One source entry counts once, however many versions of it are cited, and only while it stands.
  select count(distinct (t.source, t.source_ref)) into new.support_n
  from public.taste_evidence t
  where t.id = any(new.evidence_ids)
    and t.attribution in ('krish_words', 'krish_action')
    and t.withdrawn_at is null;

  select count(distinct (t.source, t.source_ref)) into new.counter_n
  from public.taste_evidence t
  where t.id = any(new.counterexample_ids)
    and t.attribution in ('krish_words', 'krish_action')
    and t.withdrawn_at is null;

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

  new.updated_at := now();
  return new;
end;
$$;
