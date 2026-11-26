-- Retire the call scoreboard: the two views that dated, ruled and scored the falsifiers.
--
-- Ruling (Krish, 2026-11-24): "the signature format is the 5 Whys; get rid of everything that suggests predictions,
-- calls, dated, odds or scores." The routes that fed and read these views went in the same change: the daily
-- falsifier sweep (/api/claims/resolve), the ruling route (/api/claims/rule), the public scoreboard (/api/calls) and
-- the daily odds cron (/api/signals/odds).
--
-- Applied 2026-11-25 on Krish's yes ("Merge and apply"). Both views came from control-center migrations
-- (2026-08-05-techonomic-investigations.sql and 20260922120000_a_falsifier_that_is_never_checked.sql).
--
-- Nothing is deleted from any table. investigation_claims keeps every row and every column, falsifier included, which
-- stays as a research-quality field ("what would break this Why"); falsifier_due_on is simply no longer written.
-- claim_resolutions keeps its rows as the record of what was ruled. No CASCADE: if anything else still reads a view,
-- the drop fails and says so instead of taking that reader with it. The scoreboard goes first because it may read the
-- due list.

drop view if exists public.claim_scoreboard;
drop view if exists public.claims_due;
