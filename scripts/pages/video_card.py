#!/usr/bin/env python3
"""video_card: the pictures that cut in while Krish talks, drawn in the house style.

    python scripts/pages/video_card.py CARDS.json [--out FOLDER] [--sheet]
    python scripts/pages/video_card.py --self-test

Krish, 2026-10-13, on Wednesday's video: "there are font consistency issues
throughout ... brand guidelines have been seriously violated", "having 'where
the money moves' inside under the hood makes no sense because we have a
separate segment called 'Follow the Money'", and "we've not made any use of
business logos as we're supposed to". The cards had been drawn by a one-off
script with a system fallback font. This is the one tool for them now:

  * Faces and colours come from brand.py (Anton for headlines, Archivo for
    words, IBM Plex Mono for labels and sources; ink, cream, mint and the
    series accent from config/studio.json). Nothing else is drawn.
  * Every card carries at least one company logo people recognise, and every
    logo a card names is drawn (a columns card's own "logos" sit on its
    kicker line, like every other card's).
  * A kicker never names another series' territory (money on a card that is
    not follow.the.money, and so on).
  * Every word must sit inside the card with nothing clipped or wrapped past
    its box; a card that does not fit is refused, never drawn.
  * One header on every card that is not a chapter divider (17 Oct 2026
    review: "the video uses three different headers"): the kicker at the top
    with the card's logos at its right, then the heading in Anton 72px. A cut
    from one card to the next changes what is under the header, never the
    header's size or place. Chapter dividers keep their centred 104px lines.

CARDS.json: {"series": "under_the_hood", "logos": "logos/", "cards": [CARD, ...]}
with logo paths relative to the JSON file, and each CARD one of:

  {"file": "score-job.png", "kind": "bars", "kicker": "My scores, out of 10",
   "title": "Can it do the job?", "highlight": "Muse",
   "rows": [{"name": "Muse", "logos": ["meta-cream.svg"], "score": 9, "group": "Ready-made assistants"}, ...],
   ("group" is optional: rows in the same group sit under one labelled band, in the order given)
   "note": "Muse books, buys and negotiates"}
   Optional on bars: "max" (the axis's top, default 10), "axis" (what the number measures, its scale and which
   way is better, printed over the bars with 0 / half / max ticks: house rule PLAIN_SCORES), and per row "hi"
   (the series accent), "dim" (faded), "hidden" (keeps its place, drawn invisible, so a later card can show it
   without moving anything), "label" (the number as printed), "sub" (a small line under the name) and "extra"
   (a figure in its own column at the right, such as a cost). "callout": {"big": "+16 points", "small": "...",
   "hidden": false} prints the comparison large under the bars (PLAIN_SCORES: the comparison, not the score,
   is the big line).
  {"file": "scorecard.png", "kind": "table", "kicker": ..., "title": ...,
   "columns": ["Does the job", ...], "highlight": "Muse",
   "rows": [{"name": "Muse", "logos": [...], "scores": [9, 10, ...]}, ...]}
  {"file": "picked.png", "kind": "statement", "kicker": ..., "logos": [...],
   "lines": [{"text": "Shops paid to be seen.", "tone": "dim"},
             {"text": "Now they'll pay to be picked.", "tone": "answer"}],
   "note": "An assistant gives you one answer, not a list"}
   (a card with "chapter" is a chapter divider: centred lines at 104px. Any other statement takes the one header
   with its "title", the other lines under it, and an optional "meter": {"value": 85, "tone": "answer"|"dim"}
   drawn as a 0 to 100 bar.)
  {"file": "panels.png", "kind": "panels", "kicker": ..., "title": ..., "subject": {"logos": [...], "text": "..."},
   "panels": [{"title": "Cost per task, US dollars, lower is cheaper", "max": 6.5, "dim": false,
               "rows": [{"name": "Low effort", "value": 0.55, "label": "$0.55", "hi": false}, ...],
               "callout": {"big": "x10.9", "small": "...", "hidden": true}}, ...]}
   (two measures side by side, each on its own axis from zero; a reveal lights one bar at a time.)
  {"file": "names.png", "kind": "timeline", "kicker": ..., "title": ..., "start": "2025-10-16", "end": "2026-10-15",
   "events": [{"date": "2025-11-24", "name": "Opus 4.5", "major": true, "hi": false}, ...]}
   (every event on one dated line: "major" names above it, the rest below.)
  {"file": "dots.png", "kind": "dots", "kicker": ..., "title": ...,
   "columns": [{"label": "...", "lit": 0.5, "figure": "Under 1 in 100", "line": "...", "state": "plain"|"hi"|"empty"}]}
   (a 10 by 10 grid of dots per column, "lit" of them filled: a share out of 100 drawn as a share out of 100.)

  {"file": "gemini-auto.png", "kind": "shot", "kicker": "Google Gemini help", "title": "Free Gemini now starts on Auto",
   "image": "shots/gemini-auto.png", "source": "support.google.com, changes from 9 Oct 2026; captured 16 Oct 2026",
   "logos": ["google-cream.svg"]}
   (a real page, captured: never redrawn. Krish, 2026-10-16: "The visuals should look like genuine reviews
   of the actual product". Optional "crop": [x, y, w, h] cuts it to the passage that matters so its words
   read on a phone, and "marks": [[x, y, w, h], ...] ring the words he is talking about in mint, one box per
   text line, joined into one outline ("mark", a single box, still works); both in the capture's own pixels.
   A fifth item in a mark box is its padding (default 10), one number or [left, top, right, bottom]: small on a
   side that meets other words (mid-line, or the line above or below), so the ring sits in the space between
   them instead of on them. A ring that would cover the page's own ink (a word, an icon, a rule) or run off its
   crop is refused, never drawn (17 Oct 2026 review: rings cut "For", "but", "mode" and the lines under them).
   Two or more passages of real pages: "parts": [{"image", "crop", "marks"}, ...] stacks them with a dashed cut
   line between, drawn here, never baked into a capture; "stacks": [[part, ...], [part, ...]] sets stacks side
   by side. Every crop gets a margin of the page's own colour, so a ring never sits on a crop's edge. The ring
   is drawn over the capture at the card's own size (6px of mint with an ink edge) and the page outside it is
   laid under 38% ink, so the ringed words are the brightest thing in the box; the page's pixels are never
   changed. A capture taken at device scale 2 is drawn at up to twice its pixel size. Its source and date sit
   under it.)

tone: "plain" (cream), "dim" (muted), "answer" (mint: the answer, and only the answer), "moved" (the series accent).
The card's subject ("highlight") is drawn in the series accent; mint is kept for the answer.
Any card may carry "note" (one line, under the picture) and "source" (where and when, at the foot).
"""
import argparse
import base64
import datetime as dt
import html
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'post-pack'))
import title_check  # noqa: E402  the anti-dumb filter (house rule TITLE_EARNS_THE_CLICK)

W, H = 1600, 900
PAD = 96
# Another series' ground, by the words that name it. A kicker on one series'
# card never uses the others' (Krish, 2026-10-13).
TERRITORY = {'follow_the_money': ('money',), 'under_the_hood': ('hood', 'under the hood'),
             'mind_the_gap': ('gap',)}
TONES = {'plain': 'var(--cream)', 'dim': 'var(--muted)', 'answer': 'var(--mint)', 'moved': 'var(--accent)'}
KINDS = ('bars', 'table', 'statement', 'columns', 'shot', 'panels', 'timeline', 'dots')

# A shot's ring and shade (17 Oct 2026 review: the mint ring on the cream page was about 1.3:1 and 3 to 5px
# wide once scaled down, so the line he is talking about barely showed on a phone).
RING_PX = 6          # mint, in the card's own pixels
RING_EDGE_PX = 1     # ink, outside the mint, so the ring reads on a light page and on the shade
RING_RX = 14         # the ring's corner radius, capture pixels
RING_MIN = 3         # card pixels: a ring any thinner is not drawn, the card is refused
RING_CLEAR = 1       # card pixels kept clear between the ring and the page's other words
INK_DIFF = 96        # how far a pixel's lightness is from the page's own colour before it counts as the page's ink
INK_ALLOWED = 4      # stray pixels a ring may touch (antialiasing), no more
SHADE = 0.38         # ink over the page outside the ring
MARK_PAD = 10        # capture pixels between the words and the ring
CROP_MARGIN = 32     # capture pixels of the page's own colour round every crop
MAX_SCALE = 2.0      # a device-scale-2 capture drawn at up to twice its pixel size
CUT_PX = 30          # the dashed cut line between two stacked crops
VCUT_PX = 36         # the gap between two stacks side by side

