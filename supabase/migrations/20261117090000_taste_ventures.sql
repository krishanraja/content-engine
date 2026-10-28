-- The taste ledger, keyed by venture.
--
-- Krish, 2026-10-28: "I'd like to ensure that each repository builds its own taste ledger and reads from its own taste
-- ledger, and not the central makeyourmindup one." And: "The ledger is keyed by venture not repository. Makeyourmindup
-- as a separate venture to mindmake".
--
-- Every row the ledger files carries one venture, a venture_registry slug: 'publication' is Make Your Mind Up (the slug
-- venture_formats, growth_engines and the North Star readings already use for it), separate from 'mindmake'. The
-- inspirationhouse engine decides a row's venture in code (src/venture.ts), never by a model; a session's report takes
-- the venture of the repository it came from, or, from a repository that serves several ventures, the one the session
-- named. Every step that compiles reads one venture, and every reader filters by its own.
--
-- Enforced here, not by convention:
--   1. One map from repository to venture, taste_venture_repositories. A report or capture from a mapped repository
--      takes its venture from the map, and one naming another venture is refused. From an unmapped repository the
--      session names the venture, which must be active; with none named the row is held unassigned (venture null) and
--      the engine files nothing of it until it has one.
--   2. A row keeps the venture it was filed under. An unassigned report or capture may be assigned once.
--   3. A claim cites only its own venture's evidence, and a standard only its own venture's records, so no venture's
--      support is counted in another's.
--   4. The readers' views carry the venture as their last column; the patterns count each venture apart.

begin;

-- 1. Which venture each repository serves ------------------------------------------------------------------------------
--
-- Control Center's FLEET_VENTURE (control-center src/lib/northStar.ts), with two changes Krish made for taste:
-- content-engine and content-watcher produce Make Your Mind Up's content, so their taste is publication's. A repository
-- that serves several ventures (control-center, ai-harness, inspirationhouse, hunter, contentarchives) is not listed.
create table public.taste_venture_repositories (
  repository text primary key check (repository = lower(repository)
    and repository ~ '^[a-z0-9][a-z0-9._-]{0,99}/[a-z0-9][a-z0-9._-]{0,99}$'),
  venture text not null references public.venture_registry (slug) on update restrict on delete restrict,
  created_at timestamptz not null default now()
);

insert into public.taste_venture_repositories (repository, venture) values
  ('krishanraja/content-engine', 'publication'),
  ('krishanraja/content-watcher', 'publication'),
  ('krishanraja/makeyourmindup', 'publication'),
  ('krishanraja/growth-makeyourmindup', 'publication'),
  ('krishanraja/mindmake', 'mindmake'),
  ('krishanraja/growth-mindmake', 'mindmake'),
  ('krishanraja/aeo-engine', 'mindmake'),
  ('krishanraja/krish-raja', 'mindmake'),
  ('krishanraja/dothinkdo', 'mindmake'),
  ('krishanraja/dothinkdo-skills', 'mindmake'),
  ('krishanraja/heartside', 'heartside'),
  ('krishanraja/growth-heartside', 'heartside'),
  ('krishanraja/full-time', 'full_time'),
  ('krishanraja/growth-fulltime', 'full_time'),
  ('krishanraja/legibility', 'legibility'),
  ('krishanraja/growth-legibility', 'legibility'),
  ('krishanraja/legibility-worker', 'legibility'),
  ('krishanraja/mm-ctrl', 'mm_ctrl'),
  ('krishanraja/mindmake-ctrl', 'mm_ctrl'),
  ('krishanraja/mm-ctrl-relaunch-private', 'mm_ctrl'),
  ('krishanraja/fractionl-pulse', 'fractionl_pulse'),
  ('krishanraja/fractionl-circle', 'fractionl_circle');

-- 2. The venture on every row the ledger files -------------------------------------------------------------------------
--
-- Everything the ledger held before today is Make Your Mind Up's but for the rows set below, so each column arrives
-- with that default (a constant default rewrites nothing and fires no trigger) and the default is then dropped: from
-- here on every writer names the venture. No cascade: a slug renamed in the registry must never move rows between
-- ventures without anyone deciding it.
alter table public.taste_evidence
  add column venture text not null default 'publication' references public.venture_registry (slug) on update restrict on delete restrict;
alter table public.taste_claims
  add column venture text not null default 'publication' references public.venture_registry (slug) on update restrict on delete restrict;
