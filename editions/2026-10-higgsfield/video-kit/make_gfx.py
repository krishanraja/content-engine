#!/usr/bin/env python3
"""make_gfx: the graphics kit for "Higgsfield, taken apart" (under.the.hood,
2026-10-07), in the look of the article's explainer pictures.

    python3 make_gfx.py [--only sora,inside,...] [--no-video]

Writes into this folder:
  gfx/hf-<id>-9x16.png   1080 x 1000, the tall panel
  gfx/hf-<id>-16x9.png   1314 x 1080, the wide panel
  gfx/hf-frame-16x9.png  1920 x 1080, the wide background (speaker column x 657 to 1263 left plain)
  gfx/hf-strap-9x16.png  1080 x 1920, transparent name strap
  endcard-9x16.png/.mp4 and endcard-16x9.png/.mp4  4 seconds, 30 fps, silent stereo AAC

Every image is drawn from HTML in Chromium (Playwright) at its exact pixel
size, with the house fonts and logos from scripts/pages/brand.py. After each
render it checks that nothing runs past the edge of the image.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(os.environ.get('CONTENT_ENGINE', '/home/user/content-engine'))
# In the cloud container Playwright's default browser build is missing; use the
# Chromium that is there. Elsewhere brand.browser() finds its own.
_CLOUD_CHROME = Path('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
if _CLOUD_CHROME.exists():
    os.environ.setdefault('MYMU_BROWSER', str(_CLOUD_CHROME))
sys.path.insert(0, str(REPO / 'scripts' / 'pages'))
import brand  # noqa: E402

HERE = Path(__file__).resolve().parent
GFX = HERE / 'gfx'

H = brand.house()
TOK = H['tokens']
INK, CREAM, MINT = TOK['ink'], TOK['cream'], TOK['mint']
LAV = brand.channel(H, 'under.the.hood')['accent']  # #B7A6FF
CORAL = '#FF6A4D'
GREEN, RED, GOLD = '#1F7A55', '#D9452B', '#93700A'
SHADOW = '#8476C9'

SQUIGGLE = ('<svg class="squig" viewBox="0 0 120 110" aria-hidden="true"><path d="M8 34 C 30 4, 64 6, 56 30 '
            'C 48 54, 16 70, 30 88 C 42 104, 70 84, 74 62 C 78 40, 104 34, 112 56 C 118 74, 100 92, 86 80" '
            f'fill="none" stroke="{INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>')

BASE_CSS = f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ width: var(--W); height: var(--H); overflow: hidden; }}
body {{ background: {LAV}; color: {INK}; font-family: 'Archivo', sans-serif; -webkit-font-smoothing: antialiased; }}
body.clear {{ background: transparent; }}
body.ink {{ background: {INK}; color: {CREAM}; }}
.wrap {{ position: absolute; inset: 0; padding: var(--pad); display: flex; flex-direction: column; }}
.top {{ display: flex; align-items: center; justify-content: space-between; }}
.pill {{ display: inline-block; background: {INK}; color: {CREAM}; font-family: 'IBM Plex Mono', monospace; font-weight: 700;
        font-size: var(--pill); letter-spacing: .08em; padding: .34em .62em .3em; border-radius: .26em; line-height: 1; }}
.squig {{ width: var(--squig); height: auto; }}
h1 {{ font-family: 'Anton', sans-serif; font-weight: 400; text-transform: uppercase; font-size: var(--h);
      line-height: .95; letter-spacing: .005em; margin-top: var(--gap1); }}
.card {{ background: {INK}; border-radius: 30px; padding: var(--cardpad); margin-top: var(--gap2);
         box-shadow: 16px 16px 0 {SHADOW}; display: flex; flex-direction: column; gap: var(--rowgap); }}
.row {{ background: {CREAM}; color: {INK}; border-radius: 20px; padding: var(--rowpad);
        display: flex; align-items: center; justify-content: space-between; gap: 24px; }}
.row .txt {{ flex: 1; min-width: 0; }}
.tag {{ font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: var(--tag); letter-spacing: .06em;
        text-transform: uppercase; color: #4B5550; margin-bottom: .35em; }}
.big {{ font-weight: 800; font-size: var(--big); line-height: 1.08; letter-spacing: -.012em; }}
.mid {{ font-weight: 600; font-size: var(--mid); line-height: 1.12; letter-spacing: -.01em; }}
/* No lone word on a line of its own. */
.big, .mid, .cardhead, .tl {{ text-wrap: balance; }}
.src {{ font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: var(--src); margin-top: var(--gap3); }}
.stamp {{ flex: none; font-family: 'Archivo', sans-serif; font-weight: 900; font-size: var(--stamp); letter-spacing: .06em;
          border: .12em solid currentColor; border-radius: .14em; padding: .08em .32em .02em; transform: rotate(-3deg);
          line-height: 1.05; }}
.stamp.real {{ color: {GREEN}; }} .stamp.gold {{ color: {GOLD}; }} .stamp.theatre {{ color: {RED}; transform: rotate(-4deg); }}
.chips {{ display: flex; flex-wrap: wrap; gap: var(--chipgap); margin-top: .5em; }}
.chip {{ font-weight: 700; font-size: var(--chip); border: 4px solid {INK}; border-radius: 999px; padding: .12em .62em .14em; line-height: 1.1; }}
.cardhead {{ color: {CREAM}; font-weight: 800; font-size: var(--big); line-height: 1.1; letter-spacing: -.012em; }}
.cardtag {{ color: {LAV}; font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: var(--tag); letter-spacing: .06em;
            text-transform: uppercase; }}
.barlabel {{ color: {CREAM}; font-weight: 700; font-size: var(--mid); line-height: 1.1; margin-bottom: .3em; }}
.bar {{ background: #26302C; border-radius: 16px; height: var(--barh); overflow: hidden; }}
.bar > div {{ height: 100%; border-radius: 16px; display: flex; align-items: center; padding-left: .5em;
              font-weight: 900; font-size: var(--barfs); color: {INK}; white-space: nowrap; }}
"""

