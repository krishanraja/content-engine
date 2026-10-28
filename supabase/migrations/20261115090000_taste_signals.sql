-- Taste signals: each thing Krish said, broken into countable tags, so patterns in his taste can be counted over time.
--
-- Krish, 2026-10-27: "Does this engine take my long-form feedback and turn it into really robust metadata tags that are
-- going to be really valuable over time to draw patterns from? ... The long form should be kept because it's good
-- context to understand what I really want but there's a tonne more we can do with the data to build a really
-- incredible taste brain over time."
--
-- Before this, each piece of his evidence gave one to three whys (taste_whys): a sentence each, for a claim to cite.
-- Nothing could be counted. A signal is one tag from a fixed vocabulary (krishanraja/inspirationhouse
-- src/signal/vocab.ts, its revision in vocab_rev), and an answer of his gives as many as it holds. Written by the
-- inspirationhouse engine's daily `signals` stage (src/signal/extract.ts); counted only by the views below.
--
-- Enforced here, not by convention:
--   1. His words are his: a signal's span is a phrase of his own words on the evidence row it cites (the excerpt, the
--      whole text when the excerpt was cut, meta.full_text, or a card's typed why_here and would_do), whitespace aside.
--      origin 'krish' needs a span and a krish_words row; 'krish_action' (he tapped it) needs a krish_action row; a
--      'model_guess' (the model's reading) carries no span.
--   2. Numbers are computed, never emitted by a model: support, sources, trend and tension come from the views.
--   3. Only his counts: a model_guess signal is shown as a guess and never counted as support. A withdrawn answer and
--      a superseded reading drop out of every count.
--   4. Anti-echo: kind 'form' signals are craft; 'subject' (what a thing is about) and 'workflow' (how he wants the
--      system to work with him) are kept apart by kind, so a reader of taste can take form alone.
--
-- Each evidence row is read once per prompt revision (taste_signal_reads). A new revision reads the backlog again and
-- supersedes the older revision's signals (superseded_at), so a better reader improves every past answer.

begin;

create table public.taste_signals (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.taste_evidence(id) on delete cascade,
  -- One of the craft layers (taste_layers, checked by trigger), or subject, or workflow.
  dimension text not null check (dimension ~ '^[a-z][a-z_]{1,31}$'),
  kind text not null check (kind in ('form', 'subject', 'workflow')),
  -- '<dimension>.<slug>' from the vocabulary; '<dimension>.other' and 'subject.topic' name themselves in label.
  attribute text not null check (attribute ~ '^[a-z][a-z_]{1,31}\.[a-z][a-z0-9_]{1,47}$'),
  label text check (label is null or char_length(btrim(label)) between 1 and 60),
  polarity text not null check (polarity in ('likes', 'dislikes')),
  strength smallint not null check (strength between 1 and 3),
  span text check (span is null or char_length(btrim(span)) between 1 and 300),
  -- A creator, show, brand or piece he names as the comparison.
  reference text check (reference is null or char_length(btrim(reference)) between 1 and 120),
  origin text not null check (origin in ('krish', 'krish_action', 'model_guess')),
  -- Where it applies, copied from the ledger and the card: lane, source, and a card's platform, format, kind, author.
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{16,64}$'),
  vocab_rev text not null check (char_length(vocab_rev) between 1 and 40),
  prompt_rev text not null check (char_length(prompt_rev) between 1 and 40),
  model text not null check (char_length(model) between 1 and 80),
  run_id uuid,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint taste_signals_attribute_in_dimension check (split_part(attribute, '.', 1) = dimension),
  constraint taste_signals_kind_of_dimension check (
    kind = case dimension when 'subject' then 'subject' when 'workflow' then 'workflow' else 'form' end),
  constraint taste_signals_open_has_label check (
    (attribute like '%.other' or attribute = 'subject.topic') = (label is not null)),
  constraint taste_signals_span_is_krish check ((origin = 'krish') = (span is not null)),
  constraint taste_signals_unique unique (evidence_id, prompt_rev, fingerprint)
);

create index taste_signals_evidence_idx on public.taste_signals (evidence_id);
create index taste_signals_standing_idx on public.taste_signals (attribute, polarity) where superseded_at is null;

-- The dimension is a craft layer or one of the two that are not craft, and the span is his: a phrase of his own words
-- on the row it cites, and the row is his kind of row for the origin it claims.
create or replace function public.taste_signals_check()
returns trigger
language plpgsql
as $$
declare
  ev record;
  words text;
begin
  if new.dimension not in ('subject', 'workflow')
     and not exists (select 1 from public.taste_layers l where l.slug = new.dimension) then
    raise exception 'taste_signals: dimension % is not a craft layer, subject or workflow', new.dimension;
  end if;
  select attribution, excerpt, meta into ev from public.taste_evidence where id = new.evidence_id;
  if new.origin = 'krish_action' and ev.attribution <> 'krish_action' then
    raise exception 'taste_signals: a krish_action signal must cite a krish_action evidence row';
  end if;
  if new.origin = 'krish' then
    if ev.attribution <> 'krish_words' then
      raise exception 'taste_signals: a krish signal must cite a krish_words evidence row';
    end if;
    words := regexp_replace(concat_ws(' | ', ev.excerpt, ev.meta->>'full_text', ev.meta->>'why_here', ev.meta->>'would_do'),
                            '\s+', ' ', 'g');
    if strpos(words, regexp_replace(btrim(new.span), '\s+', ' ', 'g')) = 0 then
      raise exception 'taste_signals: span must be a verbatim phrase of his words on the cited evidence row';
    end if;
  end if;
  return new;
end;
$$;

create trigger taste_signals_check
  before insert or update of dimension, span, origin, evidence_id on public.taste_signals
  for each row execute function public.taste_signals_check();

create table public.taste_signal_reads (
  evidence_id uuid not null references public.taste_evidence(id) on delete cascade,
  prompt_rev text not null check (char_length(prompt_rev) between 1 and 40),
  run_id uuid,
  read_at timestamptz not null default now(),
  primary key (evidence_id, prompt_rev)
);

-- What his signals add up to, one row per tag and polarity. Support counts only his (krish and krish_action) on
-- standing answers and current readings; guesses are shown beside it, never in it.
--   evidence_n    distinct answers behind it          sources_n     how many places they came from
--   grounded_n    of those, resting on a phrase of his strength_avg  how strongly he put it, 1 to 3
--   last_90d_n, prior_90d_n   answers in the last 90 days and the 90 before: the trend
--   opposite_n    his answers on the same tag with the other polarity: where his taste is in tension
create view public.taste_signal_patterns with (security_invoker = on) as
with live as (
  select s.*, e.source, e.occurred_at
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
         where o.attribute = k.attribute and o.label is not distinct from k.label and o.polarity <> k.polarity)::int as opposite_n,
       (select count(*) from live g
         where g.origin = 'model_guess' and g.attribute = k.attribute and g.label is not distinct from k.label
           and g.polarity = k.polarity)::int as guesses_n,
       min(h.occurred_at) as first_seen,
       max(h.occurred_at) as last_seen
from (select distinct dimension, kind, attribute, label, polarity from live) k
left join his h on h.attribute = k.attribute and h.label is not distinct from k.label and h.polarity = k.polarity
group by k.dimension, k.kind, k.attribute, k.label, k.polarity;

-- The same support, split by where it applies: lane, platform, format and kind (a card's, when the file proves it or
-- he set it). His signals only.
create view public.taste_signal_patterns_by_context with (security_invoker = on) as
select s.dimension, s.kind, s.attribute, s.label, s.polarity,
       s.context->>'lane' as lane, s.context->>'platform' as platform, s.context->>'format' as format,
       s.context->>'kind' as item_kind,
       count(distinct s.evidence_id)::int as evidence_n,
       count(distinct e.source)::int as sources_n
from public.taste_signals s
join public.taste_evidence e on e.id = s.evidence_id
where s.superseded_at is null and e.withdrawn_at is null and s.origin <> 'model_guess'
group by 1, 2, 3, 4, 5, 6, 7, 8, 9;

comment on table public.taste_signals is
  'Krish''s taste as countable tags: each thing he said, split into signals from a fixed vocabulary, each resting on a phrase of his words (krish), a tap (krish_action) or the model''s reading (model_guess, never counted). Written by the inspirationhouse engine; counted by taste_signal_patterns.';
comment on table public.taste_signal_reads is
  'Which evidence rows the inspirationhouse signals stage has read, by prompt revision. A new revision reads the backlog again.';

-- Access: service role only, like the taste ledger.
alter table public.taste_signals enable row level security;
alter table public.taste_signal_reads enable row level security;
revoke all on public.taste_signals, public.taste_signal_reads, public.taste_signal_patterns,
  public.taste_signal_patterns_by_context from public, anon, authenticated;
grant select, insert, update on public.taste_signals to service_role;
grant select, insert on public.taste_signal_reads to service_role;
grant select on public.taste_signal_patterns, public.taste_signal_patterns_by_context to service_role;
create policy taste_signals_service_all on public.taste_signals
  for all to service_role using (true) with check (true);
create policy taste_signal_reads_service_all on public.taste_signal_reads
  for all to service_role using (true) with check (true);

commit;
