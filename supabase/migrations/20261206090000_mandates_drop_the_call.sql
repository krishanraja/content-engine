-- The three channel mandates stop asking for a dated prediction.
--
-- Ruling (Krish, 2026-11-17): "I don't do dated-and-scored make-your-mind-up
-- pieces because it felt quite tacky and gimmicky. I don't really have the
-- clout such that my opinion can hold up in official scores."
-- Ruling (Krish, 2026-11-18): "get rid of that - i have abandoned the
-- prediction format, it feels lame".
--
-- 20261002090000_mandates_dated_prediction.sql appended a "THE CALL:" block to
-- each live mandate (every piece ends under OUR PREDICTION with a dated call
-- and "How sure we are: N%"). This takes that block out again, and nothing
-- else. Until it is applied, house rule NO_DATED_PREDICTION
-- (apps/control-plane/api/_houseRules.ts) wins over a mandate that still
-- carries it, in the drafter, the rewriter and the final pass.
--
-- The mandates stay in the database only (AGENTS.md, "The mandate is the
-- test"). Applied by hand through the Supabase MCP apply_migration, with
-- Krish's approval, never with supabase db push (supabase/migrations/ORIGIN.md).
-- Idempotent: a mandate without the block is left as it is.
update public.venture_formats
set mandate = btrim(regexp_replace(mandate, '[[:space:]]THE CALL: every piece ends under the heading OUR PREDICTION.*?tells no one what to do\.', '')),
    updated_at = now()
where slug in ('follow_the_money', 'mind_the_gap', 'under_the_hood')
  and position('THE CALL:' in mandate) > 0;