# Sizes per shape: the tall panel is 1080 x 1000, the wide one 1314 x 1080.
SIZES = {
    '9x16': dict(W=1080, H=1000, pad='56px 60px 50px', pill='30px', squig='92px', h='132px', gap1='22px', gap2='34px',
                 cardpad='26px', rowgap='18px', rowpad='22px 30px', tag='26px', big='60px', mid='48px', src='26px',
                 gap3='26px', stamp='50px', chip='40px', chipgap='12px', barh='96px', barfs='54px'),
    '16x9': dict(W=1314, H=1080, pad='64px 72px 56px', pill='32px', squig='104px', h='150px', gap1='24px', gap2='40px',
                 cardpad='30px', rowgap='20px', rowpad='26px 36px', tag='28px', big='68px', mid='54px', src='28px',
                 gap3='30px', stamp='56px', chip='46px', chipgap='14px', barh='108px', barfs='60px'),
}


def head(title, squiggle=True):
    return (f'<div class="top"><span class="pill">UNDER.THE.HOOD</span>{SQUIGGLE if squiggle else ""}</div>'
            f'<h1 data-fit="2">{title}</h1>')


def panel_sora(a):
    return head('Why Sora closed') + f"""
<div class="card">
  <div class="row"><div class="txt"><div class="tag">OpenAI</div>
    <div class="mid">&ldquo;the Sora research team&nbsp;&hellip; to advance robotics&rdquo;</div></div></div>
  <div class="row"><div class="txt"><div class="tag">WSJ</div>
    <div class="big">About $1m a day to run</div></div></div>
  <div class="row"><div class="txt"><div class="tag">WSJ</div>
    <div class="big">Users: about 1m to under 500k</div></div></div>
</div>
<div class="src">Sources: OpenAI; The Wall Street Journal</div>"""


def panel_inside(a):
    chips = ''.join(f'<span class="chip">{n}</span>' for n in ['ByteDance', 'Alibaba', 'MiniMax', 'xAI', 'Kling', 'Google'])
    return head('What&rsquo;s inside Higgsfield') + f"""
<div class="card">
  <div class="row"><div class="txt"><div class="big">Mostly other companies&rsquo; AI</div>
    <div class="chips">{chips}</div></div></div>
  <div class="row"><div class="txt"><div class="mid">Sora was one engine on the menu</div></div></div>
</div>"""


