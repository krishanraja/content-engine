# channel-kit

Makes the YouTube channel's art in the makeyourmindup look: the banner, the
watermark that sits in the corner of every video, a sheet showing what each
screen shows of the banner, and the channel description with the days filled
in. It made the set Krish was given on 2026-10-05, and rebuilds it whenever
the schedule or the line under the logo changes.

`profiles.py`, beside it, makes every other picture the social profiles
carry: the profile picture, the Facebook cover, the X header and the
Instagram highlight covers (below, "The rest of the profile kit").

Both only make files. Krish uploads them himself (YouTube Studio, under
Customisation, and each app's profile editor); nothing is posted or changed on
any profile by these tools.

## Setup

The same as `scripts/pages/`: Python 3.10 or later, `npm ci` in the
repository once (for the fonts), and `pip install playwright` with
`python -m playwright install chromium` (or `MYMU_BROWSER=msedge` on Windows).

## Run it

```
python scripts/channel-kit/build.py --out OUTDIR
```

Without `--out`, the files go to `.cache/channel-kit/` in the repository,
which git ignores. It prints where the words and logo sit and stops with an
error if any of them would fall outside the part every screen shows.

| File | What it is |
|---|---|
| `makeyourmindup-youtube-banner-2560x1440.png` | The banner. The logo, the line "A free publication on how AI really works. You make your mind up." and one pill per day sit inside the middle 1546 x 423, the only part a phone shows. The strip of the three day colours sits at the right end of the band a computer shows. |
| `makeyourmindup-youtube-watermark-150.png` | The mark on an ink tile, 150 x 150, so it reads over light and dark video. |
| `banner-how-it-crops.jpg` | What a TV, a computer and a phone each show of the banner, and the watermark over light and dark video. Look at this before uploading. |
| `description.txt` | The channel description, ready to paste. |

YouTube's limits, checked by the tool: the banner is 2560 x 1440 and under
6 MB, a TV shows all of it, a computer shows the full-width band 423 pixels
tall through the middle, and a phone shows only the middle 1546 x 423. The
watermark is 150 x 150 and under 1 MB.

## The rest of the profile kit: profiles.py

```
python scripts/channel-kit/profiles.py --out OUTDIR
```

Without `--out`, the files go to `.cache/channel-kit/profiles/`. The setup is
the same as above. It made the set that went live on 11 and 12 October 2026;
what each profile carries is in `docs/AMPLIFICATION.md`, "The profiles every
link lands on".

| File | Where it goes |
|---|---|
| `profile-avatar-splashes-1080.png` | The profile picture on YouTube, Instagram and the Facebook Page since 2026-10-12: the Mindmake icon over paint splashes in the three day colours, on ink. |
| `profile-avatar-mark-1080.png` | The plain mark on ink. The fallback; on no profile now. |
| `facebook-cover-1640x856.png` | The Facebook Page cover. |
| `x-header-1500x500.png` | The header on Krish's own X account. |
| `instagram-highlight-start-here.png`, `-follow-the-money`, `-under-the-hood`, `-mind-the-gap`, `-scored` | The five Instagram highlight covers: START, MON, WED, FRI and SCORED on a disc. They go up once a full week of pieces is out (Krish, 2026-10-12). |
| `profiles-sheet.jpg` | Every file at the size and crop each platform shows. Look at this before uploading. |

What it checks, and it stops with an error if any check fails:

- **Facebook cover.** A computer shows the full width but only the middle 624
  rows; a phone shows the full height but only the middle 1522 columns. The
  logo, the line and the pills must sit inside both, and clear of the day
  strip on the right.
- **X header.** The profile picture covers the bottom-left corner (x 0 to
  400, y 320 to 500 here); nothing may sit there.
- **Both avatars.** Every platform crops the picture to a circle; nothing but
  ink may reach past it (needs Pillow, pinned in `requirements.lock.txt`).
- **Sizes.** Avatars under 4 MB (YouTube's limit), the X header under 2 MB.

Where it comes from:

- **The days, colours and names**, as for the banner, from the house style in
  `config/studio.json`; the highlight labels are each channel's `short`. A
  schedule change reaches the cover, the header and the highlights on the
  next build.
- **The line under the logo** is `channel.json`'s `tagline`, so the cover,
  the header and the YouTube banner always say the same thing.
- **The makeyourmindup logo and mark**, from the live site through
  `scripts/pages/brand.py`.
- **The splashes picture** draws the Mindmake icon from
  `https://mindmake.co/favicon.svg`, cached as `mindmake-favicon.svg` beside
  the brand images and refreshed weekly, because Krish asked for "my mindmake
  icon but with splashes of these colors" (2026-10-12). The splashes are
  drawn from fixed seeds in `SPLASHES`, so the picture comes out the same
  every time; change a seed only to change the picture, and show Krish
  first. It is a social picture: the brand kit's logo stays as it is.

A rebuilt set goes to Krish's asset library with
`python scripts/post-pack/send.py OUTDIR --as "2 Channel art (permanent)" --purpose "..."`
(`scripts/post-pack/README.md`). The set now in that folder was put there by
hand on 2026-10-12, at Krish's request, with `READ ME - profiles.txt`
saying which file goes where; keep that file in step.

## Where the words come from

- **The days, their colours and the subchannel names** come from the house
  style in `config/studio.json` (`publication.house_style.channels`, and each
  series' `accent`), the same values the Studio and `scripts/pages/` use. A
  schedule change is one edit there: change each subchannel's `day`, and the
  pills, the colour strip, the description and every page follow on the next
  build.
- **The line under the logo, each day's promise and the rest of the
  description** are in `channel.json`, next to this file. `{days}` in the
  description becomes one line per day, in the order of the week.
- **The logo and the mark** come from the live site, through the cache that
  `scripts/pages/brand.py` keeps.

## The description, as it stands

The copy Krish was given on 2026-10-05, which `description.txt` reproduces
from `channel.json`:

```
Short videos from makeyourmindup, a free publication on how AI really works, in plain words.

Monday, follow.the.money: who gets paid when AI gets bought.
Wednesday, under.the.hood: what's real, and what's theatre.
Friday, mind.the.gap: what's coming, before it's obvious.

Every piece ends with a prediction and a date. We keep score in public, misses included. Then you make your mind up.

From Krish Raja. Read every piece free at makeyourmindup.ai
```

If you change `channel.json`, update this copy too, so the README and the
file agree.
