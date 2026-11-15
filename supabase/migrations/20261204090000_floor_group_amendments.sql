-- Amending an approved floor group without losing what he decided on 4 November.
--
-- Krish, 2026-11-15, on the standards review page: house_brand, words_add and honest_titles were approved on 4 Nov, and
-- his 15 Nov choices (the wordmark at the close, the episode title moment, no "they" in titles) change their words. The
-- hold trigger forbids rewriting a seeded group and the app refuses a second decision, so the 4 Nov decision stays as
-- it is and his new words go into an amendment beside it.
--
--   taste_floor_group_amendments   one row per amendment he made to a decided group: the words, who decided, when, and
--                                  where (the page or session his choice was made on). Append-only: never updated or
--                                  deleted, so every earlier wording stays readable.
--   taste_floor (view)             a group's latest amendment by Krish supplies group_statement, and its members stand
--                                  'reworded'. group_amended_at is new and last, so every reader keeps its columns. A
--                                  rejected group is not revived by an amendment.
--
-- Service role only, like its neighbours. Idempotent: safe to run twice.

begin;

create table if not exists public.taste_floor_group_amendments (
  id uuid primary key default gen_random_uuid(),
  venture text not null default 'publication' references public.venture_registry (slug) on update restrict on delete restrict,
  group_key text not null references public.taste_floor_groups (key) on update restrict on delete restrict,
  statement text not null check (char_length(btrim(statement)) between 8 and 800),
  decided_by text not null check (decided_by = 'Krish'),
  decided_at timestamptz not null default now(),
  source text not null check (char_length(btrim(source)) between 3 and 300),
  created_at timestamptz not null default now(),
  -- No long dash in anything he reads (AGENTS.md, Voice).
  constraint taste_floor_group_amendments_no_long_dash check (
    strpos(statement, chr(8212)) = 0 and strpos(statement, chr(8211)) = 0)
);

create index if not exists taste_floor_group_amendments_group_idx
  on public.taste_floor_group_amendments (venture, group_key, decided_at desc);

create or replace function public.taste_floor_group_amendments_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'taste_floor_group_amendments: an amendment is never rewritten or removed; add a newer one';
end;
$$;

drop trigger if exists taste_floor_group_amendments_hold on public.taste_floor_group_amendments;
create trigger taste_floor_group_amendments_hold
  before update or delete on public.taste_floor_group_amendments
  for each row execute function public.taste_floor_group_amendments_hold();

create or replace view public.taste_floor
with (security_invoker = true) as
select s.id,
  s.fingerprint,
  s.formats,
  s.theme,
  s.layer,
  s.kind,
  case
    when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected') and ga.statement is not null then 'reworded'
    when gp.decided_by = 'Krish' and gp.status = 'corrected' then 'reworded'
    when gp.decided_by = 'Krish' and gp.status = 'approved' then 'approved'
    when gp.decided_by = 'Krish' and gp.status = 'rejected' then 'draft'
    when p.decided_by = 'Krish' and p.status = 'corrected' then 'reworded'
    when p.decided_by = 'Krish' and p.status = 'approved' then 'approved'
    else 'draft'
  end as standing,
  case
    when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected', 'rejected') then s.statement
    when p.decided_by = 'Krish' and p.status = 'corrected' then coalesce(p.decision_note, s.statement)
    else s.statement
  end as statement,
  s.how_to_check,
  case
    when exists (select 1 from public.taste_rejections r
                  where r.withdrawn_at is null and r.venture = s.venture and s.krish_quote_id = any (r.quote_ids))
     and exists (select 1 from public.taste_rejection_quotes q
                  where q.id = s.krish_quote_id and q.attribution = 'krish_words')
    then s.krish
    else null
  end as krish,
  s.support_n,
  s.action_n,
  s.quote_ids,
  s.record_refs,
  s.boundary_quote_ids,
  s.status,
  case
    when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected', 'rejected') then gp.decided_at
    else p.decided_at
  end as decided_at,
  s.venture,
  g.key as group_key,
  g.title as group_title,
  case
    when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected') and ga.statement is not null then ga.statement
    when gp.decided_by = 'Krish' and gp.status = 'corrected' then gp.decision_note
    else null
  end as group_statement,
  case
    when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected') then ga.decided_at
    else null
  end as group_amended_at
from public.taste_floor_standards s
left join public.mindmake_studio_learning_proposals p on p.id = s.proposal_id
left join lateral (
  select g_1.key, g_1.title, g_1.proposal_id
  from public.taste_floor_groups g_1
  where g_1.venture = s.venture and s.fingerprint = any (g_1.member_fingerprints)
  order by g_1.created_at, g_1.key
  limit 1
) g on true
left join public.mindmake_studio_learning_proposals gp on gp.id = g.proposal_id
left join lateral (
  select a.statement, a.decided_at
  from public.taste_floor_group_amendments a
  where a.venture = s.venture and a.group_key = g.key and a.decided_by = 'Krish'
  order by a.decided_at desc, a.created_at desc
  limit 1
) ga on true
where s.status in ('candidate', 'proposed')
  and case
        when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected', 'rejected') then gp.status <> 'rejected'
        else p.id is null or p.status not in ('rejected', 'superseded')
      end;

comment on view public.taste_floor is
  'The floor as a session reads it: each open standard, approved, reworded or draft, by its own decision or, once he has decided its group, by the group''s. group_statement is his words for the group: his latest amendment (taste_floor_group_amendments), else his correction. Makers read all of it; reviewers and pre-delivery checks may test work against approved and reworded standards and his words (Ruling, Krish, 2026-10-28: craft and process, never subject).';

alter table public.taste_floor_group_amendments enable row level security;
revoke all on public.taste_floor_group_amendments from public, anon, authenticated;
grant select, insert on public.taste_floor_group_amendments to service_role;
revoke update, delete, truncate on public.taste_floor_group_amendments from service_role;
revoke all on public.taste_floor from public, anon, authenticated;
grant select on public.taste_floor to service_role;

drop policy if exists taste_floor_group_amendments_service_all on public.taste_floor_group_amendments;
create policy taste_floor_group_amendments_service_all on public.taste_floor_group_amendments
  for all to service_role using (true) with check (true);

commit;