def panel_keeps(a):
    return head('Who keeps what') + f"""
<div class="card" style="gap: calc(var(--rowgap) * 1.4)">
  <div class="cardhead">Higgsfield picks the engine in over 40% of jobs</div>
  <div class="cardtag">What it keeps from each sale</div>
  <div><div class="barlabel">Its own and open models</div>
    <div class="bar"><div style="width:84%; background:{MINT}">over 80%</div></div></div>
  <div><div class="barlabel">Rented big-name models</div>
    <div class="bar"><div style="width:{'40' if a == '9x16' else '36'}%; background:{CORAL}">20 to 30%</div></div></div>
</div>"""


def panel_billion(a):
    return head('The billion') + f"""
<div class="card">
  <div class="row"><div class="txt"><div class="tag">How the number is made</div>
    <div class="big">Last 4 weeks of sales <span class="nw">&times; 13</span></div></div></div>
  <div class="row"><div class="txt"><div class="big"><span class="nw">= $1bn</span> <span class="nw">a year pace</span></div></div>
    <div class="sh"><div class="stamp gold">REAL*</div></div></div>
</div>
<div class="src" style="font-size:var(--src2)">* A pace, not a banked year</div>"""


def panel_theatre(a):
    return f"""<div class="top"><span class="pill">UNDER.THE.HOOD</span>{SQUIGGLE}</div>
<div class="quote">
  <h1 data-fit="1" style="text-transform:none; font-size: calc(var(--h) * 1.15)">&ldquo;We don&rsquo;t do paid.&rdquo;</h1>
  <div class="qline"><div class="src" style="margin-top:0">Higgsfield&rsquo;s founder, on a podcast</div>
  <div class="sh"><div class="stamp theatre">THEATRE</div></div></div>
</div>
<div class="card">
  <div class="row"><div class="txt"><div class="tag">What he went on to say</div>
    <div class="big">Influencers: a fee per video + pay per click</div></div></div>
</div>"""


def panel_call(a):
    return head('Our call') + f"""
<div class="card">
  <div class="row"><div class="txt"><div class="big">By 30 June 2027, Higgsfield raises money at a <span class="nw">$10bn+ valuation</span></div></div></div>
  <div class="pct"><span class="num">85%</span><span class="sure">sure</span></div>
</div>"""


PANEL_CSS = f"""
.quote {{ position: relative; }}
.nw {{ white-space: nowrap; }}
/* room for a rotated stamp's corners, so it never counts as overflow */
.sh {{ flex: none; padding: 14px; margin: -14px 0; }}
.qline {{ display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 18px; }}
.qline .src {{ white-space: nowrap; }}
.quote .stamp {{ font-size: calc(var(--stamp) * 1.25); }}
.pct {{ display: flex; align-items: baseline; gap: 26px; padding: 0 10px; }}
.pct .num {{ font-family: 'Anton', sans-serif; color: {MINT}; font-size: calc(var(--h) * 1.5); line-height: 1; }}
.pct .sure {{ font-family: 'Anton', sans-serif; color: {CREAM}; font-size: calc(var(--h) * .75); text-transform: uppercase; line-height: 1; }}
"""

# Per-panel size changes on top of SIZES, so each fills its space without crowding.
PANEL_VARS = {
    'sora': {'9x16': dict(big='54px', mid='44px', rowpad='18px 28px', rowgap='14px'),
             '16x9': dict(big='62px', mid='50px', rowgap='16px', gap2='34px')},
    'inside': {'9x16': dict(chip='42px', big='62px', mid='52px'), '16x9': dict(chip='48px', mid='58px')},
    'keeps': {'9x16': dict(), '16x9': dict(big='62px', mid='50px', barh='96px', rowgap='16px', gap2='34px')},
    'billion': {'9x16': dict(big='64px', src2='38px', rowpad='34px 32px', stamp='58px', gap2='44px'),
                '16x9': dict(big='72px', src2='42px', rowpad='40px 40px', stamp='64px', gap2='50px')},
    'theatre': {'9x16': dict(big='68px', rowpad='30px 32px', stamp='42px', gap2='56px', src='28px'),
                '16x9': dict(big='76px', rowpad='36px 40px', stamp='52px', gap2='70px', src='30px')},
    'call': {'9x16': dict(big='60px'), '16x9': dict(big='66px')},
}

PANELS = {'sora': panel_sora, 'inside': panel_inside, 'keeps': panel_keeps, 'billion': panel_billion,
          'theatre': panel_theatre, 'call': panel_call}


