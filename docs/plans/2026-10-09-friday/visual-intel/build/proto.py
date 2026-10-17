"""Feasibility proofs for the five exhibits in visual-intel/exhibits.json: one HTML file each, drawn from that file's
rows and words with the house faces and the real logos, so the spec can be checked with scripts/pages/card.py
(phone floor, nothing cut off) and looked at. Not final art.

Run: python3 -I /home/user/content-engine/.cache/visual-intel/scripts/proto.py
Writes only into /home/user/content-engine/.cache/visual-intel/design/.
"""
import base64
import html
import json
import math
import sys
from pathlib import Path

ROOT = Path('/home/user/content-engine')
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand  # noqa: E402

EX = json.loads((ROOT / 'docs/plans/2026-10-09-friday/visual-intel/exhibits.json').read_text(encoding='utf-8'))
DATA = json.loads((ROOT / 'docs/plans/2026-10-09-friday/visual-intel/data-final.json').read_text(encoding='utf-8'))
ROWS = {r['slug']: r for r in DATA['rows']}
OUT = ROOT / '.cache/visual-intel/design'
OUT.mkdir(parents=True, exist_ok=True)
D = EX['design_system']
INK, SOFT, CREAM, MINT, ACC = D['colours']['ink'], D['colours']['ink_soft'], D['colours']['cream'], D['colours']['mint'], D['colours']['mind_the_gap_accent']
W, PAD = 1360, 64
CW = W - 2 * PAD
FONTS = brand.font_css()


def esc(s):
    return html.escape(str(s), quote=True)


def logo_uri(key):
    p = ROOT / D['logos'][key]['file']
    return 'data:image/svg+xml;base64,' + base64.b64encode(p.read_bytes()).decode()


def page(e, body, extra_css=''):
    notes = ''.join(f'<p class="note">{esc(n["text"])}</p>' for n in e.get('notes', []) if 'source block' in n['placement'])
    src = f'<div class="source" data-fine-print>' + (f'<img class="aa" src="{logo_uri("aa")}" alt="Artificial Analysis">' if 'aa' in e['logos'] else '') + \
          f'<p>{esc(e["source_line"])}</p>{notes}<p class="brandline">mind.the.gap · makeyourmindup</p></div>'
    return f'''<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>{esc(e["heading"])}</title><style>
{FONTS}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ background: {INK}; }}
#card {{ width: {W}px; padding: {PAD}px {PAD}px 56px; background: {INK}; color: {CREAM}; font-family: 'Archivo', sans-serif; -webkit-font-smoothing: antialiased; }}
.kicker {{ font: 500 42px/1.2 'IBM Plex Mono', monospace; letter-spacing: .03em; color: {ACC}; white-space: nowrap; }}
h1 {{ font: 400 92px/1.04 'Anton', sans-serif; margin-top: 22px; letter-spacing: .005em; }}
.stand {{ font: 500 54px/1.25 'Archivo', sans-serif; color: rgba(244,239,228,.82); margin-top: 26px; }}
.chart {{ margin-top: 48px; }}
.source {{ margin-top: 44px; padding-top: 30px; border-top: 2px solid rgba(244,239,228,.2); font: 400 42px/1.3 'IBM Plex Mono', monospace; color: rgba(244,239,228,.7); }}
.source .aa {{ height: 44px; display: block; margin-bottom: 22px; }}
.source p + p {{ margin-top: 10px; }}
.brandline {{ color: {ACC}; opacity: .85; }}
.fine {{ font: 400 42px/1.3 'IBM Plex Mono', monospace; color: rgba(244,239,228,.7); }}
svg text {{ font-family: 'Archivo', sans-serif; }}
{extra_css}
</style></head><body><div id="card">
<div class="kicker" data-fine-print>{esc(e["kicker"])}</div>
<h1>{esc(e["heading"])}</h1>
<p class="stand">{esc(e["standfirst"])}</p>
<div class="chart">{body}</div>
{src}
</div></body></html>'''


def text(x, y, s, size=54, weight=700, fill=CREAM, anchor='start', family="'Archivo'", extra=''):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" style="font-family:{family}" {extra}>{esc(s)}</text>'


# ------------------------------------------------------------------ exhibit 1

