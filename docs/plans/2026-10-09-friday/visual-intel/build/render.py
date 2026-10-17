"""Render Friday's five Substack exhibits (mind.the.gap) as HTML artwork, 1360 wide, one file each:

    /home/user/content-engine/.cache/visual-intel/<id>.html

Words come from docs/plans/2026-10-09-friday/visual-intel/exhibits.json (the spec). Every plotted point and every
number printed is computed here from data-final.json rows (by Artificial Analysis slug) or the spec's dated launch
rows, and checked against derived.json and the spec's own strings, so nothing is typed by hand and nothing drifts.
House faces come from scripts/pages/brand.py (font_css, as video_card.py and build.py embed them); colours from
config/studio.json through brand.house(); logos are the files in docs/plans/2026-10-09-friday/logos/, unaltered,
checked against the spec's sha256.

Run from the repository root:  python3 -I .cache/visual-intel/scripts/render.py
Then check and draw each:      python3 scripts/pages/card.py .cache/visual-intel/<id>.html --out .cache/visual-intel
Writes only into .cache/visual-intel/ (the HTML files and figures.json).
"""
import base64
import datetime as dt
import hashlib
import html
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path('/home/user/content-engine')
sys.path.insert(0, str(ROOT / 'scripts/pages'))
sys.path.insert(0, str(ROOT / '.cache/visual-intel/scripts'))
import brand  # noqa: E402
from meter import Meter  # noqa: E402

VI = ROOT / 'docs/plans/2026-10-09-friday/visual-intel'
OUT = ROOT / '.cache/visual-intel'
EX = json.loads((VI / 'exhibits.json').read_text(encoding='utf-8'))
DATA = json.loads((VI / 'data-final.json').read_text(encoding='utf-8'))
DER = json.loads((VI / 'derived.json').read_text(encoding='utf-8'))
ARTICLE = (ROOT / 'docs/plans/2026-10-09-draft-body-v5.md').read_text(encoding='utf-8')
ROWS = {r['slug']: r for r in DATA['rows']}

HOUSE = brand.house()
TOK = HOUSE['tokens']
INK, SOFT, CREAM, MINT = TOK['ink'], TOK['ink_soft'], TOK['cream'], TOK['mint']
ACC = brand.channel(HOUSE, 'mind_the_gap')['accent']
_spec_col = EX['design_system']['colours']
assert (INK, SOFT, CREAM, MINT, ACC) == (_spec_col['ink'], _spec_col['ink_soft'], _spec_col['cream'], _spec_col['mint'],
                                         _spec_col['mind_the_gap_accent']), 'house colours and the spec disagree'
_r, _g, _b = (int(CREAM[i:i + 2], 16) for i in (1, 3, 5))


def cr(a):
    """Cream at an opacity."""
    return f'rgba({_r},{_g},{_b},{a})'


W, PAD = 1360, 64
CW = W - 2 * PAD
FONTS = brand.font_css()
METER = Meter()
PROBLEMS = []


COST_IS = ('cost per task: Artificial Analysis\'s average cost to run one of its test tasks, in US dollars, at list '
           'prices')
check_cost = EX['cost_measure']['printed_as']


def src_head(e):
    """'Artificial Analysis Intelligence Index v4.3.2, read 17 Oct 2026' from the exhibit's source line."""
    return e['source_line'].removeprefix('Source: ').split('. ')[0].split('; ')[0]


def check(ok, what):
    if not ok:
        PROBLEMS.append(what)


def esc(s):
    return html.escape(str(s), quote=True)


KEEP_TOGETHER = re.compile(r"(GPT-[0-9.]+(?: (?:Sol|Luna|Astra))?|(?:Claude )?(?:Opus|Sonnet|Haiku|Fable|Mythos) [0-9.]+"
                           r"|Gemini [0-9.]+ \w+|v[0-9.]+[0-9]|[0-9]{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* [0-9]{4})")


def prose(s):
    """Words for an HTML paragraph: escaped, with model names and dates kept on one line (no 'GPT-' / '6.1 Sol')."""
    return KEEP_TOGETHER.sub(lambda m: f'<span class="nb">{m.group(0)}</span>', esc(s))


def width(text, size=54, weight=700, face='Archivo'):
    return METER.w(text, f"{weight} {size}px '{face}'")


# ---------------------------------------------------------------- numbers, all from the JSON

def score(slug):
    return ROWS[slug]['score']


def cpt(slug):
    return ROWS[slug]['cost_per_task_usd']


def half_up(v, nd):
    q = 10 ** nd
    return math.floor(v * q + 0.5 + 1e-9) / q


def pts(a, b):
    """Points gained from slug a to slug b, one decimal (scores are one-decimal values)."""
    return half_up(score(b) - score(a), 1)


def times(a, b, nd=2):
    """Cost per task multiple from slug a to slug b."""
    return half_up(cpt(b) / cpt(a), nd)


def f1(v):
    return f'{v:.1f}'


def usd(v):
    return f'${v:.2f}'


def level_name(slug):
    return ROWS[slug]['thinking_level_label']


def gap_words(older, newer):
    """How much later the newer row was released, in words, from the two rows' release dates."""
    days = (dt.date.fromisoformat(newer['release_date']) - dt.date.fromisoformat(older['release_date'])).days
    if days == 7:
        return 'a week'
    months = round(days / 30.44)
    check(abs(days - months * 30.44) <= 4 and 2 <= months <= 12, f'release gap of {days} days is not a whole number of months')
    return ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][months - 2] + ' months'


def short_name(model):
    """'Claude Opus 5.5' -> 'Opus 5.5' (the panel title already says Claude)."""
    return model.removeprefix('Claude ')


def der_range(model):
    for d in DER['thinking_range']:
        if d['model'] == model:
            return d
    raise KeyError(model)


def der_upgrade(from_model, to_model):
    for d in DER['model_upgrades_matched_level']:
        if d['from_model'] == from_model and d['to_model'] == to_model:
            return d
    raise KeyError((from_model, to_model))


def by_model(model):
    """A model's rows in setting order (Non-reasoning, Low, ..., Max)."""
    order = ['Non-reasoning', 'Low', 'Medium', 'High', 'Xhigh', 'Max']
    rs = [r for r in DATA['rows'] if r['model'] == model and r['thinking_level_label'] in order]
    return sorted(rs, key=lambda r: order.index(r['thinking_level_label']))


# ---------------------------------------------------------------- logos (files unaltered, framed to their artwork)

LOGO = {}
for key, spec in EX['design_system']['logos'].items():
    raw = (ROOT / spec['file']).read_bytes()
    check(hashlib.sha256(raw).hexdigest() == spec['sha256'], f'logo {key}: sha256 differs from the spec')
    geo = METER.bbox(raw.decode('utf-8'))
    LOGO[key] = {'uri': 'data:image/svg+xml;base64,' + base64.b64encode(raw).decode(), 'company': spec['company'], **geo}


def logo_svg(key, x, y_top, h):
    """The logo's artwork placed with its drawn box at (x, y_top), h tall, inside an SVG. Returns (markup, width)."""
    lg = LOGO[key]
    vx, vy, vw, vh = lg['vb']
    bx, by, bw, bh = lg['box']
    s = h / bh
    return (f'<image href="{lg["uri"]}" x="{x - (bx - vx) * s:.2f}" y="{y_top - (by - vy) * s:.2f}" width="{vw * s:.2f}" '
            f'height="{vh * s:.2f}" preserveAspectRatio="none"><title>{esc(lg["company"])}</title></image>'), bw * s


def logo_html(key, h, cls='logo'):
    lg = LOGO[key]
    vx, vy, vw, vh = lg['vb']
    bx, by, bw, bh = lg['box']
    return (f'<svg class="{cls}" role="img" aria-label="{esc(lg["company"])}" width="{bw * h / bh:.1f}" height="{h}" '
            f'viewBox="{bx:.3f} {by:.3f} {bw:.3f} {bh:.3f}"><image href="{lg["uri"]}" x="{vx}" y="{vy}" width="{vw}" '
            f'height="{vh}" preserveAspectRatio="none"/></svg>')


