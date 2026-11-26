# The production playbook: how to assemble every makeyourmindup piece from the Library, and every edge case

Read ART-DIRECTION.md first: variety and imagery rules.

For content-engine production sessions. Read this, `LIBRARY-GUIDE.md` (every template: where it is used and what to fill), `STANDARD.md`, `TITLES.md`, `SCRIPT-TO-MOTION.md`, `MOTION-FLOOR.md`, `CAROUSEL-FORMAT.md` and `IMAGERY.md` before making anything. When this playbook and a template disagree, the template's refusal wins: fix the input, never the frame.

## 1. The order of work for any piece
1. **Story and words first.**
   - Fix the claim, the five whys and the sources.
   - Write the words in his shapes (`TITLES.md`) and offer them to Krish as options. He picks.
2. **Choose the data.** Find the one number, change or threshold that carries the story, plus the one real sentence that proves it. These feed every device (see section 4 when there is none).
3. **Assemble from the sets below.** Use the named templates in their order. Never invent a frame.
4. **Bind the motion to the script.** Write the beats (`SCRIPT-TO-MOTION.md`) and choose a caption style per cue.
5. **Render and pass every gate (section 7).** Then watch the cut at full size before anyone else sees it.
6. **Write captions into the piece manifest and hand over to growth to post.** Growth never makes assets (Krish, 26 Nov 2026).

## 2. What each piece is made of

**Covers and thumbnails: `make_covers.py`.** From the repository root, `python scripts/covers/make_covers.py docs/plans/<day> --out <folder>` renders the approved image-led systems (Krish, 26 Nov 2026: "I approve the new cover thumbnail systems, go"): `cover-1200x630.png` (Substack), `thumb-wide-1280x720.jpg`, `cover-1080x1920.png`, `thumb-tall-1080x1920.jpg` and the carousel's `carousel/slide-01.png`, with a `covers.json` receipt that post-pack reads as `cover_set`. `COVERS-PLAYBOOK.md` gives the families and the automatic pick. `make_piece.py --set covers` and `--set video` refuse and name it.

**Carousels: `make_piece.py`.** `python scripts/library/make_piece.py docs/plans/<day> --set <carousel set>` fills a carousel from the piece's `cover-facts.json`. It builds the pack, renders it with `render.py --carousel-pack <pack> --items <ids>`, and writes `carousel/slide-NN.png` with a `post-pack-files.json` of the post.json entries. It never invents words: every slot comes from the piece, or it stops and names the slot. The old drawer (`scripts/pages/build.py --cover` and `--thumbs`, the v5_feed skin) is retired and runs only with `--legacy`, for an archived piece.

### Hero piece (Mon, Wed, Fri)

**Vertical cut** (Shorts, Reels, TikTok; sequence `short` is the worked example):

| Order | Template | Notes |
|---|---|---|
| 1 | `video-vertical-talking-head` | Hook with punch captions, first 5 s |
| 2 | `video-vertical-title` | No captions while it holds; at least 2.5 s |
| 3 | `video-vertical-why-1` | |
| 4 | evidence: `-document` or `-quote` | |
| 5 | footage: `-split`, `-pip` or `-plate` | His face never under a caption |
| 6 | `-why-2` | |
| 7 | data: `-chart`, `-number` or `-big-moment` | |
| 8 | `-why-3` | |
| 9 | `-big-moment` or `-callout` | |
| 10 | `-landing` | The answer, on mint |
| 11 | `video-vertical-outro` | |

**Long cut** (YouTube, Substack, Spotify; sequence `long`): the same spine on `video-wide-*`, with these differences:
- footage beats use `video-wide-side-by-side`, `-place`, `-documented` or `-creative-work` (wide has no split, pip or plate);
- `video-wide-recap` before the landing when the episode has more than three sections;
- `video-wide-chapter` cards between sections;
- `video-wide-lower-third` for every named person or source;
- `video-wide-outro`, which reserves YouTube's end-screen area.

**Covers and thumbnails.** Run `python scripts/covers/make_covers.py PIECE` for every hero or off-day piece. Use the four wide and three vertical families in `COVERS-PLAYBOOK.md`. Their receipt supplies the finished post-pack entries.

**Carousel** (set `piece`), 6 slides:

| Slide | Template |
|---|---|
| 1 | `carousel/slide-01.png` from the image-led renderer |
| 2 | `carousel-chart` (the answer, standing alone) |
| 3 | `carousel-document` |
| 4 | `carousel-why-3` |
| 5 | `carousel-why-1` |
| 6 | `carousel-close` (the takeaway) |

**Words:** `copy-yt-description`, `copy-yt-pinned`, `copy-chapters`, `copy-carousel-caption`, `copy-x-post` or `copy-x-thread`, `copy-substack-note`, all through `check_voice`.

