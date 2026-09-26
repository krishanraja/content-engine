---
repo: krishanraja/content-engine
product: Mindmake content engine
as_of: 2026-09-25
head: 47f3944
lifecycle: building
production_url: https://content-engine-flame-nu.vercel.app
state_doc: docs/STATE.md
history_log: docs/history/LOG.md
truth_files: []
authority_order: [production readback (the Vercel project content-engine and the Supabase database), AGENTS.md, docs/NORTH_STAR.md, docs/STATE.md, docs/SYSTEM_MAP.md, docs/CONTENT_ENGINE.md, docs/STUDIO.md, docs/ENGINE_SESSION.md, docs/GLOSSARY.md, README.md]
steward: https://github.com/krishanraja/control-center/blob/main/docs/steward/RUNBOOK.md
never_publish: [the Supabase project id, any credential or secret name including the operator token, the cron secret, Drive paths, Windows runner host names and local paths, runner bearer and signing key target names, any Remotion licence status detail, any client or guest name in config, the text of any subchannel mandate or of the voice block]
---
# Mindmake content engine: where it is right now

## What it is

The Mindmake content engine is the production team behind makeyourmindup, Krish Raja's publication: it finds what is worth saying, judges it with a blind panel, drafts it in his voice to the right subchannel's mandate, and turns it into Shorts and carousels, while Krish makes every decision that matters and nothing publishes itself. One repository holds two halves over one Supabase database. The content engine (`apps/control-plane`, its own Vercel project) runs 20 crons of collectors, a judge ladder, drafting and rewriting routes, channel cuts, production briefs and the ledger the engine learns from. The Video and Carousel Studio (`packages/`, `apps/runner`, `apps/renderer`) turns an approved brief into a Short or a carousel through hash-gated stations on Krish's Windows machine. Control Center is the desk Krish works at; this repository has no interface of its own. The publication, makeyourmindup, is hosted on Substack with its cover page at makeyourmindup.ai, and has three subchannels, follow.the.money, mind.the.gap and under.the.hood, each held to a mandate that lives in the database (`docs/NORTH_STAR.md`).

## Who it is for and why it matters for Mindmake

The engine is internal: it is how Mindmake's mission reaches its reader, the face in `apps/control-plane/api/_mission.ts` ("a senior leader who will not admit to anyone that they are not ready for what is happening... leaders of PE and VC backed media, adtech and data businesses Krish already knows"), and its job there is "one published piece a week aimed at the face, with sources". What it proves to that reader is that one person can run a publication with an AI production team and stay the editor: the machine proposes and shows its working, the person decides, and the machine learns only from what the person decided.

Stories a writer can carry without asking Krish:

- **Nobody was grading the judges.** A panel of blind judges had scored ideas since 2026-09-09, and the view that compares each judge with Krish's decision returned zero rows, because no screen sent the panel's run id with his decision. The first seven graded rows arrived on 2026-09-24, from his first decision on a piece (`docs/STATE.md`).
- **The engine taught the habit he had banned.** The stored voice block called the "Not X, Y" move his most consistent habit. A rewrite told to use none kept about seven. Fixing the prompt did not work; fixing the source did (walk log, H7 and H8).
- **The evidence judge could not see the evidence.** It gave 9 to a draft whose headline figure had no source, then killed a fully sourced draft as "invented". It had never been shown the sources. On the same text after the fix: kill 3 became pass 9 (walk log, H9).
- **An agent's work was about to be learned as his taste.** The ledger defaulted every row to Krish, so the engine would have learned from its own session. Agent rows are now observations the compiler never reads (walk log, H6).
- **The weakest-judge rule failed its own test.** Scoring a piece on its lowest judge put the panel 2.8 points below Krish's own grades; the median of the same judges came within 0.4 (`79c68e7`).

Objection it answers: "AI content is slop." Here is an engine that grades its judges against the editor and never counts its own actions as taste.

## Where it is right now (as of 2026-09-25)

Lifecycle: building. Readback the same day unless a commit is named.