alter table public.taste_rejections
  add column venture text not null default 'publication' references public.venture_registry (slug) on update restrict on delete restrict;
alter table public.taste_floor_standards
  add column venture text not null default 'publication' references public.venture_registry (slug) on update restrict on delete restrict;
alter table public.feedback_cues
  add column venture text not null default 'publication' references public.venture_registry (slug) on update restrict on delete restrict;
-- A report or capture from an unmapped repository that named no venture is held with none.
alter table public.taste_reports
  add column venture text references public.venture_registry (slug) on update restrict on delete restrict;
alter table public.taste_rejection_inbox
  add column venture text references public.venture_registry (slug) on update restrict on delete restrict;

-- 3. The rows that are not Make Your Mind Up's, set while the old triggers are in place ----------------------------------

-- Reports and captures, by the repository they came from.
update public.taste_reports r set venture = m.venture
from public.taste_venture_repositories m where m.repository = lower(btrim(r.repository));
update public.taste_rejection_inbox r set venture = m.venture
from public.taste_venture_repositories m where m.repository = lower(btrim(r.repository));

-- What a report or capture became: evidence, records and cues carry the reporting repository in meta. A capture's record
-- takes its capture's venture, as the engine files it.
update public.taste_evidence e set venture = m.venture
from public.taste_venture_repositories m
where e.source = 'session_report' and m.repository = lower(btrim(e.meta->>'repository')) and e.venture <> m.venture;
update public.taste_rejections r set venture = m.venture
from public.taste_venture_repositories m
where r.source in ('session_report', 'inbox') and m.repository = lower(btrim(r.meta->>'repository')) and r.venture <> m.venture;
update public.feedback_cues c set venture = m.venture
from public.taste_venture_repositories m
where c.source = 'session_report' and m.repository = lower(btrim(c.meta->>'repository')) and c.venture <> m.venture;

-- Visibility: a target is its product's; a target with none is Krish's own stage, Mindmake's (as Control Center reads
-- it, api/_growthContext.ts). Nova's and Nell's feedback was on targets, contacts and guests: Mindmake's too.
update public.taste_evidence e
set venture = coalesce((select t.product_slug from public.visibility_targets t where t.id::text = e.source_ref), 'mindmake')
where e.source = 'visibility_target'
  and e.venture is distinct from coalesce((select t.product_slug from public.visibility_targets t where t.id::text = e.source_ref), 'mindmake');
update public.taste_evidence e set venture = 'mindmake'
where e.source = 'feedback_hist' and e.meta->>'agent' in ('nova', 'nell') and e.venture <> 'mindmake';

-- Claims take the one venture their evidence has. A candidate whose evidence spans ventures is superseded, to be drafted
-- again within one venture; one already on a proposal stops the migration, since what he was shown is never changed.
do $$
declare
  blocked integer;
begin
  select count(*) into blocked from public.taste_claims c
  where c.status not in ('candidate', 'superseded', 'retired')
    and (select count(distinct e.venture) from public.taste_evidence e where e.id = any(c.evidence_ids || c.counterexample_ids)) > 1;
  if blocked > 0 then
    raise exception 'taste_ventures: % claim(s) on a proposal cite evidence of more than one venture; decide them first', blocked;
  end if;
end $$;

update public.taste_claims c set venture = v.venture
from (select c.id, min(e.venture) as venture
      from public.taste_claims c join public.taste_evidence e on e.id = any(c.evidence_ids || c.counterexample_ids)
      group by c.id having count(distinct e.venture) = 1) v
where v.id = c.id and c.venture <> v.venture;
update public.taste_claims c set status = 'superseded'
where c.status = 'candidate'
  and (select count(distinct e.venture) from public.taste_evidence e where e.id = any(c.evidence_ids || c.counterexample_ids)) > 1;

-- Standards take the one venture of the records they name, by the same rule.
do $$
declare
  blocked integer;
begin
  select count(*) into blocked from public.taste_floor_standards s
  where s.status not in ('candidate', 'superseded', 'retired')
    and (select count(distinct r.venture) from public.taste_rejections r where (r.source || ':' || r.source_ref) = any(s.record_refs)) > 1;
  if blocked > 0 then
    raise exception 'taste_ventures: % standard(s) on a proposal name records of more than one venture; decide them first', blocked;
  end if;
end $$;

update public.taste_floor_standards s set venture = v.venture
from (select s.id, min(r.venture) as venture
      from public.taste_floor_standards s join public.taste_rejections r on (r.source || ':' || r.source_ref) = any(s.record_refs)
      group by s.id having count(distinct r.venture) = 1) v
