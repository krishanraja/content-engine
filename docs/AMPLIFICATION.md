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

**Two cuts, both from the same recording.**
- The long cut (wide, 16:9, about 3 to 4 minutes) lives on Substack and YouTube.
- The vertical cut (tall, 9:16, at most 90 seconds) goes everywhere else: LinkedIn,
  YouTube Shorts, Instagram Reels, WhatsApp and Substack Notes. Ninety seconds
  is WhatsApp Status's limit (Krish's), and the cut keeps the hook and the
  call to action (house rule HOOK_AND_CTA).

**Same face everywhere.** Same title idea, same cover frame, same opening
line, same closing line ("the full article is free at makeyourmindup.ai"),
said out loud so it works even where links do not.

## The order

| # | Channel | What goes up | Where the link goes |
|---|---|---|---|
| 1 | Substack | Video post: long cut on top, the article under it, the cover as thumbnail. Settings: YouTube upload on with the watermark off; Shorts and LinkedIn clips off | It is the link |
| 2 | YouTube | Substack uploads the long cut as private. Swap in the engine's title and description, set the thumbnail, make it public, pin a comment | The description's read line and the pinned comment |
| 3 | LinkedIn | The vertical cut as a native video, with the LinkedIn post | First comment |
| 4 | YouTube Shorts | The vertical cut, with Related video set to the long one | Related video (links in Shorts are not clickable) |
| 5 | Instagram Reels | The vertical cut, with the caption | Link in bio (makeyourmindup.ai) |
| 6 | WhatsApp | Channel: the vertical cut and the link. Status: the vertical cut | In the message |
| 7 | Substack Notes | Optional: the vertical cut, with the post attached | The attached post |

Steps 1 and 2 come first because every later step needs their links. The
page has a box for each link; paste it once and every Copy button carries it.

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
- LinkedIn post, Shorts title, Reels caption, WhatsApp message, Note: written
  with the piece, held to the same house rules, and passed through the
  publish checks before they go in `publish.json`.

## Making the page for a post

```
python scripts/post-pack/publish_kit.py WORKDIR/publish.json --out WORKDIR/kit
```

then add it to the pack as `{"kind": "publish-kit", "file": "kit/publish.html"}`;
it lands in `0 Publish/publish.html`. A step whose words are missing says
"Not written yet" rather than guessing.