- **Choosing is live.** All 20 crons in `apps/control-plane/vercel.json` wrote run rows in the last seven days; the judge sweep ran 59 times; 243 panel runs; 93 live ideas routed to a subchannel.
- **Making was walked for the first time on 2026-09-24.** One piece per subchannel, from judged-ready to the edge of publishing (`docs/walks/2026-09-three-piece-walk.md`). Piece 1 ("Same agent, opposite answers", follow.the.money) is in `review` and needs the plain-words rewrite and the fact gate; piece 2 ("Who picks your AI?", mind.the.gap) passed the fact gate, has a web edition in `editions/` and a Short storyboard built from its receipts, and the only check holding its approval is the prediction's confidence, which is Krish's to set; piece 3 (under.the.hood) is next.
- **Nothing is published.** `content_ideas` has 0 published rows. No Short or carousel has a final approval, package or upload.
- **The engine learns only from Krish.** 55 ledger rows, 37 of them his; every agent row since the fix is `observation_only`. `judge_calibration` has 7 settled rows.
- **The Studio knows the three subchannels.** A routed piece can get a production brief in its own name (2026-09-26). A branded render still needs Krish's approved wordmark for each subchannel, and the Windows runner needs updating to take live-name briefs (`docs/STUDIO.md`).
- **Known risks.** About a dozen content routes accept writes with no auth; four crons' last runs failed (`docs/STATE.md`, "Broken or risky"). `npm run verify` passes its guards again.

## What changed recently

