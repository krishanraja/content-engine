# makeyourmindup: what the channel is, and how it grows without paid boosts

Prepared 14 October 2026. Research only. Nothing was posted, sent or changed anywhere.

---

## 0. What the site and channels say today (verbatim)

The exact sentence "I'm 70% sure people and businesses will advertise on ChatGPT" is not in any text I could read. I searched the site repo (`/home/user/makeyourmindup`, including `origin/main`), the live cover, the Substack home, about page and full RSS feed, and the YouTube channel description. The nearest match is in `WORKBENCH.md` line 790: "Krish keeps the ChatGPT ads ad-lib ("it's true")". That points to a spoken line in Wednesday's video. Instagram could not be read from here.

The real problem is wider than one line. The site sells the percentage scoreboard as part of what the channel is. Here is the current copy.

**Hero and meta** (`apps/cover/content/site.json`, served live at www.makeyourmindup.ai):

- Title tag: "makeyourmindup: AI, unpicked"
- Hero splash: "AI, unpicked."
- Dek: "We follow the money, look under the hood and mind the gap. You make your mind up."
- Meta description (also og and twitter): "We follow the money, look under the hood and mind the gap. You make your mind up. A free publication on how AI really works, every Monday, Wednesday and Friday."
- Marquee includes: "Every call scored in public".
- Staff box, "Written for": "Busy people who want AI explained without the sales pitch".

**The scoreboard, which still shows percentages** (`site.json` "scoreboard"; `apps/cover/components/Scoreboard.tsx` line 58 renders `{c.confidence}% sure`; the calls are in `apps/cover/content/config.json`):

- Title: "Every piece makes a call. We keep score."
- Body: "Each piece ends with a prediction, a date and how sure we are. When the date arrives, we mark it right, wrong or too close to call. The wrong ones go up as big as the right ones."
- Live example board text: "A major airline lets an AI agent rebook a missed flight with no human in the loop. Due 30 June 2026 · 70 % sure". The board also shows "By 30 June 2027, Amazon opens an authorised route for shopping agents ... 70" and "Higgsfield ... 85".
- The brand kit sample also uses it: `apps/cover/scripts/build-brand-kit.mjs` line 412, "Due 2027-03 · 70% sure".

**Substack** (home.makeyourmindup.ai): the meta description repeats the dek. The welcome post title is "Welcome to my new AI media channel - which will help you make your mind up and build incredible things with AI." The Suno article ends "How sure we are: 70%." The Amazon article ends "How sure we are? 70%".

**YouTube** (@makeyourmind-up, about): "Short videos from makeyourmindup, a free publication on how AI really works, in plain words ... Every piece ends with a prediction and a date. We keep score in public, misses included. Then you make your mind up."

**Small gaps found on the way:** `config.json` has `"instagram": null` and `"tiktok": null`, so the cover links neither, even though the Instagram account makeyourmind.up exists. The Substack is named "makeyourmind/up" while the site is "makeyourmindup".

---

## Part A. Positioning

### Why the "70% sure" hook is weak

1. **It is one prediction, not a promise.** A visitor learns one guess about one company. They do not learn what they get every week.
2. **It goes stale.** A dated call is news for a week. On the front door it ages every day.
3. **The number carries no meaning.** "70% sure" sounds exact but no reader can check it. Krish has banned it: "I'm overall getting sick of these percentage predictions" (`WORKBENCH.md` line 800). The site still shows percentages on the scoreboard, the brand kit and the YouTube description.
4. **It breaks the house title rules** (`config/title-verdicts.json`). It is not first person in a way that shows his work. It names no finding. It gives no reason to care.
5. **It sells the wrong thing.** The value is seeing the pattern early and making it make sense. The guess is only the last line of that. Leading with the guess makes the channel look like a tipster.
6. **"AI, unpicked" is clever but vague.** It names a method (taking things apart), not a payoff for the reader. The dek is a list of the three series names. Those names mean nothing to a stranger yet.

**Keep the dated calls, without the percentage.** A public record of held and broke calls is proof that he saw it first. That fits his purpose. Show the call, the date and the result. Drop "how sure". The board's columns are already in plain words: Right, Wrong, Too close to call, Not due yet.

### What the three series actually do

