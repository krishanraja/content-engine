-- Defects leave the taste system (Ruling, Krish, 2026-11-23: the taste system holds only preference and inspiration).
--
-- A defect is something that was wrong, broke or misfired. Its event belongs in engine_incidents and its standard in
-- engine_standards, both the engine's. The taste tables keep their rows, marked moved: nothing is deleted, and clearing
-- moved_to_engine_at and withdrawn_at on a row puts it back.
--
-- Makers still see every standard: production_floor is the taste floor plus the engine's standards, each labelled by
-- its home. Only the taste floor is taste.

alter table public.taste_rejections add column if not exists moved_to_engine_at timestamptz;
alter table public.taste_floor_standards add column if not exists moved_to_engine_at timestamptz;

create table if not exists public.engine_standards (
  id uuid primary key,
  fingerprint text not null,
  formats text[] not null,
  theme text not null,
  layer text,
  kind text not null,
  standing text not null,
  statement text not null,
  how_to_check text not null,
  krish text,
  support_n integer not null,
  action_n integer not null,
  quote_ids uuid[] not null,
  record_refs text[] not null,
  boundary_quote_ids uuid[] not null,
  status text not null,
  decided_at timestamptz,
  venture text not null,
  group_key text,
  group_title text,
  group_statement text,
  group_amended_at timestamptz,
  moved_at timestamptz not null default now(),
  moved_why text not null,
  unique (venture, fingerprint)
);

alter table public.engine_standards enable row level security;
revoke all on public.engine_standards from public, anon, authenticated;
grant select, insert, update on public.engine_standards to service_role;

comment on table public.engine_standards is
  'Standards about defects, moved out of the taste floor on Krish''s ruling of 2026-11-23. The engine''s, never taste.';

create or replace view public.taste_floor with (security_invoker = true) as
 SELECT s.id,
    s.fingerprint,
    s.formats,
    s.theme,
    s.layer,
    s.kind,
        CASE
            WHEN gp.decided_by = 'Krish'::text AND (gp.status = ANY (ARRAY['approved'::text, 'corrected'::text])) AND ga.statement IS NOT NULL THEN 'reworded'::text
            WHEN gp.decided_by = 'Krish'::text AND gp.status = 'corrected'::text THEN 'reworded'::text
            WHEN gp.decided_by = 'Krish'::text AND gp.status = 'approved'::text THEN 'approved'::text
            WHEN gp.decided_by = 'Krish'::text AND gp.status = 'rejected'::text THEN 'draft'::text
            WHEN p.decided_by = 'Krish'::text AND p.status = 'corrected'::text THEN 'reworded'::text
            WHEN p.decided_by = 'Krish'::text AND p.status = 'approved'::text THEN 'approved'::text
            ELSE 'draft'::text
        END AS standing,
        CASE
            WHEN gp.decided_by = 'Krish'::text AND (gp.status = ANY (ARRAY['approved'::text, 'corrected'::text, 'rejected'::text])) THEN s.statement
            WHEN p.decided_by = 'Krish'::text AND p.status = 'corrected'::text THEN COALESCE(p.decision_note, s.statement)
            ELSE s.statement
        END AS statement,
    s.how_to_check,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM taste_rejections r
              WHERE (r.withdrawn_at IS NULL OR r.moved_to_engine_at IS NOT NULL) AND r.venture = s.venture AND (s.krish_quote_id = ANY (r.quote_ids)))) AND (EXISTS ( SELECT 1
               FROM taste_rejection_quotes q
              WHERE q.id = s.krish_quote_id AND q.attribution = 'krish_words'::text)) THEN s.krish
            ELSE NULL::text
        END AS krish,
    s.support_n,
    s.action_n,
    s.quote_ids,
    s.record_refs,
    s.boundary_quote_ids,
    s.status,
        CASE
            WHEN gp.decided_by = 'Krish'::text AND (gp.status = ANY (ARRAY['approved'::text, 'corrected'::text, 'rejected'::text])) THEN gp.decided_at
            ELSE p.decided_at
        END AS decided_at,
    s.venture,
    g.key AS group_key,
    g.title AS group_title,
        CASE
            WHEN gp.decided_by = 'Krish'::text AND (gp.status = ANY (ARRAY['approved'::text, 'corrected'::text])) AND ga.statement IS NOT NULL THEN ga.statement
            WHEN gp.decided_by = 'Krish'::text AND gp.status = 'corrected'::text THEN gp.decision_note
            ELSE NULL::text
        END AS group_statement,
        CASE
            WHEN gp.decided_by = 'Krish'::text AND (gp.status = ANY (ARRAY['approved'::text, 'corrected'::text])) THEN ga.decided_at
            ELSE NULL::timestamp with time zone
        END AS group_amended_at
   FROM taste_floor_standards s
     LEFT JOIN mindmake_studio_learning_proposals p ON p.id = s.proposal_id
     LEFT JOIN LATERAL ( SELECT g_1.key,
            g_1.title,
            g_1.proposal_id
           FROM taste_floor_groups g_1
          WHERE g_1.venture = s.venture AND (s.fingerprint = ANY (g_1.member_fingerprints))
          ORDER BY g_1.created_at, g_1.key
         LIMIT 1) g ON true
     LEFT JOIN mindmake_studio_learning_proposals gp ON gp.id = g.proposal_id
     LEFT JOIN LATERAL ( SELECT a.statement,
            a.decided_at
           FROM taste_floor_group_amendments a
          WHERE a.venture = s.venture AND a.group_key = g.key AND a.decided_by = 'Krish'::text
          ORDER BY a.decided_at DESC, a.created_at DESC
         LIMIT 1) ga ON true
  WHERE s.moved_to_engine_at IS NULL AND (s.status = ANY (ARRAY['candidate'::text, 'proposed'::text])) AND
        CASE
            WHEN gp.decided_by = 'Krish'::text AND (gp.status = ANY (ARRAY['approved'::text, 'corrected'::text, 'rejected'::text])) THEN gp.status <> 'rejected'::text
            ELSE p.id IS NULL OR (p.status <> ALL (ARRAY['rejected'::text, 'superseded'::text]))
        END;

create or replace view public.production_floor with (security_invoker = true) as
  select f.id, f.fingerprint, f.formats, f.theme, f.layer, f.kind, f.standing, f.statement, f.how_to_check, f.krish,
         f.support_n, f.action_n, f.quote_ids, f.record_refs, f.boundary_quote_ids, f.status, f.decided_at, f.venture,
         f.group_key, f.group_title, f.group_statement, f.group_amended_at, 'taste'::text as home
  from public.taste_floor f
  union all
  select e.id, e.fingerprint, e.formats, e.theme, e.layer, e.kind, e.standing, e.statement, e.how_to_check, e.krish,
         e.support_n, e.action_n, e.quote_ids, e.record_refs, e.boundary_quote_ids, e.status, e.decided_at, e.venture,
         e.group_key, e.group_title, e.group_statement, e.group_amended_at, 'engine'::text as home
  from public.engine_standards e;

revoke all on public.production_floor from public, anon, authenticated;
grant select on public.production_floor to service_role;

comment on view public.production_floor is
  'Every standard a maker must meet: the taste floor (home taste) and the engine''s defect standards (home engine).';
