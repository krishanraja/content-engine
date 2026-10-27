"""Draw every picture beat of Monday's two cuts as make.py panels, from the signed direction.

The look is "Receipts" (../receipts.md): cream till receipts, the empty Character.AI box
and real logos on the ink desk; documents are the live captures (capture_sources.py)
with the proving words sharp and the rest of the page out of focus. Each beat is one
panel, or one page per word it prints on (make.py "pages"): the 5-minute cut's panels
are 1314 x 1080 (beside his face), the 90-second cut's 1080 x 1000 (above it).
Every page's legible words are listed with their role for the visual-clarity
inventory (panels.json). Run from the repository root after capture_sources.py:

    python docs/plans/2026-10-26-monday/video/draw_panels.py
"""
import base64
import html
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[4]
PLAN = Path(__file__).resolve().parents[1]
WORK = ROOT / '.cache/produce/2026-10-26-b358e788'
CAPS = WORK / 'captures'
OUT = WORK / 'panels'
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand

SIZE = {'16x9': (1314, 1080), '9x16': (1080, 1000)}
INK, CREAM, MINT, BUTTER = '#0C1512', '#F4EFE4', '#7EF0C0', '#FFD84D'


def esc(s):
    return html.escape(str(s))


def uri(data, mime):
    return f'data:{mime};base64,' + base64.b64encode(data).decode()


def logo(name, h, extra='', w=None):
    """A real logo; with w, fitted inside a w x h box so logos of different shapes read at one size."""
    size = f'width:{w}px;height:{h}px;object-fit:contain' if w else f'height:{h}px;max-width:100%'
    return f'<img class="logo" style="{size};{extra}" src="{uri((PLAN / "logos" / name).read_bytes(), "image/svg+xml")}">'


def torn(width_px, teeth=26, depth=14):
    """A clip-path with a torn top edge, for till paper."""
    pts = []
    for i in range(teeth + 1):
        x = 100 * i / teeth
        pts.append(f'{x:.2f}% {depth if i % 2 else 0}px')
    return 'polygon(' + ', '.join(pts) + ', 100% 100%, 0% 100%)'


# ------------------------------------------------------------------ the objects

def receipt(header, lines, footer, shown, size='m'):
    """Till paper: a header, priced lines (left, right, total?, sub-lines) and the source footer.
    Lines past `shown` are not printed yet; the paper keeps its full length so it never jumps."""
    rows = []
    for i, (left, right, total, subs) in enumerate(lines):
        vis = '' if i < shown else ' style="visibility:hidden"'
        r = f'<b class="{"total" if total else ""}">{esc(right)}</b>' if right else ''
        rows.append(f'<div class="line"{vis}><span>{esc(left)}</span><i></i>{r}</div>' +
                    ''.join(f'<div class="sub"{vis}>{esc(s)}</div>' for s in subs))
    return (f'<div class="receipt {size}" style="clip-path:{torn(0)}"><div class="rh">{esc(header)}</div>'
            f'<div class="rule"></div>{"".join(rows)}<div class="rule"></div><div class="rf">{esc(footer)}</div></div>')


def box(labels, title='CHARACTER.AI', size='m', dim=()):
    pills = ''.join(f'<span class="pill{" dim" if l in dim else ""}">{esc(l)}</span>' for l in labels)
    return f'<div class="box {size}"><div class="bt">{logo("characterai-cream.svg", 54 if size == "m" else 40)}</div><div class="bin">{pills}</div></div>'


def spotlight(cap_id, sharp, crop_w, aspect, record, fill=0.62):
    """The capture cropped round its marked words, every word but the marked ones out of focus."""
    img = Image.open(CAPS / f'{cap_id}.png').convert('RGB')
    if 'rects_px' in record:
        groups = record['rects_px']
    else:
        groups = [[[x * 2, y * 2, w * 2, h * 2] for x, y, w, h in g] for g in record['rects_css']]
    keep = [r for i in sharp for r in groups[i]]
    every = [r for g in groups for r in g]
    left, right = min(r[0] for r in every), max(r[0] + r[2] for r in every)
    top, bottom = min(r[1] for r in every), max(r[1] + r[3] for r in every)
    cx, cy = (left + right) / 2, (top + bottom) / 2
    # The marked words fill about three fifths of the width, so they read large on a phone.
    w = round(min(img.width, max(crop_w, (right - left) / fill, (bottom - top + 160) * aspect)))
    h = round(w / aspect)
    x0 = int(max(0, min(img.width - w, cx - w / 2)))
    y0 = int(max(0, min(img.height - h, cy - h / 2)))
    crop = img.crop((x0, y0, x0 + w, y0 + h))
    soft = crop.filter(ImageFilter.GaussianBlur(9))
    soft = Image.blend(soft, Image.new('RGB', soft.size, (200, 200, 196)), 0.18)
    for x, y, rw, rh in keep:
        pad = 10
        b = (int(x - x0 - pad), int(y - y0 - pad), int(x - x0 + rw + pad), int(y - y0 + rh + pad))
        region = crop.crop(b)
        if 'rects_px' in record:
            # A PDF page carries no mark of its own: lay the mint at 30% behind the words, as on the web pages.
            region = Image.composite(Image.blend(region, Image.new('RGB', region.size, (126, 240, 192)), 0.30), region,
                                     region.convert('L').point(lambda v: 255 if v > 160 else 0))
        soft.paste(region, b[:2])
    buf = io.BytesIO()
    soft.save(buf, 'PNG')
    return uri(buf.getvalue(), 'image/png'), (w, h)


# ------------------------------------------------------------------ page layouts

def page(shape, body, label=None, source=None, layout='centre'):
    lab = f'<div class="label">{esc(label)}</div>' if label else ''
    src = f'<div class="source">{esc(source)}</div>' if source else ''
    return f'<main class="{shape} {layout}">{lab}<div class="stage">{body}</div>{src}</main>'