where v.id = s.id and s.venture <> v.venture;
update public.taste_floor_standards s set status = 'superseded'
where s.status = 'candidate'
  and (select count(distinct r.venture) from public.taste_rejections r where (r.source || ':' || r.source_ref) = any(s.record_refs)) > 1;

alter table public.taste_evidence alter column venture drop default;
alter table public.taste_claims alter column venture drop default;
alter table public.taste_rejections alter column venture drop default;
alter table public.taste_floor_standards alter column venture drop default;
alter table public.feedback_cues alter column venture drop default;

-- 4. A report's venture, from the map or the session ------------------------------------------------------------------
--
-- Before insert on taste_reports and taste_rejection_inbox. A mapped repository's venture is the map's, and a session
-- naming another is refused. From an unmapped one, the venture the session named, which must be an active venture; with
-- none, the row is held unassigned. meta.venture_from says which.
create or replace function public.taste_venture_fill()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  mapped text;
begin
  select m.venture into mapped from public.taste_venture_repositories m where m.repository = lower(btrim(new.repository));
  if mapped is not null then
    if new.venture is not null and new.venture <> mapped then
      raise exception '%: % serves %, not %', tg_table_name, new.repository, mapped, new.venture;
    end if;
    new.venture := mapped;
    new.meta := coalesce(new.meta, '{}'::jsonb) || jsonb_build_object('venture_from', 'map');
  elsif new.venture is not null then
    if not exists (select 1 from public.venture_registry v where v.slug = new.venture and v.active) then
      raise exception '%: % is not an active venture', tg_table_name, new.venture;
    end if;
    new.meta := coalesce(new.meta, '{}'::jsonb) || jsonb_build_object('venture_from', 'session');
  end if;
  return new;
end;
$$;

create trigger taste_reports_venture before insert on public.taste_reports
  for each row execute function public.taste_venture_fill();
create trigger taste_rejection_inbox_venture before insert on public.taste_rejection_inbox
  for each row execute function public.taste_venture_fill();

-- 5. A row keeps its venture --------------------------------------------------------------------------------------------
create or replace function public.taste_venture_kept()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.venture is not null and new.venture is distinct from old.venture then
    raise exception '%: a row keeps the venture it was filed under', tg_table_name;
  end if;
  return new;
end;
$$;

create trigger taste_evidence_venture_kept before update on public.taste_evidence
  for each row when (old.venture is distinct from new.venture) execute function public.taste_venture_kept();
create trigger taste_claims_venture_kept before update on public.taste_claims
  for each row when (old.venture is distinct from new.venture) execute function public.taste_venture_kept();
create trigger taste_rejections_venture_kept before update on public.taste_rejections
  for each row when (old.venture is distinct from new.venture) execute function public.taste_venture_kept();
create trigger taste_floor_standards_venture_kept before update on public.taste_floor_standards
  for each row when (old.venture is distinct from new.venture) execute function public.taste_venture_kept();
create trigger feedback_cues_venture_kept before update on public.feedback_cues
  for each row when (old.venture is distinct from new.venture) execute function public.taste_venture_kept();
create trigger taste_reports_venture_kept before update on public.taste_reports
  for each row when (old.venture is distinct from new.venture) execute function public.taste_venture_kept();
create trigger taste_rejection_inbox_venture_kept before update on public.taste_rejection_inbox
  for each row when (old.venture is distinct from new.venture) execute function public.taste_venture_kept();

-- 6. A claim cites only its own venture's evidence -----------------------------------------------------------------------
--
-- The trigger as it stood (20261112090000_taste_quote_holds.sql), and one more check: every cited row is the claim's
-- venture. Checked when the claim is drafted or its citations change, not on the recount the engine's withdrawal runs
-- over every claim citing a source, so a superseded claim from before this split never stops that recount.
create or replace function public.taste_claims_count_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unresolved integer;
  foreign_n integer;
  cites_changed boolean;
  quoted text;