CSS = """
:root { --ink: INK; --ink-soft: INKSOFT; --cream: CREAM; --mint: MINT; --muted: #AEAEA5; --line: #2A3430; --accent: ACCENT; --bar: #5C6A64; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1600px; height: 900px; overflow: hidden; background: var(--ink); color: var(--cream); }
body { padding: 64px 96px; display: flex; flex-direction: column; justify-content: flex-start; gap: 28px;
       font-family: 'Archivo', sans-serif; -webkit-font-smoothing: antialiased; }
/* One header on every card but a chapter divider: the kicker at the top, the logos at its right, the heading under. */
.hd { display: flex; flex-direction: column; gap: 28px; flex: none; }
.kl { display: flex; align-items: center; justify-content: space-between; gap: 40px; height: 40px; }
.kl .logos { display: flex; align-items: center; gap: 32px; flex: none; }
.kl .logos img { height: 40px; width: auto; max-width: 300px; object-fit: contain; display: block; }
.k { font: 700 26px/1 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); white-space: nowrap; }
/* Lines of a heading balanced, so a word never sits alone on the last line. */
h1 { text-wrap: balance; font: 400 72px/1.0 'Anton', sans-serif; text-transform: uppercase; letter-spacing: .005em; }
/* the heading always takes two lines' room, so what is under it starts at the same place on every card */
.hd h1 { min-height: 144px; }
.foot { margin-top: auto; display: flex; flex-direction: column; gap: 10px; flex: none; }
.note { font: 500 24px/1.3 'IBM Plex Mono', monospace; color: var(--muted); }
.src { font: 500 22px/1.25 'IBM Plex Mono', monospace; color: var(--muted); text-wrap: balance; }
.nb { white-space: nowrap; }

/* chapter dividers: centred, 104px lines, logos under */
body.chapter { justify-content: center; padding: 84px 96px; }
body.chapter .k { white-space: normal; }
.lines { display: flex; flex-direction: column; gap: 6px; }
.lines div { font: 400 104px/1.02 'Anton', sans-serif; text-transform: uppercase; text-wrap: balance; }
.logos { display: flex; align-items: center; gap: 40px; }
body.chapter .logos img { height: 56px; width: auto; max-width: 360px; object-fit: contain; }

/* a call: its lines under the header, and a 0 to 100 meter */
.say { font: 400 88px/1.02 'Anton', sans-serif; text-transform: uppercase; text-wrap: balance; }
.meter { display: flex; flex-direction: column; gap: 10px; }
.meter .track { height: 34px; background: var(--ink-soft); border: 2px solid var(--line); position: relative; }
.meter .track i { position: absolute; inset: 0 auto 0 0; background: var(--bar); }
.meter.answer .track i { background: var(--mint); }
.meter .ends { display: flex; justify-content: space-between; font: 500 22px/1 'IBM Plex Mono', monospace; color: var(--muted); }
.callnote { font: 500 30px/1.35 'Archivo', sans-serif; color: var(--cream); text-wrap: pretty; }

/* bars */
.rows { display: flex; flex-direction: column; gap: 14px; }
.rows.g { gap: 8px; }
.rows.g .r { height: 56px; }
.band { font: 700 20px/1 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
        border-top: 2px solid var(--line); padding-top: 12px; margin-top: 8px; }
.band:first-child { margin-top: 0; }
.r { display: grid; grid-template-columns: var(--grid, 400px 1fr 90px); align-items: center; gap: 28px; height: 70px; }
.rows.chart { gap: 10px; }
.rows.chart .r { height: 66px; }
.rows.chart .who span { font-size: 34px; }
.rows.chart .s { font-size: 58px; }
.rows.chart .x { font-size: 30px; }
.rows.chart .r.ticks { height: 44px; align-items: start; }
.r.dim { opacity: .38; }
.r.hid { visibility: hidden; }
.who { display: flex; align-items: center; gap: 16px; min-width: 0; }
.who img { height: 40px; width: 64px; object-fit: contain; object-position: left center; flex: none; }
.who .nm { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.who span { font: 700 36px/1 'Archivo', sans-serif; white-space: nowrap; }
.who small { font: 500 20px/1 'IBM Plex Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.bar { height: 40px; background: var(--ink-soft); border: 2px solid var(--line); position: relative; }
.bar i { position: absolute; inset: 0 auto 0 0; background: var(--bar); }
.s { font: 400 64px/1 'Anton', sans-serif; text-align: right; white-space: nowrap; }
.x { font: 700 34px/1 'Archivo', sans-serif; text-align: right; white-space: nowrap; color: var(--muted); }
.hi .who span, .hi .s, .hi .x { color: var(--accent); }
.hi .bar i { background: var(--accent); }
.axis { font: 700 18px/1.2 'IBM Plex Mono', monospace; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); text-align: right; }
.r.ticks { height: 22px; }
.ticks .tk { position: relative; height: 22px; font: 500 20px/1 'IBM Plex Mono', monospace; color: var(--muted); }
.ticks .tk span { position: absolute; top: 0; transform: translateX(-50%); }
.ticks .tk span:first-child { transform: none; }
.ticks .tk span:last-child { transform: translateX(-100%); }
.callout { display: flex; align-items: baseline; gap: 28px; }
.callout .big { font: 400 64px/1 'Anton', sans-serif; text-transform: uppercase; color: var(--accent); white-space: nowrap; }
.callout .small { font: 600 30px/1.2 'Archivo', sans-serif; color: var(--cream); }
.callout.hid { visibility: hidden; }

/* table */
table { border-collapse: collapse; width: 100%; }
th { font: 700 20px/1.1 'IBM Plex Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted);
     text-align: center; padding: 0 8px 14px; vertical-align: bottom; }
td { font: 400 46px/1 'Anton', sans-serif; text-align: center; padding: 12px 8px; border-top: 2px solid var(--line); }
td.who { display: flex; align-items: center; gap: 14px; text-align: left; font: 700 32px/1 'Archivo', sans-serif; }
td.who img { height: 36px; width: 100px; object-fit: contain; object-position: left center; }
td.t { border-left: 2px solid var(--line); }
tr.hi td { color: var(--accent); }
tr.bandrow td { font: 700 18px/1 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
                text-align: left; padding: 14px 8px 4px; }

/* columns */
.cols { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; gap: 28px; }
.col { border-top: 4px solid var(--line); padding-top: 22px; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.cols.some-hi .col:not(.hi) { opacity: .5; }
.col.hi { border-top-color: var(--accent); }
.cl { font: 700 24px/1.1 'IBM Plex Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.col.hi .cl, .col.hi .cn { color: var(--accent); }
.cg { display: flex; align-items: center; gap: 22px; height: 56px; }
.cg img { height: 48px; width: auto; max-width: 150px; object-fit: contain; }
.cn { font: 700 40px/1.15 'Archivo', sans-serif; }
.cf { font: 500 30px/1.3 'Archivo', sans-serif; color: var(--muted); }

/* panels: two measures side by side */
.subject { display: flex; align-items: center; gap: 18px; font: 700 34px/1 'Archivo', sans-serif; }
.subject img { height: 40px; width: auto; max-width: 120px; object-fit: contain; }
.panels { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; }
.panel { display: flex; flex-direction: column; gap: 16px; border-top: 4px solid var(--line); padding-top: 18px; }
.panel.dim { opacity: .35; }
.pt { font: 700 20px/1.25 'IBM Plex Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pr { display: grid; grid-template-columns: 200px 1fr 170px; align-items: center; gap: 22px; height: 72px; }
.pr .pn { font: 700 32px/1.05 'Archivo', sans-serif; white-space: nowrap; }
.pr .pv { font: 400 64px/1 'Anton', sans-serif; text-align: right; white-space: nowrap; }
.pr.hi .pn, .pr.hi .pv { color: var(--accent); }
.pr.hi .bar i { background: var(--accent); }
.pc { display: flex; flex-direction: column; gap: 6px; min-height: 96px; }
.pc .big { font: 400 64px/1 'Anton', sans-serif; text-transform: uppercase; color: var(--accent); }
.pc .small { font: 600 26px/1.2 'Archivo', sans-serif; color: var(--cream); }
.pc.hid { visibility: hidden; }

/* timeline */
.tl { position: relative; height: 400px; flex: none; margin: auto 0; }
.tl .axisline { position: absolute; left: 0; right: 0; top: 200px; height: 3px; background: var(--bar); }
.tl .tick { position: absolute; width: 4px; transform: translateX(-2px); background: var(--cream); z-index: 2; }
.tl .tick.minor { background: var(--muted); }
.tl .tick.hi, .tl .lead.hi { background: var(--accent); }
.tl .lead { position: absolute; width: 2px; transform: translateX(-1px); background: var(--line); }
.tl .lab { position: absolute; white-space: nowrap; }
.tl .lab.major b { display: block; font: 700 34px/1 'Archivo', sans-serif; color: var(--cream); }
.tl .lab.major i { display: block; font: 500 20px/1 'IBM Plex Mono', monospace; font-style: normal; color: var(--muted); margin-top: 6px; }
.tl .lab.minor b { display: block; font: 600 28px/1 'Archivo', sans-serif; color: var(--muted); }
.tl .lab.hi b, .tl .lab.hi i { color: var(--accent); }
.tl .month { position: absolute; bottom: 0; font: 500 18px/1 'IBM Plex Mono', monospace; color: var(--muted); letter-spacing: .06em; transform: translateX(-50%); }

/* dots */
.dotcols { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 64px; }
.dc { display: flex; flex-direction: column; gap: 18px; border-top: 4px solid var(--line); padding-top: 18px; min-width: 0; }
.dc.hi { border-top-color: var(--accent); }
.dc.empty { opacity: .45; }
.dc .dl { font: 700 24px/1.15 'IBM Plex Mono', monospace; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.dc.hi .dl { color: var(--accent); }
.dc .dr { display: flex; gap: 36px; align-items: center; }
.grid { display: grid; grid-template-columns: repeat(10, 22px); gap: 7px; flex: none; }
.grid i { width: 22px; height: 22px; border-radius: 50%; background: var(--ink-soft); border: 2px solid var(--line); display: block; }
.grid i.on { background: var(--cream); border-color: var(--cream); }
.dc.hi .grid i.on { background: var(--accent); border-color: var(--accent); }
.dc .fig { font: 400 88px/1 'Anton', sans-serif; text-transform: uppercase; text-wrap: balance; }
.dc.hi .fig { color: var(--accent); }
.dc .fl { font: 600 28px/1.25 'Archivo', sans-serif; color: var(--cream); margin-top: 12px; }
.dc .fig.hid, .dc .fl.hid { visibility: hidden; }

/* shots */
.shotbox { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
           border: 2px solid var(--line); border-radius: 10px; overflow: hidden; padding: 14px; }
.stacks { display: flex; align-items: center; justify-content: center; gap: HALFVCUTpx; }
.stack { display: flex; flex-direction: column; align-items: flex-start; }
.part { position: relative; flex: none; }
.part img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.part svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.cut { height: CUTpx; align-self: stretch; position: relative; }
.cut::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; border-top: 4px dashed var(--bar); }
.vcut { width: 4px; align-self: stretch; border-left: 4px dashed var(--bar); }
""".replace('HALFVCUTpx', f'{(VCUT_PX - 4) // 2}px').replace('CUTpx', f'{CUT_PX}px')

