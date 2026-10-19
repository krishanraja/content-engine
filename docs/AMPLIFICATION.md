# Amplification: one home, one link, every channel

Krish, 2026-10-09: "I currently post the video to Substack separately to the
article, with a link to the article, but I have a feeling this is a clumsy
approach, can you recommend me a neater way? for the consumer? ... Build a
durable amplification strategy that looks cohesive and is really easy for me
to take from Drive to Publish."

This is the standing plan for every piece. `scripts/post-pack/publish_kit.py`
writes it out for one post as `0 Publish/publish.html`, the first folder in
the post's Drive folder: every step in order, the file to upload, and a Copy
button for every word. The engine posts nothing; Krish publishes each step.

## The idea

**One home.** Each piece is one Substack **Video** post: the long video at the
top and the whole article underneath. One email to subscribers, one link for
every channel to point at. It replaces the separate video post and article.
Why: a reader gets one email instead of two; the video and the words share
one set of comments and one link; and only Substack's Video post type does the
rest of the work below (an article with a video dropped in gets none of it).

**Two cuts, each recorded from its own script** with its own hook and its
own outro (house rule TWO_CUTS). Krish, 2026-10-11: "I always want a 3-minute
video and a 90-second version. I always want to repost to YouTube and then
Shorts, TikTok, and Instagram."
- The long cut (wide, 16:9, about 5 minutes: 675 to 825 spoken words; 3 minutes until Krish, 2026-10-19: "let's make the 3-minute scripts into 5-minute scripts and videos. Scrap the 3-minute format in favor of the 5-minute format.") lives on
  Substack and YouTube.
- The short cut (tall, 9:16, at most 90 seconds: 160 to 225 spoken words) goes
  to YouTube Shorts, TikTok and Instagram Reels, every time; and to LinkedIn,
  WhatsApp and Substack Notes when Krish wants them. It keeps the hook and the
  call to action (house rule HOOK_AND_CTA).
- `scripts/post-pack/story_check.py` refuses a cut of the wrong length.

**Same face everywhere.** Same title idea, same cover frame, same opening
line, same closing line ("the full article is free at makeyourmindup.ai"),
said out loud so it works even where links do not.

## The order

The first five are the standing set for every piece; the publish step on the
piece's making record is done when they are ticked. The last three are
optional and never hold a piece back.

| # | Channel | What goes up | Where the link goes |
|---|---|---|---|
| 1 | Substack | Video post: the 5-minute cut on top with the wide thumbnail, the article under it, the 3:2 cover as the post's cover image. Settings: YouTube upload on with the watermark off; Shorts and LinkedIn clips off | It is the link |
| 2 | YouTube | Substack uploads the 5-minute cut as private. Swap in the engine's title and description, upload the wide thumbnail, make it public, pin a comment | The description's read line and the pinned comment |
| 3 | YouTube Shorts | The 90-second cut, with Related video set to the long one | Related video (links in Shorts are not clickable) |
| 4 | TikTok | The 90-second cut, with the caption and the tall thumbnail as its cover | Said out loud in the video; makeyourmindup.ai in the profile |
| 5 | Instagram Reels | The 90-second cut, with the caption and the tall thumbnail as its cover | Link in bio (makeyourmindup.ai) |
| 6 | LinkedIn (optional) | The 90-second cut as a native video, with the LinkedIn post | First comment |
| 7 | WhatsApp (optional) | Channel: the 90-second cut and the link. Status: the same cut | In the message |
| 8 | Substack Notes (optional) | The 90-second cut, with the post attached | The attached post |

Steps 1 and 2 come first because every later step needs their links. The
page has a box for each link; paste it once and every Copy button carries it.

**A thumbnail for every video size.** Krish, 2026-10-12: "I always want a
video thumbnail for all video sizes produced as an asset every time".
`python scripts/pages/build.py COVER_FACTS --thumbs` draws both from the
cover facts, with his face and the real logos: the wide one (1280 x 720,
`<Subject> - wide 16x9 - thumbnail.jpg` in `3 Video`) goes on YouTube and
the Substack video post, and the tall one (1080 x 1920, `<Subject> - tall
9x16 - thumbnail.jpg`) is the cover on Reels and TikTok. The 3:2 cover stays
the Substack post's cover image and the LinkedIn picture. A pack with a video
and no thumbnail of its shape is refused. Still to confirm in the apps:
whether TikTok takes an uploaded cover picture or only a frame of the video,
and whether YouTube lets a Short take a thumbnail at all; until then Shorts
keep the frame YouTube picks.