def frame16():
    wm = brand.brand_uri('wordmark', full=True)
    return dict(W=1920, H=1080), f"""
<div class="fl"><span class="pill">UNDER.THE.HOOD</span>
  <h1 data-fit="3">Higgsfield,<br>taken apart</h1>
  {SQUIGGLE}</div>
<div class="fr"><div class="inkcard">
  <img src="{wm}" alt="makeyourmindup">
  <div class="day">Wednesdays</div>
  <div class="url">makeyourmindup.ai</div></div></div>""", f"""
.fl {{ position: absolute; left: 64px; top: 0; bottom: 0; width: 529px; display: flex; flex-direction: column; justify-content: center; }}
.fl .pill {{ align-self: flex-start; font-size: 32px; }}
.fl h1 {{ font-size: 150px; margin-top: 30px; }}
.fl .squig {{ width: 110px; margin-top: 40px; }}
.fr {{ position: absolute; left: 1263px; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; }}
.inkcard {{ width: 529px; background: {INK}; border-radius: 30px; padding: 48px 44px; box-shadow: 16px 16px 0 {SHADOW};
            display: flex; flex-direction: column; gap: 26px; }}
.inkcard img {{ width: 100%; height: auto; }}
.inkcard .day {{ color: {LAV}; font-family: 'Anton', sans-serif; text-transform: uppercase; font-size: 76px; line-height: 1; margin-top: 10px; }}
.inkcard .url {{ color: {CREAM}; font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 34px; }}
"""


def strap():
    return dict(W=1080, H=1920), """
<div class="strap"><div class="name">Krish Raja</div><div class="ch">under.the.hood</div></div>""", f"""
.strap {{ position: absolute; left: 60px; top: 1500px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }}
.name {{ background: {INK}; color: {CREAM}; font-weight: 800; font-size: 58px; line-height: 1; padding: 16px 30px 18px; border-radius: 999px; }}
.ch {{ background: {LAV}; color: {INK}; font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 38px; line-height: 1;
       padding: 12px 26px; border-radius: 999px; }}
"""


def endcard(a):
    mh = brand.brand_uri('masthead', full=True)
    days = ''.join(f'<div class="d"><span class="dn">{c["day"]}</span><span class="cn" style="color:{c["accent"]}">{c["name"]}</span></div>'
                   for c in H['channels'])
    inner = f"""
<div class="ec"><img class="mh" src="{mh}" alt="makeyourmindup">
  <div class="tl">A free publication on how AI really works. You make your mind up.</div>
  <div class="days">{days}</div>
  <div class="cta"><span class="btn">Subscribe free</span><span class="url">makeyourmindup.ai</span></div></div>"""
    if a == '9x16':
        size, css = dict(W=1080, H=1920), """
.ec { position: absolute; inset: 0; padding: 0 90px; display: flex; flex-direction: column; justify-content: center; gap: 70px; }
.mh { width: 100%; height: auto; }
.tl { font-size: 58px; font-weight: 600; line-height: 1.18; }
.days { display: flex; flex-direction: column; gap: 22px; }
.d { display: flex; flex-direction: column; gap: 4px; }
.dn { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 32px; letter-spacing: .06em; text-transform: uppercase; opacity: .8; }
.cn { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 60px; line-height: 1.1; }
.cta { display: flex; flex-direction: column; align-items: flex-start; gap: 26px; }
.btn { font-size: 60px; padding: 22px 48px; }
.url { font-size: 44px; }
"""
    else:
        size, css = dict(W=1920, H=1080), """
.ec { position: absolute; inset: 0; padding: 0 130px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 110px; row-gap: 60px;
      align-content: center; }
.mh { grid-column: 1 / 3; width: 1000px; height: auto; }
.tl { font-size: 52px; font-weight: 600; line-height: 1.2; }
.days { grid-row: 2 / 4; grid-column: 2; display: flex; flex-direction: column; gap: 26px; }
.d { display: flex; flex-direction: column; gap: 4px; }
.dn { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 28px; letter-spacing: .06em; text-transform: uppercase; opacity: .8; }
.cn { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 56px; line-height: 1.1; }
.cta { display: flex; align-items: center; gap: 40px; }
.btn { font-size: 46px; padding: 20px 40px; }
.url { font-size: 36px; }
"""
    css += f"""
.btn {{ white-space: nowrap; background: {MINT}; color: {INK}; font-weight: 800; border-radius: 999px; line-height: 1; }}
.url {{ font-family: 'IBM Plex Mono', monospace; font-weight: 700; color: {CREAM}; }}
"""
    return size, inner, css


