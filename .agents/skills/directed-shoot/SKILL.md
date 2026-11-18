---
name: directed-shoot
description: "Plan, direct and post-produce an experimental video built around Krish himself, the way a film is made: a shot script he acts out (lines, marks, walks, what his hands do, props chosen to become something else), filmed as one continuous take, then transformed with AI in post so the edit turns the footage into the point, starting with the reveal peel format (a generated version of the take that lies, undone one lie at a time beside the raw take). Use when Krish asks for an experiment, a directed shoot, a shot script, or a video in the style of a reference like 'Nothing is real anymore'. Separate from the style pickers: it never uses style.motion, captions, the ve lab or the style bank. Spend waits on his yes."
model: opus
---

# Directed shoot: an experiment you act out

Krish, 2026-11-18: "I'd also like you to build an experimentation skill that takes things to this kind of attached
level around me in a video. This would have to be completely separate from all of the style pickers that we have and
would probably need to be motion-directed and directed more like a film script. I'd be given instructions to walk and
do certain things and then I'd record that. The post-production would do something like this to it."

This route is for experiments, and it stays apart from the series cuts. It never sets `style.motion`, `style.captions`
or any other style pick, never runs `ve lab`, and adds nothing to the style bank. Each experiment is one piece with
one hypothesis, and it is logged so the next one learns from it.

## The steps

1. **The point first.** Write the one sentence the effect proves for the viewer, and choose the format that proves
   it. An effect with no point is refused (AGENTS.md rule 6). The formats so far:
   - `reveal-peel`: a generated version of the take tells lies that are undone one at a time beside the raw take.
     `.agents/skills/directed-shoot/references/reveal-peel.md` holds its deconstruction, beat by beat, from his
     reference.

   A new format gets its own reference file in the same shape, written from a reference he sent, read in full (Ruling,
   Krish, 2026-11-17: a style skill is built from the reference he sends, never from general knowledge).
2. **The words.** The lines are a script, so they go through make-piece's Scripts step as any script does, the
   hannah-fry check included, then to his Approve scripts press. Short lines, said out loud, and his vocabulary.
3. **The shot script.** Write it to `.agents/skills/directed-shoot/references/shot-script.md`: a header (the point,
   format, runtime, location and light, props and what each becomes, what to wear, camera), the beats table (line,
   blocking, camera, what it becomes and on which word, what to watch for), and the takes to film. File it on the
   piece and on the day's board for his yes in words. He films from it, alone, with his phone.
4. **He records.** The take comes in through the recordings lane like any other.
5. **Post-production.** `.agents/skills/directed-shoot/references/post.md` covers it all:
   - Pick the take.
   - Make stills first, price them and get his yes before any credits are spent.
   - Run the motion renders.
   - Build the composite on the forced clocks, with the palette's one opening and one close.
   - Take the two hand-built receipts, the Codex receipt, a separate reader's review and his Approve cut press.
6. **Log the experiment** in the piece's `experiment.md`: the hypothesis, what was measured, what changed on the day,
   which renders failed, and the cost.

## Hard lines

- **Spend:** nothing is generated for motion until he has seen the stills and said yes to the price, for that piece.
- **His face:** it is his own and unchanged in every render. A render that alters it fails.
- **Truth:** every generated picture is shown as the lie and undone on screen within the piece. A generated picture
  is never left standing in for a real place, record or test (`docs/ve/ENGINE.md`).
- **His words:** they stay his own, in sync in every panel, and are never dubbed (floor 3).
- **No marks:** no "ORIGINAL", "AI" or other labels unless he says yes for that piece.
- **ve's gap:** ve cannot compile generated layers yet, so each experiment is a hand-built composite with that
  route's receipts. A step that cannot be done is a blocker, named with the smallest engine request (F54). It is never
  shipped with a caveat.
- **Publishing:** never. He publishes.
