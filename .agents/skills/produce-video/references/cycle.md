# The cycle's touches in produce-video (stage 7, and 8 and 9 after it)

Kept here, not in `.agents/skills/produce-video/SKILL.md`, so the core stays under its byte cap
(scripts/check_skill_core.py). Which system is touched at which stage is said once, in `config/cycle.json`
(Krish, 2026-11-26: every system involved at the right moment, in the most streamlined way). This skill names the
stage and runs it; it never lists the tools again.

    python3 scripts/post-pack/touch.py run 7 --week <Monday> --piece <id>
    python3 scripts/post-pack/touch.py check 7 --week <Monday> --piece <id>

Stage 7, Visuals and video, before any paid generation:

- the krish-clone registry, read at the raw URL `scripts/velib/lint.py` uses, before any synthetic face or voice
  (`ve lint` still refuses an unapproved likeness);
- Control Center's credit caps (`python3 scripts/ve.py budget status`);
- before a Higgsfield generation, the generator itself: read its cost estimate and write the recipe it will run with
  that estimate to `docs/plans/<Monday>-week/higgsfield/<generation>.estimate.json` (`{generation, model, prompt, size,
  count, estimate_credits, read_at}`); the row `s7-higgsfield-estimate` is required whenever `--set generation=<name>`
  is given, and the check refuses a generation with no estimate read;
- before it runs, reserve its credits: `touch.py run 7 ... --set generation=<name> --only s7-credits-reserve --set
  pool=<pool> --set amount=<n> --set asset="<what>"`; after it, settle: `--set generation=<name> --only
  s7-credits-settle --set spend_id=<id> --set settled=<n>`. With a generation named, both are required. Without
  `CC_HARNESS_KEY` both are queued for `touch.py drain`, and the spend waits for the reservation, as the credit desk
  says (`scripts/velib/credits.py`); a reservation Control Center refuses (over_share, held) is logged failed and is
  never sent again, so nothing is generated on it;
- new approved stills go to krish-clone only on his yes (a manual row: the run logs it skipped with that reason).

Stages 8 (publish approval) and 9 (distribution) run the same way once the cut is done:
`touch.py run 8 ...` and, once it is out, `touch.py run 9 ... --set title="<the published title>"`.
Exit 2 or not served is logged skipped (not_served), never done, and a required row not served stays a finding.