- Monday, follow.the.money: who gets paid when AI gets bought. Recent example: Warner sued Suno and now takes a cut.
- Wednesday, under.the.hood: a shipped thing taken apart, real or theatre. Examples: Higgsfield, Meta's Muse scored against its rivals.
- Friday, mind.the.gap (the headline series): the pattern across the week, and what comes next. Example: soon you won't pick your AI model.

Together they answer one question for the reader: **what is about to change, who wins, and what do I do before everyone else notices?** That is Krish's purpose: "I see what is coming before it is obvious and make it legible to people while it still counts."

### Four options

**Option 1. "See it coming"** (purpose-led)
- Line: **What's coming in AI, before it's obvious.**
- Supporting line: Three times a week I take one AI story apart: who gets paid, what's real, and where it leads. In plain words, while it still counts.
- The homepage leads with: Krish's face, the line, the newest piece's real finding (the newsstand is already under the hero), then the record of dated calls marked right or wrong.
- Note: this is already mind.the.gap's cover line in `site.json`. Moving it up to the masthead makes the headline series the promise of the whole channel.

**Option 2. "Who wins when AI moves"** (stakes-led)
- Line: **AI is moving money and jobs. I show you where, early.**
- Supporting line: Every Monday, Wednesday and Friday: who gets paid, what actually works, and what happens next.
- The homepage leads with: a "this week's winners and losers" strip taken from the latest pieces (Warner gets paid; Amazon locked Muse out; Walmart let it in).
- Strength: concrete and aspirational. Risk: tilts towards follow.the.money and undersells the build series.

**Option 3. "The AI everyone's talking about, taken apart"** (method-led; sharpens "AI, unpicked")
- Line: **I take apart the AI everyone's talking about, and show you what's real.**
- Supporting line: Who gets paid, how it's built, and where it leads. Free, three times a week.
- The homepage leads with: the felt-robot "real or theatre" image the cover already uses, plus the last three teardowns.
- Strength: keeps the current brand world, so little rework. Risk: a teardown is backward-looking. It does not carry "before it's obvious".

**Option 4. "Your early read on AI"** (reader-led, for the face)
- Line: **Your early read on AI, for people who'd rather not be caught out.**
- Supporting line: What it means for you as a customer, a builder and a boss, three times a week, in plain words.
- The homepage leads with: three doors, one each for the consumer, the business builder and "how the old way is changing" (the THREE_LENSES house rule).
- Strength: speaks straight to "the senior leader who will not admit they are not ready". Risk: "caught out" leans on fear. It is the least fun of the four, against his "fascinating and aspirational" rule.

### Recommendation: Option 1

**"What's coming in AI, before it's obvious."**

Why:
1. It is his purpose in reader words. Every piece can keep the promise, because each piece ends on what comes next.
2. It covers all three series. Money, build and pattern are three ways of seeing it coming.
3. The proof is built in, with no percentages. The record of right and wrong calls is the evidence that he saw it first. "Misses included" stays as the honesty marker.
4. It ages well. It is a standing promise, not one guess.
5. It passes the house tests. It is short and in plain words, with no straw man and no stock phrase. A 12-year-old understands it.
6. It is cheap to ship. The line already exists in `site.json`, and the hero, newsstand and scoreboard are already built.

What changes on the site if Krish picks it (to do later, with his approval, not done here):
- Hero splash: "What's coming in AI, before it's obvious." Keep "AI, unpicked" as the strap or retire it.
- Dek: "Three times a week I take one AI story apart: who gets paid, what's real, and where it leads. You make your mind up."
- Scoreboard: remove "how sure we are" and the "% sure" line in `Scoreboard.tsx` and the `confidence` fields. Retitle it "Called early. Marked in public." Body: "Every piece ends with a call and a date. When the date comes, we mark it right or wrong. The wrong ones go up as big as the right ones."
- Meta description: "What's coming in AI, before it's obvious. Krish Raja takes one AI story apart every Monday, Wednesday and Friday: who gets paid, what's real, and where it leads. Free." (This also sets the answer-engine summary. See job 8.)
- YouTube about and Substack about: the same line, with the "prediction and a date" sentence kept but no percentage.
- Fix the `instagram` and `tiktok` nulls in `config.json`.
- Titles still go to Krish as options first (house rule). These lines are proposals, not picks.

---

## Part B. The Cowork growth plan: agents do the legwork, Krish approves

### What the evidence says works (2025 to 2026)

Most growth data is self-reported by creators or vendors. The table shows how strong each piece of evidence is.