# ---------------------------------------------------------------- drawing helpers

def text(x, y, s, size=54, weight=700, fill=CREAM, anchor='start', face='Archivo', fine=False, extra='', halo=False):
    """SVG words. halo: an ink outline drawn under the letters, so a gridline or line passing behind them is cut away."""
    fp = ' data-fine-print' if fine else ''
    hl = f' stroke="{INK}" stroke-width="16" stroke-linejoin="round" paint-order="stroke"' if halo else ''
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" '
            f'style="font-family:\'{face}\'"{fp}{hl} {extra}>{esc(s)}</text>')


def line(x1, y1, x2, y2, stroke=CREAM, w=2, extra=''):
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{w}" {extra}/>'


def circle(x, y, r, fill='none', stroke=None, w=0, extra=''):
    st = f' stroke="{stroke}" stroke-width="{w}"' if stroke else ''
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}"{st} {extra}/>'


def svg(w, h, body, top=0, cls='plot'):
    return (f'<svg class="{cls}" width="{w}" height="{h}" viewBox="0 {top} {w} {h}" '
            f'xmlns="http://www.w3.org/2000/svg">{"".join(body)}</svg>')


BASE_CSS = f'''
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ background: {INK}; }}
#card {{ width: {W}px; padding: 64px {PAD}px 56px; background: {INK}; color: {CREAM}; font-family: 'Archivo', sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }}
.kicker {{ font: 500 42px/1.2 'IBM Plex Mono', monospace; letter-spacing: .03em; text-transform: uppercase; color: {ACC}; white-space: nowrap; }}
h1 {{ font: 400 92px/1.04 'Anton', sans-serif; margin-top: 26px; text-wrap: balance; }}
.stand {{ font: 500 54px/1.25 'Archivo', sans-serif; color: {cr(.82)}; margin-top: 30px; text-wrap: pretty; }}
.chart {{ margin-top: 72px; }}
.axis-title {{ font: 500 54px/1.22 'Archivo', sans-serif; color: {cr(.82)}; text-wrap: pretty; }}
.fine {{ font: 400 42px/1.3 'IBM Plex Mono', monospace; color: {cr(.7)}; text-wrap: pretty; }}
.source {{ margin-top: 64px; padding-top: 36px; border-top: 2px solid {cr(.2)}; font: 400 42px/1.3 'IBM Plex Mono', monospace; color: {cr(.7)}; }}
.source .credit {{ display: block; margin-bottom: 26px; }}
.source p {{ text-wrap: pretty; }}
.source p + p {{ margin-top: 12px; }}
.source .brandline {{ margin-top: 26px; color: {ACC}; }}
svg {{ display: block; overflow: visible; }}
svg text {{ font-kerning: normal; }}
.head {{ display: flex; align-items: center; gap: 22px; }}
.head b {{ font: 700 60px/1 'Archivo', sans-serif; }}
.nb {{ white-space: nowrap; }}
'''


