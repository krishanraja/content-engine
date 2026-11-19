---
name: directed-shoot
description: "Plan, direct and post-produce experimental videos built around Krish with zero creative limits: a film-style shot script he acts out (lines, marks, triggers, what his hands do, props chosen to become something else), filmed in one take, then transformed with AI in post into anything at all: him in space, turned into a famous person at random, shrunk, cloned, the world swapped around him. The formats so far are wild (anything goes), reveal-peel (lies undone beside the raw take), escalation, interruption and two-of-me. Use when Krish ticks Add an experiment on a piece on the board (meta.style.experiment, the production prompt says so), or asks for an experiment, a directed shoot, a shot script or something nuts. Separate from the style pickers. Spend waits on his yes."
model: opus
---

# Directed shoot: experiments with no ceiling

Krish, 2026-11-18: "I'd also like you to build an experimentation skill that takes things to this kind of attached
level around me in a video ... directed more like a film script." Then: "I want this experiment skill to literally be
capable of going nuts - putting me on space, having me turn in to sam altman randomly, absolutely nuts stuff that has
ZERO limits. make it so"

This route is for experiments, and the idea has no ceiling: space, other worlds, a famous face, a crowd of clones,
gravity off. Nothing is too much. Ask only whether it is striking or funny, and whether it makes the piece's point
land (AGENTS.md rule 6). It stays apart from the series cuts. It never sets `style.motion`, `style.captions` or any
style pick, never runs `ve lab`, and adds nothing to the style bank.

## How it starts

His optional tick, **Add an experiment**, on every piece, apart from his three picks, with his idea in his words
(`meta.style.experiment_idea`), quoted in the production prompt. First flesh it out, draw 3 to 5 free mock
frames and ask him: go, change it, or call it. Nothing else runs before his go.

## The steps

1. **The point and the format.** Write the one sentence the piece proves, then pick the format from
   `.agents/skills/directed-shoot/references/wild.md` (wild, escalation, interruption, two-of-me) or
   `.agents/skills/directed-shoot/references/reveal-peel.md`. Go big: offer him the most ambitious version first. A new
   format gets its own reference file, built from a reference he sends, read in full (Ruling, Krish, 2026-11-17).
2. **The words.** The lines are a script. They go through make-piece's Scripts step, the hannah-fry check included,
   then to his Approve scripts press.
3. **The shot script.** Write it in the shape of `.agents/skills/directed-shoot/references/shot-script.md`. Every
   transformation names its trigger, his body and the ground (`wild.md`, "The craft"). File it on the piece and on the
   day's board for his yes in words. He films from it with his phone.
4. **He records.** The take comes in through the recordings lane.
5. **Post.** `.agents/skills/directed-shoot/references/post.md` covers it:
   - Stills first, priced, then his yes before any credits are spent.
   - The motion renders.
   - A hand-built composite on the forced clocks, with its receipts.
   - A separate reader, then filing; Approve gates publish only.
6. **Log the experiment** in the piece's `experiment.md`: the hypothesis, what was measured, what changed on the day,
   which renders failed, and the cost.

## What stays

None of these limits how far an idea can go.

- **His yes before spend.** He sees the stills and the price, then says yes in words for that piece (AGENTS.md,
  "Spend"). This is one press, and he decides it.
- **Real, named people** (Sam Altman, anyone else). He can turn into them, and the gag is welcome, with three rules:
  - The change happens on camera, so we see him become them.
  - They never state a factual claim as themselves.
  - Their voice is never cloned; his own words carry an effect if one is wanted.

  Growth ticks the platform's AI-content disclosure at upload. That keeps a clip lifted out of the video from passing
  as real footage of them, which is the one way this hurts his channel's name.
- **No sexual content and nothing defamatory about a real person.**
- **Evidence stays real.** A generated picture never stands in as the proof of a factual claim the piece makes
  (`docs/ve/ENGINE.md`). Fantasy that is plainly fantasy is fine.
- **His voice.** His own take is in sync in the finished cut (floor 3). Voice effects go on his words.
- **No marks unless he wants them:** no "ORIGINAL" or "AI" labels unless he says yes for that piece.
- **Drift.** His face changes only where the shot script changes it on purpose. A render that drifts his face anywhere
  else fails.
- **ve's gap.** ve cannot compile generated layers yet, so each experiment is a hand-built composite with that route's
  receipts. A step that cannot be done is a blocker, named with the smallest engine request (F54).
- **He publishes.** Nothing here posts.