| Lever | Evidence | How strong |
|---|---|---|
| Substack network (Recommendations and the app) | Substack: Recommendations and the app "drive 50% of all new subscriptions and 25% of new paid subscriptions" (22 Feb 2024). https://on.substack.com/cp/142007285 | Primary, but 2024. No official 2025 or 2026 figure found |
| Recommendation swaps | Write Build Scale reports 2,300+ new subscribers from asking for swaps. https://writebuildscale.substack.com/p/the-ultimate-guide-to-growing-your . Tim Mason reports 352. https://timomason.substack.com/p/substack-recommendations | Creator self-report |
| Substack Notes | One creator: Notes drove over 60% of growth, 11 to about 5,800 in six months (sells a course). https://thrivewithcarrie.substack.com/p/how-to-start-substack-newsletter-2026 . An analysis of 9,641 Notes from 689 writers (April 2026): the best Note drove 111 free subscribers, and likes alone do not predict subscribers. https://writebuildscale.substack.com/p/i-analyzed-9641-substack-notes-heres | Self-report; directionally consistent |
| "Viral" Notes are fool's gold | Count conversations started, not likes. https://mackcollier.substack.com/p/the-viral-note-is-the-fools-gold | Opinion, consistent with the data above |
| Substack Live co-streams | Up to three publishers can stream together. Gabe Fleisher's subscriber count spiked after co-streaming with Chris Cillizza, mostly free subscribers. https://digiday.com/media/how-substack-creators-are-pooling-audiences-with-live-video-co-hosting/ . Support page: https://support.substack.com/hc/en-us/articles/30316077882516-Getting-started-with-Live-Video-on-Substack | Reported anecdote |
| LinkedIn comments on bigger accounts | Van der Blom: reach down about 60% for active creators over two years (1.3M posts). https://podcast.creatorscience.com/richard-van-der-blom-2/ . He says a few well-chosen comments brought more business than his posts, and most comment impressions come from the other author's network. https://enterprisezone.cc/why-comments-outperform-posts-on-linkedin-insights-from-richard-van-der-blom/ . Links in comments are reportedly suppressed. https://melaniegoodmanlinkedinconsultant.substack.com/p/linkedin-algorithm-2026-reach-topic-authority | Practitioner data, second-hand summaries |
| LinkedIn slop penalty | "Seems like AI slop" button since 30 July 2026, so generic AI comments get less reach. In `docs/research/2026-10-14-viral-hooks-corpus.md` (refs 7, 8) | Reported by trade press |
| Instagram reach to non-followers | Mosseri: sends matter slightly more for reaching non-followers; Trial Reels show only to non-followers; reposting the same Trial Reel can be detected and limited. https://buffer.com/resources/instagram-trial-reels/ , https://www.thereelstars.com/uncategorized/adam-mosseri-reveals-instagram-trial-reels-rule-that-could-limit-your-reach/ | Mosseri statements, second-hand |
| Instagram collab posts | A collab post shows on every collaborator's profile and reaches all their followers, up to five collaborators. https://buffer.com/resources/instagram-collab-post/ , https://planable.io/blog/instagram-collaborations/ . Uplift claims (about twice the impressions, Emplifi) are unverified | Mechanics solid; uplift soft |
| Shorts plus long-form | AIR, 18,000 channels: channels mixing Shorts with long-form have more subscribers in most niches, best at about 25 to 40% of uploads being Shorts. https://air.io/en/audience-growth/do-youtube-shorts-help-your-long-form-videos-grow-data-from-18000-channels | Vendor, large sample |
| Podcast guesting | Codie Sanchez did 3 to 7 podcast guest spots almost every month, and her subscriber growth tracked them. https://growthinreverse.com/insanely-valuable-content-nms/ . No controlled study exists, so track it with a link per show | Correlation |
| Answer engines (AEO) | Only about 12% of URLs that AI tools cite are also in Google's top ten; ChatGPT leans on Reddit, Wikipedia and news. https://otterly.ai/blog/the-ai-citations-report-2026/ . A newsletter citation index: https://everything-pr.com/the-substack-citation-index-2026 . Titles that answer the query get cited more (hooks corpus ref 11) | Vendor research |
| Reddit | No outright ban on self-promotion. Each subreddit sets its own limits. Folk rule: about 10% of activity may be your own links; disclose who you are. https://redship.io/blog/reddit-self-promotion-rules-2026 | Practitioner guide |
| Lead magnets | Checklists and cheat sheets convert better than ebooks. Pages with one call to action convert far better than pages with five. https://www.shno.co/marketing-statistics/lead-magnet-conversion-statistics , https://www.mailerlite.com/blog/best-lead-magnet-statistics | Vendor benchmarks |