begin
  select count(*) into unresolved
  from unnest(new.evidence_ids || new.counterexample_ids) as e(id)
  where not exists (select 1 from public.taste_evidence t where t.id = e.id);
  if unresolved > 0 then
    raise exception 'taste_claims: % cited evidence id(s) do not exist', unresolved;
  end if;

  -- Nested, so OLD is read on an update only.
  cites_changed := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    cites_changed := new.evidence_ids is distinct from old.evidence_ids
      or new.counterexample_ids is distinct from old.counterexample_ids or new.venture is distinct from old.venture;
  end if;
  if cites_changed then
    select count(*) into foreign_n
    from public.taste_evidence t
    where t.id = any(new.evidence_ids || new.counterexample_ids) and t.venture <> new.venture;
    if foreign_n > 0 then
      raise exception 'taste_claims: % cited evidence row(s) belong to another venture than %', foreign_n, new.venture;
    end if;
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
         new.proposal_id is distinct from old.proposal_id
      or new.statement is distinct from old.statement or new.why is distinct from old.why
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

-- 7. A standard names only its own venture's records, and counts only them ------------------------------------------------
--
-- The trigger as it stood (20261116090000_rejections.sql), with support counted over the standard's own venture's
-- records, and its record_refs checked against its venture when it is drafted or they change.
create or replace function public.taste_floor_standards_count()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unresolved integer;
  foreign_n integer;
  refs_changed boolean;
  quoted text;
  set_quote boolean;