def page(e, chart_html, extra_css=''):
    notes = ''.join(f'<p>{prose(n["text"])}</p>' for n in e.get('notes', []) if 'source block' in n['placement'])
    credit = logo_html('aa', 44, 'credit') if 'aa' in e['logos'] else ''
    src = (f'<div class="source" data-fine-print>{credit}<p>{prose(e["source_line"])}</p>{notes}'
           f'<p class="brandline">mind.the.gap · makeyourmindup</p></div>')
    title = e['heading']
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>{esc(title)}</title>
<meta name="description" content="{esc(e["question"])}">
<style>
{FONTS}
{BASE_CSS}
{extra_css}
</style></head><body><div id="card">
<div class="kicker" data-fine-print>{esc(e["kicker"])}</div>
<h1>{esc(e["heading"])}</h1>
<p class="stand">{prose(e["standfirst"])}</p>
<div class="chart">{chart_html}</div>
{src}
</div></body></html>'''


# ================================================================ Exhibit 1: launches

def ex_launches(e):
    c = e['chart']
    rows = e['data']['rows']
    start, end = dt.date(2025, 11, 1), dt.date(2026, 10, 15)
    span = (end - start).days
    D = lambda s: dt.date.fromisoformat(s)  # noqa: E731

    def X(d):
        return (D(d) - start).days / span * CW
    check(all(start <= D(r['date']) <= end for r in rows), 'launches: a row falls outside the date axis')

    lanes = ['Anthropic', 'OpenAI']
    lane_rows = {ln: sorted([r for r in rows if r['lane'] == ln], key=lambda r: r['date']) for ln in lanes}
    a_days, a_names = len(lane_rows['Anthropic']), sum(len(r['names']) for r in lane_rows['Anthropic'])
    o_days = len(lane_rows['OpenAI'])
    lab_a = f'Anthropic: {a_names} new Claude names on {a_days} days'
    lab_o = f'OpenAI: at least {o_days} launch days'
    check(lab_a == c['lane_labels']['Anthropic'], f'launches: Anthropic label {lab_a!r} v spec')
    check(lab_o == c['lane_labels']['OpenAI'], f'launches: OpenAI label {lab_o!r} v spec')
    all_days = sorted({r['date'] for r in rows})
    union_days = len(all_days)
    weeks_per = (D(all_days[-1]) - D(all_days[0])).days / 7 / (union_days - 1)
    check(1.5 <= weeks_per <= 2.5, f'launches: "about every two weeks" but {weeks_per:.2f} weeks per launch day')
    an = c['annotations'][0]
    in_band = [r for r in rows if an['from'] <= r['date'] <= an['to']]
    band_days = (D(an['to']) - D(an['from'])).days + 1
    band_text = f'{len(in_band)} launches in {band_days} days'
    check(band_text == an['text'], f'launches: band {band_text!r} v spec {an["text"]!r}')
    der = {d['what']: d['value'] for d in e['data']['derived']}
    check(der['launch days, both labs'] == union_days, 'launches: union of launch days v spec')

    names = {(p['lane'], p['date']): p['text'] for p in c['point_labels']}
    for p in c['point_labels']:
        r = [x for x in lane_rows[p['lane']] if x['date'] == p['date']]
        check(len(r) == 1 and any(p['text'] in n for n in r[0]['names']), f'launches: point label {p["text"]} has no row')
    tier_of = {p['text']: (2 if 'second tier' in p['placement'] else 1,
                           'end' if 'right edge' in p['placement'] else ('start' if 'left edge' in p['placement'] else 'middle'))
               for p in c['point_labels']}

    R, STEP = 15, 32
    LBL_Y, BAND_TOP = 50, 84
    head_y = {'Anthropic': 118, 'OpenAI': 568}
    lane_y = {'Anthropic': 338, 'OpenAI': 788}
    TIER = {1: 96, 2: 162}
    band_x0, band_x1 = X(an['from']) - 22, X(an['to']) + 22
    band_bottom = lane_y['OpenAI'] + 46
    axis_y = lane_y['OpenAI'] + TIER[1] + 70
    H = axis_y + 130
    s = []
    # the cluster band, behind everything
    s.append(f'<rect x="{band_x0:.1f}" y="{BAND_TOP}" width="{band_x1 - band_x0:.1f}" height="{band_bottom - BAND_TOP}" '
             f'fill="{ACC}" fill-opacity=".13"/>')
    s.append(f'<rect x="{band_x0:.1f}" y="{BAND_TOP}" width="{band_x1 - band_x0:.1f}" height="5" fill="{ACC}"/>')
    s.append(text(band_x1, LBL_Y, band_text, 54, 700, ACC, 'end'))
    # month ticks and labels
    s.append(line(0, axis_y, CW, axis_y, cr(.35), 2))
    m = dt.date(start.year, start.month, 1)
    while m <= end:
        x = (m - start).days / span * CW
        s.append(line(x, axis_y, x, axis_y + 14, cr(.5), 2))
        name = m.strftime('%b')
        if name in c['axis']['tick_labels']:
            s.append(text(x, axis_y + 72, name, 54, 500, cr(.75), 'start', 'IBM Plex Mono'))
            yr = c['axis']['year_labels'].get(name)
            if yr:
                check(str(m.year) == yr, 'launches: year label')
                s.append(text(x, axis_y + 124, yr, 42, 400, cr(.55), 'start', 'IBM Plex Mono', fine=True))
        m = dt.date(m.year + (m.month == 12), m.month % 12 + 1, 1)
    for ln in lanes:
        y = lane_y[ln]
        hy = head_y[ln]
        mk, lw = logo_svg('anthropic' if ln == 'Anthropic' else 'openai', 0, hy, 52)
        s.append(mk)
        lab = lab_a if ln == 'Anthropic' else lab_o
        who, count = lab.split(': ', 1)
        s.append(text(lw + 22, hy + 46, who, 60, 700, CREAM))
        s.append(text(0, hy + 116, count[0].upper() + count[1:], 54, 500, cr(.72)))
        s.append(line(0, y, CW, y, cr(.3), 2))
        placed = []
        dots, labels = [], []
        for r in lane_rows[ln]:
            x = X(r['date'])
            level = 0
            while any(abs(x - px) < STEP and pl == level for px, pl in placed):
                level += 1
            placed.append((x, level))
            cy = y - level * STEP
            lab_txt = names.get((ln, r['date']))
            dots.append(circle(x, cy, R, MINT if lab_txt else CREAM, extra=f'data-date="{r["date"]}"'))
            if lab_txt:
                tier, anchor = tier_of[lab_txt]
                ly = y + TIER[tier]
                labels.append(line(x, cy + R + 6, x, ly - 50, MINT, 2))
                labels.append(text(x, ly, lab_txt, 54, 700, MINT, anchor))
        s += labels + dots
    chart = svg(CW, H, s)

    def long_date(d, year=True):
        d = D(d)
        return f'{d.day} {d.strftime("%B")}' + (f' {d.year}' if year else '')
    named = {ln: [p for p in sorted(c['point_labels'], key=lambda p: p['date']) if p['lane'] == ln] for ln in lanes}
    a_named = ', '.join(f'Claude {p["text"]} on {long_date(p["date"], False)}' for p in named['Anthropic'][:-1])
    a_last = named['Anthropic'][-1]
    o_first, o_last = named['OpenAI'][0], named['OpenAI'][-1]
    band_from, band_to = long_date(an['from'], False), long_date(an['to'])
    read_on = e['kicker'].rsplit(' · ', 1)[1].title()      # "15 OCT 2026" -> "15 Oct 2026"
    fig = {
        'alt': (f'Timeline of new model launches by Anthropic and OpenAI, November 2025 to October 2026, one dot per launch '
                f'day, as dated on the companies\' own pages. Anthropic launched {a_names} new Claude models on {a_days} days, '
                f'including {a_named} and Claude {a_last["text"]} on {long_date(a_last["date"])}. OpenAI launched models on at '
                f'least {o_days} days, from {o_first["text"]} on {long_date(o_first["date"])} to {o_last["text"]} on '
                f'{long_date(o_last["date"])}. Between them that is {union_days} launch days, about one every '
                f'{weeks_per:.1f} weeks, and {len(in_band)} launches came in the {band_days} days from {band_from} to '
                f'{band_to}.'),
        'caption': (f'Anthropic and OpenAI launched new models on {union_days} days in under a year, {len(in_band)} of them '
                    f'in {band_days} days from {band_from} to {band_to}. Source: Anthropic and OpenAI release pages, read '
                    f'{read_on}; days counted by us.'),
    }
    return page(e, chart), fig


# ================================================================ Exhibit 2: model or thinking level (hero)

def ex_model(e):
    c = e['chart']
    G = 104                       # gutter for the score ticks
    PW = CW - G
    PH = 500
    LO, HI = 0.05, 10.0
    S0, S1 = 24, 62

    def X(v):
        return G + (math.log10(v) - math.log10(LO)) / (math.log10(HI) - math.log10(LO)) * PW

    def Y(v):
        return (S1 - v) / (S1 - S0) * PH

    all_slugs = [sl for p in c['panels'] for ln in p['lines'] for sl in ln['slugs']]
    for sl in all_slugs:
        check(LO < cpt(sl) < HI and S0 < score(sl) < S1, f'model-or-thinking-level: {sl} outside the axes')
        check(ROWS[sl]['model'] in [ln['model'] for p in c['panels'] for ln in p['lines']], f'{sl}: model')

    # the claims the heading and takeaway rest on, from the rows
    climbs = []
    gaps = []
    for p in c['panels']:
        for ln in p['lines']:
            climbs.append(pts(ln['slugs'][0], ln['slugs'][-1]))
            dr = der_range(ln['model'])
            check(dr['from']['slug'] == ln['slugs'][0] and dr['to']['slug'] == ln['slugs'][-1], f'{ln["model"]}: range ends')
            check(abs(dr['points_gained'] - climbs[-1]) < 1e-9, f'{ln["model"]}: points v derived.json')
        newer, older = p['lines']
        up = der_upgrade(older['model'], newer['model'])
        for b in up['by_level']:
            g = pts(b['from']['slug'], b['to']['slug'])
            check(abs(g - b['points_gained']) < 1e-9, f'upgrade {b["thinking_level"]}: points v derived.json')
            gaps.append(g)
    check((min(climbs), max(climbs)) == (9.7, 19.1), f'model-or-thinking-level: climbs {min(climbs)} to {max(climbs)}')
    check((min(gaps), max(gaps)) == (2.9, 8.0), f'model-or-thinking-level: gaps {min(gaps)} to {max(gaps)}')
    check(max(gaps) < min(climbs), 'model-or-thinking-level: a new version moved more than the thinking level')
    d_callout = {d['what']: d for d in e['data']['derived'] if d['what'].startswith('callout')}
    check(score('claude-opus-5') > score('claude-opus-5-5-low'), 'callout: Opus 5 Max does not beat Opus 5.5 Low')
    check(cpt('gpt-6-sol-non-reasoning') > cpt('gpt-6-sol-low'), 'callout: thinking off does not cost more than Low')
    check(len(d_callout) == 2 and all(d['holds'] for d in d_callout.values()), 'callouts v spec')

    def end_label(x, y, s, colour, where):
        if where == 'left':
            return text(x - 34, y + 19, s, 54, 700, colour, 'end', halo=True)
        if where == 'right':
            return text(x + 36, y + 19, s, 54, 700, colour, 'start', halo=True)
        if where == 'above':
            return text(x, y - 32, s, 54, 700, colour, 'middle', halo=True)
        if where == 'below':
            return text(x, y + 76, s, 54, 700, colour, 'middle', halo=True)
        raise ValueError(where)

    out = []
    out.append(f'<p class="axis-title">Artificial Analysis\'s Intelligence Index, 0 to 100, higher is better</p>')
    check(c['axes_text']['y_title'] in out[-1], 'model-or-thinking-level: y title differs from the spec')
    for i, p in enumerate(c['panels']):
        newer, older = p['lines']
        for ln, want_date in ((newer, newer['label']), (older, older['label'])):
            r0 = ROWS[ln['slugs'][0]]
            d = dt.date.fromisoformat(r0['release_date'])
            check(f'{ln["model"]} · {d.day} {d.strftime("%b %Y")}' == want_date, f'{ln["model"]}: label date')
        key = (f'<div class="key"><span class="k-new"><svg width="64" height="20"><line x1="0" y1="10" x2="64" y2="10" '
               f'stroke="{MINT}" stroke-width="8"/></svg>{esc(newer["label"])}</span>'
               f'<span class="k-old"><svg width="64" height="20"><line x1="0" y1="10" x2="64" y2="10" stroke="{cr(.6)}" '
               f'stroke-width="6" stroke-dasharray="16 10"/></svg>{esc(older["label"])}</span></div>')
        out.append(f'<div class="phead head">{logo_html(p["logo"], 56)}<b>{esc(p["title"])}</b></div>{key}')
        TOP = 56
        s = []
        for g in (30, 40, 50, 60):
            s.append(line(G, Y(g), CW, Y(g), cr(.14), 2))
            s.append(text(G - 26, Y(g) + 19, str(g), 54, 500, cr(.62), 'end', 'IBM Plex Mono'))
        for gx, strong in ((0.1, True), (0.3, False), (1, True), (3, False), (10, True)):
            s.append(line(X(gx), 0, X(gx), PH, cr(.14 if strong else .07), 2))
        pos = {}
        for ln in (older, newer):
            xy = [(X(cpt(sl)), Y(score(sl))) for sl in ln['slugs']]
            pos.update(dict(zip(ln['slugs'], xy)))
            path = ' '.join(f'{"M" if k == 0 else "L"}{x:.1f},{y:.1f}' for k, (x, y) in enumerate(xy))
            if ln['style'] == 'newer_version':
                s.append(f'<path d="{path}" fill="none" stroke="{MINT}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>')
                s += [circle(x, y, 13, MINT) for x, y in xy]
            else:
                s.append(f'<path d="{path}" fill="none" stroke="{cr(.55)}" stroke-width="6" stroke-dasharray="16 12"/>')
                s += [circle(x, y, 10, INK, cr(.75), 5) for x, y in xy]
        # setting names at the ends of each line
        n_lo, n_hi = newer['slugs'][0], newer['slugs'][-1]
        o_lo, o_hi = older['slugs'][0], older['slugs'][-1]
        check(level_name(n_lo) == 'Low' and level_name(n_hi) == 'Max', f'{newer["model"]}: ends are not Low and Max')
        s.append(end_label(*pos[n_lo], level_name(n_lo), MINT, 'left'))
        s.append(end_label(*pos[n_hi], level_name(n_hi), MINT, 'above'))
        if i == 0:
            a, b = pos['claude-opus-5'], pos['claude-opus-5-5-low']
            check(level_name(o_lo) == 'Low', 'Opus 5 starts at Low')
            ox, oy = pos[o_lo]
            s.append(text(ox - 30, oy + 52, level_name(o_lo), 54, 700, cr(.72), 'end', halo=True))
            for (x, y) in (a, b):
                s.append(circle(x, y, 23, 'none', ACC, 5))
            # the callout's words come from the spec, split at "beat"; its names and levels from the rows
            words = c['panels'][0]['callout']['text']
            t1 = f'{short_name(ROWS["claude-opus-5"]["model"])} at {level_name("claude-opus-5")} beat'
            t2 = f'{short_name(ROWS["claude-opus-5-5-low"]["model"])} at {level_name("claude-opus-5-5-low")}'
            check(words == f'{t1} {t2}', 'Opus callout words v spec')
            check(score('claude-opus-5') > score('claude-opus-5-5-low'), 'Opus callout: it did not beat it')
            # two lines in the empty lower right, between the 30 gridline and the plot's foot
            y1, y2 = Y(30) - 8, Y(30) + 58
            w1, w2 = width(t1), width(t2)
            s.append(line(a[0], a[1] + 28, a[0], y1 - 50, ACC, 2.5))
            s.append(f'<path d="M{b[0]:.1f},{b[1] + 28:.1f} V{y2 - 19:.1f} H{CW - w2 - 22:.1f}" fill="none" stroke="{ACC}" stroke-width="2.5"/>')
            s.append(text(CW, y1, t1, 54, 700, ACC, 'end', halo=True))
            s.append(text(CW, y2, t2, 54, 700, ACC, 'end', halo=True))
            check(a[0] > CW - w1 + 20, 'Opus callout: the straight leader misses the first line')
            check(y2 + 16 < PH, 'Opus callout runs below the plot')
        else:
            check(level_name(o_lo) == 'Non-reasoning' and level_name(older['slugs'][1]) == 'Low', 'GPT-6 Sol settings')
            lx, ly = pos[older['slugs'][1]]
            s.append(end_label(lx, ly, 'Low', cr(.72), 'left'))
            s.append(end_label(*pos[o_hi], level_name(o_hi), cr(.72), 'right'))
            a = pos[o_lo]
            s.append(circle(*a, 23, 'none', ACC, 5))
            words = c['panels'][1]['callout']['text']
            check(words == 'Non-reasoning (thinking off) cost more to run than Low', 'GPT callout words v spec')
            check(level_name(o_lo) == 'Non-reasoning' and cpt(o_lo) > cpt(older['slugs'][1]), 'GPT callout claim')
            lines3 = ['Non-reasoning', '(thinking off) cost', 'more to run than Low']
            check(' '.join(lines3) == words, 'GPT callout lines')
            tx = a[0] + 23 + 70
            base = a[1] + 19
            for k, t in enumerate(lines3):
                s.append(text(tx, base - (2 - k) * 64, t, 54, 700, ACC, 'start', halo=True))
            s.append(line(a[0] + 28, a[1], tx - 18, a[1], ACC, 2.5))
            check(tx + max(width(t) for t in lines3) <= CW, 'GPT callout runs past the edge')
        out.append(svg(CW, PH + TOP + 14, s, top=-TOP))
        if i == 0:
            out.append('<div style="height:64px"></div>')
    ticks = ''.join(f'<span style="left:{X(v):.1f}px" class="{cl}">{esc(t)}</span>'
                    for v, t, cl in ((0.1, '$0.10', 'mid'), (1, '$1', 'mid'), (10, '$10', 'end')))
    check([t for t in c['axes_text']['x_ticks']] == ['$0.10', '$1', '$10'], 'x ticks v spec')
    out.append(f'<div class="xt">{ticks}</div><p class="axis-title xtitle">{esc(c["axes_text"]["x_title"])}</p>')
    out.append(f'<p class="fine" data-fine-print style="margin-top:28px">{prose(e["notes"][0]["text"])}</p>')
    css = f'''