## The profiles every link lands on

Every step above sends people to a profile, so the profiles have to explain
the publication to someone who has never heard of it. Krish had them rebuilt
on 11 and 12 October 2026 (a Claude session working in his browser, every
change checked on the live page). This is what each one carries and what is
left. The pictures are made by `scripts/channel-kit/` (`build.py` for the
YouTube banner and watermark, `profiles.py` for everything else); the copies
he uploaded are in Drive under `makeyourmindup > 2 Channel art (permanent)`,
indexed in `READ ME - profiles.txt`.

**Which accounts.** Three brand accounts carry the publication: YouTube
`@makeyourmind-up`, Instagram `@makeyourmind.up` and the Facebook Page
`Makeyourmind/up`. Krish's own TikTok (`@therealkrisho`) and X
(`@TheRealKrisho`) carry him as its editor and amplify it. LinkedIn stays his
personal profile, unchanged.

| Profile | What it carries (checked live, 12 October 2026) | Left to do |
|---|---|---|
| YouTube `@makeyourmind-up` | Name `makeyourmindup` (the handle stays: the site links to it). The splashes picture. Banner and description from `build.py`. Links: Read free (makeyourmindup.ai), Instagram, and Build Your AI Brain, kept. The watermark for the whole video. Home tab: the launch video as trailer for new visitors, Higgsfield for subscribers, and a row of the three day playlists (follow.the.money, under.the.hood, mind.the.gap). The launch Short's Related video points at Higgsfield. Channel keywords; upload defaults of Science and Technology and a description footer. | A Scored playlist once the first call falls due. The three videos already up print mindmakerlive.substack.com on their thumbnails (seen 11 October); the next ones should print makeyourmindup.ai. |
| Instagram `@makeyourmind.up` | The splashes picture. Category Magazine. Bio: "AI, unpicked, unboringly." then one line per day (yellow, purple and red dots): "Mon follow.the.money: who gets paid", "Wed under.the.hood: real or theatre", "Fri mind.the.gap: what's coming". Links: Read free (makeyourmindup.ai) and YouTube. Linked to the Facebook Page. | On Krish's phone: the name `makeyourmindup \| AI, unpicked` once Instagram's 14-day lock on name changes lifts; the five highlights once a full week of pieces is up (covers from `profiles.py`: Start here, Mon, Wed, Fri, Scored); pinned posts. |
| Facebook Page `Makeyourmind/up` | The splashes picture and the cover from `profiles.py`. Category Media/news company. Intro: "AI, unpicked. Who gets paid, what's real and what's coming, in plain words. Free at makeyourmindup.ai". Website makeyourmindup.ai and a Sign up button to it. Instagram connected. No username (`makeyourmindup` and `makeyourmind.up` are taken). | Not yet checked: whether Instagram posts share to the Page on their own (a setting per account in Meta's Accounts Center), and the Sign up button as a visitor sees it. |
| TikTok `@therealkrisho` (Krish) | Name `Krish Raja \| makeyourmindup`, his editor photo, bio "AI, unpicked. Who gets paid, what's real, what's coming. makeyourmindup.ai". | Nothing. A clickable profile link needs more followers or a business account (above). |
| X `@TheRealKrisho` (Krish) | The header from `profiles.py`, the bio ("Editor of makeyourmindup. AI, unpicked: who gets paid, what's real, what's coming. Every call dated and scored in public, misses included."), location London and Brooklyn, website makeyourmindup.ai. | Name and photo left as they were on purpose: changing either hides his blue check until X reviews it. A pinned post introducing makeyourmindup, only with his approval. |

Krish's decisions on the profiles, in his words:

- 2026-10-11, the personal accounts: keep both handles and change only the
  copy; X location "London and Brooklyn".
- 2026-10-12, the Facebook Page: "I am happy with the current name", and no
  username ("Dont need a new name if this is just my page, right?").
- 2026-10-12, the highlights: "I can only put highlights up once I have a full
  week done."
- 2026-10-12, the profile picture: "can you change the logo to something a bit
  more colourful? Maybe my mindmake icon but with splashes of these colors?"
  He picked the splashes option over four coloured blocks and a swoosh. It is
  a social picture only: the brand kit's logo stays as it is.

**The wider plan is still a proposal.** The social playbook
Krish was given on 11 October (a Claude doc in his account) sets one number,
new Substack subscribers per week that arrive from social, read from
Substack's subscriber sources, and a job for each channel. It also proposes
a your.call loop (a two-option poll on the call the day a piece goes out,
and a 30-second Scored cut when a call falls due) and five template jobs the
engine does not do yet: a 1080 x 1350 carousel per piece, an X card, a
1080 x 1920 poll frame and a Scored frame, a captions file, and a short-cut
ending that says the call. None of these is a ruling; the standing five above
are what the engine enforces. Ask Krish before building any of them.

## What the platforms do (checked 2026-10-09)

- Substack: a video can be uploaded into an Article, but transcripts, clips and
  free previews "are only available on video posts". A Video post puts the
  video "at the top of the post and cannot be moved", and it is emailed. In
  the email a video shows as "a thumbnail image"; readers click through to
  watch. (support.substack.com articles 15659757294228 and 21093671091220)
- Substack to YouTube: "your video posts will upload to YouTube automatically
  when you publish", private by default, with a Substack watermark on unless
  turned off, and up to four auto-made Shorts clips. (article 30627373184532)
- Substack to LinkedIn: up to two auto-made clips, to the personal profile.
  (article 41566866156564) We switch this off and post our own cut.
- Substack Notes take one video of up to five minutes. (article 14743550626580)
- LinkedIn: member videos up to 15 minutes and 5 GB, aspect ratios 1:2.4 to
  2.4:1. That a link in the post lowers its reach is widely reported and not
  confirmed by LinkedIn; the first comment is the cautious place.
- YouTube Shorts: up to three minutes since 15 October 2024. Links in Shorts
  descriptions and comments are not clickable (since 31 August 2023). Related
  video needs YouTube's advanced features turned on.
- Instagram Reels: up to 20 minutes, but over 3 minutes are not recommended to
  new audiences. Caption links are only in a test for Meta Verified accounts.
- WhatsApp Status: 90 seconds is Krish's limit; only beta reports confirm it.
- TikTok (checked 2026-10-11, from third-party guides; TikTok's own help page
  did not come up): links in captions are not clickable; a clickable website
  link in the profile needs 1,000 followers or a registered business account
  (the guides disagree on whether it is either or both); uploads run up to
  60 minutes for most accounts, so 90 seconds is never the limit. Still to
  confirm in the app: the exact rule for the profile link.
- No scheduling tool covers all of these: Buffer posts Substack Notes only and
  YouTube Shorts only; none posts to WhatsApp Channels. Publishing by hand
  from the page stays the simplest route.

Still to confirm on the first run: that pasting the Substack copy (the Copy
post button) into a Video post's text keeps its pictures, and how the YouTube
upload names the video before step 2 renames it.

## Where each word comes from

- The script (spoken words only, house rules SCRIPT_ONLY and HOOK_AND_CTA),
  both cuts: `story_check.py` refuses anything else.
- Substack title and subtitle, YouTube title and description: the engine's
  `package` step (`docs/CONTENT_ENGINE.md`, step 14), linted by `_packaging.ts`.
- Shorts title, TikTok and Reels captions, LinkedIn post, WhatsApp message, Note: written
  with the piece, held to the same house rules, and passed through the
  publish checks before they go in `publish.json`.

## Making the page for a post

```
python scripts/post-pack/publish_kit.py WORKDIR/publish.json --out WORKDIR/kit
```

then add it to the pack as `{"kind": "publish-kit", "file": "kit/publish.html"}`;
it lands in `0 Publish/publish.html`. A step whose words are missing says
"Not written yet" rather than guessing.
