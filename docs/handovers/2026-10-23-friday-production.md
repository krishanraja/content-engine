# Handover: Friday 23 October (mind.the.gap, "two passports"), from recording to four videos

Written 23 October, late, by the session that scored the test, filled both scripts, set the creative direction and
sent the scripts to Teleprompter (its context passed 500k tokens, guard G1). Start a fresh session from this file.

## Start the new session with

> Pick up docs/handovers/2026-10-23-friday-production.md. I've recorded the takes and dropped them in the Inbox.
> Build the storyboard for all four videos and show me before anything renders.

## Where it stands

- Piece `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`. Test scored: `docs/plans/2026-10-23-friday/test-results/scores.md`
  (DeepSeek wrote then deleted its Xinjiang answer 3 of 3; Turkmenistan answered 3 of 3; Taiwan a draw).
- **Four videos, two takes per length** (Krish: "I'll record a version as you've written in the script and then I'll
  record a voiceover version as well. You can then produce both videos."). Words: on camera
  `docs/plans/2026-10-23-draft-script.md` and `-90s.md`; voiceover
  `docs/plans/2026-10-23-friday/script-long-voiceover.md` and `script-short-voiceover.md`; both takes per length in
  `script-long-both-takes.md` and `script-short-both-takes.md` (what the board and Teleprompter hold).
- **Creative direction:** `docs/plans/2026-10-23-friday/creative-direction.md` (every line paired with the picture
  that proves it; the passport card; the disappearing answer; beat tables for both lengths; asset list with sources;
  truth labels; done means). Order: he records, takes lined up, **storyboard to Krish for sign-off**, then render
  (Krish: "Once I've recorded show me your creative storyboard before I sign that off.").
- **Board:** Friday tab, build `cc25274e` (revision 49): both takes in each script box. Feeder:
  `docs/plans/2026-10-19-week/update_friday_23oct.py` (cloud: `BOARD_BASE_URL=https://content-engine-flame-nu.vercel.app`
  and `ENGINE_OPERATOR_TOKEN=proxy-injected`; a publish can answer 502 and still land: read the build back).
- **Teleprompter:** folder "Fri 23 Oct mind.the.gap - Two passports", one script per length holding both takes,
  sent by hand on Krish's "Yes. Send it". Not on the making record: `making.py scripts` waits on an approved outline
  (`docs/plans/2026-10-23-outline.md`, not written) and the spine judge (needs the article draft). Those gates were
  not bypassed. So the recordings lane will not stamp these takes: line each up with `narration_diff.py` against its
  own take's words.
- **Engine:** two-take scripts are now checked take by take (`story_check.takes`), timed by the longest take in
  Teleprompter; pull request #148 (https://github.com/krishanraja/content-engine/pull/148) carries it with this
  handover. Merge it when CI is green (repo rule: auto-merge, or merge on green).
- Readers: the on-camera scripts had two rounds (retellings matched; small items left); the voiceover versions have
  passed `story_check.py` but no fresh readers yet.

## Next, in order

1. Fetch the four takes (`recording.py get`), line each up with its own words (`narration_diff.py`).
2. Ask Krish (one question) whether the DeepSeek moment was screen-recorded; if not, the labelled replay from
   `test-results/answers.md` is the fallback (creative direction, "The money shot").
3. Capture the evidence pages in the asset list; build the storyboard (one frame per beat, all four videos, real
   captures) and put it on the Friday tab as a review item through the feeder. Wait for his sign-off in words.
4. Then Codex renders per the creative direction and `produce-video`; watched full size with sound before it is
   called done. Titles and thumbnail words only after he records.
5. Article (1,000 to 1,400 words, "3 things you can do tomorrow"), outline, spine judge, fact gate: still to do.
