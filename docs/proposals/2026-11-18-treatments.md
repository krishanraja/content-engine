# Proposal: a treatment bank, with no new choices for Krish (18 Nov 2026)

Status: Accepted by Krish, 18 Nov 2026 ("Yes do it all. Merge to main. Write it up so everything knows where
everything is."). The reference is [`docs/ve/TREATMENTS.md`](../ve/TREATMENTS.md); this file keeps the reasoning.

## The ask

Krish, 18 Nov 2026, sending https://github.com/storytold/effectcraft: "How should we strengthen the engine like this?
I don't want 300 different choices in the UI so figure out how. We can use this to empower the entire engine."

## The call

Use EffectCraft as a parts catalogue and keep ve's own renderer. Turn its effects into **treatments**: fixed recipes applied
by rule from what each beat or still is for. Krish's only visible choice stays the look (Pick a style), which sets
their strength. One bank serves video, covers, carousels and Notes images.

## Why this route

- **EffectCraft** (MIT/Apache, Rust, alpha) has 308 After Effects-style effects with exact parameters, subject
  tracking with SAM 2.1 Tiny, and an MCP server that reads back rendered frames
  ([`docs/ve/sources/effectcraft.md`](../ve/sources/effectcraft.md)).
- **Rejected: adopting it as a renderer.** ve's gates, receipts and tests are built on Remotion and ffmpeg. A second
  renderer in alpha, twelve days before the 30 Nov North Star date, adds a way to fail and no asset.
- **Rejected: an effects menu.** ve already has 14 motion styles and 27 caption styles. More options would cost Krish
  time against the North Star's "under an hour a week deciding".
- **Chosen: rules over choices.** A beat's role, its face and its devices already say what it is for, so the engine
  can pick the treatment. The learning `upgrade-the-edit-style` (17 Oct) asked for exactly this: a bank of modules he
  rates, tried on his own footage first.

## What it moves

The North Star's 10/10 bar on Shorts and stills, and the hour a week: treatments raise the floor of every asset
without one more decision for him. It does not move this week's count (4 against 12, U4) by itself; the still
treatments reach it first, because covers and carousels ship in hours.

## What was built on 18 Nov

- The bank: `config/ve/treatments.json` (11 primitives, 10 treatments, the rules, the limits, the strengths).
- The planner and its check: `scripts/velib/treatments.py`, tested by `tests/ve_treatments_test.py`.
- Three Codex cards in `docs/ve/cards/treatments/`: subject lift, still treatments, motion treatments.

## Risks and how they are held

- **The cut-out smears hair and hands.** A smeared edge looks worse than no treatment. The subject lift must carry a
  smear receipt (F53), and a failed one is a blocker (F54). The card may add no dependency; if MediaPipe's edge fails,
  it stops and names the model to add, for Krish's yes.
- **Too many options already.** The honest fix may be removing motion and caption styles as well as adding
  treatments. Not done here; it is Krish's call, once his look picks show which styles never win.
- **Treatments that look like a template.** Each recipe is held to the rejection floor; one Krish rejects comes out
  of the bank.

## Next

Card `ve-treat-1-subject-lift` builds on the lane; its first result is shown to Krish beside the untreated take before
any style uses it.