- 2026-09-26 **The Studio learns follow.the.money, mind.the.gap and under.the.hood; piece 2 set at 75%** (`47f3944`, `e4f1394`, `92f6294`; Control Center `2c60cd0`). Rulings (Krish, 2026-09-26): "I agree with all your four except for number one", and for number one, 75%: "I'd rather take a clearer stance than sit on the fence all the time and say 60%." Why: no piece on a live subchannel could reach video or carousel, and the fact check would have been re-run for a number that is his judgement. Now the Studio takes all three names while every record made under the retired two stays valid, an old runner is never handed a name it cannot parse, a confidence no longer forces a fact re-check, and CLEAR_STANCE is a house rule. Piece 2 clears every blocking check and waits on his approval. Shorts take sentence-case captions and close on the dated prediction.
- 2026-09-25 **Krish's rulings in one list every stage reads, checked before approval, with receipts for the Shorts** (`a032649`, `d574a8e`, `d408e11`; Control Center `37538b7`). Ruling (Krish, 2026-09-25): think of the engine "as a modular set of components that work together to come alive", upgrading every part a guideline touches, "brainstorming an idea and judging it" through "gates and checks prior to publish". Why: his rulings were copied into some prompts and missing from others; no judge had read any of them. Now `api/_houseRules.ts` holds each with his words and reaches writers, both judge gates, the joke pass and the final pass, and a test fails when one goes unenforced; approval needs the machine checks (no "Not X, Y", no em dashes, reading age, a dated prediction with a confidence); and the fact gate's verbatim quotes come back as receipts, the proof panels for a Short in the style of an ad he liked (`docs/REFERENCE_INSTAGRAM_AD.md`, proposed, not confirmed). Also: `main`'s CI had been red in both repositories while I kept pushing; both are green again, and agent sessions now read CI after every push (walk log F20).
- 2026-09-25 **Bricks, not one article at a time** (`494d4f4`, `18f34fd`, `a5c5ab3`, `04449a6`; Control Center `d006f60`). Ruling (Krish, 2026-09-25): "This requires more frequent merging, documentation, logging, and building the bricks of the system as you go, as opposed to just doing this one article by article." Why: the work on piece 2 was piling up as one-off fixes. Now: plain words and a reading age of 12 are house rules every writer and the final pass read (his words the same day: no words "someone needs to interpret"); `npm run verify`'s two standing guard failures are fixed; a script files a source's own words for the fact gate; Krish has a Check the facts button where he approves; and a piece's web edition lives in `editions/` beside the exact text that passed, with a test that fails if the page says anything the gate did not check.
- 2026-09-25 **Piece 2 passes the fact gate** on its tenth run (34 facts, 19 confirmed by both checks). Why it took ten: each run exposed a fault in the gate, fixed in turn (walk log H14), and three in my own text (F16, F17, F18).
- 2026-09-25 **The fact gate** (`a843cc8`, `e870a90`, `deefcae`). Ruling (Krish, 2026-09-25): "we cannot afford even a chance of factual errors slipping in." Why: the engine's first draft of piece 2 rescaled Cisco's $900 million a year to "close to a million dollars" and made five other errors with the right sources on file, and the judges gave it evidence 9. No piece on a live subchannel reaches review, approval or publication until every checkable claim in its exact body is verified against its sources, with the quote confirmed in code, and independently on the web. Its first run also showed that one source is not enough unless it is the source's own words: the engine's research had filed a Batch price as a standard price.
- 2026-09-25 **The subchannels take their final names: follow.the.money and under.the.hood** (`0a4cc74`, control-center migration `20260925120000`). Ruling (Krish, 2026-09-25): "those two and mind.the.gap are my FINAL FINAL choices for the 3 channels", renamed "every single instance front and back end, with zero exceptions". Why: the names are the publication's identity and he has settled them. Both repositories, the live database rows and the n8n content factory were renamed together; the old names survive only as aliases so append-only rows still resolve, and a test fails if either returns.
- 2026-09-25 **The publication is makeyourmindup, and every piece gets a signature identity** (`docs/CREATIVE_IDENTITY_UPGRADE.md`). Ruling (Krish, 2026-09-25): "if they are going in, they need to go in for everything." Why: he wants no "walls of text" and nothing "out-there for out-theres sake"; the form has to communicate better. Each subchannel's signature device is the diagram its own mandate already names (the money map, the timeline, real or theatre), the cold open is the mandate's opening artifact, every piece makes a Call ruled in public through the claims system the engine already has, and the panel stamp leads with the panel's sharpest objection and his answer. Components go live one at a time, each universal from the day it passes on every piece.
- 2026-09-25 **Documentation reset, at Krish's request.** Why: an agent reading this repository could not tell what it was. The README described only the Studio under retired names, no document described the content engine that moved here on 2026-09-08, and `AGENTS.md` named The Money of AI and Built With AI as the public series without saying they now survive only as Studio identifiers. New: `docs/NORTH_STAR.md`, `docs/SYSTEM_MAP.md`, `docs/CONTENT_ENGINE.md`, `docs/STUDIO.md`, `docs/GLOSSARY.md`, `docs/STATE.md`. The old README, NOW, PILOT and control-plane README moved to `docs/history/` (`docs/history/LOG.md`).
- 2026-09-24 **Judges read what the piece was written from; the final pass stops truncating** (`b61a461`). Why: the draft gate's evidence judge graded evidence it could not see, and `channel_fit` had no mandate and guessed retired channels. The final pass echoes the whole draft inside its JSON, so a 900-word piece ran past 3,200 output tokens and 2 of 5 runs returned 502 and lost their spend.
- 2026-09-24 **"Cut it everywhere"** (`19d7d7e`, `30b42af`). Ruling (Krish, 2026-09-24): no "Not X, Y" construction in any piece, in either order. It became a house rule, a deterministic check that reports every hit, and an edit to the stored voice block and corpus, which had been teaching the move.
- 2026-09-24 **An agent's ledger rows are its own** (`b50b935`). Why: `actor` defaulted to Krish and the weekly compiler read every row, so an agent's drafts and kept rewrites would have been learned as his taste. Operator rows are now observations; an agent cannot approve, drop or publish unless it relays his words.
- 2026-09-24 **Draft into the idea; judge and rewrite to the mandate** (`ded51da`, `6d096eb`, `4762ba3`). Why: no route could turn a judged idea into a draft, nothing read what curation had produced, and final pass and revise graded routed pieces against a generic rubric that predated the 2026-09-17 mandates.
- 2026-09-24 **The idea routes get a gate** (`054142d`, `317b1ad`). Why: thirteen routes, several of which spend or write, checked nothing but the HTTP method. They now take Control Center's cookie or an operator token, and refuse both when unset.
- 2026-09-24 **The judge ladder: judge, try twice to fix, then ask Krish** (`3fb3475` to `d153021`). Why, in his words: the machine should get a story "to a 10/10 itself first by going deeper, finding contrarian evidence, asking why" before he sees it. Scoring moved to the median judge after the minimum missed his grades by 2.8 points; the ladder stopped burying after three judges were shown to disagree with him on a piece he rated 7; the sweep runs live by default after the batch saving was found to be about $95 a year for hours of latency.
- 2026-09-23 **The opening contract** (`88fadf3`). Why: `hook_strength` was one opaque score nobody could repair against. A Short's opening now answers to three named checks, including a question that must be opened and later answered (`docs/OPENING_LOOP_CALIBRATION.md`).
- 2026-09-23 **A model between the feed pool and the table** (`242ac30`, `c72e8dc`). Why: raw pool markup reached `content_ideas.thesis`, and the relevance classifier gained the buyer test.
- 2026-09-22 **Record what arrived before the desk clears it** (`2666761`). Why: the Monday purge was the end of the line for every story, and nothing could ask a trend question afterwards. Every collector now writes `trend_observations` first, and the purge deletes nothing if that write fails.
- 2026-09-21 **A meter that says when it has stopped** (`061d6fd`, `2ad04fd`). Why: `meter_add`'s error was discarded, so every Anthropic agent went dark in `meter_daily` on 2026-09-15 and the dashboard read "we spent nothing". The same discarded-error shape was fixed in both ledger writes.
- 2026-09-20 **research-topic stops writing retired names** (`5a9fb88`). Why: reads resolved retired slugs, so a write in the old spelling looked fine on every read afterwards.
- 2026-09-15 **Station artifact handoffs proven** (PR #70). Why: the station check proved order but not that every artifact had exactly one producer and a consumer.
- 2026-09-13 **Production as station harnesses** (PR #69). Ruling (Krish, 2026-09-13): "production machinery must use independently governed station harnesses, not one accumulating Markdown file."
- 2026-09-08 **The content engine moved into this repository** (PR #42, ADR-019 in control-center). Why: Control Center kept the desk and gave the machinery to its own project; the routes, crons and guards now deploy from here.

Everything older is in `docs/history/2026-09-25-NOW.md` and `docs/history/LOG.md`.

## What is next and what is waiting on Krish

- Next: piece 2's confidence and his verdict on its page and Short storyboard; piece 1's plain-words rewrite and fact gate; piece 3 (under.the.hood); then the idea sources' own rule copies and retired names (walk log F23).
- Waiting on Krish: approving piece 2; his verdict on its Short storyboard; wordmarks for the three subchannels (a branded render needs them) and a format for mind.the.gap carousels; updating the Windows runner (`docs/STUDIO.md`); the makeyourmindup masthead and subchannel wordmarks (to approve from rendered territories), which also unblock renaming the Studio's series; adding the Call to all three mandates; where CTRL's lead-magnet door goes now that makeyourmindup.ai is the publication's cover page; rotating four credentials pasted into a chat on 2026-09-24; and the operator token's fate.
- Sequenced by Krish (2026-09-25): a prompt caching pass over the whole engine, only once three pieces in a row come out with minimal fix passes (`docs/CONTENT_ENGINE.md`, "Waiting: the prompt caching pass").
- Engineering backlog, in order of risk: the unauthenticated write routes; the brief bridge for live subchannels; the walk's open findings (F2 to F19, `docs/STATE.md`).

## Read next

1. `AGENTS.md`: the rules for any agent here. Read first.
2. `docs/NORTH_STAR.md`: what the whole system is for, in Krish's words.
3. `docs/STATE.md`: what is live, built, broken and waiting on Krish.
4. `docs/SYSTEM_MAP.md`: the two halves, every system involved and who owns what.
5. `docs/CONTENT_ENGINE.md`: the content engine route by route: guards, crons, models, spend, tables, checks.
6. `docs/CREATIVE_IDENTITY_UPGRADE.md`: the Signature Pack, how every piece looks, sounds and moves, and what Krish has decided on it.
7. `docs/STUDIO.md`: the Studio, and the index of its detailed documents with what is stale in each.
8. `docs/ENGINE_SESSION.md`: the Studio's tracked-session contract.
9. `docs/GLOSSARY.md`: every term, and every retired name with its live equivalent.
10. `docs/walks/2026-09-three-piece-walk.md`: the record of the first live walk, H1 to H10 and F1 to F12.

## Do not trust

- `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`, `docs/ENGINE_SECRETS_HANDOVER.md` and `docs/CAROUSEL_ENGINE_STATE.md` in the passages `docs/STUDIO.md` lists as stale (audited 2026-09-25). The rest of each is current for the Studio.
- The Studio's skills under `.agents/skills/` (`content-corpus`, `krish-voice`, `mindmake-video`) where they route work into The Money of AI or Built With AI and call the business Mindmaker: correct for the Studio's series, wrong as a description of the publication. They are copied into every Studio job, so they change only with care.
- Control Center's own docs where they call the publication "Mindmake's publication" or treat makeyourmindup.ai as CTRL's door (superseded 2026-09-25: the publication is makeyourmindup), where they say it has exactly two channels, or that Control Center hosts the content routes (its `docs/MINDMAKE_OS_ARCHITECTURE.md` section 0a, `docs/CONTENT-ENGINE-BUILD-SIGNALS.md`). Superseded by the three subchannels (2026-09-17) and ADR-019 (2026-09-08).
- Everything in `docs/history/`.