**What this means:** the free levers that compound are (1) Substack's own network, through Notes and recommendation swaps; (2) showing up in other people's audiences, through comments, guest spots, co-streams and collab posts; and (3) packaging that gets sent and searched. Posting more on his own feeds is the weakest of the three.

### How Cowork fits

Claude Cowork runs a job in the cloud and keeps going after the laptop closes. Scheduled tasks "run with no device online" and leave work "drafted but unsent". Anthropic says: "Nothing ships until you've reviewed and approved it." Claude asks before acting by default. (Sources: https://claude.com/blog/cowork-web-mobile , https://claude.com/blog/cowork-is-now-claude , as recorded in `docs/plans/2026-10-14-wednesday/research-assistants-direction.md`.) Claude Code scheduled tasks can run the same jobs against this repository.

**Hard rules for every job:**
1. Agents find, rank and draft. Krish posts, sends, comments and DMs, or approves one named send to one named target. Approval never carries over to the next action (`makeyourmindup/AGENTS.md`).
2. Each job runs in "ask before acting" mode, never "Skip all approvals".
3. One approval queue. Everything lands in Control Center's waiting list (https://controlcenter.krishraja.com/#/home?waiting=1), and emails are saved only as Gmail drafts. No new dashboard (North Star: "not a second dashboard").
4. Every draft is in his voice and passes the house rules: plain words, no em dashes, no slop phrases, no percentages, named facts from his own checked pieces. A comment must say something only he could say.
5. No mass outreach, no automated DMs and no auto-follow. Platform rules forbid it, and it would spend his name.
6. Agent output is observation only. Only what Krish does or says counts as taste (North Star rule 1).
7. No invented numbers. Each weekly report quotes the platform dashboards he exports or reads out.

**Krish's time budget:** about 20 minutes a day plus 30 minutes on Sunday. This sits on top of his two to four hours per signature piece.

### The weekly loop

| Day | Agent work (overnight, queued by 7am) | Krish (approve, then act) |
|---|---|---|
| Sunday | Growth report from last week; plan-week gets the topics that pulled people in; pick this week's swap, pitch and collab targets | 30 min: read the report, approve targets |
| Monday | Piece out. Notes pack, LinkedIn post, clip pack and AEO pack for it. Conversation radar | 20 min: approve and post Notes and comments |
| Tuesday | Radar; podcast and guest pitches drafted (Gmail drafts) | 20 min: comments; send the pitches he likes |
| Wednesday | Piece out. Same packs. Radar | 20 min |
| Thursday | Radar; swap and collab outreach drafted; co-stream invite drafted | 20 min |
| Friday | Piece out (the headline series). Same packs. Radar. Monthly: "calls marked" post | 20 min |
| Saturday | Light radar; weekend reposts of Friday's piece | 10 min, optional |

### The recurring jobs

| # | Job | What it does | Cadence | What Krish approves | Metric it moves |
|---|---|---|---|---|---|
| 1 | Conversation radar | Finds 10 to 15 live threads where his finding adds something real: Substack Notes, LinkedIn posts by people in his world (media, adtech, data, AI creators, PE and VC operators), X, two or three subreddits, YouTube comments under bigger AI channels. Ranks them by reach, fit and freshness (under 12 hours old). Drafts one reply each that names a fact from his checked pieces. Puts no links in LinkedIn comments | Daily, 6am London | Picks 5 to 8, edits, posts them himself | Profile visits, new follows and subscribers traced to comments; replies he gets back |
| 2 | Notes pack | For each piece: 5 to 7 Notes over the week (the finding, a chart, a quote, a question, a restack with one added line, a "this call was right/wrong" note). Follows the hooks playbook and his title lessons | With each piece; queued per day | Ticks which go out, posts or schedules them in Substack | Subscribers from Notes (Substack shows the source); conversations started, not likes |
| 3 | Recommendation swap scout | Keeps a list of 30 aligned Substacks (AI, the creator economy, media and adtech, business of tech) of similar size or a bit bigger, with recent posts and overlap. Drafts a short personal note offering a swap, citing one of their posts. Tracks replies | Weekly, Thursday; 3 to 5 asks a week | Chooses whom to ask; sends from his account | Subscribers from Recommendations; number of active swaps |
| 4 | Guest and podcast pitcher | Finds shows and newsletters whose audience matches the face (Podchaser connector, Substack guest posts, LinkedIn newsletters). Drafts a pitch tied to this week's finding with three talk points. Makes one tracked link per show | Weekly, Tuesday; 3 pitches | Picks and sends (Gmail drafts only) | Bookings a month; subscribers through each show's link |
| 5 | Clip and collab desk | From each long cut: 2 or 3 extra vertical clips with the search phrase in speech, on screen and caption; one Trial Reel variant (never a repeat); a "send this to..." moment. Monthly: finds one adjacent creator for a collab Reel or a Substack Live co-stream and drafts the invite and run sheet | Per piece; collab monthly | Approves clips (the engine's existing gates); sends the invite | Sends per reach, 3-second hold, follows from non-followers; co-stream subscribers |
| 6 | Rooms to pieces | Krish's keynotes, rooms and podcasts (North Star job 4). Turns each appearance into a clip, a Note and a "talked about this at..." LinkedIn post. Asks hosts to tag him in a collab post | After each appearance | Approves the drafts | Subscribers per appearance |
| 7 | Calls record | Keeps the public record of dated calls (no percentages). When a date arrives, drafts the "we called it / we missed it" post for every channel. This is proof that he saw it first, and it is very shareable | Monthly, plus on each due date | Marks right or wrong himself; approves the post | Shares and sends; return visits to the cover |
| 8 | SEO and answer-engine pack | Per article: a search title and description of 51 to 60 characters that match the H1, a two-line answer up top that states the finding, a short "the questions this answers" block, sources linked. Weekly: asks ChatGPT, Claude, Perplexity and Google 20 fixed questions in his topics and records whether makeyourmindup is cited | Per piece; weekly check | Approves title and description options (house rule: titles go to him first) | Citations found; organic and referral visits |
| 9 | Lead magnet | One useful, forwardable page that is updated monthly. Suggested: "The AI money map: who's getting paid as AI moves in, and who's losing", built from follow.the.money pieces, with the calls record. One call to action: subscribe. Used as the link in every bio and in pitches | Built once in week 3; updated monthly | Approves the angle, the title and each update | Visitor-to-subscriber rate on that page |
| 10 | Growth report | Sunday: subscribers and follows by source on every platform, from numbers he exports or reads out. What worked, what to stop, and next week's targets. Sends the topics that pulled people in to plan-week | Weekly, Sunday 7am | Reads it; keeps or kills a job | All of the above; cost of his time per new subscriber |

**How to build it:** each job is one scheduled task, either in Cowork ("ask before acting") or as a Claude Code scheduled task on this repository. Results go to Control Center's waiting list as one item per job per day, and emails go to Gmail drafts. No job holds a posting or sending permission. Discovery uses web search and the connected readers (Podchaser, YouTube pages). Logging in to LinkedIn, X or Reddit to post stays with Krish.

### The first 30 days

**Week 1: fix the front door and set the baseline**
- Krish picks a positioning line (Part A). The cover, Substack about, YouTube about and Instagram bio change to it on his approval. Percentages come off the scoreboard, the brand kit sample and the YouTube description.
- Link Instagram makeyourmind.up and TikTok on the cover.
- Baseline: subscribers, followers and sources on every platform, read from the dashboards. No guessed numbers.
- Turn on job 10 (report) and job 1 (radar), at 5 comments a day.
- Build the swap list (job 3) and the pitch list (job 4).

**Week 2: the Substack network**
- Notes pack live for all three pieces (job 2): at least one Note a day.
- First 5 swap asks sent.
- First 3 podcast or guest pitches sent.
- SEO and answer-engine pack on every new piece; the first citation check sets the baseline (job 8).

**Week 3: other people's audiences**
- First co-stream or collab Reel booked (job 5).
- Lead magnet drafted and approved (job 9), then linked from every bio.
- Radar moves up to 8 comments a day if week 2's report shows follows from comments.
- Trial Reels: one variant per piece.

**Week 4: keep what works, drop what doesn't**
- First "calls marked" post (job 7), even if no call is due yet: show the board and what is coming.
- Review: keep the three jobs that brought the most subscribers per minute of Krish's time; pause the weakest one.
- Second round of swaps (aim: 5 active), 6 pitches sent in total.

### The three highest-leverage moves

1. **Recommendation swaps plus daily Notes, built from his finished pieces.** Substack's own network is the largest proven free source of subscribers (Substack: Recommendations and the app drive half of all new subscriptions). Swaps compound: each one keeps working with no further effort. The agent does all of the finding and drafting; Krish sends 3 to 5 asks a week and ticks the Notes.
2. **A daily "conversation radar" where he comments under bigger accounts with a fact only he has.** Reach on his own posts is falling, but comments are seen by the other author's network. One specific line from a checked piece also beats AI slop, which LinkedIn now penalises. The agent finds and drafts; Krish edits and posts 5 to 8 a day.
3. **Borrowed stages: podcast guest spots, Substack Live co-streams and collab Reels, each tied to the week's finding.** These put him in front of an audience that already trusts the host. They also produce clips and Notes for jobs 2 and 5, and they match the North Star's job 4 ("turn every room, keynote and podcast into one published piece a week"). The agent pitches and preps; Krish chooses and shows up.

The positioning fix comes before all three. Every comment, swap and pitch sends people to the front door, so it needs to say "what's coming in AI, before it's obvious", not one old guess with a percentage.

---

## Sources

- Substack, Recommendations and app share of new subscriptions (22 Feb 2024): https://on.substack.com/cp/142007285
- Write Build Scale, swaps: https://writebuildscale.substack.com/p/the-ultimate-guide-to-growing-your
- Tim Mason, recommendations: https://timomason.substack.com/p/substack-recommendations
- Notes growth report: https://thrivewithcarrie.substack.com/p/how-to-start-substack-newsletter-2026
- 9,641 Notes analysed: https://writebuildscale.substack.com/p/i-analyzed-9641-substack-notes-heres
- Viral Notes as fool's gold: https://mackcollier.substack.com/p/the-viral-note-is-the-fools-gold
- Substack co-streams (Digiday): https://digiday.com/media/how-substack-creators-are-pooling-audiences-with-live-video-co-hosting/
- Substack Live help: https://support.substack.com/hc/en-us/articles/30316077882516-Getting-started-with-Live-Video-on-Substack
- Van der Blom, LinkedIn 2026: https://podcast.creatorscience.com/richard-van-der-blom-2/
- Comments vs posts: https://enterprisezone.cc/why-comments-outperform-posts-on-linkedin-insights-from-richard-van-der-blom/
- Links in LinkedIn comments: https://melaniegoodmanlinkedinconsultant.substack.com/p/linkedin-algorithm-2026-reach-topic-authority
- Instagram Trial Reels: https://buffer.com/resources/instagram-trial-reels/
- Mosseri on repeated Trial Reels: https://www.thereelstars.com/uncategorized/adam-mosseri-reveals-instagram-trial-reels-rule-that-could-limit-your-reach/
- Instagram collab posts: https://buffer.com/resources/instagram-collab-post/ and https://planable.io/blog/instagram-collaborations/
- Shorts and long-form, 18,000 channels: https://air.io/en/audience-growth/do-youtube-shorts-help-your-long-form-videos-grow-data-from-18000-channels
- Podcast guesting and newsletter growth: https://growthinreverse.com/insanely-valuable-content-nms/
- AI citations report 2026: https://otterly.ai/blog/the-ai-citations-report-2026/
- Substack citation index: https://everything-pr.com/the-substack-citation-index-2026
- Reddit self-promotion: https://redship.io/blog/reddit-self-promotion-rules-2026
- Lead magnet benchmarks: https://www.shno.co/marketing-statistics/lead-magnet-conversion-statistics and https://www.mailerlite.com/blog/best-lead-magnet-statistics
- Claude Cowork: https://claude.com/blog/cowork-web-mobile and https://claude.com/blog/cowork-is-now-claude
- Internal: `docs/NORTH_STAR.md`, `WORKBENCH.md` (lines 51 to 56, 781, 790, 800), `docs/research/2026-10-14-viral-hooks-corpus.md`, `config/hook-playbook.json`, `config/title-verdicts.json`, `/home/user/makeyourmindup/apps/cover/content/site.json`, `.../content/config.json`, `.../components/Scoreboard.tsx`, `.../scripts/build-brand-kit.mjs`