.phead {{ margin-top: 40px; }}
.key {{ display: flex; flex-direction: column; gap: 8px; margin: 22px 0 6px; font: 700 54px/1.2 'Archivo'; }}
.key span {{ display: inline-flex; align-items: center; gap: 20px; }}
.key svg {{ flex: none; }}
.k-new {{ color: {MINT}; }} .k-old {{ color: {cr(.75)}; }}
.xt {{ position: relative; height: 72px; margin-top: 18px; font: 500 54px/1 'IBM Plex Mono'; color: {cr(.75)}; }}
.xt span {{ position: absolute; top: 0; white-space: nowrap; }}
.xt .mid {{ transform: translateX(-50%); }} .xt .end {{ transform: translateX(-100%); }}
.xtitle {{ margin-top: 8px; }}
'''
    o55 = [ROWS[s_] for s_ in c['panels'][0]['lines'][0]['slugs']]
    o5 = [ROWS[s_] for s_ in c['panels'][0]['lines'][1]['slugs']]
    g61 = [ROWS[s_] for s_ in c['panels'][1]['lines'][0]['slugs']]
    g6 = [ROWS[s_] for s_ in c['panels'][1]['lines'][1]['slugs']]
    cheaper_o = sum(cpt(n['slug']) < cpt(o['slug']) for n, o in zip(o55, o5))
    cheaper_g = sum(cpt(n['slug']) < cpt(o['slug']) for n, o in zip(g61, g6[1:]))
    check(cheaper_g == 5, 'GPT-6.1 Sol cheaper at every level')
    fig = {
        'alt': (f'Two charts of score on Artificial Analysis\'s Intelligence Index (0 to 100, higher is better) against cost '
                f'per task in US dollars at list prices, log scale. Each line is one model, from its lowest thinking level to '
                f'its highest. Claude Opus 5.5 rises from {f1(o55[0]["score"])} at Low ({usd(o55[0]["cost_per_task_usd"])} a task) '
                f'to {f1(o55[-1]["score"])} at Max ({usd(o55[-1]["cost_per_task_usd"])}); Claude Opus 5, released {gap_words(o5[0], o55[0])} '
                f'earlier, runs from {f1(o5[0]["score"])} at Low ({usd(o5[0]["cost_per_task_usd"])}) to {f1(o5[-1]["score"])} '
                f'at Max ({usd(o5[-1]["cost_per_task_usd"])}) and costs more at {cheaper_o} of its {len(o5)} levels, so Opus 5 at Max '
                f'beat Opus 5.5 at Low. GPT-6 Sol rises from {f1(g6[0]["score"])} with thinking off '
                f'({usd(g6[0]["cost_per_task_usd"])}, more than its Low at {usd(g6[1]["cost_per_task_usd"])}) to '
                f'{f1(g6[-1]["score"])} at Max ({usd(g6[-1]["cost_per_task_usd"])}); GPT-6.1 Sol, {gap_words(g6[0], g61[0])} newer, runs from '
                f'{f1(g61[0]["score"])} at Low ({usd(g61[0]["cost_per_task_usd"])}) to {f1(g61[-1]["score"])} at Max '
                f'({usd(g61[-1]["cost_per_task_usd"])}) and costs less at every level. Turning up the thinking added '
                f'{f1(min(climbs))} to {f1(max(climbs))} points; the newer version added {f1(min(gaps))} to {f1(max(gaps))} '
                f'points at the same level.'),
        'caption': ('Turning up the thinking lifted each model\'s score on Artificial Analysis\'s Intelligence Index (0 to '
                    f'100) more than moving to its newer version did. Source: {src_head(e)}; {COST_IS}.'),
    }
    return page(e, ''.join(out), css), fig


# ================================================================ Exhibit 3: each step buys less

def ex_steps(e):
    c = e['chart']
    GUT, PW, PH, GAP = 92, 508, 260, 32
    PAN = GUT + PW                       # 600 each, two columns and a 32 gap = 1232
    check(2 * PAN + GAP == CW, 'each-step-buys-less: grid does not fill the width')
    XMAX, YMAX = 16, 22

    def X(m):
        return GUT + (m - 1) / (XMAX - 1) * PW

    def Y(p):
        return (YMAX - p) / YMAX * PH

    titles = c['panel_titles']
    cells = []
    ends = []
    fable = None
    for k, pnl in enumerate(c['panels']):
        model = pnl['model']
        rs = [r for r in by_model(model) if r['thinking_level_label'] != 'Non-reasoning']
        check([r['slug'] for r in rs] == [p['slug'] for p in pnl['points']], f'{model}: rows v spec slugs')
        lo = rs[0]['slug']
        check(level_name(lo) == 'Low' and level_name(rs[-1]['slug']) == 'Max', f'{model}: Low to Max')
        pts_xy = [((cpt(r['slug']) / cpt(lo)), score(r['slug']) - score(lo)) for r in rs]
        for (mx, py), sp in zip(pts_xy, pnl['points']):
            check(abs(half_up(mx, 2) - sp['x_times_low_cost']) < 1e-9 and abs(half_up(py, 1) - sp['y_points_added']) < 1e-9,
                  f'{model} {sp["level"]}: point v spec')
            check(1 <= mx <= XMAX and 0 <= py <= YMAX, f'{model}: point outside the axes')
        # the heading's claim: points per extra dollar fall at every step
        per_dollar = [(score(b['slug']) - score(a['slug'])) / (cpt(b['slug']) - cpt(a['slug'])) for a, b in zip(rs, rs[1:])]
        check(all(x > y for x, y in zip(per_dollar, per_dollar[1:])), f'{model}: a step bought more per dollar than the one before')
        gain, mult = pts(lo, rs[-1]['slug']), half_up(cpt(rs[-1]['slug']) / cpt(lo), 1)
        l1, l2 = f'+{f1(gain)} points', f'{f1(mult)} times the cost'
        check((l1, l2) == (pnl['end_label']['line1'], pnl['end_label']['line2']), f'{model}: end label v spec')
        ends.append((model, gain, mult))
        s = []
        for g in (0, 10, 20):
            s.append(line(GUT, Y(g), GUT + PW, Y(g), cr(.3 if g == 0 else .14), 2))
            if k % 2 == 0:
                s.append(text(GUT - 18, Y(g) + 19, str(g), 54, 500, cr(.62), 'end', 'IBM Plex Mono'))
        for gx in (4, 8, 12, 16):
            s.append(line(X(gx), 0, X(gx), PH, cr(.08), 2))
        for an in c.get('annotations', []):
            if an['panel'] == model:
                a, b = rs[-2]['slug'], rs[-1]['slug']
                p_last, more = pts(a, b), round((cpt(b) / cpt(a) - 1) * 100)
                w1, w2 = f'Last step: +{f1(p_last)} points', f'for {more}% more'
                check(f'{w1} {w2}' == an['text'], f'{model}: annotation {w1} {w2!r} v spec')
                check(f'costs {more}% more' in ARTICLE, 'Fable: the article\'s figure is not the same')
                check(width(w1) <= PAN, 'Fable annotation is wider than its panel')
                fable = (model, p_last, more)
                s.append(text(GUT + PW, Y(20) + 50, w1, 54, 700, ACC, 'end', halo=True))
                s.append(text(GUT + PW, Y(20) + 116, w2, 54, 700, ACC, 'end', halo=True))
        xy = [(X(mx), Y(py)) for mx, py in pts_xy]
        for j in range(len(xy) - 1):
            last = j == len(xy) - 2
            s.append(line(*xy[j], *xy[j + 1], ACC if last else MINT, 7, 'stroke-linecap="round"'))
        for j, (x, y) in enumerate(xy):
            s.append(circle(x, y, 10, ACC if j == len(xy) - 1 else MINT))
        title = titles.get(pnl['title'], pnl['title'])
        check(width(title) + 70 <= PAN, f'{model}: title wider than its panel')
        cells.append(f'<div class="cell"><div class="ct head">{logo_html(pnl["logo"], 44)}<b>{esc(title)}</b></div>'
                     f'<p class="stat"><span class="big">+{f1(gain)}</span> points</p>'
                     f'<p class="mult">for {f1(mult)} times the cost</p>'
                     f'{svg(PAN, PH + 12, s, top=-6)}</div>')
    # Claude Opus 5 (deprecated, not drawn): the source block says it shows the same pattern; check it does
    rs5 = by_model('Claude Opus 5')
    pd5 = [(score(b['slug']) - score(a['slug'])) / (cpt(b['slug']) - cpt(a['slug'])) for a, b in zip(rs5, rs5[1:])]
    check(all(x > y for x, y in zip(pd5, pd5[1:])), 'Claude Opus 5 does not show the same pattern')
    xt = ''.join(f'<span style="left:{X(v):.1f}px" class="{"end" if v == XMAX else "mid"}">{v}</span>' for v in (1, 4, 8, 12, 16))
    axis = (f'<div class="xrow"><div class="xt">{xt}</div><div class="xt">{xt}</div></div>'
            f'<p class="axis-title xtitle">{esc(c["axes_text"]["x_title"])}</p>')
    notes = [n['text'] for n in e['notes'] if 'source block' not in n['placement']]
    check(notes[1].startswith('Starts at Low'), 'GPT-6 Sol note')
    g6 = by_model('GPT-6 Sol')
    check(level_name(g6[0]['slug']) == 'Non-reasoning' and cpt(g6[0]['slug']) > cpt(g6[1]['slug']), 'GPT-6 Sol note claim')
    foot = (f'<div class="foot" data-fine-print><p class="fine">{prose(notes[0])}</p>'
            f'<p class="fine">{prose("GPT-6 Sol " + notes[1][0].lower() + notes[1][1:])}</p></div>')
    ytitle = 'Points added on Artificial Analysis\'s Intelligence Index (0 to 100), from each model\'s Low setting'
    css = f'''
