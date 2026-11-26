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
- the Higgsfield recipes and cost estimate (the ve brief and recipe, as today);
- before a generation runs, reserve its credits: `touch.py run 7 ... --only s7-credits-reserve --set pool=<pool>
  --set amount=<n> --set asset="<what>"`; after it, settle: `--only s7-credits-settle --set spend_id=<id>
  --set settled=<n>`. Without `CC_HARNESS_KEY` both are queued for `touch.py drain`, and the spend waits for the
  reservation, as the credit desk says (`scripts/velib/credits.py`);
- new approved stills go to krish-clone only on his yes (a manual row: the run logs it skipped with that reason).

Stages 8 (publish approval) and 9 (distribution) run the same way once the cut is done:
`touch.py run 8 ...` and, once it is out, `touch.py run 9 ... --set title="<the published title>"`.
Exit 2 or not served is logged skipped, never done.