### Off days (Tue, Thu, Sat)
- **Voiceover short** (sequence `offday`): `video-vertical-voiceover`, then `-plate` or `social-meme-video`, then `video-vertical-statement-close`.
- **Good news, Saturday:**
  - Carousel set `good-news`: the cover, four items by default (five only if all fit the word limits) and the close.
  - Slideshow cut `goodnews`.
  - Each item uses a credited real photograph. A reported event never uses a generated image.
- **Weekly edition:** `newsletter-weekly-edition`, 6 to 10 primary-sourced items in two to four topics. Growth only does the Substack editor step.
- **Simple advice:** set `simple-advice`, with the real prompt on the cover card.
- **How-to:** set `how-to`, one step per `carousel-howto-step`, 5 at most.
- **Explainer, quiz and meme:** their sets in `library.json` (`carousel_sets`).
- **Notes:** `social-note-image` with `copy-substack-note`.

### Every surface carries
- one wordmark (the template places it);
- the approved series colour treatment for its format;
- words in his shapes;
- at most three parts besides the headline.

## 3. Choosing the cover family

Use the first supported family that differs from the last published piece. Wide walks portrait, evidence, number, object. Vertical walks portrait, receipt, figure. The cover playbook defines proof crops, photo eligibility, attribution, the still brief and the post-pack receipt. Keep its channel headlines as supplied in cover-facts.

## 4. Edge cases, by asset, with the action to take

### Words and headlines

