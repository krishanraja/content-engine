# Wed 11 Nov scripts: checks, facts and read-back (make-piece run, 4 Nov 2026)

Piece 36886e0b-4b32-473b-be72-b0aef31fccef, from the signed lock `narrative-lock-wed.md` (sha256 d151291b...).
Scripts: `docs/plans/2026-11-11-draft-script.md` (5-minute) and `-90s.md` (90-second).
Run: https://github.com/krishanraja/content-engine/actions/runs/41788254038

## Gates
- `story_check.py` ready for both (`--series under_the_hood`). One warning is kept on purpose:
  PERSONAL_INTRO, because the signed style recipe opens cold on the two songs he talks over.
  The short cut keeps a SCRIPT_AS_HE_TALKS warning (fewer So/And/But openers) to stay under 195 words.
- `copy_lint.py` clean on both.
- Kill list: `node` is not an allowed command in this run, so `kill-list.mjs` did not run. Its vetoes
  (`kill-list.v1.json`) were checked by reading both files: no em dash, no "!", no retired name, no product
  name, no name of his, none of the banned words or preach patterns. Run the node kill list at the next
  session that can.
- `making.py scripts` recorded both (Scripts: done, not in Teleprompter yet). Workroom recorded.
- No "3 things you can do" anywhere (Ruling, Krish, 2026-11-03, in the lock). The close is his signed line,
  led in by one first-person beat: "So the next time someone hands me a song, an advert or a report, I'll ask
  one thing. Who did which bit?"

## Facts the scripts state, and where each rests (no web or Drive in this run)
All from `wed-research.md` and the lock's Facts to check; none re-fetched here. The fact gate checks them
against filed sources with the article.
- Movin' To The Sun, UK No. 2, in the charts for months (Official Charts: 19 weeks). Said as "months".
- Imael Angel, a Reiki master and children's author with no music background, typed lyrics into Suno
  (hu.wikipedia; Amazon author page). The short cut says "a healer" and "the app" to keep names to four.
- The first version's voice was AI (frequence3.com; brief).
- Spread as background music on short videos; many comments ask "what's this song?" (Reddit corpus, brief).
- HUGEL rebuilt it by hand with a new Ultra Naté vocal; a thin layer of the AI vocal remains under hers
  (weraveyou.com, edm.com). "Real hits behind her" is general knowledge (to source in the article).
- Bad Times re-sung by a human, rebuilt by human producers, put out by Universal (Qobuz credits). The script
  says "one of the biggest record companies in the world" without naming it, and does not name Cali Bee.
- Grammys: ruled out of songwriting, eligible for performance (The Australian, 17 Oct 2026). "The writing
  prize covers the music as well as the words" explains the songwriting categories; check it at the gate.
- Under Ultra Naté's video few comments mention AI (5.6% of comments, brief); top comments are nostalgia.
- Not stated in either script: 113 million plays, the Beatport record, the "95% human" estimate (all
  reported only), the Shazam Greece number.

## Read-back: two rounds, readers A, B and C on each cut
Every retelling, in both rounds, matched the spine and the answer (AI got her in the door, people carried
it the rest of the way, it is both). No round came back "nothing" from all three. Round one raised: the
unnamed second song, "behind short videos", who "hers" was, "writing" looking like her lyrics, the Grammys
"couldn't say" against a split ruling, "every layer", and no link to the viewer's own work. Round two
raised smaller things: the writing prize again, what "who did which bit" gives a leader, "both, all the way
through" against a sequence, "healer" vague, "go up for". Each was fixed in the words now recorded.
Per make-piece step 4, the words are on Wednesday's tab for Krish (two review boxes and one waiting line,
web board build 9f6ce78a, Monday and Friday kept as they were). His Approve scripts press is his sign-off;
record it with `making.py <uuid> read-back long|short --krish-words "Krish, DATE: ..."`. No reader read-back
is recorded as passed.

## Next
His press or his edits (carried by `edit_sweep.py`); then the creative direction (Scripts step 7, motion
style required), and the article in the background (1,000 to 1,400 words, "we", no three-things section by
his ruling for this piece).