.ytitle {{ margin-bottom: 44px; }}
.grid {{ display: grid; grid-template-columns: {PAN}px {PAN}px; column-gap: {GAP}px; row-gap: 64px; }}
.ct {{ gap: 16px; }} .ct b {{ font-size: 54px; white-space: nowrap; }}
.stat {{ margin-top: 14px; font: 700 54px/1 'Archivo'; color: {CREAM}; }}
.stat .big {{ font: 400 76px/1 'Anton'; color: {MINT}; }}
.mult {{ margin: 8px 0 26px; font: 500 54px/1.2 'Archivo'; color: {cr(.75)}; white-space: nowrap; }}
.xrow {{ display: grid; grid-template-columns: {PAN}px {PAN}px; column-gap: {GAP}px; margin-top: 14px; }}
.xt {{ position: relative; height: 66px; font: 500 54px/1 'IBM Plex Mono'; color: {cr(.75)}; }}
.xt span {{ position: absolute; top: 0; }} .xt .mid {{ transform: translateX(-50%); }} .xt .end {{ transform: translateX(-100%); }}
.xtitle {{ margin-top: 8px; }}
.foot {{ margin-top: 36px; }} .foot p + p {{ margin-top: 12px; }}
'''
    body = f'<p class="axis-title ytitle">{esc(ytitle)}</p><div class="grid">{"".join(cells)}</div>{axis}{foot}'
    o = by_model('Claude Opus 5.5')
    first_pts, first_x = pts(o[0]['slug'], o[1]['slug']), half_up(cpt(o[1]['slug']) / cpt(o[0]['slug']), 1)
    last_pts, last_x = pts(o[-2]['slug'], o[-1]['slug']), half_up(cpt(o[-1]['slug']) / cpt(o[-2]['slug']), 1)
    parts = '; '.join(f'{m} added {f1(g)} points for {f1(x)} times the cost' for m, g, x in ends)
    fig = {
        'alt': (f'Six small line charts, one per model, of points added on Artificial Analysis\'s Intelligence Index '
                f'(0 to 100) against cost per task as a multiple of the model\'s own Low setting, as the thinking level rises '
                f'through Low, Medium, High, Xhigh (extra high) and Max. Every line climbs steeply at first and flattens: each '
                f'step up added fewer points per extra dollar than the one before. Claude Opus 5.5\'s first step added '
                f'{f1(first_pts)} points for {f1(first_x)} times the cost, its last {f1(last_pts)} points for {f1(last_x)} '
                f'times. From Low to Max, {parts}. {fable[0]}\'s last step added {f1(fable[1])} points for {fable[2]}% more.'),
        'caption': ('Each step up in thinking level bought fewer points on Artificial Analysis\'s Intelligence Index (0 to '
                    f'100) per extra dollar, for all six models. Source: {src_head(e)}; {COST_IS}.'),
    }
    return page(e, body, css), fig


# ================================================================ Exhibit 4: new version or more thinking

def ex_versus(e):
    c = e['chart']
    tiles = c['tiles']
    TW, TP, BAR = 600, 40, 520
    PPX = BAR / 20                                  # one shared scale: 0 to 20 points
    # recompute every tile's numbers from the rows; the tile draws these, after checking them against the spec
    drawn = []
    for t in tiles:
        sl = t['slugs']
        if t['bar']['kind'] == 'solid':
            g, m = pts(sl[0], sl[1]), half_up(cpt(sl[1]) / cpt(sl[0]), 1)
            big, cost = f'+{f1(g)}', f'{f1(m)} times the cost per task'
            check(t['big_number'] == big and t['bar']['to'] == g, f'{t["model"]}: big number')
            check(t['cost'] == cost, f'{t["model"]}: cost line')
            check(m > 1 and t['cost_colour'] == 'accent', f'{t["model"]}: cost colour')
            under = f'points, {short_name(ROWS[sl[0]]["model"])} from {level_name(sl[0])} to {level_name(sl[1])}'
            drawn.append({'big': big, 'under': under, 'cost': cost, 'bar': {'kind': 'solid', 'to': g},
                          'cost_more': m > 1})
        else:
            n = len(sl) // 2
            old, new = sl[:n], sl[n:]
            gains = [pts(a, b) for a, b in zip(old, new)]
            mults = [times(a, b) for a, b in zip(old, new)]
            check(t['bar']['dots_at'] == gains, f'{t["model"]}: dots v rows')
            big = f'+{f1(min(gains))} to +{f1(max(gains))}'
            check(t['big_number'] == big, f'{t["model"]}: range')
            cheaper = sum(m_ < 1 for m_ in mults)
            tail = 'cheaper at every level' if cheaper == len(mults) else f'cheaper at {cheaper} of {len(mults)} levels'
            cost = f'{min(mults):.2f} to {max(mults):.2f} times the cost: {tail}'
            check(t['cost'] == cost, f'{t["model"]}: cost line {t["cost"]!r}')
            check([level_name(s_) for s_ in old] == [level_name(s_) for s_ in new], f'{t["model"]}: matched levels')
            under = (f'points, {short_name(ROWS[old[0]]["model"])} to {short_name(ROWS[new[0]]["model"])} '
                     f'at each level')
            drawn.append({'big': big, 'under': under, 'cost': cost,
                          'bar': {'kind': 'range', 'lo': min(gains), 'hi': max(gains), 'marks': gains},
                          'cost_more': cheaper < len(mults) / 2})
        check(drawn[-1]['under'] == t['under'], f'{t["model"]}: words under the number {drawn[-1]["under"]!r} v spec')
    ver = [t for t in tiles if t['bar']['kind'] == 'range']
    cheaper_all = sum(times(a, b) < 1 for t in ver for a, b in zip(t['slugs'][:5], t['slugs'][5:]))
    check(cheaper_all == 9, f'versions cheaper at {cheaper_all} of 10 levels')

    def bar(d):
        b = d['bar']
        s = [f'<rect x="0" y="4" width="{BAR}" height="52" rx="6" fill="{cr(.1)}"/>']
        if b['kind'] == 'solid':
            s.append(f'<rect x="0" y="4" width="{b["to"] * PPX:.1f}" height="52" rx="6" fill="{MINT}"/>')
        else:
            x0, x1 = b['lo'] * PPX, b['hi'] * PPX
            # solid to the smallest gain, a lighter band to the largest, a thin mark at each level's gain
            s.append(f'<rect x="0" y="4" width="{x1:.1f}" height="52" rx="6" fill="{cr(.32)}"/>')
            s.append(f'<rect x="0" y="4" width="{x0:.1f}" height="52" rx="6" fill="{CREAM}"/>')
            for v in sorted(b['marks']):
                if v > b['lo']:
                    s.append(f'<rect x="{v * PPX - 2:.1f}" y="4" width="4" height="52" fill="{CREAM}"/>')
        s.append(line(10 * PPX, -8, 10 * PPX, 2, cr(.5), 2))
        s.append(line(10 * PPX, 58, 10 * PPX, 68, cr(.5), 2))
        return svg(BAR, 60, s, cls='bar')

    heads = (f'<div class="colheads"><div><b style="color:{MINT}">More thinking</b><span>same model</span></div>'
             f'<div><b>A new version</b><span>same thinking level</span></div></div>')
    rows_html = []
    for fam in dict.fromkeys(t['row'] for t in tiles):
        ts = [t for t in tiles if t['row'] == fam]
        company, line_name = fam.split(' · ')
        key = 'anthropic' if company == 'Anthropic' else 'openai'
        cells = []
        for t in ts:
            d = drawn[tiles.index(t)]
            big_col = MINT if t['big_colour'] == 'mint' else CREAM
            cost_col = ACC if d['cost_more'] else MINT
            check((cost_col == ACC) == (t['cost_colour'] == 'accent'), f'{t["model"]}: cost colour v spec')
            cells.append(f'<div class="tile"><div class="big" style="color:{big_col}">{esc(d["big"])}</div>'
                         f'<p class="under">{prose(d["under"])}</p>{bar(d)}<p class="cost" style="color:{cost_col}">{esc(d["cost"])}</p></div>')
        rows_html.append(f'<div class="rhead head">{logo_html(key, 56)}<b>{esc(line_name)}</b></div><div class="trow">{"".join(cells)}</div>')
    scale = ''.join(f'<span style="left:{TP + v * PPX:.1f}px" class="{"start" if v == 0 else "mid"}">{v}</span>' for v in (0, 10, 20))
    axis = (f'<div class="scale"><div class="bt">{scale}</div><div class="bt">{scale}</div></div>'
            f'<p class="axis-title scale-title">Points added on Artificial Analysis\'s Intelligence Index (0 to 100). On a '
            f'new version\'s bar, each mark is one thinking level.</p>')
    note = [n['text'] for n in e['notes'] if 'source block' not in n['placement']][0]
    g6 = der_range('GPT-6 Sol')
    check(note.startswith(f'GPT-6 Sol, from thinking off (Non-reasoning) to Max: +{f1(g6["points_gained"])} points for '
                          f'{f1(half_up(g6["cost_multiple_per_task"], 1))} times the cost.'), 'GPT-6 Sol note v derived.json')
    css = f'''