FIT_JS = """() => {
  for (const el of document.querySelectorAll('[data-fit]')) {
    const lines = +el.dataset.fit;
    let fs = parseFloat(getComputedStyle(el).fontSize);
    const lh = () => parseFloat(getComputedStyle(el).lineHeight);
    while (fs > 24 && (el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().height > lines * lh() + 2)) {
      fs -= 2; el.style.fontSize = fs + 'px';
    }
  }
  const W = innerWidth, H = innerHeight, bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1))
      bad.push(el.tagName + '.' + el.className + ' ' + JSON.stringify([Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]));
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'hidden' && el.clientWidth)
      bad.push('overflow ' + el.tagName + '.' + el.className);
  }
  // The card's offset shadow (16px) must sit inside the image with room to spare.
  for (const el of document.querySelectorAll('.card, .inkcard')) {
    const r = el.getBoundingClientRect();
    if (r.bottom + 16 > H - 20 || r.right + 16 > W - 8) bad.push('card too close to the edge ' + Math.round(r.bottom));
  }
  return bad;
}"""


def html(size, inner, css='', body_class=''):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{brand.font_css()}\n'
            f':root{{--W:{size["W"]}px;--H:{size["H"]}px}}\n{BASE_CSS}\n{PANEL_CSS}\n{css}</style></head>'
            f'<body class="{body_class}">{inner}</body></html>')


def shoot(pg, path, size, doc, clear=False):
    pg.set_viewport_size({'width': size['W'], 'height': size['H']})
    pg.set_content(doc, wait_until='load')
    pg.evaluate('document.fonts.ready.then(() => true)')
    bad = pg.evaluate(FIT_JS)
    path.parent.mkdir(parents=True, exist_ok=True)
    pg.screenshot(path=str(path), omit_background=clear, clip={'x': 0, 'y': 0, 'width': size['W'], 'height': size['H']})
    print(('WARN ' if bad else 'ok   ') + str(path.relative_to(HERE)) + (f'  {bad}' if bad else ''))
    return not bad


def endcard_video(png, mp4):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', str(png),
                    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '4',
                    '-vf', 'fade=t=in:st=0:d=0.4:color=0x0C1512,format=yuv420p', '-r', '30',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', str(mp4)], check=True)
    print('ok   ' + str(mp4.relative_to(HERE)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma list of: ' + ','.join([*PANELS, 'frame', 'strap', 'endcard']))
    ap.add_argument('--no-video', action='store_true')
    args = ap.parse_args()
    want = set(args.only.split(',')) if args.only else None
    ok = True
    with brand.playwright() as p:
        b = brand.browser(p)
        pg = b.new_page(device_scale_factor=1)
        for pid, fn in PANELS.items():
            if want and pid not in want:
                continue
            for a, s in SIZES.items():
                vars_ = ';'.join(f'--{k}:{v}' for k, v in {**s, **PANEL_VARS[pid][a]}.items() if k not in ('W', 'H'))
                inner = f'<div class="wrap" style="{vars_}">{fn(a)}</div>'
                ok &= shoot(pg, GFX / f'hf-{pid}-{a}.png', s, html(s, inner))
        if not want or 'frame' in want:
            s, inner, css = frame16()
            ok &= shoot(pg, GFX / 'hf-frame-16x9.png', s, html(s, inner, css))
        if not want or 'strap' in want:
            s, inner, css = strap()
            ok &= shoot(pg, GFX / 'hf-strap-9x16.png', s, html(s, inner, css, 'clear'), clear=True)
        if not want or 'endcard' in want:
            for a in ('9x16', '16x9'):
                s, inner, css = endcard(a)
                ok &= shoot(pg, HERE / f'endcard-{a}.png', s, html(s, inner, css, 'ink'))
                if not args.no_video:
                    endcard_video(HERE / f'endcard-{a}.png', HERE / f'endcard-{a}.mp4')
        b.close()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
