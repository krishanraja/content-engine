-- The rejection floor, grouped for his approval.
--
-- Krish, 2026-11-04: "group the 215 floor standards for my approval". The floor holds 215 standards the inspirationhouse
-- engine read into his rejections (taste_floor_standards); put one by one they are 215 decisions. config/floor-groups.json
-- sorts them into about 20 groups he can decide in one sitting at /standards, and a set of session-process standards
-- (operating) that are never put to him as taste. Each group is one proposal in mindmake_studio_learning_proposals,
-- decided through the same write as every other proposal (apps/control-plane/api/_learningDecision.ts).
--
--   taste_floor_groups   one row per group: its words as he is shown them, its members by full fingerprint, and the
--                        proposal he decides. A card snapshot (counts, his quotes, the member standards) is what the
--                        page shows beside the decision; it is evidence, never the decision.
--   taste_floor (view)   a member takes its group's decision once he has decided the group: approved stays approved,
--                        corrected is reworded (the member keeps its own statement; group_statement is his words),
--                        rejected leaves the floor like a rejected proposal. Until then each standard stands as before.
--                        group_key, group_title and group_statement are new and last, so every reader keeps its columns.
--
-- Nothing here is ever deleted. Service role only, like its neighbours. Idempotent: safe to run twice.

begin;

create table if not exists public.taste_floor_groups (
  id uuid primary key default gen_random_uuid(),
  venture text not null default 'publication' references public.venture_registry (slug) on update restrict on delete restrict,
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  never_beneath text not null check (char_length(btrim(never_beneath)) between 8 and 600),
  check_text text not null check (char_length(btrim(check_text)) between 8 and 600),
  member_fingerprints text[] not null check (cardinality(member_fingerprints) between 1 and 300),
  card jsonb not null default '{}'::jsonb check (jsonb_typeof(card) = 'object'),
  proposal_id uuid unique references public.mindmake_studio_learning_proposals (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- No long dash in anything he reads (AGENTS.md, Voice).
  constraint taste_floor_groups_no_long_dash check (
    strpos(title || never_beneath || check_text, chr(8212)) = 0 and strpos(title || never_beneath || check_text, chr(8211)) = 0)
);

-- What he was shown is what he decides: a group on a proposal is never rewritten.
create or replace function public.taste_floor_groups_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.proposal_id is not null and (
       new.proposal_id is distinct from old.proposal_id or new.key is distinct from old.key
    or new.venture is distinct from old.venture or new.title is distinct from old.title
    or new.never_beneath is distinct from old.never_beneath or new.check_text is distinct from old.check_text
    or new.member_fingerprints is distinct from old.member_fingerprints) then
    raise exception 'taste_floor_groups: a group on a proposal is never rewritten; group again under a new key';
  end if;
  return new;
end;
$$;

drop trigger if exists taste_floor_groups_hold on public.taste_floor_groups;
create trigger taste_floor_groups_hold
  before update on public.taste_floor_groups
  for each row execute function public.taste_floor_groups_hold();

create index if not exists taste_floor_groups_members_idx on public.taste_floor_groups using gin (member_fingerprints);

-- The floor as a session reads it, every column as before and in the same order, then the group's three.
create or replace view public.taste_floor
with (security_invoker = true) as
select
  s.id,
  s.fingerprint,
  s.formats,
  s.theme,
  s.layer,
  s.kind,
  case when gp.decided_by = 'Krish' and gp.status = 'corrected' then 'reworded'
       when gp.decided_by = 'Krish' and gp.status = 'approved' then 'approved'
       when gp.decided_by = 'Krish' and gp.status = 'rejected' then 'draft'
       when p.decided_by = 'Krish' and p.status = 'corrected' then 'reworded'
       when p.decided_by = 'Krish' and p.status = 'approved' then 'approved'
       else 'draft' end as standing,
  case when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected', 'rejected') then s.statement
       when p.decided_by = 'Krish' and p.status = 'corrected' then coalesce(p.decision_note, s.statement)
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
  case when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected', 'rejected') then gp.decided_at
       else p.decided_at end as decided_at,
  s.venture,
  g.key as group_key,
  g.title as group_title,
  case when gp.decided_by = 'Krish' and gp.status = 'corrected' then gp.decision_note end as group_statement
from public.taste_floor_standards s
left join public.mindmake_studio_learning_proposals p on p.id = s.proposal_id
left join lateral (
  select g.key, g.title, g.proposal_id from public.taste_floor_groups g
  where g.venture = s.venture and s.fingerprint = any(g.member_fingerprints)
  order by g.created_at, g.key
  limit 1
) g on true
left join public.mindmake_studio_learning_proposals gp on gp.id = g.proposal_id
where s.status in ('candidate', 'proposed')
  and case when gp.decided_by = 'Krish' and gp.status in ('approved', 'corrected', 'rejected') then gp.status <> 'rejected'
           else (p.id is null or p.status not in ('rejected', 'superseded')) end;

comment on table public.taste_floor_groups is
  'The rejection floor grouped for Krish''s approval (config/floor-groups.json, seeded by scripts/floor_group.py): one proposal per group in mindmake_studio_learning_proposals, decided at /standards. Its members take the decision in public.taste_floor. Never rewritten once on a proposal.';
comment on view public.taste_floor is
  'The floor as a session reads it: each open standard, approved, reworded or draft, by its own decision or, once he has decided its group, by the group''s (group_statement is his rewording of the group). Makers read all of it; reviewers and pre-delivery checks may test work against approved and reworded standards and his words (Ruling, Krish, 2026-10-28: craft and process, never subject).';

alter table public.taste_floor_groups enable row level security;
revoke all on public.taste_floor_groups from public, anon, authenticated;
grant select, insert, update on public.taste_floor_groups to service_role;
revoke delete, truncate on public.taste_floor_groups from service_role;
revoke all on public.taste_floor from public, anon, authenticated;
grant select on public.taste_floor to service_role;

drop policy if exists taste_floor_groups_service_all on public.taste_floor_groups;
create policy taste_floor_groups_service_all on public.taste_floor_groups
  for all to service_role using (true) with check (true);

commit;