# Lay out a shot's parts at one scale: as large as the box allows, never more than MAX_SCALE.
LAYOUT_JS = """
window.__layout = () => {
  const box = document.querySelector('.shotbox'); if (!box) return null;
  const cs = getComputedStyle(box);
  const W = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const H = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const stacks = [...box.querySelectorAll('.stack')];
  const parts = s => [...s.querySelectorAll('.part')];
  const sw = stacks.map(s => Math.max(...parts(s).map(p => +p.dataset.w)));
  const sh = stacks.map(s => parts(s).reduce((a, p) => a + +p.dataset.h, 0));
  const cuts = stacks.map(s => (parts(s).length - 1) * CUT);
  let k = Math.min(MAXS, (W - (stacks.length - 1) * VCUT) / sw.reduce((a, b) => a + b, 0));
  stacks.forEach((s, i) => { k = Math.min(k, (H - cuts[i]) / sh[i]); });
  // whole pixels, so the shade's edge never antialiases into a light line along a part's right and bottom edges
  for (const p of box.querySelectorAll('.part')) { p.style.width = Math.floor(+p.dataset.w * k) + 'px'; p.style.height = Math.floor(+p.dataset.h * k) + 'px'; }
  document.body.dataset.scale = k.toFixed(3);
  return k;
};
""".replace('MAXS', str(MAX_SCALE)).replace('VCUT', str(VCUT_PX)).replace('CUT', str(CUT_PX))

# Spread a timeline's names so none overlaps another: majors in rows above the line, the rest in rows below.
TIMELINE_JS = """
window.__timeline = () => {
  const tl = document.querySelector('.tl'); if (!tl) return null;
  const Wd = tl.clientWidth, LINE = 200, GAP = 18, CLEAR = 8;
  // Names go in rows away from the line, each with a leader line from its date. A name never overlaps another
  // name, its leader never crosses a name nearer the line, and it never covers a leader already drawn through its
  // row; it is kept off the dates still to come where it can be. It may sit centred on its date, or start or end there.
  const place = (cls, dir, rowH, first) => {
    const labs = [...tl.querySelectorAll('.lab.' + cls)];
    const xs = labs.map(l => +l.dataset.x * Wd);
    const rows = [], leads = [];
    labs.forEach((lab, i) => {
      const x = xs[i], w = lab.offsetWidth, h = lab.offsetHeight;
      const ok = (r, left, strict) => {
        const free = (rows[r] || []).every(([a, b]) => left + w + GAP <= a || left >= b + GAP);
        const leadClear = rows.slice(0, r).every(row => (row || []).every(([a, b]) => x < a - CLEAR || x > b + CLEAR));
        const notCrossed = leads.every(([lx, lr]) => lr <= r || lx < left - CLEAR || lx > left + w + CLEAR);
        const ahead = !strict || xs.slice(i + 1).every(fx => fx < left - CLEAR || fx > left + w + CLEAR);
        return free && leadClear && notCrossed && ahead;
      };
      let pick = null;
      for (const strict of [true, false]) {
        for (let r = 0; r < 8 && !pick; r++)
          for (const left0 of [x - w / 2, x - 10, x - w + 10]) {
            const left = Math.max(0, Math.min(Wd - w, left0));
            if (ok(r, left, strict)) { pick = [r, left]; break; }
          }
        if (pick) break;
      }
      const [r, left] = pick || [rows.length, Math.max(0, Math.min(Wd - w, x - w / 2))];
      (rows[r] = rows[r] || []).push([left, left + w]);
      leads.push([x, r]);
      const top = dir < 0 ? LINE - first - r * rowH - h : LINE + first + r * rowH;
      lab.style.left = left + 'px'; lab.style.top = top + 'px';
      const lead = tl.querySelector('.lead[data-for="' + lab.dataset.id + '"]');
      if (lead) { lead.style.left = x + 'px';
        if (dir < 0) { lead.style.top = (top + h + 4) + 'px'; lead.style.height = Math.max(0, LINE - top - h - 4) + 'px'; }
        else { lead.style.top = LINE + 'px'; lead.style.height = Math.max(0, top - LINE - 4) + 'px'; } }
    });
    return rows.length;
  };
  return [place('major', -1, 72, 26), place('minor', 1, 40, 26)];
};
"""

# Every visible element must sit inside the page box, and no text box may
# overflow its own width (a word pushed past its cell or clipped).
FIT_JS = """() => {
  const bad = [];
  const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (getComputedStyle(el).visibility === 'hidden') continue;
    const name = (el.textContent || el.getAttribute('alt') || el.tagName).trim().slice(0, 50);
    if (r.left < 40 || r.top < 40 || r.right > W - 40 || r.bottom > H - 40) bad.push(`outside the card: ${name}`);
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') bad.push(`clipped: ${name}`);
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim()) bad.push(`too wide: ${name}`);
  }
  for (const a of document.querySelectorAll('.tl .lab, .tl .month')) for (const b of document.querySelectorAll('.tl .lab, .tl .month')) {
    if (a === b) continue; const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    if (p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom) bad.push(`overlaps: ${a.textContent.trim()} / ${b.textContent.trim()}`);
  }
  return [...new Set(bad)];
}"""