begin
  select count(*) into unresolved
  from unnest(new.quote_ids || new.boundary_quote_ids) as q(id)
  where not exists (select 1 from public.taste_rejection_quotes t where t.id = q.id);
  if unresolved > 0 then
    raise exception 'taste_floor_standards: % cited quote(s) do not exist', unresolved;
  end if;

  -- Nested, so OLD is read on an update only.
  refs_changed := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    refs_changed := new.record_refs is distinct from old.record_refs or new.venture is distinct from old.venture;
  end if;
  if refs_changed then
    select count(*) into foreign_n
    from unnest(new.record_refs) as ref(r)
    where exists (select 1 from public.taste_rejections x
                  where (x.source || ':' || x.source_ref) = ref.r and x.venture <> new.venture);
    if foreign_n > 0 then
      raise exception 'taste_floor_standards: % named record(s) belong to another venture than %', foreign_n, new.venture;
    end if;
  end if;

  -- Support: distinct quotes of his words cited by a standing rejected or process record of this venture. A shared
  -- quote counts once.
  select count(distinct t.id) into new.support_n
  from public.taste_rejection_quotes t
  where t.id = any(new.quote_ids) and t.attribution = 'krish_words'
    and exists (select 1 from public.taste_rejections r
                where r.withdrawn_at is null and r.kind in ('rejected', 'process') and r.venture = new.venture
                  and t.id = any(r.quote_ids));
  select count(distinct t.id) into new.action_n
  from public.taste_rejection_quotes t
  where t.id = any(new.quote_ids) and t.attribution = 'krish_action'
    and exists (select 1 from public.taste_rejections r
                where r.withdrawn_at is null and r.kind in ('rejected', 'process') and r.venture = new.venture
                  and t.id = any(r.quote_ids));

  -- His quote is his words, whitespace aside, on a cited quote that is his words: checked when the quote is set. A
  -- quote the engine later reclasses must not stop a recount or a retirement; the view stops showing it instead.
  -- Nested, so OLD is read on an update only.
  set_quote := new.krish is not null and tg_op = 'INSERT';
  if new.krish is not null and tg_op = 'UPDATE' then
    set_quote := new.krish is distinct from old.krish or new.krish_quote_id is distinct from old.krish_quote_id;
  end if;
  if set_quote then
    select t.text into quoted from public.taste_rejection_quotes t
    where t.id = new.krish_quote_id and t.id = any(new.quote_ids) and t.attribution = 'krish_words';
    if quoted is null
       or strpos(regexp_replace(quoted, '\s+', ' ', 'g'),
                 regexp_replace(regexp_replace(new.krish, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g')) = 0 then
      raise exception 'taste_floor_standards: krish must be his words, verbatim, on a cited quote of his';
    end if;
  end if;

  -- What he was shown is what he decides: a standard on a proposal is never rewritten.
  if tg_op = 'UPDATE' then
    if old.proposal_id is not null and (
         new.proposal_id is distinct from old.proposal_id
      or new.statement is distinct from old.statement or new.how_to_check is distinct from old.how_to_check
      or new.formats is distinct from old.formats or new.theme is distinct from old.theme
      or new.layer is distinct from old.layer or new.kind is distinct from old.kind
      or new.quote_ids is distinct from old.quote_ids or new.record_refs is distinct from old.record_refs
      or new.boundary_quote_ids is distinct from old.boundary_quote_ids
      or new.krish is distinct from old.krish or new.krish_quote_id is distinct from old.krish_quote_id) then
      raise exception 'taste_floor_standards: a standard on a proposal is never rewritten; draft a new one instead';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- 8. Two ventures may hold the same statement --------------------------------------------------------------------------
alter table public.taste_claims drop constraint taste_claims_version_unique;
alter table public.taste_claims add constraint taste_claims_version_unique unique (venture, fingerprint, version);
alter table public.taste_floor_standards drop constraint taste_floor_standards_version_once;
alter table public.taste_floor_standards add constraint taste_floor_standards_version_once unique (venture, fingerprint, version);

create index taste_evidence_venture_lane on public.taste_evidence (venture, lane) where withdrawn_at is null;
create index taste_rejections_venture on public.taste_rejections (venture) where withdrawn_at is null;

-- 9. The readers' views, each with its venture last (create or replace keeps every earlier column where it was) ------------

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
  p.decided_at,
  c.venture
from public.taste_claims c
join public.mindmake_studio_learning_proposals p on p.id = c.proposal_id
where p.status in ('approved', 'corrected')
  and p.decided_by = 'Krish'
  and c.status not in ('retired', 'superseded');

create or replace view public.taste_profile_form
with (security_invoker = true) as
select id, lane, layer, kind, statement, krish, why, means, support_n, counter_n, confidence, decision, decided_at, venture
from public.taste_profile_current
where kind = 'form';

-- His quote shows only while a standing record of the standard's own venture still cites it.
create or replace view public.taste_floor
with (security_invoker = true) as
select
  s.id,
  s.fingerprint,
  s.formats,
  s.theme,
  s.layer,
  s.kind,
  case when p.decided_by = 'Krish' and p.status = 'corrected' then 'reworded'
       when p.decided_by = 'Krish' and p.status = 'approved' then 'approved'
       else 'draft' end as standing,
  case when p.decided_by = 'Krish' and p.status = 'corrected' then coalesce(p.decision_note, s.statement)
       else s.statement end as statement,
  s.how_to_check,
  case when exists (select 1 from public.taste_rejections r
                    where r.withdrawn_at is null and r.venture = s.venture and s.krish_quote_id = any(r.quote_ids))
        and exists (select 1 from public.taste_rejection_quotes q where q.id = s.krish_quote_id and q.attribution = 'krish_words')
       then s.krish end as krish,
  s.support_n,
  s.action_n,
  s.quote_ids,
  s.record_refs,
  s.boundary_quote_ids,
  s.status,
  p.decided_at,
  s.venture
from public.taste_floor_standards s
left join public.mindmake_studio_learning_proposals p on p.id = s.proposal_id
where s.status in ('candidate', 'proposed')
  and (p.id is null or p.status not in ('rejected', 'superseded'));

-- Each venture's patterns counted apart: the same tag in two ventures is two rows.
create or replace view public.taste_signal_patterns with (security_invoker = on) as
with live as (
  select s.*, e.source, e.occurred_at, e.venture
  from public.taste_signals s
  join public.taste_evidence e on e.id = s.evidence_id
  where s.superseded_at is null and e.withdrawn_at is null
), his as (
  select * from live where origin <> 'model_guess'
)
select k.dimension, k.kind, k.attribute, k.label, k.polarity,
       count(distinct h.evidence_id)::int as evidence_n,
       count(distinct h.source)::int as sources_n,
       count(distinct h.evidence_id) filter (where h.origin = 'krish')::int as grounded_n,
       round(avg(h.strength), 2) as strength_avg,
       count(distinct h.evidence_id) filter (where h.occurred_at >= now() - interval '90 days')::int as last_90d_n,
       count(distinct h.evidence_id) filter (where h.occurred_at < now() - interval '90 days'
                                               and h.occurred_at >= now() - interval '180 days')::int as prior_90d_n,
       (select count(distinct o.evidence_id) from his o
         where o.venture = k.venture and o.attribute = k.attribute and o.label is not distinct from k.label
           and o.polarity <> k.polarity)::int as opposite_n,
       (select count(*) from live g
         where g.venture = k.venture and g.origin = 'model_guess' and g.attribute = k.attribute
           and g.label is not distinct from k.label and g.polarity = k.polarity)::int as guesses_n,
       min(h.occurred_at) as first_seen,
       max(h.occurred_at) as last_seen,
       k.venture
from (select distinct venture, dimension, kind, attribute, label, polarity from live) k
left join his h on h.venture = k.venture and h.attribute = k.attribute and h.label is not distinct from k.label
               and h.polarity = k.polarity
group by k.venture, k.dimension, k.kind, k.attribute, k.label, k.polarity;

create or replace view public.taste_signal_patterns_by_context with (security_invoker = on) as
select s.dimension, s.kind, s.attribute, s.label, s.polarity,
       s.context->>'lane' as lane, s.context->>'platform' as platform, s.context->>'format' as format,
       s.context->>'kind' as item_kind,
       count(distinct s.evidence_id)::int as evidence_n,
       count(distinct e.source)::int as sources_n,
       e.venture
from public.taste_signals s
join public.taste_evidence e on e.id = s.evidence_id
where s.superseded_at is null and e.withdrawn_at is null and s.origin <> 'model_guess'
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, e.venture;

comment on table public.taste_venture_repositories is
  'Which venture each repository''s taste is for (Krish, 2026-10-28: the ledger is keyed by venture, not repository). A repository that serves several ventures is not listed; its sessions name the venture. Changed only by a migration.';
comment on column public.taste_evidence.venture is
  'The venture this row is taste for, set by the inspirationhouse engine in code (src/venture.ts), never by a model, and never changed.';
comment on column public.taste_reports.venture is
  'The venture of the reporting repository (taste_venture_repositories), or the one the session named from a repository that serves several; null is held unassigned and never filed. meta.venture_from says which.';

-- 10. Access: service role only, like the rest of the ledger --------------------------------------------------------------
alter table public.taste_venture_repositories enable row level security;
revoke all on public.taste_venture_repositories from public, anon, authenticated;
grant select on public.taste_venture_repositories to service_role;
revoke insert, update, delete, truncate on public.taste_venture_repositories from service_role;
create policy taste_venture_repositories_service_read on public.taste_venture_repositories
  for select to service_role using (true);

-- 11. What moved, checked before this commits ---------------------------------------------------------------------------
do $$
declare
  bad integer;
begin
  select count(*) into bad from public.taste_evidence e
  where e.source = 'session_report'
    and e.venture is distinct from (select m.venture from public.taste_venture_repositories m
                                    where m.repository = lower(btrim(e.meta->>'repository')));
  if bad > 0 then raise exception 'taste_ventures: % session report row(s) from an unmapped repository', bad; end if;

  select count(*) into bad from public.taste_evidence e
  where e.source = 'visibility_target'
    and e.venture <> coalesce((select t.product_slug from public.visibility_targets t where t.id::text = e.source_ref), 'mindmake');
  if bad > 0 then raise exception 'taste_ventures: % visibility row(s) not their target''s venture', bad; end if;

  select count(*) into bad from public.taste_claims c
  where c.status in ('candidate', 'proposed')
    and exists (select 1 from public.taste_evidence e where e.id = any(c.evidence_ids || c.counterexample_ids) and e.venture <> c.venture);
  if bad > 0 then raise exception 'taste_ventures: % open claim(s) cite another venture''s evidence', bad; end if;

  select count(*) into bad from public.taste_floor_standards s
  where s.status in ('candidate', 'proposed')
    and exists (select 1 from public.taste_rejections r where (r.source || ':' || r.source_ref) = any(s.record_refs) and r.venture <> s.venture);
  if bad > 0 then raise exception 'taste_ventures: % open standard(s) name another venture''s records', bad; end if;

  select count(*) into bad from public.taste_reports r
  where r.venture is null and exists (select 1 from public.taste_venture_repositories m where m.repository = lower(btrim(r.repository)));
  if bad > 0 then raise exception 'taste_ventures: % report(s) from a mapped repository have no venture', bad; end if;

  raise notice 'taste_ventures: evidence %, claims %, records %, reports %, superseded claims %',
    (select jsonb_object_agg(venture, n) from (select venture, count(*) n from public.taste_evidence group by 1) x),
    (select jsonb_object_agg(venture, n) from (select venture, count(*) n from public.taste_claims group by 1) x),
    (select jsonb_object_agg(venture, n) from (select venture, count(*) n from public.taste_rejections group by 1) x),
    (select jsonb_object_agg(coalesce(venture, 'unassigned'), n) from (select venture, count(*) n from public.taste_reports group by 1) x),
    (select count(*) from public.taste_claims where status = 'superseded');
end $$;

commit;
