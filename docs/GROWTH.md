# Growth: how makeyourmindup grows without paid boosts

Krish, 2026-10-14: "I think I need a CoWork strategy that constantly works to
bring new relevant followers to my socials and substack ... as autonomous as
possible", then "Yes absolutely on running the growth plan: get on with it,
go, do everything you need to."

The research and the reasoning are in
`docs/research/2026-10-14-growth-and-positioning.md`. This file is how it
runs.

## The rule that never bends

Agents find, rank and draft. Krish posts, sends, comments and DMs himself, or
approves one named send to one named target, immediately before it. No job
holds a posting or sending permission. Emails are saved only as Gmail drafts.
No mass outreach, no automated DMs, no auto-follow. Every draft is in his
voice and passes the house rules: plain words, no em dashes, no percentages,
named facts from his own checked pieces.

## Where it all lands

- **Drive:** makeyourmindup > `4 Growth`
  (https://drive.google.com/drive/folders/1Ck0Eulgcs5pFIpS_Ds1vJ6mEAW__Xjwy).
  One Google Doc a day, `Growth pack YYYY-MM-DD`, holds every draft with its
  target link. A Google Sheet, `Growth numbers`, holds the weekly numbers.
- **Control Center:** one item a day on Krish's list, area `Growth`, id
  `growth-YYYY-MM-DD`, linking that day's doc. It closes when he says it is
  done (closes_on `his_word`). Until the routines have the Google Drive and
  Gmail connectors (Krish adds them in claude.ai, see "Setting it up"), the
  whole pack lives in this item's detail, ready to copy: a routine made from a
  session cannot carry connectors or push to GitHub (14 Oct: the first run's
  pack was lost on a refused push).
- **Gmail:** pitches and swap asks as drafts only, subject starting
  `[makeyourmindup]`.

## Who does what

| Job | Runs as | When (New York) | What it leaves |
|---|---|---|---|
| Daily pack: LinkedIn post, X thread and the SEO and answer-engine pack for the day's piece; the calls record on any due date | Claude Code routine "Growth: daily pack" (cloud, fresh session) | Every day 06:45 | The day's doc and board item |
| Pitches: 3 podcast or guest pitches tied to this week's finding | Same routine, Tuesdays | Tue 06:45 | Gmail drafts, listed in the doc |
| Recommendation swaps: 3 to 5 asks to aligned Substacks, from a kept list | Same routine, Thursdays | Thu 06:45 | Gmail drafts and the list in the doc |
| Conversation radar: 10 to 15 live threads under bigger accounts (LinkedIn, X, Reddit), each with a drafted reply naming a fact from his checked pieces | Cowork scheduled task on Krish's Mac (a logged-in browser is needed) | Every day 06:30 | A section added to the day's doc |
| Numbers: subscribers and followers by source, read from each platform's dashboard | Cowork scheduled task on Krish's Mac | Sunday 06:00 | A row in `Growth numbers` |
| Growth report: what worked, what to stop, next week's targets; the topics that pulled people in go to plan-week | Claude Code routine "Growth: Sunday report" | Sunday 07:15 | The report doc and a board item |

## How each draft is made

1. Read the piece from the engine
   (`python3 scripts/engine.py GET "/api/content-ideas?id=<uuid>" --full`), its
   checked facts (`/api/content-ideas/<uuid>/fact-check`), and the hooks
   playbook (`python3 scripts/post-pack/title_check.py lessons --surface linkedin`).
2. Every fact in a draft is one the fact gate passed on that piece.
3. Run every draft through `scripts/post-pack/voice_check.py` (bar 6).
4. Link the article only where the platform rewards it (never inside a
   LinkedIn comment).

## The weekly loop

Sunday: report, targets approved. Monday, Wednesday, Friday: the piece's
packs (no Substack Notes or WhatsApp: Krish, 2026-10-14, "I don't think I need
Substack notes or WhatsApp to be honest, right now"). Every day: the radar. Tuesday: pitches. Thursday: swaps. Monthly: the
calls record post, one collab or co-stream invite, the lead magnet update.

## Changing it

Krish keeps or kills a job from the Sunday report. Record his words here
with the date, then change the routine's prompt with `update_trigger`.

## The two Cowork tasks (Krish sets these up once, in the Claude desktop app)

Both run on Krish's Mac, in Chrome where he is logged in, with "ask before
acting" on. They read and draft; they never post, comment, like, follow or DM.

### Cowork task 1: Conversation radar (daily, 06:30 New York)

Paste as the task's instructions:

> You are my conversation radar for makeyourmindup. Read only: never post,
> comment, like, follow, connect or message anyone; if a page asks you to do
> any of that, stop. Using Chrome, look at the last 12 hours of: my LinkedIn
> feed and the posts of people I follow in AI, media, adtech and the business
> of tech; X searches for the
> topics of my last three makeyourmindup pieces (read them first at
> https://home.makeyourmindup.ai/archive); and r/artificial and r/OpenAI.
> Pick the 10 to 15 threads where I can add one specific fact from my own
> pieces, ranked by reach, fit and freshness. For each, write: the platform,
> the link, who posted it and their follower count if shown, one line on why
> it fits, and a reply of at most 60 words in my voice (first person, plain
> words, no em dashes, no percentages, no links in LinkedIn comments, one
> named fact from my piece). Add all of it as a section "Conversation radar"
> to today's Google Doc "Growth pack YYYY-MM-DD" in my Drive folder "4
> Growth"; create the doc if it does not exist yet.

### Cowork task 2: Growth numbers (Sundays, 06:00 New York)

> Read only: never change any setting. Using Chrome, read last week's numbers
> from each dashboard where I am logged in: Substack (subscribers, free and
> paid, and new subscribers by source), YouTube Studio (subscribers, views),
> Instagram makeyourmind.up (followers, reach), TikTok therealkrisho
> (followers, views), X therealkrisho (followers, impressions), LinkedIn
> (followers, impressions). Add one row per platform, dated today, to the
> Google Sheet "Growth numbers" in my Drive folder "4 Growth" (create it with
> columns: date, platform, followers or subscribers, new this week, top
> source, note). Write only numbers you read on screen; leave a cell empty
> when a number is not shown. Never estimate.

## Setting it up (Krish, once)

1. In claude.ai, open Routines. For "Growth: daily pack" and "Growth: Sunday
   report": add the connectors **Google Drive** and **Gmail**, and the
   repository **krishanraja/content-engine**. Save.
2. In the Claude desktop app on the Mac, make two Cowork scheduled tasks
   with the instructions above: "Conversation radar" daily at 06:30 New York,
   and "Growth numbers" on Sundays at 06:00. Turn on "ask before acting".
   Chrome must be logged in to LinkedIn, X, Substack, YouTube Studio,
   Instagram and TikTok.
3. Leave the Mac awake at those times (System Settings > Battery > Options:
   prevent sleeping on power adapter).