def fail(msg):
    sys.exit(f'video_card: {msg}')


def logos_of(card):
    """Every logo a card names, wherever it sits: the card's own, its rows', its columns', its subject's."""
    out = list(card.get('logos') or [])
    out += [l for r in card.get('rows', []) for l in r.get('logos', [])]
    out += [l for c in card.get('columns', []) if isinstance(c, dict) for l in c.get('logos', [])]
    out += list((card.get('subject') or {}).get('logos') or [])
    return out


def shot_stacks(card):
    """A shot's passages as stacks of parts ([[part, ...], ...]); one plain capture is one stack of one part."""
    if card.get('stacks'):
        return card['stacks']
    if card.get('parts'):
        return [card['parts']]
    return [[{k: card[k] for k in ('image', 'crop', 'mark', 'marks') if k in card}]]


def check_spec(spec):
    series = spec.get('series')
    if series not in TERRITORY:
        fail(f'"series" must be one of {", ".join(TERRITORY)}')
    others = [w for s, words in TERRITORY.items() if s != series for w in words]
    for card in spec['cards']:
        name = card.get('file', '?')
        kicker = (card.get('kicker') or '').lower()
        hit = next((w for w in others if w in kicker), None)
        if hit:
            fail(f'{name}: the kicker "{card["kicker"]}" uses "{hit}", another series\' ground (Krish, 2026-10-13: '
                 '"having \'where the money moves\' inside under the hood makes no sense")')
        if not logos_of(card):
            fail(f'{name}: no company logo on it; every card shows the companies it is about (Krish, 2026-10-13: '
                 '"we\'ve not made any use of business logos as we\'re supposed to")')
        if card.get('kind') not in KINDS:
            fail(f'{name}: kind must be one of {", ".join(KINDS)}')
        if card['kind'] == 'shot':
            parts = [p for s in shot_stacks(card) for p in s]
            if not parts or not all(p.get('image') for p in parts) or not str(card.get('source') or '').strip():
                fail(f'{name}: a shot shows a real captured page ("image", or "parts" each with an "image") and says where '
                     'and when it is from ("source")')
        heading = card.get('title') or ' '.join(l.get('text', '') for l in card.get('lines', []))
        why = title_check.gate(heading, spec.get('_source'))
        if why:
            fail(f'{name}: its heading "{heading}" is not ready (house rule TITLE_EARNS_THE_CLICK: the anti-dumb floor, then only a title Krish picked): ' + '; '.join(why))


TRIMMED = {}  # logo path -> data URI of the SVG cut to its own artwork
CARDS_DIR = Path('.')  # the cards file's folder: a shot's "image" is relative to it


def trim_svg(pg, path):
    """A logo SVG with its viewBox cut to the artwork, so every logo draws at
    the same visual size (Meta's and OpenAI's files carry wide empty margins)."""
    import re
    text = path.read_text(encoding='utf-8')
    pg.set_content(f'<html><body style="margin:0">{text}</body></html>')
    box = pg.evaluate("""() => { const s = document.querySelector('svg'); const b = s.getBBox();
                                 return [b.x, b.y, b.width, b.height]; }""")
    if box[2] <= 0 or box[3] <= 0:
        return brand.data_uri(path)
    vb = f'viewBox="{box[0]:.2f} {box[1]:.2f} {box[2]:.2f} {box[3]:.2f}"'
    text = re.sub(r'\sviewBox="[^"]*"', ' ' + vb, text, count=1) if 'viewBox' in text else text.replace('<svg', f'<svg {vb}', 1)
    text = re.sub(r'(<svg[^>]*?)\s(width|height)="[^"]*"', r'\1', text, count=2)
    return 'data:image/svg+xml;base64,' + base64.b64encode(text.encode()).decode()


def img(base, rel):
    path = (base / rel).resolve()
    if not path.exists():
        fail(f'logo not found: {path}')
    return f'<img src="{TRIMMED.get(path) or brand.data_uri(path)}" alt="{html.escape(path.stem)}">'


def page_colour(im):
    """The page's own background: the commonest colour along the crop's edges."""
    from collections import Counter
    w, h = im.size
    px = im.load()
    edge = [px[x, 0] for x in range(0, w, 3)] + [px[x, h - 1] for x in range(0, w, 3)]
    edge += [px[0, y] for y in range(0, h, 3)] + [px[w - 1, y] for y in range(0, h, 3)]
    return Counter(edge).most_common(1)[0][0]


def framed_part(part, name):
    """One passage of a captured page: cut to its "crop" ([x, y, w, h] in the capture's pixels), with a margin of
    the page's own colour round it so a ring never sits on its edge, and its "marks" moved into the cut's
    pixels. The page's pixels are never changed; the ring is drawn over them by the card."""
    from PIL import Image
    path = (CARDS_DIR / part['image']).resolve()
    if not path.exists():
        fail(f'{name}: the captured page {part["image"]} is not there')
    im = Image.open(path).convert('RGB')
    x0, y0, w, h = (int(v) for v in (part.get('crop') or (0, 0, im.width, im.height)))
    if x0 < 0 or y0 < 0 or x0 + w > im.width or y0 + h > im.height:
        fail(f'{name}: "crop" {part.get("crop")} runs outside the capture {part["image"]} ({im.width} x {im.height})')
    im = im.crop((x0, y0, x0 + w, y0 + h))
    bg = page_colour(im)
    m = CROP_MARGIN
    out = Image.new('RGB', (w + 2 * m, h + 2 * m), bg)
    out.paste(im, (m, m))
    marks = list(part.get('marks') or []) + ([part['mark']] if part.get('mark') else [])
    boxes = []
    for mk in marks:
        x, y, mw, mh = (int(v) for v in mk[:4])
        # padding: one number, or [left, top, right, bottom] so a side that meets other words stays tight to its own
        p = mk[4] if len(mk) > 4 else MARK_PAD
        pl, pt, pr, pb = (int(v) for v in (p if isinstance(p, (list, tuple)) else (p,) * 4))
        if x < x0 - pl or y < y0 - pt or x + mw > x0 + w + pr or y + mh > y0 + h + pb:
            fail(f'{name}: the mark {mk} runs outside its crop {part.get("crop")} in {part["image"]}')
        boxes.append((x - x0 + m - pl, y - y0 + m - pt, mw + pl + pr, mh + pt + pb))
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=True)
    return {'uri': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), 'w': out.width, 'h': out.height,
            'bg': '#%02X%02X%02X' % bg, 'bg_rgb': bg, 'marks': boxes, 'im': out, 'src': part['image']}