def capture_page(shape, cap_id, sharp, label, source, records):
    w, h = SIZE[shape]
    stage_w = w - 120
    stage_h = (h - (230 if label else 120) - (90 if source else 0))
    data, _ = spotlight(cap_id, sharp, 760 if shape == '16x9' else 640, stage_w / stage_h, records[cap_id],
                        0.98 if cap_id == 'court-filing' else 0.62)
    return page(shape, f'<img class="cap" style="width:{stage_w}px;height:{stage_h}px" src="{data}">', label, source)


CSS = '''*{box-sizing:border-box;margin:0;padding:0}
body{background:#0C1512;color:#F4EFE4;font-family:Archivo}
main{position:relative;width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;padding:56px 60px;
 background-color:#0C1512;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>")}
main::before{content:"";position:absolute;left:0;top:0;width:100%;height:10px;background:#FFD84D}
.label{font:104px/1 Anton;letter-spacing:1px;text-align:center;color:#F4EFE4;max-width:100%}
.label .m{color:#7EF0C0}
.source{position:absolute;left:60px;bottom:44px;font:500 30px/1 "IBM Plex Mono";letter-spacing:1px;color:rgba(244,239,228,.78)}
.\\39x16 .label{font-size:92px}.\\39x16 .source{font-size:40px;bottom:40px}
.stage{display:flex;align-items:center;justify-content:center;gap:44px;max-width:100%}
.cap{border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.55);object-fit:cover}
.logo{display:block;object-fit:contain}
.big{font:150px/1 Anton;text-align:center}
.huge{font:300px/.9 Anton;color:#FFD84D;text-align:center}
.mono{font:500 40px/1.25 "IBM Plex Mono";letter-spacing:1px;color:rgba(244,239,228,.85);text-align:center}
.receipt{background:#F4EFE4;color:#0C1512;font-family:"IBM Plex Mono";padding:52px 46px 40px;box-shadow:0 22px 60px rgba(0,0,0,.6);transform:rotate(-1.2deg)}
.receipt.m{width:1060px}.\\39x16 .receipt.m{width:940px}.receipt.s{width:520px;padding:40px 30px 30px}.receipt.xs{width:392px;padding:36px 26px 28px}
.rh{font:700 54px/1.1 "IBM Plex Mono";letter-spacing:2px;text-align:center}
.rule{border-top:4px dashed rgba(12,21,18,.45);margin:24px 0}
.line{display:flex;align-items:baseline;gap:14px;font:500 46px/1.25 "IBM Plex Mono";margin:14px 0}
.line i{flex:1;border-bottom:4px dotted rgba(12,21,18,.4);transform:translateY(-8px)}
.line b{font-weight:700;white-space:nowrap}
.line b.total{background:#7EF0C0;padding:2px 10px;border-radius:3px}
.sub{font:400 38px/1.3 "IBM Plex Mono";padding-left:34px;color:rgba(12,21,18,.75)}
.rf{font:500 34px/1.2 "IBM Plex Mono";text-align:center;letter-spacing:1px;color:rgba(12,21,18,.75)}
.receipt.s .rh{font-size:36px}.receipt.s .line{font-size:32px}.receipt.s .rf{font-size:26px}
.receipt.xs .rh{font-size:38px}.receipt.xs .line{font-size:38px;margin:14px 0}.receipt.xs .rf{font-size:24px}.receipt.xs .rule{margin:16px 0}
.box{border:5px solid rgba(244,239,228,.6);border-top:none;border-radius:0 0 14px 14px;padding:24px 26px 30px;position:relative;min-width:440px;min-height:420px;display:flex;flex-direction:column;align-items:center}
.box::before{content:"";position:absolute;top:-30px;left:-24px;right:-24px;height:30px;border:5px solid rgba(244,239,228,.6);border-bottom:none;transform:skewX(-14deg)}
.box.s{min-width:300px;min-height:340px}
.\39x16 .line{font-size:40px}
.bt{margin:10px 0 26px}
.bin{display:flex;flex-direction:column;align-items:center;gap:18px}
.pill{font:700 38px/1 "IBM Plex Mono";letter-spacing:1px;background:rgba(244,239,228,.12);border:3px solid rgba(244,239,228,.7);padding:14px 20px;border-radius:8px;white-space:nowrap}
.pill.dim{visibility:hidden}
.arrow{width:200px;height:24px;background:#7EF0C0;position:relative;border-radius:4px}
.arrow::after{content:"";position:absolute;right:-30px;top:-22px;border:34px solid transparent;border-left:40px solid #7EF0C0;border-right:none}
.col{display:flex;flex-direction:column;align-items:center;gap:22px}
.row{display:flex;align-items:center;gap:40px}
.void{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(8deg);font:170px/1 Anton;color:#F4EFE4;background:#0C1512;padding:6px 40px;border:8px solid #F4EFE4;letter-spacing:8px}
.wrap{position:relative}
.sora{border:6px dashed rgba(244,239,228,.7);border-radius:16px;padding:60px 56px 50px;position:relative}
.sora .tag{position:absolute;top:-36px;left:40px;background:#0C1512;padding:0 18px;font:700 52px/1 "IBM Plex Mono";letter-spacing:6px}
.sora .door{position:absolute;right:-44px;top:50%;transform:translateY(-50%);background:#0C1512;border:5px solid rgba(244,239,228,.7);border-radius:10px;padding:16px}
.sora.open{border-color:transparent}.sora.open .tag,.sora.open .door{visibility:hidden}
.slot{background:#F4EFE4;color:#0C1512;width:360px;height:560px;padding:40px 30px;display:flex;flex-direction:column;align-items:center;gap:28px;box-shadow:0 18px 50px rgba(0,0,0,.55)}
.slot .blank{width:100%;border-bottom:4px dashed rgba(12,21,18,.35);height:40px}
.slot small{font:500 32px/1 "IBM Plex Mono";letter-spacing:1px}
.slot.hide{visibility:hidden}
.card{background:#F4EFE4;color:#0C1512;padding:46px 54px;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:22px;max-width:1080px}
.card .q{font:118px/1.02 Anton}.card .n{font:700 40px/1 "IBM Plex Mono";color:#0C1512;background:#FFD84D;width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.card .proof{font:500 46px/1.2 "IBM Plex Mono";color:rgba(12,21,18,.8)}
.dots{display:flex;gap:18px}.dots span{width:22px;height:22px;border-radius:50%;background:rgba(244,239,228,.25)}.dots span.on{background:#FFD84D}
.mini{display:flex;flex-direction:column;gap:22px}
.minicard{background:#F4EFE4;color:#0C1512;border-radius:10px;padding:26px 34px;display:flex;align-items:center;gap:30px;width:940px;box-shadow:0 12px 34px rgba(0,0,0,.5)}
.minicard .n{font:700 36px/1 "IBM Plex Mono";background:#FFD84D;width:66px;height:66px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.minicard b{font:96px/1 Anton}.minicard.hide{visibility:hidden}
.pair{display:flex;align-items:center;gap:38px;padding:26px 0;border-bottom:3px solid rgba(244,239,228,.2)}
.pair .t{font:72px/1.05 Anton}.pair .s{font:500 30px/1.2 "IBM Plex Mono";color:rgba(244,239,228,.78);margin-top:10px}
.pair.hide{visibility:hidden}
.money{font:700 46px/1 "IBM Plex Mono";background:#7EF0C0;color:#0C1512;padding:8px 16px;border-radius:4px;white-space:nowrap}
.cap2{font:700 34px/1 "IBM Plex Mono";letter-spacing:1px;text-align:center}
'''