| Case | Action |
|---|---|
| Headline too long for the slot (a red REFUSED stamp) | Write a shorter line that keeps the claim (`TITLES.md` rule 6). Never shrink type below the floor, never cut the words that carry the claim. |
| A name too long for one line (a company, product or person) | Use the short form people search (Meta's Muse, not "Meta Platforms Muse assistant"). If there is none, move the name to the dek and keep the headline's claim. |
| Accents and non-English names | Keep the exact spelling with its accents (the fonts carry Latin Extended). Check the render at true size for clipped diacritics. |
| Numbers with units or currency | Set "$2.7B", "30 seconds", "27% to 9%" exactly as he would say them. The striped figure takes at most 4 characters ("$2.7B" fits; a longer figure goes on a Receipt instead). |
| A question that only makes sense after the piece | Rejected: a stranger must understand the line in one second (`TITLES.md` rule 4). |
| "They", "it" or "this" standing in for a name | Name the subject. |
| Two lines that read as one sentence break badly | Set `display_lines` by hand at the phrase break; never break inside a name. |

### Data devices

| Case | Action |
|---|---|
| No number in the story | Do not invent one. Follow the cover renderer’s automatic pick. Inside the cut, use evidence and footage beats and leave the devices out. |
| A change between two amounts that are not durations | Use the timeline with its labels rewritten in the story's own unit. The bar counts stay proportional (20 against 5 means 4 to 1); round to whole bars and say "about" in the label. |
| A threshold other than 30 | Set the meter `count` to the threshold (at most 40 bars) and light the threshold bar mint. |
| A device on a colour field (why cards) | Bars go ink and the answer bar mint. The house-colour palette is only for ink grounds, because coral on coral disappears. |
| The spoken word for a beat is missing or mis-heard in the alignment | Fix the caption alignment first. A beat must land on a word that is actually spoken in that shot; `motion_check.py` refuses it otherwise. |

### Evidence cards

| Case | Action |
|---|---|
| No source document exists (an interview, a statistic from a person) | Use the person's own words as a `quote` frame with a lower third naming them and the date. Never fabricate a screenshot. |
| The source sentence wraps or is clipped | Crop to the one sentence only, at word boundaries. No word may be cut at any edge. Mark only the words that matter. |
| The source is a video or a tweet | Screenshot the frame or post with its date visible, keep the mark on the claim, and credit the account in the source line. |
| A paywalled or private source | Do not show it. Cite it in the caption and use a public confirmation if one exists. |

### Logos

| Case | Action |
|---|---|
| A logo file is missing | Add the company's own mark (the product's mark, never the parent company's) as a cream SVG to the piece's `logos` folder first. Never type the name in place of a logo on a Receipt. |
| A logo is dark on dark | Use its cream version. If none exists, it sits on a cream chip. |
| More than three companies | Choose the three the headline names. The rest go in the caption. |

### Pictures

| Case | Action |
|---|---|
| No real picture of the thing exists | Generate one of the specific thing (a real product, screen, place or object), bright and contemporary, composed in the slot's shape with nothing cropped. Record the prompt, model, date and cost. Never generate people. |
| A real person in a news story | Use only a credited real photograph with the credit visible on the sheet, or no picture. |
| A head would be cropped | Recompose or regenerate in the slot's shape. A face is never cut. |

### Captions

| Case | Action |
|---|---|
| A cue longer than 2 lines (refused) | Split the cue at a phrase into segments of 3 to 5 words. |
| The line being said is the frame's headline | No caption. The renderer suppresses it; do not force it. |
| A face in the caption band | Move the cue into the footage's lower-third zone, or use a `-plate` frame. Captions never cover his face. |
| A hook after 5 seconds | `build` or `line`, never `punch`. |
| Captions over the title card | None while the title holds (`MOTION-FLOOR`). |

### Motion

| Case | Action |
|---|---|
| A beat fails the profile (too fast or too slow) | Change its duration within the profile, never the house ease. |
| Two moves wanted at once | Stagger them by 3 frames or more, with at most two in flight. If the second is not on its own spoken word, cut it. |
| A frame does not hold long enough to read | Lengthen the shot (and shift everything after it) or let the voice say the words. `motion_check.py` measures unspoken words only. |
| A word on his face that should hit hard | Use the impact zoom (`MOTION-FLOOR` F14): starts on the word, 1.05 to 1.06 over 10 to 12 frames, at least 4 s apart, take layer only. Never on b-roll, splits, screens or graphics. |
| An animation Krish has not seen in the Library | Not allowed in production. Propose it as a new Library device first. |

### Platforms

| Case | Action |
|---|---|
| A tall cover in the Instagram grid | Words and logos inside y 330 to 1180, the subject inside the 3:4 crop (y 240 to 1680). |
| A YouTube thumbnail | At most 4 words, nothing important in the bottom-right corner (the duration badge). |
| X link cards | X strips headlines from link cards, so the share card's words are in the image. |
| The Instagram carousel re-shows from slide 2 | Slide 2 must stand alone. |

## 5. What a refusal stamp means (the exact wording the renderer prints)

| Stamp | Fix |
|---|---|
| `max_words`, `max_chars`, `max_lines at minimum size`, `cannot fit at minimum size` | The words are too long for the slot. Rewrite them shorter in his shape. Never change the template or the type floor. |
| `needs a headline and payoff` | The slot takes two parts (headline, then the mint payoff). Supply both. |
| `headline below 70% of its column` | The line is too short for the space. Use the fuller line in his shape. |
| `house still does not match the source, style or aspect`, or a retired-image reason | The image is not allowed in that slot. Generate the specific real thing in the slot's shape (`IMAGERY.md`). |
| `reported event needs a credited original photograph` | Find the credited real photograph or drop the picture. |
| `source image unavailable`, `source screenshot unavailable`, `source logo unavailable` | The file is missing from the piece folder. Add it; never let the slot render empty. |
| `unknown document crop` | The evidence crop names a box that does not exist. Set the crop to the one sentence on the real screenshot. |
| `source lettering below the reading floor`, `source lettering below 33 px at 1080 wide`, `source cannot fill the column at the reading floor` | The source text would be too small to read. Crop tighter to the one sentence, or use a `quote` frame with the words set in type. |
| `source logo below the size floor`, `tool marks below the size floor`, `unknown tools or too many marks` | Too many marks for the space. Cut to the three the headline names, using marks from the logo set. |
| `steps exceed the lower safe line` | A how-to step is too long. Shorten it or split the set (5 steps at most). |
| `composition: ink exceeds safe zone` | Too much on the frame. Cut a part (at most three besides the headline). |
| A wordmark count failure (from `verify_static.py`) | A wordmark was added or removed. The template places the only one. |

## 6. Creative freedom, and where it stops
**Free:**
- the story;
- his words, chosen by him;
- the data and the evidence;
- the cover family;
- which device carries each spoken claim;
- the caption style per cue (within the rules);
- the specific real things pictured.

**Fixed:** everything else, especially:
- the palette and type;
- marks and their placement;
- the grids and safe zones;
- device designs and motion curves;
- the caption look;
- the closes and outros.

A session that wants something outside the Library proposes it as a new device or template (with the Divergence engine where it helps). It ships only after it is in the Library and Krish has seen it. It never appears first in a piece.

## 7. The gates, every time, before Krish sees anything
```
python render.py --changed            # fit, refusals, wordmark count
python render.py --alignment-only     # ink alignment and spacing, 2 px tolerance
python thumb_gate.py                  # every cover and thumbnail at 160 px
python motion_check.py                # the motion floor, beats, caption styles, reading holds
python render.py --check-locks        # no approved template changed without a brief naming it
python verify_static.py               # the registry and the renderer agree
```
Then `check_voice` on every word, and watch every cut at full size with sound. A failure at any gate means the piece is not ready.