def _plain(fp):
    """True when the part is mostly one plain page colour (text on a page), so its ink can be told from its page."""
    im = fp['im']
    small = im.resize((max(1, im.width // 8), max(1, im.height // 8)))
    cols = small.getcolors(small.width * small.height) or []
    near = sum(n for n, c in cols if sum(abs(a - b) for a, b in zip(c, fp['bg_rgb'])) < 12)
    return near / max(1, small.width * small.height) >= 0.4


def _band_hits(fp, reach):
    """Pixels of the page's own ink (outside the ringed words) within `reach` capture pixels of the joined boxes."""
    from PIL import Image, ImageChops, ImageDraw
    im = fp['im']
    band = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(band)
    for x, y, w, h in fp['marks']:
        d.rounded_rectangle((x - reach, y - reach, x + w + reach, y + h + reach), radius=RING_RX + reach, fill=255)
    for x, y, w, h in fp['marks']:
        d.rounded_rectangle((x, y, x + w, y + h), radius=RING_RX, fill=0)
    if 'ink' not in fp:
        fp['ink'] = ImageChops.difference(im, Image.new('RGB', im.size, fp['bg_rgb'])).convert('L').point(
            lambda v: 255 if v > INK_DIFF else 0)
    return ImageChops.multiply(band, fp['ink'])


def ring_room(fp, limit=48):
    """How many capture pixels of clear page the ringed words have round them: to the nearest ink that is not
    theirs, and to the crop's edge. A page that is not plain (a photo, a gradient) counts only the crop's edge."""
    if not fp['marks']:
        return limit
    W, H = fp['im'].size
    edge = min(min(x, y, W - (x + w), H - (y + h)) for x, y, w, h in fp['marks'])
    if not _plain(fp):
        return max(0, min(limit, edge))
    lo, hi = 0, min(limit, max(0, edge))  # the largest reach with no ink in its band (more reach, more ink: binary search)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if _band_hits(fp, mid).histogram()[255] > INK_ALLOWED:
            hi = mid - 1
        else:
            lo = mid
    return lo


def ring_width(parts, k):
    """The card's ring, in card pixels: RING_PX of mint and RING_EDGE_PX of ink where the page leaves room, thinner
    where the ringed words sit close to others (a word space, the next line), always clear of them by RING_CLEAR."""
    rooms = [ring_room(fp) for fp in parts if fp['marks']]
    if not rooms or not k:
        return RING_PX + RING_EDGE_PX
    return max(0, min(RING_PX + RING_EDGE_PX, int(min(rooms) * k - RING_CLEAR)))


def ring_problems(fp, k, width=None):
    """Where one part's ring, `width` card pixels wide with the part at k card pixels per capture pixel, would sit on
    the page's own ink (a word, an icon, a rule) or run off the crop, or be too thin to see."""
    if not fp['marks'] or not k:
        return []
    width = RING_PX + RING_EDGE_PX if width is None else width
    out = []
    if width < RING_MIN:
        out.append(f'no room for a ring in {fp["src"]}: the ringed words have {ring_room(fp)} px of clear page round them, '
                   f'{ring_room(fp) * k:.1f} px on the card (page at {k:.3f}x), and a ring needs {RING_MIN + RING_CLEAR}: '
                   'tighten the mark to the words, or crop so the page draws larger')
        return out
    reach = int(-(-width // k))
    W, H = fp['im'].size
    for x, y, w, h in fp['marks']:
        if x - reach < 0 or y - reach < 0 or x + w + reach > W or y + h + reach > H:
            out.append(f'the ring round {[x, y, w, h]} runs off the crop of {fp["src"]} (it needs {reach} px of page round it)')
    if _plain(fp):
        hit = _band_hits(fp, reach)
        n = hit.histogram()[255]
        if n > INK_ALLOWED:
            x0, y0, x1, y1 = hit.getbbox()
            out.append(f'the ring sits on the page\'s own ink in {fp["src"]}: {n} px between x {x0}-{x1}, y {y0}-{y1} of the framed '
                       f'crop (page at {k:.3f}x; ring {width} px, {reach} px in capture pixels): move or tighten the mark, or crop '
                       'so the page draws larger')
    return out


def ring_svg(fp, idn, shade):
    """The ring and the shade, over one part, in its own pixels: every mark box joins one outline (the inner half
    of each box's stroke is masked away, so overlapping line boxes read as one shape), RING_PX of mint with a
    RING_EDGE_PX ink edge at the card's own size (set_ring thins it where the page leaves less room), and 38% ink
    over the page outside."""
    t = brand.house()['tokens']
    w, h = fp['w'], fp['h']
    holes = ''.join(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" rx="{RING_RX}" fill="black"/>' for x, y, bw, bh in fp['marks'])
    outline = lambda width, colour, cls: ''.join(  # noqa: E731
        f'<rect class="{cls}" x="{x}" y="{y}" width="{bw}" height="{bh}" rx="{RING_RX}" fill="none" stroke="{colour}" '
        f'stroke-width="{width}" vector-effect="non-scaling-stroke"/>' for x, y, bw, bh in fp['marks'])
    dim = f'<rect width="{w}" height="{h}" fill="{t["ink"]}" fill-opacity="{SHADE}" shape-rendering="crispEdges"/>' if shade else ''
    return (f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true">'
            f'<defs><mask id="{idn}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="{w + 100}" height="{h + 100}">'
            f'<rect x="-50" y="-50" width="{w + 100}" height="{h + 100}" fill="white"/>{holes}</mask></defs>'
            f'<g mask="url(#{idn})">{dim}{outline(2 * (RING_PX + RING_EDGE_PX), t["ink"], "ring-edge")}'
            f'{outline(2 * RING_PX, t["mint"], "ring-mint")}</g></svg>')


def ring_strokes(width):
    """The two strokes of a ring `width` card pixels wide (each stroke is doubled: its inner half is masked away):
    the ink edge outside, the mint inside; a ring under 4 px is mint alone."""
    mint = width - RING_EDGE_PX if width >= 4 else width
    return 2 * width, 2 * mint


SET_RING_JS = """([edge, mint]) => {
  for (const e of document.querySelectorAll('rect.ring-edge')) e.setAttribute('stroke-width', edge);
  for (const e of document.querySelectorAll('rect.ring-mint')) e.setAttribute('stroke-width', mint);
}"""


def shaded(hexcol):
    """A page colour under the shot's ink shade."""
    ink = brand.house()['tokens']['ink'].lstrip('#')
    col = hexcol.lstrip('#')
    return '#%02X%02X%02X' % tuple(round(int(col[i:i + 2], 16) * (1 - SHADE) + int(ink[i:i + 2], 16) * SHADE) for i in (0, 2, 4))


def src_html(text):
    """A source line, with each web address kept whole on one line."""
    return ' '.join(f'<span class="nb">{html.escape(w)}</span>' if '/' in w else html.escape(w) for w in str(text).split(' '))


FRAMED = {}  # card file -> its framed parts, kept until the layout gives their scale and the rings are checked


def shot_body(card):
    stacks = [[framed_part(p, card['file']) for p in s] for s in shot_stacks(card)]
    FRAMED[card['file']] = [fp for s in stacks for fp in s]
    shade = any(fp['marks'] for s in stacks for fp in s)
    n = 0
    out = []
    for i, s in enumerate(stacks):
        if i:
            out.append('<div class="vcut"></div>')
        inner = []
        for j, fp in enumerate(s):
            if j:
                inner.append('<div class="cut"></div>')
            n += 1
            inner.append(f'<div class="part" data-w="{fp["w"]}" data-h="{fp["h"]}" style="background:{shaded(fp["bg"]) if shade else fp["bg"]}">'
                         f'<img src="{fp["uri"]}" alt="the page">'
                         + (ring_svg(fp, f'm{n}', shade) if shade else '') + '</div>')
        out.append('<div class="stack">' + ''.join(inner) + '</div>')
    bg = stacks[0][0]['bg']
    if shade:  # the box round a shaded page takes the same shade, so the page and its margin read as one surface
        bg = shaded(bg)
    return f'<div class="shotbox" style="background:{bg}"><div class="stacks">{"".join(out)}</div></div>'


def header(card, base, title=None):
    """The one header: kicker at the top with the card's logos at its right, the heading under it."""
    e = html.escape
    logos = ''.join(img(base, l) for l in card.get('logos') or [])
    t = card.get('title') if title is None else title
    return (f'<div class="hd"><div class="kl"><div class="k">{e(card.get("kicker") or "")}</div>'
            f'<div class="logos">{logos}</div></div>' + (f'<h1>{e(t)}</h1>' if t else '') + '</div>')


def foot(card):
    e = html.escape
    bits = ([f'<div class="note">{e(card["note"])}</div>'] if card.get('note') else []) + \
           ([f'<div class="src">{src_html(card["source"])}</div>'] if card.get('source') else [])
    return f'<div class="foot">{"".join(bits)}</div>' if bits else ''


def nb(text):
    """A label kept whole on one line where it holds a model name and its level ('Opus 5.5 · Low')."""
    return html.escape(text).replace(' ', ' ')


def bars_body(card, base):
    e = html.escape
    top = float(card.get('max', 10))
    grouped = any(r.get('group') for r in card['rows'])
    has_x = any('extra' in r for r in card['rows'])
    score_col = 90 if top <= 10 else 120
    style = f'--grid:{int(card.get("namecol", 400))}px 1fr {score_col}px' + (' 240px' if has_x else '')
    out = []
    if card.get('callout'):
        c = card['callout']
        out.append(f'<div class="callout{" hid" if c.get("hidden") else ""}"><span class="big">{e(c.get("big", ""))}</span>'
                   f'<span class="small">{e(c.get("small", ""))}</span></div>')
    out.append(f'<div class="rows{" g" if grouped else ""}{" chart" if top > 10 else ""}" style="{style}">')
    last = None
    for r in card['rows']:
        if r.get('group') and r['group'] != last:
            out.append(f'<div class="band">{e(r["group"])}</div>')
            last = r['group']
        cls = ' hi' if (r['name'] == card.get('highlight') or r.get('hi')) else ''
        cls += ' dim' if r.get('dim') else ''
        cls += ' hid' if r.get('hidden') else ''
        logos = ''.join(img(base, l) for l in r.get('logos', []))
        sub = f'<small>{e(r["sub"])}</small>' if r.get('sub') else ''
        width = max(0.0, min(top, float(r['score']))) / top * 100
        out.append(f'<div class="r{cls}"><div class="who">{logos}<div class="nm"><span>{nb(r["name"])}</span>{sub}</div></div>'
                   f'<div class="bar"><i style="width:{width:.2f}%"></i></div>'
                   f'<div class="s">{e(str(r.get("label", r["score"])))}</div>'
                   + (f'<div class="x">{e(r.get("extra") or "")}</div>' if has_x else '') + '</div>')
    if card.get('axis'):  # the scale under the bars, named beside its ticks (PLAIN_SCORES)
        half = top / 2
        fmt = lambda v: str(int(v)) if float(v).is_integer() else str(v)  # noqa: E731
        out.append(f'<div class="r ticks"><div class="axis">{e(card["axis"])}</div><div class="tk"><span style="left:0">0</span>'
                   f'<span style="left:50%">{fmt(half)}</span><span style="left:100%">{fmt(top)}</span></div><div></div>'
                   + ('<div></div>' if has_x else '') + '</div>')
    out.append('</div>')
    return ''.join(out)


def panels_body(card, base):
    e = html.escape
    out = []
    if card.get('subject'):
        s = card['subject']
        out.append(f'<div class="subject">{"".join(img(base, l) for l in s.get("logos") or [])}<span>{e(s.get("text", ""))}</span></div>')
    out.append('<div class="panels">')
    for p in card['panels']:
        top = float(p['max'])
        out.append(f'<div class="panel{" dim" if p.get("dim") else ""}"><div class="pt">{e(p["title"])}</div>')
        for r in p['rows']:
            width = max(0.0, min(top, float(r['value']))) / top * 100
            out.append(f'<div class="pr{" hi" if r.get("hi") else ""}"><span class="pn">{e(r["name"])}</span>'
                       f'<div class="bar"><i style="width:{width:.2f}%"></i></div><span class="pv">{e(r["label"])}</span></div>')
        c = p.get('callout') or {'hidden': True}
        out.append(f'<div class="pc{" hid" if c.get("hidden") else ""}"><span class="big">{e(c.get("big", "") or "-")}</span>'
                   f'<span class="small">{e(c.get("small", "") or "-")}</span></div></div>')
    out.append('</div>')
    return ''.join(out)


def timeline_body(card):
    e = html.escape
    a, b = dt.date.fromisoformat(card['start']), dt.date.fromisoformat(card['end'])
    span = (b - a).days
    frac = lambda d: (dt.date.fromisoformat(d) - a).days / span  # noqa: E731
    out = ['<div class="tl"><div class="axisline"></div>']
    for n, ev in enumerate(card['events']):
        x = frac(ev['date'])
        if not 0 <= x <= 1:
            fail(f'{card["file"]}: {ev["name"]} ({ev["date"]}) is outside the timeline {card["start"]} to {card["end"]}')
        kind = 'major' if ev.get('major') else 'minor'
        hi = ' hi' if ev.get('hi') else ''
        tick_h = 18 if kind == 'major' else 14
        top = 200 - tick_h if kind == 'major' else 200
        out.append(f'<div class="tick {kind}{hi}" style="left:{x * 100:.3f}%;top:{top}px;height:{tick_h}px"></div>')
        out.append(f'<div class="lead{hi}" data-for="e{n}"></div>')
        day = dt.date.fromisoformat(ev['date'])
        date = f'<i>{day.day} {day.strftime("%b %Y")}</i>' if kind == 'major' else ''
        out.append(f'<div class="lab {kind}{hi}" data-id="e{n}" data-x="{x:.5f}"><b>{nb(ev["name"])}</b>{date}</div>')
    d = dt.date(a.year, a.month, 1)
    while d <= b:
        if d >= a:
            out.append(f'<div class="month" style="left:{frac(d.isoformat()) * 100:.3f}%">{d.strftime("%b").upper()}</div>')
        d = dt.date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    out.append('</div>')
    return ''.join(out)


def dots_body(card):
    e = html.escape
    out = ['<div class="dotcols">']
    for c in card['columns']:
        state = c.get('state', 'plain')
        lit = 0 if state == 'empty' else float(c.get('lit', 0))
        cells = []
        for i in range(100):
            if i < int(lit):
                cells.append('<i class="on"></i>')
            elif i == int(lit) and lit % 1:
                colour = 'var(--accent)' if state == 'hi' else 'var(--cream)'
                cells.append(f'<i style="background:conic-gradient({colour} 0 {lit % 1 * 360:.0f}deg, var(--ink-soft) 0);border-color:{colour}"></i>')
            else:
                cells.append('<i></i>')
        hid = ' hid' if state == 'empty' else ''
        out.append(f'<div class="dc {state}"><div class="dl">{e(c["label"])}</div><div class="dr"><div class="grid">{"".join(cells)}</div>'
                   f'<div><div class="fig{hid}">{e(c.get("figure", ""))}</div><div class="fl{hid}">{e(c.get("line", ""))}</div></div></div></div>')
    out.append('</div>')
    return ''.join(out)


def body_of(card, base):
    e = html.escape
    kind = card['kind']
    if kind == 'statement' and card.get('chapter'):
        out = [f'<div class="k">{e(card["kicker"])}</div>'] if card.get('kicker') else []
        out.append('<div class="lines">' + ''.join(
            f'<div style="color:{TONES.get(l.get("tone", "plain"), TONES["plain"])}">{e(l["text"])}</div>'
            for l in card['lines']) + '</div>')
        out.append('<div class="logos">' + ''.join(img(base, l) for l in card['logos']) + '</div>')
        if card.get('note'):
            out.append(f'<div class="note">{e(card["note"])}</div>')
        return ''.join(out)
    title = card.get('title') or (card.get('lines') or [{}])[0].get('text')
    out = [header(card, base, title)]
    if kind == 'shot':
        out.append(shot_body(card))
        if card.get('note'):
            out.append(f'<div class="note">{e(card["note"])}</div>')
        out.append(f'<div class="src">{src_html(card["source"])}</div>')
        return ''.join(out)
    if kind == 'bars':
        out.append(bars_body(card, base))
    elif kind == 'table':
        out.append('<table><tr><th></th>' + ''.join(f'<th>{e(c)}</th>' for c in card['columns']) + '<th>Total</th></tr>')
        last = None
        for r in card['rows']:
            if r.get('group') and r['group'] != last:
                out.append(f'<tr class="bandrow"><td colspan="{len(card["columns"]) + 2}">{e(r["group"])}</td></tr>')
                last = r['group']
            hi = ' class="hi"' if r['name'] == card.get('highlight') else ''
            logos = ''.join(img(base, l) for l in r.get('logos', []))
            out.append(f'<tr{hi}><td class="who">{logos}{e(r["name"])}</td>'
                       + ''.join(f'<td>{v}</td>' for v in r['scores']) + f'<td class="t">{sum(r["scores"])}</td></tr>')
        out.append('</table>')
    elif kind == 'columns':
        # Side-by-side groups: a mono label, the companies' logos, the names, and one plain line under each.
        # "hi" marks the one the card is about; the others fade so the build he talks over shows.
        some = any(c.get('hi') for c in card['columns'])
        out.append(f'<div class="cols{" some-hi" if some else ""}">')
        for c in card['columns']:
            out.append(f'<div class="col{" hi" if c.get("hi") else ""}"><div class="cl">{e(c["label"])}</div>'
                       f'<div class="cg">{"".join(img(base, l) for l in c.get("logos", []))}</div>'
                       f'<div class="cn">{e(c["names"])}</div>' + (f'<div class="cf">{e(c["line"])}</div>' if c.get('line') else '') + '</div>')
        out.append('</div>')
    elif kind == 'panels':
        out.append(panels_body(card, base))
    elif kind == 'timeline':
        out.append(timeline_body(card))
    elif kind == 'dots':
        out.append(dots_body(card))
    else:  # a statement that is not a chapter divider: the lines after the heading, then a meter
        for l in card.get('lines', [])[1:]:
            out.append(f'<div class="say" style="color:{TONES.get(l.get("tone", "plain"), TONES["plain"])}">{e(l["text"])}</div>')
        if card.get('meter'):
            m = card['meter']
            v = max(0, min(100, float(m['value'])))
            out.append(f'<div class="meter {e(m.get("tone", "dim"))}"><div class="track"><i style="width:{v:.1f}%"></i></div>'
                       f'<div class="ends"><span>0</span><span>{e(m.get("label", "how sure, out of 100"))}</span><span>100</span></div></div>')
        if card.get('callnote'):
            out.append(f'<div class="callnote">{e(card["callnote"])}</div>')
    out.append(foot(card))
    return ''.join(out)


def page(card, base, accent):
    t = brand.house()['tokens']
    css = (CSS.replace('INKSOFT', t['ink_soft']).replace('INK', t['ink']).replace('CREAM', t['cream'])
           .replace('MINT', t['mint']).replace('ACCENT', accent))
    cls = 'chapter' if card.get('kind') == 'statement' and card.get('chapter') else f'k-{card.get("kind", "")}'
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{brand.font_css()}{css}</style>'
            f'<script>{LAYOUT_JS}{TIMELINE_JS}</script></head>'
            f'<body class="{cls}">{body_of(card, base)}</body></html>')


def contact_sheet(pg, drawn, cues, out):
    """sheet.png: every card at 640 x 360 with its cue id and time under it, so a reviewer sees which tile is
    which cue and where a build repeats (base, -s1, -s2)."""
    from PIL import Image
    tiles = []
    for d in drawn:
        im = Image.open(d).convert('RGB').resize((640, 360), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=88)
        cue, at = cues.get(d.name, (d.stem, None))
        label = html.escape(cue) + (f' &middot; {at:.2f}s' if isinstance(at, (int, float)) else '')
        tiles.append(f'<figure><img src="data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"><figcaption>{label}</figcaption></figure>')
    cols = 3
    rows = (len(tiles) + cols - 1) // cols
    t = brand.house()['tokens']
    doc = (f'<!doctype html><html><head><meta charset="utf-8"><style>{brand.font_css()}'
           f'* {{ margin: 0; box-sizing: border-box; }} body {{ background: {t["ink"]}; width: {cols * 640}px; display: grid; '
           f'grid-template-columns: repeat({cols}, 640px); }} figure {{ width: 640px; height: 396px; }} img {{ display: block; width: 640px; height: 360px; }} '
           f'figcaption {{ height: 36px; padding: 8px 12px 0; font: 500 18px/1 "IBM Plex Mono", monospace; color: {t["cream"]}; '
           f'white-space: nowrap; overflow: hidden; }}</style></head><body>{"".join(tiles)}</body></html>')
    pg.set_viewport_size({'width': cols * 640, 'height': rows * 396})
    pg.set_content(doc)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(200)
    pg.screenshot(path=str(out), full_page=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('cards', nargs='?', help='the cards file (JSON)')
    ap.add_argument('--out', help='where to write the PNGs (default: pics/ beside the cards file)')
    ap.add_argument('--sheet', action='store_true', help='also write sheet.png, every card at a glance with its cue')
    ap.add_argument('--self-test', action='store_true', help='check the drawing rules with no browser')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.cards:
        ap.error('give the cards file, or --self-test')
    src = Path(a.cards).resolve()
    global CARDS_DIR
    CARDS_DIR = src.parent
    spec = json.loads(src.read_text(encoding='utf-8'))
    # "source": the piece's body and scripts (paths beside the cards file), so a card's names and numbers are the piece's.
    srcs = [src.parent / x for x in (spec.get('source') or [])]
    missing = [str(x) for x in srcs if not x.exists()]
    if missing:
        fail(f'"source" names files that are not there: {", ".join(missing)}')
    spec['_source'] = ' '.join(x.read_text(encoding='utf-8') for x in srcs) if srcs else None
    check_spec(spec)
    base = src.parent / spec.get('logos', '.')
    out = Path(a.out) if a.out else src.parent / 'pics'
    out.mkdir(parents=True, exist_ok=True)
    accent = next(c['accent'] for c in brand.house()['channels'] if c['id'] == spec['series'])
    from playwright.sync_api import sync_playwright
    problems, drawn, scales, rings = [], [], {}, {}
    with sync_playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(viewport={'width': W, 'height': H})
        for card in spec['cards']:
            for rel in logos_of(card):
                path = (base / rel).resolve()
                if path.suffix == '.svg' and path.exists() and path not in TRIMMED:
                    TRIMMED[path] = trim_svg(pg, path)
        for card in spec['cards']:
            pg.set_viewport_size({'width': W, 'height': H})
            pg.set_content(page(card, base, accent))
            pg.evaluate('document.fonts.ready')
            pg.wait_for_timeout(100)
            missing = pg.evaluate("""async () => {
              const want = ['400 20px "Anton"', '700 20px "Archivo"', '500 20px "IBM Plex Mono"', '700 20px "IBM Plex Mono"'];
              const out = [];
              for (const f of want) { const got = await document.fonts.load(f); if (!got.length) out.push(f); }
              return out;
            }""")
            scale = pg.evaluate('window.__layout()')
            pg.evaluate('window.__timeline()')
            pg.wait_for_timeout(50)
            if scale:
                scales[card['file']] = round(scale, 3)
            bad = pg.evaluate(FIT_JS)
            parts = FRAMED.pop(card['file'], [])
            if any(fp['marks'] for fp in parts):
                ring = ring_width(parts, scale)
                rings[card['file']] = ring
                if ring >= RING_MIN:
                    pg.evaluate(SET_RING_JS, list(ring_strokes(ring)))
                bad += [p for fp in parts for p in ring_problems(fp, scale, ring)]
            if missing or bad:
                problems.append(f'{card["file"]}: ' + '; '.join([f'font not loaded: {f}' for f in missing] + bad))
                continue
            pg.screenshot(path=str(out / card['file']))
            drawn.append(out / card['file'])
        if a.sheet and drawn:
            cues = {c['file']: (c.get('cue') or c['file'], c.get('at')) for c in spec['cards']}
            contact_sheet(pg, drawn, cues, out / 'sheet.png')
        b.close()
    for d in drawn:
        print(f'drew   {d}' + (f'  (page at {scales[d.name]}x' + (f', ring {rings[d.name]}px' if d.name in rings else '') + ')'
                                if d.name in scales else ''))
    # The receipt the video run checks: every picture it cuts in must be one this
    # tool drew (scripts/produce_day.py, check_cards). Kept beside cards.json.
    import hashlib
    receipt = src.parent / 'cards.receipt.json'
    old = json.loads(receipt.read_text(encoding='utf-8')) if receipt.exists() else {}
    old.update({d.name: hashlib.sha256(d.read_bytes()).hexdigest() for d in drawn})
    receipt.write_text(json.dumps(dict(sorted(old.items())), indent=1) + '\n', encoding='utf-8')
    print(f'receipt {receipt}')
    if a.sheet and drawn:
        print(f'sheet  {out / "sheet.png"}')
    if problems:
        fail('not drawn, fix the words or the layout:\n  ' + '\n  '.join(problems))
    return 0


def self_test():
    """The drawing rules, checked on the page each card would be, with no browser."""
    import re
    import tempfile
    from PIL import Image
    global CARDS_DIR
    fails = []

    def check(what, ok):
        if not ok:
            fails.append(what)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / 'aa.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')
        (tmp / 'co.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>')
        page_png = Image.new('RGB', (400, 300), (250, 250, 250))
        page_png.paste((20, 20, 20), (40, 40, 360, 60))
        page_png.save(tmp / 'page.png')
        CARDS_DIR = tmp
        accent = '#FF6A4D'

        cols = {'file': 'c.png', 'kind': 'columns', 'kicker': 'K', 'title': 'T', 'logos': ['aa.svg'],
                'columns': [{'label': 'L', 'logos': ['co.svg'], 'names': 'N'}]}
        doc = page(cols, tmp, accent)
        head = doc.split('<div class="hd">', 1)[1].split('</div></div>', 1)[0]
        check('a columns card draws its own "logos" on the kicker line (17 Oct 2026: the Artificial Analysis logo was never drawn)',
              'alt="aa"' in head)
        check('a columns card still draws each column\'s logos', 'alt="co"' in doc.split('class="cols', 1)[1])
        check('the logo trim pass takes column logos too', 'co.svg' in logos_of(cols) and 'aa.svg' in logos_of(cols))
        check('the logo trim pass takes a panels card\'s subject logos',
              'aa.svg' in logos_of({'subject': {'logos': ['aa.svg']}}))

        bars = {'file': 'b.png', 'kind': 'bars', 'kicker': 'K', 'title': 'T', 'logos': ['aa.svg'], 'max': 100,
                'axis': 'Index, 0 to 100, higher is better',
                'rows': [{'name': 'A', 'logos': ['co.svg'], 'score': 42}, {'name': 'B', 'score': 58, 'hidden': True}]}
        doc = page(bars, tmp, accent)
        check('bars take a "max": a 42 on a 0 to 100 axis is 42% of the bar (it used to clamp every score to 10)',
              'width:42.00%' in doc and 'width:58.00%' in doc)
        check('bars without "max" keep the 0 to 10 scale', 'width:90.00%' in page(
            {**bars, 'max': 10, 'rows': [{'name': 'A', 'score': 9}]}, tmp, accent))
        check('a hidden bar keeps its place', 'class="r hid"' in doc)
        check('a bars card prints its scale (PLAIN_SCORES)', 'Index, 0 to 100, higher is better' in doc)

        shot = {'file': 's.png', 'kind': 'shot', 'kicker': 'K', 'title': 'T', 'logos': ['aa.svg'], 'source': 'x.com, 1 Jan 2026',
                'parts': [{'image': 'page.png', 'crop': [20, 20, 360, 60], 'marks': [[40, 40, 100, 20], [40, 58, 60, 10]]},
                          {'image': 'page.png', 'crop': [0, 200, 400, 80]}]}
        doc = page(shot, tmp, accent)
        check('two parts of real pages stack with one cut line drawn by the card', doc.count('class="part"') == 2 and doc.count('class="cut"') == 1)
        check('every mark box is one hole in the shade and one ring', doc.count('fill="black"') == 2 and doc.count('stroke="#7EF0C0"') == 2)
        check('the ring is drawn at the card\'s own size, not in capture pixels', 'vector-effect="non-scaling-stroke"' in doc
              and f'stroke-width="{2 * RING_PX}"' in doc)
        check('the page outside the ring is shaded with ink', f'fill-opacity="{SHADE}"' in doc)
        check('a part with no ring is shaded too when another part has one', doc.count('<svg') == 2)
        fp = framed_part({'image': 'page.png', 'crop': [20, 20, 360, 60], 'marks': [[40, 40, 100, 20]]}, 's.png')
        check('every crop gets a margin of the page\'s own colour', fp['w'] == 360 + 2 * CROP_MARGIN and fp['bg'] == '#FAFAFA')
        check('marks move into the cut\'s own pixels', fp['marks'][0][:2] == (40 - 20 + CROP_MARGIN - MARK_PAD, 40 - 20 + CROP_MARGIN - MARK_PAD))
        lines = Image.new('RGB', (400, 300), (250, 250, 250))
        lines.paste((20, 20, 20), (40, 40, 360, 60))   # the line he talks about
        lines.paste((20, 20, 20), (40, 75, 360, 95))   # the next line, 15 px under it
        lines.paste((20, 20, 20), (300, 120, 330, 140))  # a word on a later line
        lines.save(tmp / 'lines.png')
        loose = framed_part({'image': 'lines.png', 'crop': [0, 0, 400, 300], 'marks': [[40, 40, 320, 20]]}, 'r.png')
        check('a ring that would run over the next line is refused (17 Oct 2026: rings cut the lines under them)',
              any('ink' in p for p in ring_problems(loose, 1.0)))
        tight = framed_part({'image': 'lines.png', 'crop': [0, 0, 400, 300], 'marks': [[40, 40, 320, 20, [10, 10, 10, 2]]]}, 'r.png')
        check('a mark padded per side ([left, top, right, bottom]) keeps the ring in the gap between lines',
              tight['marks'][0] == (40 + CROP_MARGIN - 10, 40 + CROP_MARGIN - 10, 340, 32) and not ring_problems(tight, 1.0))
        check('the same ring drawn smaller (a page shown at half size) needs more room and is refused',
              any('ink' in p for p in ring_problems(tight, 0.5)))
        check('the ring thins where the page leaves less room, and then clears the next line',
              ring_width([tight], 1.0) == RING_PX + RING_EDGE_PX and RING_MIN <= ring_width([tight], 0.5) < RING_PX + RING_EDGE_PX
              and not ring_problems(tight, 0.5, ring_width([tight], 0.5)))
        check('a ring with no room left for it is refused, not drawn thinner than RING_MIN',
              ring_width([tight], 0.2) < RING_MIN and any('no room' in p for p in ring_problems(tight, 0.2, ring_width([tight], 0.2))))
        check('a ring of 4 px or more is mint inside a 1 px ink edge; a thinner one is mint alone',
              ring_strokes(7) == (14, 12) and ring_strokes(3) == (6, 6))
        edge = framed_part({'image': 'lines.png', 'crop': [36, 36, 330, 30], 'marks': [[40, 40, 320, 20, 2]]}, 'r.png')
        check('a ring that would run off its crop is refused', any('runs off the crop' in p for p in ring_problems(edge, 0.2)))
        plain = page({**shot, 'parts': None, 'image': 'page.png'}, tmp, accent)
        check('a shot with no mark is not shaded', '<svg' not in plain)
        check('no capture is written back to disk (the page is never changed)', not list(tmp.glob('*.framed.png')))
        check('one stack per "stacks" entry, with a dashed divider between',
              page({**shot, 'parts': None, 'stacks': [[shot['parts'][0]], [shot['parts'][1]]]}, tmp, accent).count('class="vcut"') == 1)

        chapter = {'file': 'ch.png', 'kind': 'statement', 'kicker': 'Chapter 2 of 8', 'chapter': 'Why?', 'logos': ['aa.svg'],
                   'lines': [{'text': 'Why?'}]}
        check('a chapter divider keeps its centred template', '<body class="chapter">' in page(chapter, tmp, accent))
        call = {'file': 'call.png', 'kind': 'statement', 'kicker': 'OUR CALL', 'title': 'By mid-2027, X', 'logos': ['aa.svg'],
                'lines': [{'text': 'By mid-2027, X'}, {'text': 'About 85%', 'tone': 'answer'}], 'meter': {'value': 85, 'tone': 'answer'}}
        doc = page(call, tmp, accent)
        check('any other statement takes the one header, logos on the kicker line', '<div class="hd">' in doc and 'alt="aa"' in doc.split('<h1>')[0])
        check('a call draws its meter', 'width:85.0%' in doc)
        for kind_card in (cols, bars, shot, call):
            doc = page(kind_card, tmp, accent)
            check(f'{kind_card["kind"]}: the heading is one size, Anton 72px, under the kicker', doc.count('<h1>') == 1 and 'font: 400 72px/1.0' in doc)
        check('statement lines and source lines are balanced, so no word sits alone on a line',
              re.search(r'\.lines div \{[^}]*text-wrap: balance', CSS) and re.search(r'\.src \{[^}]*text-wrap: balance', CSS))

        tl = {'file': 't.png', 'kind': 'timeline', 'kicker': 'K', 'title': 'T', 'logos': ['aa.svg'], 'start': '2025-10-16', 'end': '2026-10-15',
              'events': [{'date': '2025-11-24', 'name': 'Opus 4.5', 'major': True}, {'date': '2026-02-17', 'name': 'Sonnet 4.6'}]}
        doc = page(tl, tmp, accent)
        check('a timeline draws every name on its date', doc.count('class="lab ') == 2 and 'NOV' in doc)
        dots = {'file': 'd.png', 'kind': 'dots', 'kicker': 'K', 'title': 'T', 'logos': ['aa.svg'],
                'columns': [{'label': 'Before', 'lit': 0.5, 'figure': 'Under 1 in 100'}, {'label': 'After', 'lit': 7, 'state': 'hi', 'figure': '7 in 100'}]}
        doc = page(dots, tmp, accent)
        check('dots: 7 in 100 lights 7 of 100 dots; under 1 in 100 lights none fully, one partly',
              doc.count('<i class="on">') == 7 and doc.count('conic-gradient') == 1 and doc.count('<i') >= 200)
        CARDS_DIR = Path('.')
    if fails:
        print('video_card self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print('video_card self-test passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