# ------------------------------------------------------------------ Receipt contents (receipts.md)

R1_LONG = ('GOOGLE · AUG 2024', [('USE OF THE TECH', '$2.7B (REPORTED)', True, []),
                                      ('HIRES:', 'THE FOUNDERS + RESEARCH TEAM', False, [])], 'WIRED · 19 OCT 2026')
R2_LONG_LINES = [('66 STAFF', '~$60M A YEAR × 3 YEARS', True, []),
                 ('THE CODE (OPENING BID)', '$20M', True, ['trust and safety tools', 'age prediction'])]


def receipt1_wide(shown):
    head, lines, foot = R1_LONG
    lines = [('USE OF THE TECH', '$2.7B (REPORTED)', True, []), ('HIRES: THE FOUNDERS', '', False, ['+ research team'])]
    return receipt(head, lines, foot, shown)


def build(records):
    """{panel id: [(html, [(text, role, adds)])...]} per cut."""
    W, T = '16x9', '9x16'
    P = {}

    def add(pid, shape, pages):
        P[pid] = {'shape': shape, 'pages': pages}

    def txt(*items):
        return [{'value': v, 'role': r, 'adds': a} for v, r, a in items]

    # ---------------- 5-minute cut (16:9)
    add('l01', W, [(page(W, logo('characterai-cream.svg', 110, w=520), 'CHARACTER.AI · CHAPTER 11', layout='typeset'),
                   txt(('CHARACTER.AI · CHAPTER 11', 'identity', 'names the firm and its bankruptcy chapter, which he does not say')))])
    three = [('google-wordmark.svg', 130), ('characterai-cream.svg', 130), ('disney-script-cream.svg', 150)]
    def logos3(order):
        cells = ''.join(f'<div style="width:360px;display:flex;justify-content:center;{"" if n in order else "visibility:hidden"}">{logo(f, h, w=340)}</div>'
                        for n, (f, h) in enumerate(three))
        return f'<div class="row" style="gap:20px">{cells}</div>'
    lab2 = 'TWO BUYERS · ONE COMPANY'
    t2 = ('TWO BUYERS · ONE COMPANY', 'relationship', 'frames the two buyers of one firm')
    add('l02', W, [(page(W, logos3({1}), None), txt()),
                   (page(W, logos3({1, 2}), None), txt()),
                   (page(W, logos3({0, 1, 2}), lab2), txt(t2))])
    add('l03', W, [(capture_page(W, 'bw-filing', [0], None, 'BUSINESS WIRE · 12 OCT 2026', records),
                    txt(('commenced a voluntary Chapter 11 case', 'source', 'the filing announcement in its own words'),
                        ('BUSINESS WIRE · 12 OCT 2026', 'source', 'where and when it was announced')))])
    add('l05', W, [(page(W, logo('google-g.svg', 170), 'GOOGLE · 2024', layout='typeset'),
                    txt(('GOOGLE · 2024', 'identity', 'the first buyer and its year')))])
    head, _, foot = R1_LONG
    add('l06', W, [(page(W, receipt1_wide(0), None), txt(('GOOGLE · AUG 2024', 'identity', 'who paid and when'), (foot, 'source', 'the report'))),
                   (page(W, receipt1_wide(1), None), txt(('GOOGLE · AUG 2024', 'identity', 'who paid and when'), ('USE OF THE TECH $2.7B (REPORTED)', 'quantity', 'the reported price, as a receipt line'), (foot, 'source', 'the report'))),
                   (page(W, receipt1_wide(2), None), txt(('GOOGLE · AUG 2024', 'identity', 'who paid and when'), ('USE OF THE TECH $2.7B (REPORTED)', 'quantity', 'the reported price'), ('HIRES: THE FOUNDERS + research team', 'relationship', 'the people bought with it'), (foot, 'source', 'the report')))])
    add('l08', W, [(capture_page(W, 'wired-majority', [0], 'MOST STAFF STAYED', 'WIRED · 19 OCT 2026', records),
                    txt(('MOST STAFF STAYED', 'relationship', 'the takeaway of the highlighted report'), ('“vast majority”', 'source', 'Wired\'s words'), ('WIRED · 19 OCT 2026', 'source', 'the report')))])
    add('l09', W, [(page(W, logo('disney-script-cream.svg', 190), 'DISNEY · DEC 2025', layout='typeset'),
                    txt(('DISNEY · DEC 2025', 'identity', 'the second buyer and when its story starts')))])
    add('l10', W, [(capture_page(W, 'disney-openai', [0], '$1B · 200+ CHARACTERS', 'DISNEY · DEC 2025', records),
                    txt(('$1B · 200+ CHARACTERS', 'quantity', 'the two numbers of the deal'), ('$1 billion', 'source', 'Disney\'s release'), ('DISNEY · DEC 2025', 'source', 'the release'))),
                   (capture_page(W, 'disney-openai', [0, 1], '$1B · 200+ CHARACTERS', 'DISNEY · DEC 2025', records),
                    txt(('$1B · 200+ CHARACTERS', 'quantity', 'the two numbers of the deal'), ('$1 billion', 'source', 'Disney\'s release'), ('more than 200', 'source', 'Disney\'s release'), ('DISNEY · DEC 2025', 'source', 'the release')))])
    marks = (f'<div class="row" style="gap:46px">{logo("marvel.svg", 110)}{logo("star-wars-ink.svg", 140)}{logo("disney-script-cream.svg", 120)}</div>')
    door = f'<div class="door">{logo("openai-symbol-cream.svg", 90)}</div>'
    add('l11', W, [(page(W, f'<div class="sora open"><div class="tag">SORA</div>{marks}{door}</div>', None), txt()),
                   (page(W, f'<div class="sora"><div class="tag">SORA</div>{marks}{door}</div>', 'RENTED SPACE'),
                    txt(('SORA', 'identity', 'whose app the characters were placed in'), ('RENTED SPACE', 'relationship', 'Disney did not own the app')))])
    add('l12', W, [(capture_page(W, 'sora-shut', [0], None, 'OPENAI · 24 MAR 2026', records),
                    txt(('shuttering its stand-alone', 'source', 'the report of the shutdown'), ('OPENAI · 24 MAR 2026', 'source', 'who decided and when'))),
                   (capture_page(W, 'sora-shut', [0], 'SORA SHUT', 'OPENAI · 24 MAR 2026', records),
                    txt(('SORA SHUT', 'relationship', 'the outcome'), ('shuttering its stand-alone', 'source', 'the report'), ('OPENAI · 24 MAR 2026', 'source', 'who decided and when')))])
    vhead = 'DISNEY + OPENAI · DEC 2025'
    def void(stamp, total):
        st = '<div class="void">VOID</div>' if stamp else ''
        vis = '' if total else ' style="visibility:hidden"'
        return (f'<div class="receipt m" style="clip-path:{torn(0)}"><div class="rh">{esc(vhead)}</div><div class="rule"></div>'
                f'<div style="position:relative;height:240px">{st}</div><div class="rule"></div>'
                f'<div class="line"{vis}><span>TOTAL</span><i></i><b class="total">$0 CHANGED HANDS</b></div>'
                f'<div class="rule"></div><div class="rf">REPORTS · MAR 2026</div></div>')
    add('l13', W, [(page(W, void(False, False), None), txt((vhead, 'identity', 'the deal'), ('REPORTS · MAR 2026', 'source', 'reports'))),
                   (page(W, void(True, False), None), txt((vhead, 'identity', 'the deal'), ('VOID', 'relationship', 'the deal died'), ('REPORTS · MAR 2026', 'source', 'reports'))),
                   (page(W, void(True, True), None), txt((vhead, 'identity', 'the deal'), ('VOID', 'relationship', 'the deal died'), ('TOTAL $0 CHANGED HANDS', 'quantity', 'nothing was paid'), ('REPORTS · MAR 2026', 'source', 'reports')))])
    add('l15', W, [(capture_page(W, 'disney-cto', [0], 'DISNEY\'S FIRST CTO', 'SEPT 2026', records),
                    txt(('DISNEY\'S FIRST CTO', 'identity', 'the new role'), ('newly created position', 'source', 'Disney\'s release'), ('SEPT 2026', 'source', 'when')))])
    r2h = 'DISNEY · OCT 2026'
    add('l16', W, [(page(W, receipt(r2h, R2_LONG_LINES, 'COURT FILINGS VIA GIZMODO', 0), None), txt((r2h, 'identity', 'who is paying and when'), ('COURT FILINGS VIA GIZMODO', 'source', 'the filings'))),
                   (page(W, receipt(r2h, R2_LONG_LINES, 'COURT FILINGS VIA GIZMODO', 1), None),
                    txt((r2h, 'identity', 'who is paying and when'), ('66 STAFF ~$60M A YEAR × 3 YEARS', 'quantity', 'the team and its pay'), ('COURT FILINGS VIA GIZMODO', 'source', 'the filings')))])
    add('l17', W, [(page(W, receipt(r2h, R2_LONG_LINES, 'WIRED · COURT FILINGS', 2), None),
                    txt((r2h, 'identity', 'who'), ('66 STAFF ~$60M A YEAR × 3 YEARS', 'quantity', 'the team'), ('THE CODE (OPENING BID) $20M', 'quantity', 'the code\'s price'),
                        ('trust and safety tools age prediction', 'identity', 'what the code is'), ('WIRED · COURT FILINGS', 'source', 'sources')))])
    add('l19', W, [(capture_page(W, 'bw-date', [0], None, 'BUSINESS WIRE · 12 OCT 2026', records),
                    txt(('Oct 12, 2026', 'source', 'the dateline'), ('BUSINESS WIRE · 12 OCT 2026', 'source', 'where'))),
                   (capture_page(W, 'bw-date', [0], 'CHAPTER 11 · 12 OCT', 'BUSINESS WIRE · 12 OCT 2026', records),
                    txt(('CHAPTER 11 · 12 OCT', 'identity', 'which bankruptcy and when'), ('Oct 12, 2026', 'source', 'the dateline'), ('BUSINESS WIRE · 12 OCT 2026', 'source', 'where')))])
    cf = 'COURT FILING · CASE 26-11603 · OCT 2026'
    add('l20', W, [(capture_page(W, 'court-filing', [], 'CASH · LAWSUITS', cf, records),
                    txt(('CASH · LAWSUITS', 'relationship', 'the two reasons'), (cf, 'source', 'the filing'))),
                   (capture_page(W, 'court-filing', [0], 'CASH · LAWSUITS', cf, records),
                    txt(('CASH · LAWSUITS', 'relationship', 'the two reasons'), ('diminishing cash reserve', 'source', 'the filing\'s words'), (cf, 'source', 'the filing'))),
                   (capture_page(W, 'court-filing', [0, 1], 'CASH · LAWSUITS', cf, records),
                    txt(('CASH · LAWSUITS', 'relationship', 'the two reasons'), ('diminishing cash reserve', 'source', 'the filing\'s words'), ('litigation and regulatory risks', 'source', 'the filing\'s words'), (cf, 'source', 'the filing')))])
    def money_map(moved, size='m', label=None):
        left = box(['THE PEOPLE', 'THE CODE', 'THE LAWSUITS'] if not moved else ['THE LAWSUITS'], size=size)
        right = (f'<div class="col">{logo("disney-script-cream.svg", 120)}' +
                 (''.join(f'<span class="pill" style="border-color:#7EF0C0">{p}</span>' for p in ('THE PEOPLE', 'THE CODE')) if moved else
                  '<span class="pill dim">THE PEOPLE</span><span class="pill dim">THE CODE</span>') + '</div>')
        arrow = '<div class="arrow"></div>' if moved else '<div style="width:200px"></div>'
        return f'<div class="row" style="gap:36px">{left}{arrow}{right}</div>'
    add('l21', W, [(page(W, money_map(False), None, 'COURT FILINGS'),
                    txt(('THE PEOPLE THE CODE THE LAWSUITS', 'identity', 'what sits in the firm'), ('COURT FILINGS', 'source', 'filings'))),
                   (page(W, money_map(True), 'PEOPLE + CODE → DISNEY', 'COURT FILINGS'),
                    txt(('PEOPLE + CODE → DISNEY', 'relationship', 'what moves'), ('THE LAWSUITS', 'identity', 'what stays'), ('THE PEOPLE THE CODE', 'identity', 'moved'), ('COURT FILINGS', 'source', 'filings')))])
    def emptybox(labels, label=None, source=None):
        return page(W, box(['THE APP', 'USERS’ CHATS', 'THE LAWSUITS'], dim=[l for l in ['THE APP', 'USERS’ CHATS', 'THE LAWSUITS'] if l not in labels]), label, source)
    add('l23', W, [(emptybox([], None, 'COURT FILING · OCT 2026'), txt(('COURT FILING · OCT 2026', 'source', 'filing'))),
                   (emptybox(['THE APP'], None, 'COURT FILING · OCT 2026'), txt(('THE APP', 'identity', 'left in the box'), ('COURT FILING · OCT 2026', 'source', 'filing'))),
                   (emptybox(['THE APP', 'USERS’ CHATS'], 'NOT IN DISNEY’S BID', 'COURT FILING · OCT 2026'),
                    txt(('NOT IN DISNEY’S BID', 'relationship', 'why they are left'), ('THE APP USERS’ CHATS', 'identity', 'left in the box'), ('COURT FILING · OCT 2026', 'source', 'filing')))])
    add('l24', W, [(emptybox(['THE APP', 'USERS’ CHATS', 'THE LAWSUITS'], 'THE LAWSUITS STAY', 'CBS NEWS · OCT 2026'),
                    txt(('THE LAWSUITS STAY', 'relationship', 'what stays behind'), ('THE APP USERS’ CHATS THE LAWSUITS', 'identity', 'the box'), ('CBS NEWS · OCT 2026', 'source', 'report')))])
    def one_picture():
        r1 = receipt('GOOGLE · 2024', [('THE FOUNDERS', '$2.7B', True, [])], '', 1, 'xs')
        r2 = receipt('DISNEY · 2026', [('THE TEAM', '$60M/YR', True, []), ('THE CODE', '$20M', True, [])], '', 2, 'xs')
        bx = f'<div class="col">{box([], size="s")}<span class="money" style="background:#F4EFE4">$0</span></div>'
        return f'<div class="row" style="gap:40px;align-items:flex-start">{r1}{r2}{bx}</div>'
    add('l25', W, [(page(W, one_picture(), None, 'WIRED · GIZMODO · COURT FILINGS'),
                    txt(('GOOGLE · 2024 THE FOUNDERS $2.7B', 'quantity', 'receipt one'), ('DISNEY · 2026 THE TEAM $60M/YR THE CODE $20M', 'quantity', 'receipt two'), ('$0', 'quantity', 'the box got nothing'), ('WIRED · GIZMODO · COURT FILINGS', 'source', 'sources')))])
    def pairs(n):
        a = (f'<div class="pair">{logo("netflix.svg", 120)}<div><div class="t">INTERPOSITIVE · $587M</div><div class="s">(REPORTED) · THE HOLLYWOOD REPORTER</div></div></div>')
        b = (f'<div class="pair{"" if n > 1 else " hide"}">{logo("warner-music-group-cream.svg", 110)}<div><div class="t">SUREEL AI · JUNE 2026</div><div class="s">PR NEWSWIRE</div></div></div>')
        return f'<div class="col" style="align-items:flex-start;gap:0">{a}{b}</div>'
    add('l26', W, [(page(W, pairs(1), 'NETFLIX · WARNER MUSIC'), txt(('NETFLIX · WARNER MUSIC', 'identity', 'the buyers'), ('INTERPOSITIVE · $587M', 'quantity', 'what Netflix bought, reported price'), ('(REPORTED) THE HOLLYWOOD REPORTER', 'source', 'source'))),
                   (page(W, pairs(2), 'NETFLIX · WARNER MUSIC'), txt(('NETFLIX · WARNER MUSIC', 'identity', 'the buyers'), ('INTERPOSITIVE · $587M', 'quantity', 'Netflix'), ('SUREEL AI · JUNE 2026', 'identity', 'what Warner bought and when'), ('(REPORTED) THE HOLLYWOOD REPORTER', 'source', 'source'), ('PR NEWSWIRE', 'source', 'source')))])
    add('l27', W, [(page(W, '', 'RENTING → OWNING', layout='typeset'), txt(('RENTING → OWNING', 'relationship', 'the change in one turn')))])
    slots = [('skydance-cream.svg', 140, 'PARAMOUNT'), ('universal-music-group-cream.svg', 140, ''), ('comcast-cream.svg', 140, 'NBCUNIVERSAL')]
    def slot_row(n, w=W):
        cells = ''.join(f'<div class="slot{"" if i < n else " hide"}"><div style="background:#0C1512;padding:16px;border-radius:6px">{logo(f, h, w=268)}</div><small>{c}</small><div class="blank"></div><div class="blank"></div><div class="blank"></div></div>'
                        for i, (f, h, c) in enumerate(slots))
        return f'<div class="row" style="gap:34px">{cells}</div>'
    add('l28', W, [(page(W, slot_row(k)), txt(*[(n, 'identity', 'a predicted buyer') for n in ['SKYDANCE PARAMOUNT', 'UNIVERSAL MUSIC GROUP', 'COMCAST NBCUNIVERSAL'][:k]])) for k in (1, 2, 3)])
    def prediction(pct, w=W):
        logos_ = ''.join(logo(f, 150, w=330) for f in ('skydance-cream.svg', 'universal-music-group-cream.svg', 'comcast-cream.svg'))
        p = f'<div class="huge">75%</div>' if pct else '<div class="huge" style="visibility:hidden">75%</div>'
        return page(w, f'<div class="col" style="gap:40px"><div class="big" style="font-size:120px">BY 1 MARCH 2027</div><div class="row" style="gap:40px">{logos_}</div>{p}</div>', None, 'OUR PREDICTION')
    add('l29', W, [(prediction(False), txt(('BY 1 MARCH 2027', 'identity', 'the deadline'), ('SKYDANCE UNIVERSAL MUSIC GROUP COMCAST', 'identity', 'the three'), ('OUR PREDICTION', 'source', 'whose call'))),
                   (prediction(True), txt(('BY 1 MARCH 2027', 'identity', 'the deadline'), ('SKYDANCE UNIVERSAL MUSIC GROUP COMCAST', 'identity', 'the three'), ('75%', 'quantity', 'how sure'), ('OUR PREDICTION', 'source', 'whose call')))])
    add('l31', W, [(capture_page(W, 'sora-shut', [0], None, 'OPENAI · 24 MAR 2026', records),
                    txt(('shuttering its stand-alone', 'source', 'the report'), ('OPENAI · 24 MAR 2026', 'source', 'when'))),
                   (capture_page(W, 'sora-shut', [0], 'IT HAPPENED TO DISNEY', 'OPENAI · 24 MAR 2026', records),
                    txt(('IT HAPPENED TO DISNEY', 'relationship', 'the warning is real'), ('shuttering its stand-alone', 'source', 'the report'), ('OPENAI · 24 MAR 2026', 'source', 'when')))])
    checks = [('1', 'FOUNDERS STILL THERE?', 'AUG 2024 → OCT 2026', 'WIRED'),
              ('2', 'MAIN PRODUCT OR SIDE BET?', 'SORA · SHUT 24 MAR 2026', 'OPENAI'),
              ('3', 'SHORT OF CASH?', '“diminishing cash reserve”', 'COURT FILING'),
              ('4', 'COLLECTING LAWSUITS?', '', 'COURT FILING')]
    for i, (n, q, proof, src) in enumerate(checks):
        dots = '<div class="dots">' + ''.join(f'<span class="{"on" if j <= i else ""}"></span>' for j in range(4)) + '</div>'
        body = f'<div class="col" style="gap:40px"><div class="card"><div class="n">{n}</div><div class="q">{esc(q)}</div>{f"<div class=proof>{esc(proof)}</div>" if proof else ""}</div>{dots}</div>'
        items = [(f'{n} · {q}', 'relationship', 'the question to ask')] + ([(proof, 'quantity', 'the proof from this story')] if proof else []) + [(src, 'source', 'source')]
        add(f'l{33 + i}', W, [(page(W, body, None, src), txt(*items))])
    add('l37', W, [(page(W, '', 'PLAN B · YOUR DATA', layout='typeset'), txt(('PLAN B · YOUR DATA', 'identity', 'the two things to have ready')))])
    endc = (f'<div class="col" style="gap:46px"><img style="width:760px" src="{brand.brand_uri("wordmark", full=True)}">'
            f'<div class="mono" style="color:#FFD84D;font-size:46px">follow.the.money</div><div class="big" style="font-size:110px">MAKEYOURMINDUP.AI</div></div>')
    add('l38', W, [(page(W, endc, None), txt(('makeyourmindup', 'identity', 'the brand'), ('follow.the.money', 'identity', 'the series'), ('MAKEYOURMINDUP.AI', 'identity', 'where the deep dive is')))])

    # ---------------- 90-second cut (9:16)
    def logos3t(order):
        cells = ''.join(f'<div style="width:320px;display:flex;justify-content:center;{"" if n in order else "visibility:hidden"}">{logo(f, h, w=300)}</div>'
                        for n, (f, h) in enumerate([('google-wordmark.svg', 110), ('characterai-cream.svg', 110), ('disney-script-cream.svg', 130)]))
        return f'<div class="row" style="gap:20px">{cells}</div>'
    add('s02', T, [(page(T, logos3t({1}), None), txt()), (page(T, logos3t({0, 1}), None), txt()),
                   (page(T, logos3t({0, 1, 2}), 'TWO BUYERS'), txt(('TWO BUYERS', 'relationship', 'two firms paid')))])
    r1s = [('USE OF THE TECH', '$2.7B (REPORTED)', True, []), ('HIRES: THE FOUNDERS', '', False, [])]
    add('s03', T, [(page(T, receipt('GOOGLE · 2024', r1s, 'WIRED', k), None),
                    txt(*([('GOOGLE · 2024', 'identity', 'who and when')] + [('USE OF THE TECH $2.7B (REPORTED)', 'quantity', 'price'), ('HIRES: THE FOUNDERS', 'relationship', 'people')][:k] + [('WIRED', 'source', 'report')])))
                   for k in (0, 1, 2)])
    add('s04', T, [(capture_page(T, 'sora-shut', [0], None, 'OPENAI · 24 MAR 2026', records),
                    txt(('shuttering its stand-alone', 'source', 'the report'), ('OPENAI · 24 MAR 2026', 'source', 'when'))),
                   (capture_page(T, 'sora-shut', [0], 'SORA SHUT', 'OPENAI · 24 MAR 2026', records),
                    txt(('SORA SHUT', 'relationship', 'outcome'), ('shuttering its stand-alone', 'source', 'the report'), ('OPENAI · 24 MAR 2026', 'source', 'when')))])
    r2s = [('66 STAFF', '~$60M A YEAR', True, [])]
    add('s05', T, [(page(T, receipt('DISNEY · 2026', r2s, 'COURT FILINGS VIA GIZMODO', k), None),
                    txt(*([('DISNEY · 2026', 'identity', 'who')] + ([('66 STAFF ~$60M A YEAR', 'quantity', 'the team and its pay')] if k else []) + [('COURT FILINGS VIA GIZMODO', 'source', 'filings')])))
                   for k in (0, 1)])
    def money_map_t(moved, label=None):
        left = box(['THE PEOPLE', 'THE LAWSUITS'] if not moved else ['THE LAWSUITS'], size='s')
        right = f'<div class="col">{logo("disney-script-cream.svg", 90)}<span class="pill{"" if moved else " dim"}" style="border-color:#7EF0C0">THE PEOPLE</span></div>'
        arrow = '<div class="arrow" style="width:110px"></div>' if moved else '<div style="width:110px"></div>'
        return page(T, f'<div class="row" style="gap:30px">{left}{arrow}{right}</div>', label, 'COURT FILINGS')
    add('s06', T, [(money_map_t(False), txt(('THE PEOPLE THE LAWSUITS', 'identity', 'what sits in the firm'), ('COURT FILINGS', 'source', 'filings'))),
                   (money_map_t(True, 'LAWSUITS STAY BEHIND'), txt(('LAWSUITS STAY BEHIND', 'relationship', 'what stays'), ('THE LAWSUITS THE PEOPLE', 'identity', 'the split'), ('COURT FILINGS', 'source', 'filings')))])
    def pred_t(n, pct):
        ls = ['skydance-cream.svg', 'universal-music-group-cream.svg', 'comcast-cream.svg']
        cells = ''.join(f'<div style="{"" if i < n else "visibility:hidden"}">{logo(f, 140, w=300)}</div>' for i, f in enumerate(ls))
        p = f'<div class="huge" style="font-size:240px;{"" if pct else "visibility:hidden"}">75%</div>'
        return page(T, f'<div class="col" style="gap:34px"><div class="big" style="font-size:104px">BY MAR 2027</div><div class="row" style="gap:30px">{cells}</div>{p}</div>', None, 'OUR PREDICTION')
    names = ['SKYDANCE', 'UNIVERSAL MUSIC GROUP', 'COMCAST']
    add('s07', T, [(pred_t(n, pct), txt(*([('BY MAR 2027', 'identity', 'deadline')] + [(x, 'identity', 'a predicted buyer') for x in names[:n]] + ([('75%', 'quantity', 'how sure')] if pct else []) + [('OUR PREDICTION', 'source', 'whose call')])))
                   for n, pct in ((0, False), (1, False), (2, False), (3, False), (3, True))])
    qs = ['FOUNDERS?', 'MAIN PRODUCT?', 'CASH?', 'LAWSUITS?']
    def mini(k):
        cards = ''.join(f'<div class="minicard{"" if i < k else " hide"}"><div class="n">{i + 1}</div><b>{q}</b></div>' for i, q in enumerate(qs))
        return page(T, f'<div class="mini">{cards}</div>', None, 'THIS STORY')
    add('s09', T, [(mini(k), txt(*([(f'{i + 1} {q}', 'relationship', 'a question to ask') for i, q in enumerate(qs[:k])] + [('THIS STORY', 'source', 'the proof is in this story')]))) for k in (1, 2, 3, 4)])
    endt = (f'<div class="col" style="gap:40px"><img style="width:720px" src="{brand.brand_uri("wordmark", full=True)}">'
            f'<div class="mono" style="color:#FFD84D;font-size:46px">follow.the.money</div><div class="big" style="font-size:96px">MAKEYOURMINDUP.AI</div></div>')
    add('s10', T, [(page(T, endt, None), txt(('makeyourmindup', 'identity', 'the brand'), ('follow.the.money', 'identity', 'the series'), ('MAKEYOURMINDUP.AI', 'identity', 'where the deep dive is')))])
    return P


