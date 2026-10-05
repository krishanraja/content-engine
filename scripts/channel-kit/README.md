# channel-kit

Makes the YouTube channel's art in the makeyourmindup look: the banner, the
watermark that sits in the corner of every video, a sheet showing what each
screen shows of the banner, and the channel description with the days filled
in. It made the set Krish was given on 2026-10-05, and rebuilds it whenever
the schedule or the line under the logo changes.

It only makes files. Krish uploads them in YouTube Studio, under
Customisation; nothing is posted or changed on the channel by this tool.

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