.colheads {{ display: grid; grid-template-columns: {TW}px {TW}px; column-gap: 32px; font: 700 54px/1.15 'Archivo'; }}
.colheads div {{ padding-left: {TP}px; }}
.colheads b {{ display: block; }} .colheads span {{ display: block; font-weight: 500; color: {cr(.7)}; }}
.rhead {{ margin: 56px 0 24px; }}
.trow {{ display: grid; grid-template-columns: {TW}px {TW}px; grid-template-rows: auto auto auto auto; column-gap: 32px; }}
.tile {{ background: {SOFT}; border-radius: 14px; padding: 40px {TP}px 44px; display: grid; grid-row: span 4; grid-template-rows: subgrid; row-gap: 0; }}
.big {{ font: 400 104px/1 'Anton'; }}
.under {{ font: 500 54px/1.22 'Archivo'; color: {cr(.82)}; margin-top: 20px; }}
.bar {{ margin-top: 30px; align-self: end; }}
.cost {{ font: 700 54px/1.22 'Archivo'; margin-top: 26px; }}
.scale {{ display: grid; grid-template-columns: {TW}px {TW}px; column-gap: 32px; margin-top: 18px; }}
.bt {{ position: relative; height: 64px; font: 500 54px/1 'IBM Plex Mono'; color: {cr(.75)}; }}
.bt span {{ position: absolute; top: 0; white-space: nowrap; }} .bt .mid {{ transform: translateX(-50%); }}
.bt .start {{ transform: translateX(-50%); }}
.scale-title {{ margin-top: 10px; }}
.note4 {{ margin-top: 30px; }}
'''
    body = heads + ''.join(rows_html) + axis + f'<p class="fine note4" data-fine-print>{prose(note)}</p>'
    d_op, d_ov, d_gp, d_gv = drawn
    t_op, t_ov, t_gp, t_gv = tiles
    fig = {
        'alt': (f'Four tiles comparing two ways to get a higher score on Artificial Analysis\'s Intelligence Index (0 to 100), '
                f'with cost per task in US dollars at list prices. More thinking: {t_op["model"]} from Low to Max adds '
                f'{d_op["big"][1:]} points for {d_op["cost"].replace(" per task", "")}; {t_gp["model"]} from Low to Max adds '
                f'{d_gp["big"][1:]} points for {d_gp["cost"].replace(" per task", "")}. A new version at the same thinking '
                f'level: {t_ov["model"]} adds {d_ov["big"].replace("+", "")} points at {d_ov["cost"]}; {t_gv["model"]} adds '
                f'{d_gv["big"].replace("+", "")} points at {d_gv["cost"]}. GPT-6 Sol from thinking off to Max added '
                f'{f1(g6["points_gained"])} points for {f1(half_up(g6["cost_multiple_per_task"], 1))} times the cost.'),
        'caption': ('More thinking added more points on Artificial Analysis\'s Intelligence Index (0 to 100) than a newer '
                    f'version did, but the newer version usually cost less to run. Source: {src_head(e)}; {COST_IS}.'),
    }
    return page(e, body, css), fig


# ================================================================ Exhibit 5: cheapest route to each score

def ex_cheapest(e):
    c = e['chart']
    LC = 210                                   # target column
    SC = 150                                   # score column, right
    TRACK, MAXC = 660, 6.0
    BARW = CW - LC - SC                        # the bar's svg: track plus room for the dollar figure
    PPD = TRACK / MAXC
    current = [r for r in DATA['rows'] if not r['aa_marks_deprecated'] and r.get('cost_per_task_usd') is not None]
    top = max(r['score'] for r in current)

    def cheapest(target):
        ok = [r for r in current if r['score'] >= target - 1e-9]
        return sorted(ok, key=lambda r: r['cost_per_task_usd'])

    for r in c['rows']:
        ranked = cheapest(r['target'])
        check(ranked[0]['slug'] == r['cheapest'], f'cheapest for {r["label"]}: {ranked[0]["slug"]} v spec {r["cheapest"]}')
        if r.get('runner_up'):
            check(ranked[1]['slug'] == r['runner_up'], f'runner-up for {r["label"]}')
    check(c['rows'][-1]['target'] == top, 'top score')
    # the jump: 50+ to 55+
    r50 = [r for r in c['rows'] if r['target'] == 50][0]
    r55 = [r for r in c['rows'] if r['target'] == 55][0]
    jump_x = cpt(r55['cheapest']) / cpt(r50['cheapest'])
    jump_p = pts(r50['cheapest'], r55['cheapest'])
    jump = f'{round(jump_x)} times the cost for {f1(jump_p)} more points'
    check(f'"{jump}"' in c['encoding']['jump'], f'jump {jump!r} v spec')

    def logo_for(slug):
        return {'Anthropic': 'anthropic', 'OpenAI': 'openai', 'Google': 'google'}[ROWS[slug]['creator']]

    def entry(slug, colour, outline=False, star=False, first=False):
        r = ROWS[slug]
        name = f'{r["model"]} at {r["thinking_level_label"]}' + (' *' if star else '')
        lk = logo_for(slug)
        cost = r['cost_per_task_usd']
        w = max(cost * PPD, 6)
        s = []
        for v in (2, 4, 6):
            s.append(line(v * PPD, -6, v * PPD, 70, cr(.1), 2))
        if outline:
            s.append(f'<rect x="1.5" y="9.5" width="{w - 3:.1f}" height="45" rx="4" fill="none" stroke="{CREAM}" stroke-width="3"/>')
        else:
            s.append(f'<rect x="0" y="8" width="{w:.1f}" height="48" rx="4" fill="{colour}"/>')
        label = usd(cost)
        check(w + 20 + width(label, 64, 400, 'Anton') <= BARW, f'{slug}: the dollar figure runs into the score column')
        s.append(text(w + 20, 55, label, 64, 400, ACC if colour == ACC else CREAM, 'start', 'Anton', halo=True))
        check(width(name) + 46 * 1.4 + 18 <= CW - LC, f'{slug}: the name is wider than its column')
        return (f'<div class="entry{" first" if first else ""}"><div class="l1">{logo_html(lk, 46 if lk != "google" else 44, "lg " + lk)}'
                f'<b>{esc(name)}</b></div><div class="l2">{svg(BARW, 64, s, cls="cbar")}<em>{f1(r["score"])}</em></div></div>')

    out = [f'<div class="heads"><span>Score<br>needed</span><span>Cheapest model and thinking level</span>'
           f'<span class="r">Its<br>score</span></div>']
    for k, r in enumerate(c['rows']):
        tgt = 'Top' if r['label'] == 'The top score' else r['label'].replace(' or more', '+')
        check(r['label'] == 'The top score' or float(tgt[:-1]) == r['target'], 'target label')
        colour = ACC if cpt(r['cheapest']) >= 1 else cr(.8)
        star = 'haiku' in r['cheapest']
        check(usd(cpt(r['cheapest'])) == r['cost_shown'], f'{r["label"]}: cost shown')
        inner = entry(r['cheapest'], colour, star=star, first=True)
        if k == 0:
            t = c['tie_second_line']
            check(t['slug'] == r['runner_up'] and usd(cpt(t['slug'])) == t['cost_shown'], 'tie row')
            inner += entry(t['slug'], cr(.8))
            inner += f'<p class="fine tie" data-fine-print>{prose(e["notes"][0]["text"])}</p>'
        out.append(f'<div class="row"><div class="tgt">{esc(tgt)}</div><div class="rest">{inner}</div></div>')
        if r['target'] == 50:
            out.append(f'<div class="jump"><span>{esc(jump)}</span></div>')
    ticks = ''.join(f'<span style="left:{LC + v * PPD:.1f}px" class="{"start" if v == 0 else "mid"}">${v}</span>' for v in (0, 2, 4, 6))
    check(c['axes_text']['x_ticks'] == ['$0', '$2', '$4', '$6'], 'x ticks v spec')
    out.append(f'<div class="xt">{ticks}</div><p class="axis-title xtitle">Cost per task, US dollars</p>')
    out.append('<p class="band">For comparison</p>')
    for rf in c['reference_rows']:
        rr = ROWS[rf['slug']]
        check(usd(cpt(rf['slug'])) == rf['cost_shown'] and f1(score(rf['slug'])) == f1(rf['score']), f'{rf["slug"]}: ref row')
        tag = 'Default' if 'default' in rf['label'] else rr['creator']
        out.append(f'<div class="row ref"><div class="tgt small">{esc(tag)}</div><div class="rest">'
                   f'{entry(rf["slug"], CREAM, outline=True, star="haiku" in rf["slug"], first=True)}</div></div>')
    out.append(f'<div class="foot" data-fine-print><p class="fine">{prose(e["notes"][1]["text"])}</p>'
               f'<p class="fine">Xhigh is extra high, one step below Max.</p></div>')
    css = f'''
