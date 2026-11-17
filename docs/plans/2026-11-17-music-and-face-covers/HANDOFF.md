# Music rotation and face-led covers: hand-off to a home-computer session (17 Nov 2026)

Status, later on 17 Nov: steps 1 and 2 are done from the cloud (the tracks went in through `send.py` and the library sync; ledger, rotation and carousel groups are on main). Step 3 waits only on his photos reaching the library (`scripts/post-pack/photos.py`, published by the home computers' pass), then a cloud session fetches them and dispatches the cover cards to Codex.

A cloud session agreed all of this with Krish on 17 Nov 2026. It could not finish two steps from the cloud: the Drive
connector refuses uploads over about 3.1 MB, and the headshots and Codex sign-in are only reachable from his
computer. A session on either home computer does the steps below, in order. Krish's words are quoted as he typed them.

## 1. File the ten approved tracks (Krish: "file the tracks in my music folder as fully licensed")

Download each from Epidemic Sound (MCP `DownloadRecording`, MP3, FULL), check its sha256 against this table (the cloud
session's download of the same file), and copy it into the Music folder of `1 Brand kit (permanent)`
(Drive folder `1oHyJ9A5et5_uKW7QTq1VHX0NuGwwQVri`, `MINDMAKE_MUSIC_ROOT`) under the file name shown. A different sha256
means Epidemic served a different file: measure that one and record its own hash.

| Use | Title | Artist | Epidemic id | File | sha256 | Bytes |
|---|---|---|---|---|---|---|
| Good-news carousel | Mojito | AGST | d962e139-ced7-43fb-a208-0739dde7a58f | ES_Mojito - AGST.mp3 | 47671bc6a4cb10a2a7bfa547d894629d3be58406a6daeff8b27abeaae18973e3 | 6154625 |
| Good-news carousel | Cheetah Print | Cushy | f031ac3b-1858-424a-9890-a2ba10487daf | ES_Cheetah Print - Cushy.mp3 | 34c0c8d8002cde7e4f8c98d608b54dec69954fe5d7400a0fd64c00c4de20322f | 5005270 |
| Good-news carousel | STYLE | Ballpoint | 03e71f7f-ad6f-4845-9fbd-9fce110cfa5e | ES_STYLE - Ballpoint.mp3 | 93e2230de28bcc59da6386f37ea83b1479b4f10dc0ba2193f9d8b1950bf43d67 | 4992197 |
| Good-news carousel | Make up Your Mind (Instrumental Version) | Relyae | 6a7c6349-d4bc-4d57-a093-07be3ecf1357 | ES_Make up Your Mind (Instrumental Version) - Relyae.mp3 | a168b812abcbb2a6add9d621d35ddb103d955cdee07f75569bd5ecf89062a5ad | 6097291 |
| Advice/tips carousel (gym) | CORONATION | BLUE STEEL | 38c4a13b-fa62-4af4-b5a3-b98a8e0dd352 | ES_CORONATION - BLUE STEEL.mp3 | a19f06f4fdd6ea12ebb56dada8b54e338d8221b56fe864b72ccf8dc0c57adb13 | 4430052 |
| Advice/tips carousel (gym) | GIFTED (Instrumental Version) | Bhris Drip | dc4dc755-25b6-4354-8a5e-d2b08dcb00ab | ES_GIFTED (Instrumental Version) - Bhris Drip.mp3 | 12863d0ee3855e4c05fde3b61554283547e779091b5d8175f78f5726b5ea5d3c | 4173659 |
| Advice/tips carousel (gym) | Plenty Bands! (Instrumental Version) | Enophi | 6379c2a0-a79a-4e61-a3a1-7c5106592986 | ES_Plenty Bands! (Instrumental Version) - Enophi.mp3 | 4f6dd32326e741de87d76dee2da0e71a3b4dfd40737c3f101b454a24837351fe | 5224753 |
| Mon follow.the.money rotation | Liberty City | DonVayei | 34b72f66-f0d1-4298-9a54-0d717f322d67 | ES_Liberty City - DonVayei.mp3 | 662422d24d013090725e34232691a46fc574866066802db0657c0a3e9764d7a2 | 4242810 |
| Wed under.the.hood rotation | Mind Bender | Philip Ayers | caebde53-8306-4a0d-a2bd-3262bc641d89 | ES_Mind Bender - Philip Ayers.mp3 | 8861ed77596724bb973c9b8ce7cbb23338551907a371ae64821f3e2aca770989 | 6668038 |
| Fri mind.the.gap rotation | Conclusion | Max Anson | 66265c07-2718-3650-8064-a24ff89223ce | ES_Conclusion - Max Anson.mp3 | 860748156561386199b8248f71f37b88270e50e4c6d3b1b3f451813c57a97901 | 3653975 |

Then add each to `config/music-library.json` the way the existing tracks are recorded: the Epidemic safelist licence
(`epidemic-sound-safelist-2026-10-12`), `status: approved`, `approved_by: Krish`, `approved_on: 2026-11-17`,
`approval_words: "i like the rest - file the tracks in my music folder as fully licensed"` (Conclusion:
`"conclusion"`, his pick to replace Mindscape, of which he said "i hate mindscape"), the measured LUFS, true peak, intro
and outro cues, duration and the Drive file id read back after the copy. Never add Mindscape (Lennon Hutton).

## 2. Wire the music rules

- **Series days rotate week by week, treated the same way every time.** Each day keeps three approved tracks
  (Mon: No Curves, Liberty City and the other approved Monday track; Wed: Seize It, Drifting Valleys, Mind Bender; Fri:
  Just Got Real, Conclusion, plus Drifting Valleys if needed), the next one by ISO week. Every track sits in the one bed
  shape (`config/music-bed.json`, levels of 12 Nov), so only the track changes. `scripts/produce_day.py` currently
  names `no-curves-instrumental` itself (the `--music` argument); it reads the rotation instead.
- **Off-day carousels:** good news gets the funky-house group above, advice and tips the gym group. The board's Pick
  the track offers only that type's group, with the next in rotation selected; Krish can still change it
  (`docs/CAROUSEL-STANDARD.md`: a session never picks for him).
- **Video memes keep their original sound:** no bed. Written as the one exception in `config/music-bed.json` and the
  carousel standard.

## 3. Face-led covers, drawn by Codex (Krish: "yes to the face plan", then "actually use codex to draw")

The plan he approved:

| Channel | Cover |
|---|---|
| His own accounts: TikTok @therealkrisho, X @TheRealKrisho, LinkedIn, Threads, Substack Notes | Face-led: a cutout headshot over about a third of the frame (like the Rio Meets reference he sent), the headline huge, the series colour behind, no circle. His name never in post text. |
| YouTube @makeyourmind-up | A/B test, the Receipt against face-led, on every long video (YouTube's Test & Compare); Growth reports click rate. |
| Instagram @makeyourmind.up, Facebook Page, the Substack article cover and share card | The Receipt stays. |

Four weeks, then Krish decides from the numbers. This narrows THE_RECEIPT's "never his face" (2 Nov) to the brand
accounts; record it in `.agents/skills/thumbnail-designer/SKILL.md`, `config/hook-playbook.json` and
`docs/production/COVER-STANDARD.md` with the ruling line, and run `python scripts/validate-skills.py --sync-claude`.

Headshots: the cutouts in Drive folder `1PQDSg4_kD6zwVerqvxaiQE5Ocjnsd6xB` (Denim-jacket headshot, Bespectacled man,
Natural headshot cutout, Pale Blue Oxford Headshot, all on transparent backgrounds). Codex builds two or three options
per channel from a card, opened through `node scripts/codex_thread.mjs` (`ve card` has no cover kind yet: add `cover`
beside `carousel`, `meme` and `notes_image` in `scripts/velib/cards.py`, held to the brand palette and the cover
standard). Each option is checked with `scripts/channel_safe.py`, judged by the thumbnail-critic, and shown to Krish
for his pick. Nothing is posted.