def e1(e):
    import datetime as dt
    c = e['chart']
    start, end = dt.date(2025, 11, 1), dt.date(2026, 10, 15)
    span = (end - start).days

    def X(d):
        return (dt.date.fromisoformat(d) - start).days / span * CW
    rows = e['data']['rows']
    labels = {(p['lane'], p['date']): p['text'] for p in c['point_labels']}
    tiers = {'Opus 4.8': (1, 'end'), 'Opus 5': (1, 'middle'), 'Opus 5.5': (2, 'end'), 'GPT-5.1': (1, 'start'), 'GPT-6.1 Sol': (1, 'end')}
    H = 950
    lane_y = {'Anthropic': 250, 'OpenAI': 640}
    s = [f'<svg width="{CW}" height="{H}" viewBox="0 0 {CW} {H}" style="display:block">']
    bx0, bx1 = X('2026-09-22') - 20, X('2026-10-07') + 20
    s.append(f'<rect x="{bx0:.1f}" y="80" width="{bx1 - bx0:.1f}" height="{lane_y["OpenAI"] + 40 - 80}" rx="10" fill="{ACC}" fill-opacity=".16"/>')
    s.append(f'<line x1="{bx0:.1f}" y1="80" x2="{bx1:.1f}" y2="80" stroke="{ACC}" stroke-width="5"/>')
    s.append(text(bx1, 56, c['annotations'][0]['text'], 54, 700, ACC, 'end'))
    axis_y = lane_y['OpenAI'] + 170
    for m in range(12):
        y0, mo = (2025, 11 + m) if 11 + m <= 12 else (2026, 11 + m - 12)
        d = dt.date(y0, mo, 1)
        x = (d - start).days / span * CW
        s.append(f'<line x1="{x:.1f}" y1="{axis_y}" x2="{x:.1f}" y2="{axis_y + 16}" stroke="{CREAM}" stroke-opacity=".5" stroke-width="2"/>')
        name = d.strftime('%b')
        if name in c['axis']['tick_labels']:
            s.append(text(x, axis_y + 72, name, 54, 500, 'rgba(244,239,228,.75)', 'start', "'IBM Plex Mono'"))
            yl = c['axis']['year_labels'].get(name)
            if yl:
                s.append(text(x, axis_y + 124, yl, 42, 400, 'rgba(244,239,228,.55)', 'start', "'IBM Plex Mono'", 'data-fine-print'))
    s.append(f'<line x1="0" y1="{axis_y}" x2="{CW}" y2="{axis_y}" stroke="{CREAM}" stroke-opacity=".3" stroke-width="2"/>')
    for lane, y in lane_y.items():
        s.append(f'<line x1="0" y1="{y}" x2="{CW}" y2="{y}" stroke="{CREAM}" stroke-opacity=".3" stroke-width="2"/>')
        s.append(f'<image href="{logo_uri("anthropic" if lane == "Anthropic" else "openai")}" x="0" y="{y - 146}" height="50" width="70" preserveAspectRatio="xMinYMid meet"/>')
        s.append(text(84, y - 102, c['lane_labels'][lane], 54, 700, CREAM))
        placed = []
        for r in sorted([r for r in rows if r['lane'] == lane], key=lambda r: r['date']):
            x = X(r['date'])
            level = 0
            while any(abs(x - px) < 32 and pl == level for px, pl in placed):
                level += 1
            placed.append((x, level))
            cy = y - level * 32
            lab = labels.get((lane, r['date']))
            col = MINT if lab else CREAM
            s.append(f'<circle cx="{x:.1f}" cy="{cy}" r="15" fill="{col}"/>')
            if lab:
                tier, anchor = tiers[lab]
                ly = y + 30 + tier * 66
                s.append(f'<line x1="{x:.1f}" y1="{y + 18}" x2="{x:.1f}" y2="{ly - 46}" stroke="{MINT}" stroke-width="2"/>')
                s.append(text(x + (14 if anchor == 'start' else (-14 if anchor == 'end' else 0)) * 0, ly, lab, 54, 700, MINT, anchor))
    s.append('</svg>')
    notes = ''.join(f'<p class="fine" data-fine-print style="margin-top:14px">{esc(n["text"])}</p>' for n in e.get('notes', []) if 'source block' not in n['placement'])
    return page(e, '\n'.join(s) + notes)


# ------------------------------------------------------------------ exhibit 2