.heads {{ display: grid; grid-template-columns: {LC}px 1fr auto; align-items: end; font: 500 54px/1.15 'Archivo'; color: {cr(.7)}; padding-bottom: 22px; }}
.heads .r {{ text-align: right; }}
.row {{ display: grid; grid-template-columns: {LC}px 1fr; padding: 34px 0 30px; border-top: 2px solid {cr(.14)}; }}
.tgt {{ font: 400 80px/1 'Anton'; padding-top: 2px; }}
.tgt.small {{ font: 700 54px/1.2 'Archivo'; color: {cr(.75)}; padding-top: 4px; }}
.entry + .entry {{ margin-top: 30px; }}
.l1 {{ display: flex; align-items: center; gap: 18px; font: 700 54px/1.15 'Archivo'; }}
.l1 b {{ white-space: nowrap; }}
.l2 {{ display: flex; align-items: center; margin-top: 14px; }}
.l2 em {{ width: {SC}px; text-align: right; font: 500 54px/1 'IBM Plex Mono'; font-style: normal; color: {cr(.85)}; }}
.lg {{ flex: none; }}
.cbar {{ flex: none; }}
.tie {{ margin-top: 22px; }}
.jump {{ margin: 0 0 30px {LC}px; border-left: 6px solid {ACC}; padding: 14px 0 14px 26px; font: 700 54px/1.2 'Archivo'; color: {ACC}; }}
.xt {{ position: relative; height: 70px; margin-top: 6px; padding-top: 18px; border-top: 2px solid {cr(.14)}; font: 500 54px/1 'IBM Plex Mono'; color: {cr(.75)}; }}
.xt span {{ position: absolute; top: 18px; white-space: nowrap; }} .xt .mid {{ transform: translateX(-50%); }}
.xtitle {{ padding-left: {LC}px; margin-top: 18px; }}
.band {{ margin-top: 64px; padding-top: 30px; border-top: 2px solid {cr(.4)}; font: 700 54px/1.2 'Archivo'; color: {cr(.75)}; }}
.row.ref {{ border-top: none; padding-top: 28px; }}
.row.ref + .row.ref {{ border-top: 2px solid {cr(.14)}; }}
.foot {{ margin-top: 26px; }} .foot p + p {{ margin-top: 12px; }}
'''
    rws = c['rows']
    tie = c['tie_second_line']
    refs = c['reference_rows']

    cheap_rows = [r for r in rws if cpt(r['cheapest']) < 1]
    dear_rows = [r for r in rws if cpt(r['cheapest']) >= 1]
    check(max(r['target'] for r in cheap_rows) < min(r['target'] for r in dear_rows), 'cents rows are not all below dollar rows')
    cents_top = max(r['target'] for r in cheap_rows)
    dollars_from = min(r['target'] for r in dear_rows)
    min_c = min(cpt(r['cheapest']) for r in cheap_rows)
    max_c = max(cpt(r['cheapest']) for r in cheap_rows)
    check(dollars_from == r55['target'], 'the first dollar row is the 55 row')

    def cents(v):
        return f'{half_up(v * 100, 0):.0f} cents'

    def desc_short(slug):
        r = ROWS[slug]
        return f'{r["model"]} at {r["thinking_level_label"]}'

    def desc(slug):
        r = ROWS[slug]
        return f'{r["model"]} at {r["thinking_level_label"]}, scoring {f1(r["score"])} for {usd(r["cost_per_task_usd"])} a task'
    fig = {
        'alt': (f'Price ladder: for each score on Artificial Analysis\'s Intelligence Index (0 to 100), the current model and '
                f'thinking level that reaches it at the lowest cost per task, in US dollars at list prices. 40 or more: '
                f'{desc(rws[0]["cheapest"])}, or {desc(tie["slug"])} (Haiku\'s costs are understated). 45 or more: '
                f'{desc(rws[1]["cheapest"])}. 50 or more: {desc(rws[2]["cheapest"])}. 55 or more: {desc(rws[3]["cheapest"])}, '
                f'{jump}. The top score: {desc(rws[4]["cheapest"])}. For comparison, Anthropic\'s defaults: '
                f'{desc(refs[0]["slug"])} and {desc(refs[1]["slug"])}; and Google\'s best here, {desc(refs[2]["slug"])}.'),
        'caption': (f'The cheapest way to {cents_top:g} or more on Artificial Analysis\'s Intelligence Index (0 to 100) cost '
                    f'{cents(min_c).split()[0]} to {cents(max_c)} a task; {dollars_from:g} or more took {desc_short(r55["cheapest"])} at '
                    f'{usd(cpt(r55["cheapest"]))}. Source: {src_head(e)}; {COST_IS}; defaults from Anthropic\'s developer '
                    f'guide, read 15 Oct 2026.'),
    }
    return page(e, ''.join(out), css), fig


MAKERS = {'launches': ex_launches, 'model-or-thinking-level': ex_model, 'each-step-buys-less': ex_steps,
          'new-version-or-more-thinking': ex_versus, 'cheapest-route-to-each-score': ex_cheapest}

BANNED = ['—', '–', 'low gear', 'gear', 'badge', '×']


def main():
    check(COST_IS == check_cost, f'cost wording v spec: {check_cost!r}')
    figures = {}
    try:
        for e in sorted(EX['exhibits'], key=lambda x: x['order']):
            check(ARTICLE.count(e['after']) == 1, f'{e["id"]}: "after" is not found exactly once in the article')
            doc, fig = MAKERS[e['id']](e)
            visible = html.unescape(doc.split('<div id="card">', 1)[1])
            for b in BANNED:
                check(b not in visible.lower() if b.isalpha() or ' ' in b else b not in visible, f'{e["id"]}: {b!r} on the exhibit')
            for k in ('alt', 'caption'):
                if 'Xhigh' in fig[k] and 'Xhigh (extra high)' not in fig[k]:
                    fig[k] = fig[k].replace('Xhigh', 'Xhigh (extra high)', 1)
            for b in BANNED[:2] + ['×']:
                check(b not in fig['alt'] + fig['caption'], f'{e["id"]}: {b!r} in alt or caption')
            path = OUT / f'{e["id"]}.html'
            path.write_text(doc, encoding='utf-8')
            figures[e['id']] = {'order': e['order'], 'html': str(path), 'after': e['after'], **fig}
            print('wrote', path)
    finally:
        METER.close()
    (OUT / 'figures.json').write_text(json.dumps(figures, indent=1, ensure_ascii=False), encoding='utf-8')
    if PROBLEMS:
        print('PROBLEMS:')
        for p in PROBLEMS:
            print('  -', p)
        sys.exit(1)
    print('all data checks passed')


if __name__ == '__main__':
    main()