EXTRA = '''main.typeset{gap:46px}main.typeset .label{font-size:96px}main.\\39x16.typeset .label{font-size:100px}'''

CHECK = '''() => { const bad = []; const W = innerWidth, H = innerHeight;
  for (const e of document.querySelectorAll('.label,.stage,.stage *,.source')) {
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || e.closest('[style*="visibility:hidden"]')) continue;
    const r = e.getBoundingClientRect(); if (!r.width) continue;
    if (r.left < 20 || r.top < 16 || r.right > W - 20 || r.bottom > H - 16) bad.push([e.className || e.tagName, Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]);
  } return bad.slice(0, 6); }'''


def main():
    records = {r['id']: r for r in json.loads((CAPS / 'captures.json').read_text(encoding='utf-8'))}
    panels = build(records)
    OUT.mkdir(parents=True, exist_ok=True)
    fonts = brand.font_css()
    manifest = {}
    with brand.playwright() as p:
        browser = brand.browser(p)
        pages_by_shape = {s: browser.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1) for s, (w, h) in SIZE.items()}
        for pid, spec in panels.items():
            pg = pages_by_shape[spec['shape']]
            files = []
            for k, (body, texts) in enumerate(spec['pages'], 1):
                name = f'{pid}-{spec["shape"]}.png' if len(spec['pages']) == 1 else f'{pid}-p{k}-{spec["shape"]}.png'
                pg.set_content(f'<!doctype html><meta charset="utf-8"><style>{fonts}\n{CSS}\n{EXTRA}</style><body>{body}</body>')
                pg.evaluate('document.fonts.ready')
                pg.wait_for_timeout(120)
                bad = pg.evaluate(CHECK)
                if bad:
                    raise SystemExit(f'{name}: drawn outside the panel: {bad}')
                pg.screenshot(path=str(OUT / name))
                cap = pg.evaluate("(() => { const e = document.querySelector('.cap'); if (!e) return null; "
                                  "const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()")
                files.append({'file': name, 'text': texts, **({'capture_box': cap} if cap else {})})
            manifest[pid] = {'shape': spec['shape'], 'pages': files}
        # The 90-second cut's opening label sits over his full-frame face (make.py's tall "strap"), clear of
        # the captions at the top: the whole 1080 x 1920 frame, transparent but for the label.
        strap = browser.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
        strap.set_content(f'<!doctype html><meta charset="utf-8"><style>{fonts}\n{CSS}\nbody{{background:transparent}}'
                          '.lower{position:absolute;left:50%;top:1290px;transform:translateX(-50%);background:#0C1512;'
                          'padding:34px 46px 38px;border-radius:8px;box-shadow:12px 12px 0 #FFD84D;display:flex;flex-direction:column;'
                          f'align-items:center;gap:20px}}</style><body><div class="lower">{logo("characterai-cream.svg", 84, w=420)}'
                          '<div class="label" style="font-size:80px">CHARACTER.AI · CHAPTER 11</div></div></body>')
        strap.evaluate('document.fonts.ready')
        strap.wait_for_timeout(120)
        strap.screenshot(path=str(OUT / 's01-strap-9x16.png'), omit_background=True)
        manifest['s01'] = {'shape': '9x16', 'pages': [{'file': 's01-strap-9x16.png', 'strap': True, 'text': [
            {'value': 'CHARACTER.AI · CHAPTER 11', 'role': 'identity', 'adds': 'names the firm and its bankruptcy chapter'}]}]}
        browser.close()
    for pid, seconds in PUSH.items():
        push(manifest[pid], seconds)
    (OUT / 'panels.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'drew {sum(len(v["pages"]) for v in manifest.values())} pages for {len(manifest)} beats; every page inside its panel')


# The single-page documents push in slowly (receipts.md: 5% across the beat), about the beat's length
# in his take; the clip then holds its last frame, so a longer window never restarts the push.
PUSH = {'l03': 6.9, 'l08': 5.2, 'l15': 12.6}


def push(spec, seconds):
    """The panel with only its capture pushed in 5% over `seconds`, as an mp4 make.py plays like a picture."""
    import subprocess
    page = spec['pages'][0]
    x, y, w, h = (round(v) for v in page['capture_box'])
    src = OUT / page['file']
    out = OUT / page['file'].replace(f'-{spec["shape"]}.png', f'-push-{spec["shape"]}.mp4')
    frames = round(seconds * 24)
    hold = frames + 48
    graph = (f"[0:v]split[bg][c];[c]crop={w}:{h}:{x}:{y},scale={w * 2}:{h * 2}:flags=lanczos,"
             f"zoompan=z='1+0.05*min(on,{frames})/{frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={w}x{h}:fps=24[z];"
             f"[bg][z]overlay={x}:{y},format=yuv420p[v]")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '24', '-i', str(src), '-filter_complex', graph,
                    '-map', '[v]', '-frames:v', str(hold), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', str(out)], check=True)
    page['push'] = {'file': out.name, 'seconds': seconds, 'zoom': [1.0, 1.05]}


if __name__ == '__main__':
    main()
