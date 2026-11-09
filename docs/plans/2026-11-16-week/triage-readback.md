# Triage readback, week of 16 Nov (read 9 Nov 2026)

Read from the 16 Nov board with `board_web.py read 2026-11-16 picks|queue|comments`; every document below has
`updated_by: Krish`, pressed 13:05 to 13:18 UTC on 9 Nov. His words are copied exactly. Only the final state of each
card counts (`config/learnings.json` `reading-his-board-marks`).

## Monday 16 Nov, follow.the.money
- mon-2 Oracle, picked (13:07:48), then Wider piece (13:07:51): "I think this becomes a broader piece about where, in general, money comes from that tech companies get to build AI? The output of this article should be devastatingly simple and insightful even though it's pulling in a lot of complexity of insight. You'll need to give me a prompt to go to Perplexity and generate the right research for you because this is going to need to be well evidenced."
- mon-4 Anthropic's loss-making quarter, Next week (week of 23 Nov): "I like this for next week. Your write-up here does not seem simple enough. It's a bit too complex to understand properly. The real question needs to be how will Anthropic close those losses? What might they be doing in the future? This needs more evidence and research from you before you bring this story back to me."
- mon-1 Infosys margin, Reject: "I just said that Infosys is boring so why did you make the piece about Infosys?"
- mon-3 ChatGPT fuel gauge: no press.

## Wednesday 18 Nov, under.the.hood
- wed-2 build versus buy, picked (13:11:11) with the note, then Wider piece (13:11:18): "Yes give me a Perplexity prompt. I can go and bring a lot of evidence to Deep Research, back to you with."
- wed-4 agents trade a secret, Future trend: "Let's keep an eye on this and make this figure out the ethics and morals behind this and do deeper research into why this might be occurring. Let's ask the 5 whys and find more evidence first."
- wed-3 OpenAI gadget, Reject: "I have no idea what the point of this story is."
- wed-1 tiny fix: no press.

## Friday 20 Nov, mind.the.gap
- fri-3 writing is the job now, picked (13:13:05; fri-4 was picked first at 12:55 and replaced), then Next week (13:13:08, week of 23 Nov), no note.
- fri-1 the 1986 proof, Wider piece: "We need to do a much wider piece on this. It needs to be way less finicky and technical and way more big-picture and visionary as to where the future of knowledge is going based on what we're seeing as a trend. This needs 10 times the amount of research and substance behind it than we've got here currently."
- fri-2 AI building itself, Wider piece: "This is similar to the previous feedback above. This topic is so big and needs to be really substantiated properly as to what's actually real and what's myth. Is AI genuinely starting to build itself? This needs to be the deepest of deep dives, really, really, really well evidenced, and really fun to consume and listen to, and simple"
- fri-4 voters and data centres: picked at 12:55, then replaced by fri-3; no other press.

## Off days
- Tue povteach, idea Improve: "We need to use the exact existing video but just change the caption to \"POV: your AI agent using your computer without being set up properly by you\""
- Tue burntokens, Reject: "The idea is lame. This doesn't translate into a carousel properly."
- Tue infosys, Reject: "Told you already. Infosys is boring."
- Tue fuelgauge: no press.
- Thu fortytoone, idea Improve: "Needs to be about the future of AI under the new U.S. system after the midterms."
- Thu lookalikes, direction Improve: "We need this to work as a standalone explainer for the personalities and use cases for each of the assistants and be really helpful to the layperson to understand what they can use when."
- Thu swarmdeal, Next week: "Let's align this for when the full piece has more substance behind it."
- Thu tinyfix, Next week: "I think we'll need to wait until this piece is more substantiated."
- Sat good news: no press.

## What reached the pieces
`GET /api/week/options?week_start=2026-11-16`: nothing is scheduled in any series. No pick reached its piece.

## Delivered
The two Perplexity prompts he asked for: `perplexity-prompts.md` (sent to him as a file, 9 Nov).

## Engine miss (observation)
His cue on the 9 Nov board said: "Infosys is boring as hell but \"Who's stealing your money and where's the extra margin going?\" is a really interesting topic." The 7 Nov brief carried the cue as "who's clipping the margin" without his Infosys words, and the run built Monday and Tuesday options on Infosys. Both were rejected.

His words went to his taste ledger (report_to_taste_engine, 9 Nov): mon-1, Tue infosys, Tue burntokens and wed-3.

## Correction, 9 Nov 13:30 UTC: Friday, and his lost comments
Krish, Sunday room chat, 9 Nov: "No, I actually picked the U.S. midterms one for Friday. Somehow, you've also managed to lose a bunch of my comments for that article."

`board_history` for the week (Supabase, every save the board server received) shows, for Friday:
- picks/fri rev 1, 13:12:58: fri-4 (voters and data centres), no note.
- picks/fri rev 2, 13:13:05: fri-3, 7 seconds later. queue/fri-3 Next week followed at 13:13:08.
- picks/fri rev 3, 13:22:46: fri-4 again, no note (after the readback above was read).
- No queue/fri-4 document was ever saved, and no comment with his words on fri-4.

So the server never received his comments on fri-4: they were lost in the page before any save, and the page keeps
no unsent text. Suspected, not proven: the comment box's text was not sent with the pick, or the fri-3 pick seven
seconds later replaced the page state before it saved. Every other word of his in `board_history` is in the current
documents; one save blanked off-tue-infosys's words (rev 2, 13:16:09) and his next press restored them (rev 3).
Board code is frozen this week; this goes to the parent session and the board v4 work.
