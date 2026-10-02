-- Every piece ends with a dated prediction, and now the three mandates say so.
--
-- Krish, 2026-10-02, on the work board, asked "Add the dated prediction to all
-- three channel mandates": "yes". House rule CALL has required it of every piece
-- since 2026-09-25 (api/_houseRules.ts, api/_publishChecks.ts), but the mandates
-- every writer, rewriter and final pass reads first did not mention it.
--
-- Appends one sentence block to each live mandate, once. The mandates stay in
-- the database only (AGENTS.md, "The mandate is the test"): this file carries
-- the added text and nothing else. Each mandate is a single paragraph, so the
-- addition joins it with a space.
update public.venture_formats
set mandate = mandate || ' THE CALL: every piece ends under the heading OUR PREDICTION with one dated prediction that can be checked, followed by Krish''s confidence as "How sure we are: N%". Only Krish sets the number. On the date, the call is ruled held or broke. It forecasts what will happen and tells no one what to do.',
    updated_at = now()
where slug in ('follow_the_money', 'mind_the_gap', 'under_the_hood')
  and position('THE CALL:' in mandate) = 0;
