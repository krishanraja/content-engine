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

## Part B. Growth

Moved out on 14 October 2026. Growth is its own system: the repository
krishanraja/growth-makeyourmindup (run as Codex sessions), reporting into
Control Center (Growth > Packs). Krish: "Content Engine needs nothing to do
with it, but Control Center certainly does." The plan and its evidence live
there, in `research.md`.

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