def e2(e):
    c = e['chart']
    X0, X1 = math.log10(0.05), math.log10(10)
    Y0, Y1, PH = 24, 62, 470

    def X(v):
        return (math.log10(v) - X0) / (X1 - X0) * CW

    def Y(v):
        return (Y1 - v) / (Y1 - Y0) * PH
    out = []
    for i, pnl in enumerate(c['panels']):
        newer, older = pnl['lines']
        key = (f'<div class="key"><span><i class="sw solid"></i>{esc(newer["label"])}</span><span><i class="sw dash"></i>{esc(older["label"])}</span></div>')
        out.append(f'<div class="phead"><img src="{logo_uri(pnl["logo"])}" alt="{esc(pnl["company"])}"><b>{esc(pnl["title"])}</b></div>{key}')
        s = [f'<svg class="plot" width="{CW}" height="{PH + 20}" viewBox="0 -10 {CW} {PH + 20}">']
        for g in (30, 40, 50, 60):
            s.append(f'<line x1="0" y1="{Y(g):.1f}" x2="{CW}" y2="{Y(g):.1f}" stroke="{CREAM}" stroke-opacity=".14" stroke-width="2"/>')
            s.append(text(0, Y(g) - 12, str(g), 54, 500, 'rgba(244,239,228,.6)', 'start', "'IBM Plex Mono'"))
        for gx, strong in ((0.1, 1), (0.3, 0), (1, 1), (3, 0), (10, 1)):
            s.append(f'<line x1="{X(gx):.1f}" y1="0" x2="{X(gx):.1f}" y2="{PH}" stroke="{CREAM}" stroke-opacity="{.14 if strong else .07}" stroke-width="2"/>')
        pts = {}
        for ln in (older, newer):
            xy = [(X(ROWS[sl]['cost_per_task_usd']), Y(ROWS[sl]['score'])) for sl in ln['slugs']]
            pts[ln['model']] = dict(zip(ln['slugs'], xy))
            path = ' '.join(f'{"M" if k == 0 else "L"}{x:.1f},{y:.1f}' for k, (x, y) in enumerate(xy))
            if ln['style'] == 'newer_version':
                s.append(f'<path d="{path}" fill="none" stroke="{MINT}" stroke-width="8" stroke-linejoin="round"/>')
                s += [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="13" fill="{MINT}"/>' for x, y in xy]
            else:
                s.append(f'<path d="{path}" fill="none" stroke="{CREAM}" stroke-opacity=".55" stroke-width="6" stroke-dasharray="16 12"/>')
                s += [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="11" fill="{INK}" stroke="{CREAM}" stroke-opacity=".7" stroke-width="5"/>' for x, y in xy]
        nl = pts[newer['model']]
        lo, hi = newer['slugs'][0], newer['slugs'][-1]
        s.append(text(nl[lo][0] - 30, nl[lo][1] + 18, 'Low', 54, 700, MINT, 'end'))
        s.append(text(nl[hi][0], nl[hi][1] - 30, 'Max', 54, 700, MINT, 'middle'))
        ol = pts[older['model']]
        if i == 0:
            a, b = ol['claude-opus-5'], nl['claude-opus-5-5-low']
            for (x, y) in (a, b):
                s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="26" fill="none" stroke="{ACC}" stroke-width="5"/>')
            tx, ty = 760, Y(31)
            s.append(text(tx, ty, 'Opus 5 at Max beat', 54, 700, ACC))
            s.append(text(tx, ty + 62, 'Opus 5.5 at Low', 54, 700, ACC))
            s.append(f'<path d="M{a[0]:.1f},{a[1] + 28:.1f} L{a[0]:.1f},{ty - 58:.1f}" stroke="{ACC}" stroke-width="2"/>')
            s.append(f'<path d="M{b[0]:.1f},{b[1] + 28:.1f} L{b[0]:.1f},{ty - 18:.1f} L{tx - 16:.1f},{ty - 18:.1f}" fill="none" stroke="{ACC}" stroke-width="2"/>')
            s.append(text(ol['claude-opus-5'][0] + 34, ol['claude-opus-5'][1] + 18, 'Max', 54, 700, 'rgba(244,239,228,.7)', 'start'))
            s.append(text(ol['claude-opus-5-low'][0] - 28, ol['claude-opus-5-low'][1] + 18, 'Low', 54, 700, 'rgba(244,239,228,.7)', 'end'))
        else:
            a = ol['gpt-6-sol-non-reasoning']
            s.append(f'<circle cx="{a[0]:.1f}" cy="{a[1]:.1f}" r="26" fill="none" stroke="{ACC}" stroke-width="5"/>')
            tx = a[0] + 50
            s.append(text(tx, a[1] - 14, 'Non-reasoning (thinking off)', 54, 700, ACC))
            s.append(text(tx, a[1] + 48, 'cost more to run than Low', 54, 700, ACC))
            s.append(text(ol['gpt-6-sol-low'][0] - 30, ol['gpt-6-sol-low'][1] + 18, 'Low', 54, 700, 'rgba(244,239,228,.7)', 'end'))
            s.append(text(ol['gpt-6-sol'][0] + 34, ol['gpt-6-sol'][1] + 18, 'Max', 54, 700, 'rgba(244,239,228,.7)', 'start'))
        s.append('</svg>')
        out.append('\n'.join(s))
        if i == 0:
            out.append('<div style="height:40px"></div>')
    ticks = ''.join(f'<span style="left:{X(v):.1f}px">{esc(t)}</span>' for v, t in ((0.1, '$0.10'), (1, '$1'), (10, '$10')))
    out.append(f'<div class="xt">{ticks}</div><p class="xtitle">{esc(c["axes_text"]["x_title"])}</p>')
    out.append(f'<p class="fine" data-fine-print style="margin-top:24px">{esc(e["notes"][0]["text"])}</p>')
    css = f'''
.phead {{ display: flex; align-items: center; gap: 20px; }} .phead img {{ height: 56px; }} .phead b {{ font: 700 60px/1 'Archivo'; }}
.key {{ display: flex; gap: 44px; margin: 18px 0 18px; font: 700 54px/1.15 'Archivo'; flex-wrap: wrap; row-gap: 8px; }}
.key span {{ display: inline-flex; align-items: center; gap: 16px; }}
.sw {{ display: inline-block; width: 60px; height: 0; }} .sw.solid {{ border-top: 8px solid {MINT}; }} .sw.dash {{ border-top: 6px dashed rgba(244,239,228,.6); }}
.key span:first-child {{ color: {MINT}; }} .key span:last-child {{ color: rgba(244,239,228,.75); }}
.ytitle {{ font: 500 54px/1.2 'Archivo'; color: rgba(244,239,228,.82); margin-bottom: 20px; }}
.plot {{ display: block; overflow: visible; }}
.xt {{ position: relative; height: 70px; margin-top: 8px; font: 500 54px/1 'IBM Plex Mono'; color: rgba(244,239,228,.75); }}
.xt span {{ position: absolute; top: 0; transform: translateX(-50%); }} .xt span:last-child {{ transform: translateX(-100%); }}
.xtitle {{ font: 500 54px/1.25 'Archivo'; color: rgba(244,239,228,.82); margin-top: 6px; }}
'''
    head = f'<p class="ytitle">{esc(c["axes_text"]["y_title"])}</p>'
    return page(e, head + '\n'.join(out), css)


# ------------------------------------------------------------------ exhibit 3

def e3(e):
    c = e['chart']
    PW, PHT, GAP = 600, 300, 32
    cells = []
    for k, pnl in enumerate(c['panels']):
        pts = pnl['points']
        X = lambda m: (m - 1) / 15 * PW  # noqa: E731
        Y = lambda p: (22 - p) / 22 * PHT  # noqa: E731
        s = [f'<svg width="{PW}" height="{PHT + 10}" viewBox="0 -5 {PW} {PHT + 10}" style="display:block;overflow:visible">']
        for g in (0, 10, 20):
            s.append(f'<line x1="0" y1="{Y(g):.1f}" x2="{PW}" y2="{Y(g):.1f}" stroke="{CREAM}" stroke-opacity=".14" stroke-width="2"/>')
            if k % 2 == 0 and g:
                s.append(text(0, Y(g) - 10, str(g), 54, 500, 'rgba(244,239,228,.6)', 'start', "'IBM Plex Mono'"))
        for gx in (4, 8, 12, 16):
            s.append(f'<line x1="{X(gx):.1f}" y1="0" x2="{X(gx):.1f}" y2="{PHT}" stroke="{CREAM}" stroke-opacity=".08" stroke-width="2"/>')
        xy = [(X(p['x_times_low_cost']), Y(p['y_points_added'])) for p in pts]
        for j in range(len(xy) - 1):
            col = ACC if j == len(xy) - 2 else MINT
            s.append(f'<line x1="{xy[j][0]:.1f}" y1="{xy[j][1]:.1f}" x2="{xy[j + 1][0]:.1f}" y2="{xy[j + 1][1]:.1f}" stroke="{col}" stroke-width="7" stroke-linecap="round"/>')
        for j, (x, y) in enumerate(xy):
            s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="10" fill="{ACC if j == len(xy) - 1 else MINT}"/>')
        el = pnl['end_label']
        s.append(text(PW, PHT - 78, el['line1'], 54, 700, CREAM, 'end'))
        s.append(text(PW, PHT - 16, el['line2'], 54, 500, 'rgba(244,239,228,.82)', 'end'))
        for an in c.get('annotations', []):
            if an['panel'] == pnl['model']:
                a, b2 = an['text'].split(' for ')
                s.append(text(PW, Y(18), a, 54, 700, ACC, 'end'))
                s.append(text(PW, Y(18) + 60, 'for ' + b2, 54, 700, ACC, 'end'))
        s.append('</svg>')
        title = pnl['title'] + (' *' if 'Haiku' in pnl['title'] else '') + (', from Low' if pnl['title'] == 'GPT-6 Sol' else '')
        cells.append(f'<div class="cell"><div class="ct"><img src="{logo_uri(pnl["logo"])}" alt=""><b>{esc(title)}</b></div>{"".join(s)}</div>')
    xt = ''.join(f'<span style="left:{(v - 1) / 15 * PW:.1f}px">{v}</span>' for v in (1, 4, 8, 12, 16))
    axis = f'<div class="xrow"><div class="xt">{xt}</div><div class="xt">{xt}</div></div><p class="xtitle">{esc(c["axes_text"]["x_title"])}</p>'
    notes = ''.join(f'<p class="fine" data-fine-print style="margin-top:14px">{esc(n["text"])}</p>' for n in e['notes'] if 'source block' not in n['placement'])
    css = f'''
.ytitle {{ font: 500 54px/1.2 'Archivo'; color: rgba(244,239,228,.82); margin-bottom: 24px; }}
.grid {{ display: grid; grid-template-columns: {PW}px {PW}px; column-gap: {GAP}px; row-gap: 44px; }}
.ct {{ display: flex; align-items: center; gap: 14px; margin-bottom: 26px; }} .ct img {{ height: 44px; }} .ct b {{ font: 700 54px/1 'Archivo'; }}
.xrow {{ display: grid; grid-template-columns: {PW}px {PW}px; column-gap: {GAP}px; margin-top: 14px; }}
.xt {{ position: relative; height: 64px; font: 500 54px/1 'IBM Plex Mono'; color: rgba(244,239,228,.75); }}
.xt span {{ position: absolute; transform: translateX(-50%); }} .xt span:first-child {{ transform: none; }} .xt span:last-child {{ transform: translateX(-100%); }}
.xtitle {{ font: 500 54px/1.25 'Archivo'; color: rgba(244,239,228,.82); margin-top: 4px; }}
'''
    body = f'<p class="ytitle">{esc(c["axes_text"]["y_title"])}</p><div class="grid">{"".join(cells)}</div>{axis}{notes}'
    return page(e, body, css)


# ------------------------------------------------------------------ exhibit 4

def e4(e):
    c = e['chart']
    tiles = c['tiles']
    rows_html = []
    heads = ('<div class="colheads"><div style="color:%s">More thinking<br><span>same model</span></div><div>A new version<br><span>same thinking level</span></div></div>' % MINT)
    for fam in ('Anthropic · Claude Opus', 'OpenAI · GPT Sol'):
        ts = [t for t in tiles if t['row'] == fam]
        lk = 'anthropic' if fam.startswith('Anthropic') else 'openai'
        cells = []
        for t in ts:
            b = t['bar']
            if b['kind'] == 'solid':
                bar = f'<div class="track"><div class="fill" style="width:{b["to"] * 26:.1f}px;background:{MINT}"></div></div>'
            else:
                dots = ''.join(f'<i style="left:{v * 26 - 6:.1f}px;background:{INK if v <= b["solid_to"] + 1e-9 else CREAM}"></i>' for v in b['dots_at'])
                bar = (f'<div class="track"><div class="fill" style="width:{b["solid_to"] * 26:.1f}px;background:{CREAM}"></div>'
                       f'<div class="ol" style="left:{b["solid_to"] * 26:.1f}px;width:{(b["outline_to"] - b["solid_to"]) * 26:.1f}px"></div>{dots}</div>')
            colour = MINT if t['big_colour'] == 'mint' else CREAM
            cost_col = ACC if t['cost_colour'] == 'accent' else MINT
            cells.append(f'<div class="tile"><div class="big" style="color:{colour}">{esc(t["big_number"])}</div><p class="under">{esc(t["under"])}</p>{bar}'
                         f'<p class="cost" style="color:{cost_col}">{esc(t["cost"])}</p></div>')
        rows_html.append(f'<div class="rhead"><img src="{logo_uri(lk)}" alt=""><b>{esc(fam.split(" · ")[1])}</b></div><div class="trow">{"".join(cells)}</div>')
    ticks = '<div class="bt"><span style="left:0">0</span><span style="left:260px">10</span><span style="left:520px">20 points</span></div>'
    notes = ''.join(f'<p class="fine" data-fine-print style="margin-top:20px">{esc(n["text"])}</p>' for n in e['notes'] if 'source block' not in n['placement'])
    css = f'''
.colheads {{ display: grid; grid-template-columns: 600px 600px; column-gap: 32px; font: 700 54px/1.1 'Archivo'; margin-bottom: 30px; }}
.colheads span {{ font-weight: 500; color: rgba(244,239,228,.7); }}
.rhead {{ display: flex; align-items: center; gap: 18px; margin: 36px 0 20px; }} .rhead img {{ height: 56px; }} .rhead b {{ font: 700 60px/1 'Archivo'; }}
.trow {{ display: grid; grid-template-columns: 600px 600px; column-gap: 32px; }}
.tile {{ background: {SOFT}; border-radius: 12px; padding: 36px 40px 40px; }}
.big {{ font: 400 104px/1 'Anton'; }}
.under {{ font: 500 54px/1.2 'Archivo'; color: rgba(244,239,228,.82); margin-top: 18px; min-height: 130px; }}
.track {{ position: relative; width: 520px; height: 40px; background: rgba(244,239,228,.14); border-radius: 4px; margin-top: 22px; }}
.fill {{ position: absolute; left: 0; top: 0; height: 40px; border-radius: 4px; }}
.ol {{ position: absolute; top: 0; height: 40px; border: 3px solid {CREAM}; border-left: 0; border-radius: 0 4px 4px 0; }}
.track i {{ position: absolute; top: 14px; width: 12px; height: 12px; border-radius: 6px; background: {INK}; }}
.cost {{ font: 700 54px/1.2 'Archivo'; margin-top: 24px; }}
.bt {{ position: relative; height: 64px; margin: 14px 0 0 40px; font: 500 54px/1 'IBM Plex Mono'; color: rgba(244,239,228,.75); }}
.bt span {{ position: absolute; white-space: nowrap; }} .bt span + span {{ transform: translateX(-50%); }} .bt span:last-child {{ transform: translateX(-12%); }}
'''
    return page(e, heads + ''.join(rows_html) + ticks + notes, css)


# ------------------------------------------------------------------ exhibit 5

def e5(e):
    c = e['chart']
    SCALE = 640 / 6.0

    def bar(cost, colour, outline=False):
        w = max(cost * SCALE, 6)
        st = f'border:3px solid {CREAM};background:none' if outline else f'background:{colour}'
        return f'<div class="bar"><div class="b" style="width:{w:.1f}px;{st}"></div><span>{esc("$%.2f" % cost)}</span></div>'

    def logo_for(model):
        return 'openai' if model.startswith('GPT') else ('google' if model.startswith('Gemini') else 'anthropic')

    rows = []
    for k, r in enumerate(c['rows']):
        tgt = r['label'].replace(' or more', '+') if r['label'] != 'The top score' else 'Top'
        colour = ACC if r['cost_per_task_usd'] > 1 else 'rgba(244,239,228,.8)'
        star = ' *' if 'haiku' in r['cheapest'] else ''
        lines = [f'<div class="line"><img src="{logo_uri(logo_for(r["model"]))}" alt=""><b>{esc(r["model"])} at {esc(r["level"])}{star}</b><em>{r["score"]:.1f}</em></div>{bar(r["cost_per_task_usd"], colour)}']
        if k == 0:
            t = c['tie_second_line']
            lines.append(f'<div class="line" style="margin-top:18px"><img src="{logo_uri("openai")}" alt=""><b>{esc(t["model"])} at {esc(t["level"])}</b><em>{t["score"]:.1f}</em></div>{bar(ROWS[t["slug"]]["cost_per_task_usd"], "rgba(244,239,228,.8)")}')
            lines.append(f'<p class="fine" data-fine-print style="margin-top:12px">{esc(e["notes"][0]["text"])}</p>')
        rows.append(f'<div class="row"><div class="tgt">{esc(tgt)}</div><div class="rest">{"".join(lines)}</div></div>')
        if r['target'] == 50:
            rows.append(f'<div class="jump">{esc(c["encoding"]["jump"].split(chr(34))[1])}</div>')
    refs = []
    for rf in c['reference_rows']:
        m = ROWS[rf['slug']]
        tag = 'Default' if 'default' in rf['label'] else 'Google'
        star = ' *' if 'haiku' in rf['slug'] else ''
        refs.append(f'<div class="row"><div class="tgt small">{tag}</div><div class="rest"><div class="line"><img src="{logo_uri(rf["logo"])}" alt="" class="{"g" if rf["logo"] == "google" else ""}"><b>{esc(m["model"])} at {esc(m["thinking_level_label"])}{star}</b><em>{m["score"]:.1f}</em></div>{bar(m["cost_per_task_usd"], CREAM, True)}</div></div>')
    head = ('<div class="heads"><span>Score</span><span>Cheapest way there, and its score</span></div>')
    css = f'''
.heads {{ display: grid; grid-template-columns: 210px 1fr; font: 500 54px/1.2 'Archivo'; color: rgba(244,239,228,.7); margin-bottom: 18px; }}
.line b {{ white-space: nowrap; }}
.row {{ display: grid; grid-template-columns: 210px 1fr; align-items: start; padding: 26px 0; border-top: 2px solid rgba(244,239,228,.12); }}
.tgt {{ font: 400 80px/1 'Anton'; }} .tgt.small {{ font: 700 54px/1.4 'Archivo'; color: rgba(244,239,228,.75); }}
.line {{ display: flex; align-items: center; gap: 16px; font: 700 54px/1.15 'Archivo'; }} .line img {{ height: 46px; }} .line img.g {{ height: 40px; }}
.line em {{ margin-left: auto; font: 500 54px/1 'IBM Plex Mono'; font-style: normal; color: rgba(244,239,228,.85); }}
.bar {{ display: flex; align-items: center; gap: 18px; margin-top: 16px; }} .b {{ height: 44px; border-radius: 0 6px 6px 0; }}
.bar span {{ font: 400 64px/1 'Anton'; }}
.jump {{ margin: 6px 0 6px 210px; padding: 14px 0 14px 22px; border-left: 5px solid {ACC}; font: 700 54px/1.2 'Archivo'; color: {ACC}; }}
.band {{ margin-top: 40px; padding-top: 26px; border-top: 2px solid rgba(244,239,228,.4); font: 500 54px/1.2 'Archivo'; color: rgba(244,239,228,.75); }}
'''
    notes = f'<p class="fine" data-fine-print style="margin-top:18px">{esc(e["notes"][1]["text"])}</p>'
    body = head + ''.join(rows) + '<p class="band">For comparison</p>' + ''.join(refs) + notes
    return page(e, body, css)


MAKERS = {'launches': e1, 'model-or-thinking-level': e2, 'each-step-buys-less': e3, 'new-version-or-more-thinking': e4, 'cheapest-route-to-each-score': e5}
for e in EX['exhibits']:
    f = OUT / f'exhibit-{e["order"]}-{e["id"]}.html'
    f.write_text(MAKERS[e['id']](e), encoding='utf-8')
    print('wrote', f)
