-- The batched judging sweep: its state, and the results it has already paid for.
--
-- WHY A SWEEP NEEDS STATE AT ALL. The Batches API is 50% of list price on every
-- token type, and the price of that is latency: a batch usually lands inside an
-- hour and is allowed twenty-four. A Vercel function has three hundred seconds.
-- So a batched sweep cannot be one invocation that waits; it has to be a series
-- of ticks that pick up where the last one stopped.
--
-- The ladder walk itself is unchanged and stays the ONE implementation. Each
-- tick re-walks every idea from the top with a transport that answers from
-- results already in hand and defers anything it has not got, so an idea
-- advances exactly one stage per tick and the decision logic never forked.
--
-- Two tables, and the second is the one that makes the first safe:
--
--   judge_sweeps       which ideas, which batches, how far along
--   judge_sweep_cache  the reply to a request that has already been paid for,
--                      keyed by a hash of the request itself
--
-- Without the cache a re-walk would re-ask, and the sweep would never finish:
-- every tick would resubmit the whole ladder and the bill would grow instead
-- of halving. The cache is also what makes the research leg deterministic — see
-- kind 'research' below, which is not merely an optimisation.

create table public.judge_sweeps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- running  ticking; finished  every idea settled; failed  gave up and said why;
  -- cancelled  stopped by hand. Only one sweep may be `running` at a time, which
  -- the partial unique index below enforces rather than trusts: two sweeps over
  -- the same ideas would each submit the other's work and pay twice for it.
  status text not null default 'running'
    check (status in ('running', 'finished', 'failed', 'cancelled')),
  -- The ideas this sweep is responsible for, fixed at creation. A sweep that
  -- re-selected candidates each tick would pull in whatever arrived meanwhile
  -- and never terminate.
  idea_ids text[] not null default '{}',
  -- One entry per submitted batch: { id, requests, submitted_at, read }.
  -- `read` flips once its results are in judge_sweep_cache, and a read batch is
  -- never fetched again.
  batches jsonb not null default '[]'::jsonb,
  ticks integer not null default 0,
  -- The last tick's counts, as the ladder reports them.
  counts jsonb not null default '{}'::jsonb,
  -- Why it stopped, when it stopped for a reason worth reading.
  note text,
  dry_run boolean not null default false
);

comment on table public.judge_sweeps is
  'One batched run of the judge ladder. Ticked by /api/judge/sweep; advances every idea one stage per tick.';

create unique index judge_sweeps_one_running
  on public.judge_sweeps ((status)) where status = 'running';
create index judge_sweeps_created_at on public.judge_sweeps (created_at desc);

-- A reply that has already been paid for.
--
-- key    sha256 of the exact request body, plus the sample number for a call
--        that must be an INDEPENDENT draw of an identical request. The bury
--        confirmation is the reason that field exists: it asks the same
--        question twice on purpose, and a content-keyed cache would hand back
--        the first answer and report an agreement it never tested.
-- kind   'call'     a model reply: { text, error, usage, model, agent }
--        'research' a web lookup: { text, sources }
--
-- The research rows are NOT an optimisation. gather() feeds its result into the
-- repair prompt, so a lookup that returned something different on the next tick
-- would change the repair REQUEST, miss its own cache, and the sweep would
-- never converge. Caching it is what makes the walk reproducible.
create table public.judge_sweep_cache (
  key text primary key,
  kind text not null check (kind in ('call', 'research')),
  sweep_id uuid references public.judge_sweeps(id) on delete set null,
  value jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.judge_sweep_cache is
  'Replies already paid for, keyed by a hash of the request. Lets a sweep re-walk an idea without re-asking.';

create index judge_sweep_cache_sweep on public.judge_sweep_cache (sweep_id);
create index judge_sweep_cache_created_at on public.judge_sweep_cache (created_at);

-- Service role only, both of them. Nothing in the browser has any business
-- reading a cached model reply: the ideas are in content_ideas and the verdicts
-- are in judge_verdicts, and this is the plumbing under both.
alter table public.judge_sweeps enable row level security;
alter table public.judge_sweep_cache enable row level security;

-- Added 2026-09-24, same day, after the batch path was measured rather than
-- estimated. `ladder-router` fires once per idea that completes a walk and had
-- run 113 times, so the day's $12.07 was about $0.107 an idea, not the $0.32
-- the design was justified on. At 46 ideas a week the batch discount is worth
-- roughly $95 a year, which does not buy six to eighteen hours of latency.
--
-- Ruling (Krish, 2026-09-24): fast turnaround and cost efficiency both.
--
-- So the cron sweeps LIVE and this flag is true from creation. Batch is opt-in,
-- for a large catch-up where nothing waits on the answer, and the same flag is
-- what a batch sweep sets on itself when it gives up waiting.
alter table public.judge_sweeps
  add column if not exists live_fallback boolean not null default false;

comment on column public.judge_sweeps.live_fallback is
  'This sweep makes real calls rather than batching. Set at creation for a live sweep (the default), or mid-run when a batch has been waited on past its patience.';
