#!/usr/bin/env python3
"""Build a week's content calendar as one self-contained, clickable HTML page.

    python3 scripts/calendar/make_calendar.py draft <Monday> --out docs/plans/<Monday>-week/calendar.json
    python3 scripts/calendar/make_calendar.py docs/plans/<Monday>-week/calendar.json \
        --krish <folder of Krish frames k1.jpg ...> [--photos <commons.json>] --out <file.html>

The page is a week view (Sunday to Saturday). Clicking a day opens its dashboard with three tabs: the idea, the road
to ready and the visuals. The visuals are branded mocks of that piece at every asset size it ships in (the YouTube
thumbnail, a frame of the long video, the Substack cover, the 9:16 cover and tall thumbnail, the 4:5 feed slide, every
carousel card), drawn in the v5 look (config/brand-palette.json: ink, cream, mint; Fraunces and DM Mono on the wide
system, Anton on the vertical, one wordmark) around real frames of Krish from his own published cuts and freely
licensed photographs, credited. They are drafts for review: the shipped files come from scripts/covers/make_covers.py
and scripts/library/make_piece.py after he records. The data file is the one source of what the page says
(.agents/skills/content-calendar/SKILL.md says how to write it). Images are embedded, so the page works offline and
can be sent as one file.
"""
import argparse
import base64
import html
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PALETTE = json.loads((ROOT / 'config' / 'brand-palette.json').read_text(encoding='utf-8')).get('colour', {}).get('v5', {})
INK, CREAM, MINT = PALETTE.get('ink', '#0C1512'), PALETTE.get('cream', '#F4EFE4'), PALETTE.get('mint', '#7EF0C0')


def embed(path, max_side=1100, quality=80):
    """A local image as a data URI, resized so the page stays light."""
    from PIL import Image  # noqa: PLC0415
    im = Image.open(path).convert('RGB')
    im.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def resolve(data, krish_dir, photos_path, base):
    """Attach embedded images to each piece: Krish's frame, and the licensed photos with their credits."""
    photos = json.loads(Path(photos_path).read_text(encoding='utf-8')) if photos_path else {}
    krish = {}
    for f in sorted(Path(krish_dir).glob('k*.jpg')) if krish_dir else []:
        krish[f.stem] = embed(f, 900)
    if not krish:
        sys.exit('make_calendar: no Krish frames (k1.jpg ...) in --krish; the mocks are built around him')
    missing = []
    for day in data['days']:
        for p in day.get('pieces') or []:
            if p.get('krish'):
                p['krish_img'] = krish.get(p['krish']) or next(iter(krish.values()))
            for key in ('photo', 'photo_tall'):
                title = p.get(key)
                if not title:
                    continue
                rec = photos.get(title) or {}
                f = rec.get('file')
                if f and (base / f).exists():
                    p[key + '_img'] = embed(base / f, 1400)
                    p.setdefault('credits', []).append(
                        f"{title[5:].rsplit('.', 1)[0]}, by {rec.get('artist') or 'unknown'}, {rec.get('lic')}, Wikimedia Commons")
                else:
                    missing.append(f'{p["id"]}: {title}')
    return missing


PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:__INK__;--cream:__CREAM__;--mint:__MINT__;--paper:#FAF7F0;--card:#fff;--line:#E5DED0;--muted:#5D6762;--faint:#8F978F;
--money:#F2D25C;--hood:#BBA8F7;--gap:#F28E6E;--off:#E9E3D6;--good:#7EF0C0;--r:14px;--sh:0 1px 2px rgba(12,21,18,.05),0 10px 30px rgba(12,21,18,.07)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--paper);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.wrap{max-width:1360px;margin:0 auto;padding:28px 24px 60px}
.top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:10px;font-family:Anton,sans-serif;font-size:19px;letter-spacing:.02em}
.bars{display:inline-flex;align-items:flex-end;gap:3px;height:18px}.bars i{width:4px;background:currentColor;border-radius:1px}
.bars i:nth-child(1){height:6px}.bars i:nth-child(2){height:10px}.bars i:nth-child(3){height:14px}.bars i:nth-child(4){height:18px;background:var(--mint)}
.brand b{background:var(--mint);color:var(--ink);padding:0 5px;border-radius:3px}
h1{font-family:Fraunces,Georgia,serif;font-weight:700;font-size:clamp(30px,4.4vw,52px);line-height:1.02;letter-spacing:-.01em;margin-top:10px}
.asof{color:var(--muted);font-size:13px;margin-top:6px}
.keys{display:flex;flex-wrap:wrap;gap:8px}
.key{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.sw{width:10px;height:10px;border-radius:3px}
/* week grid */
.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--sh);overflow:hidden}
.col{border-left:1px solid var(--line);min-height:520px;display:flex;flex-direction:column;text-align:left;transition:background .15s}
.col:first-child{border-left:0}
.ev{display:block;width:100%;text-align:left;transition:border-color .15s,box-shadow .15s}.ev:hover{border-color:var(--ink);box-shadow:0 4px 14px rgba(12,21,18,.1)}
.ev:focus-visible,.open-hint:focus-visible{outline:3px solid var(--mint);outline-offset:2px}
.col.rest{background:repeating-linear-gradient(135deg,#FBF9F4 0 10px,#F7F4EC 10px 20px);cursor:default}
.ch{padding:14px 14px 10px;border-bottom:1px solid var(--line)}
.dn{font-family:"DM Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.dd{font-family:Fraunces,serif;font-size:34px;font-weight:700;line-height:1;margin-top:2px}
.today .dd{color:#0f8f5f}
.sl{display:inline-block;margin-top:8px;font-family:"DM Mono",monospace;font-size:10px;letter-spacing:.06em;padding:3px 7px;border-radius:5px;font-weight:500}
.evs{padding:10px;display:flex;flex-direction:column;gap:10px;flex:1}
.ev{border-radius:10px;background:var(--paper);border:1px solid var(--line);overflow:hidden}
.ev .th{aspect-ratio:16/9;background:var(--ink);position:relative;overflow:hidden}
.ev .th.tall{aspect-ratio:4/5}
.ev .tx{padding:8px 10px 10px}
.ev .k{font-family:"DM Mono",monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.ev .t{font-weight:700;font-size:13px;line-height:1.25;margin-top:2px}
.ev .st{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--muted);margin-top:6px}
.dot{width:7px;height:7px;border-radius:50%;flex:none}.d-ok{background:#14a36d}.d-wait{background:#E0A526}.d-open{background:#C5BEAF}
.open-hint{margin-top:auto;padding:0 12px 12px;font-size:12px;font-weight:600;color:var(--muted);text-align:left}
.open-hint:hover{color:var(--ink)}
.restmsg{padding:14px;color:var(--muted);font-size:13px}
/* dashboard */
.scrim{position:fixed;inset:0;background:rgba(12,21,18,.42);opacity:0;pointer-events:none;transition:opacity .2s;z-index:20}
.scrim.on{opacity:1;pointer-events:auto}
.dash{position:fixed;top:0;right:0;bottom:0;width:min(1040px,94vw);background:var(--paper);z-index:21;transform:translateX(104%);transition:transform .28s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(12,21,18,.18)}
.dash.on{transform:none}
.dh{padding:18px 26px 0;background:var(--card);border-bottom:1px solid var(--line)}
.dh .row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.dh h2{font-family:Fraunces,serif;font-weight:700;font-size:clamp(22px,2.6vw,30px);line-height:1.1;margin-top:6px}
.close{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-size:20px;flex:none;background:var(--card)}
.close:hover{background:var(--paper)}
.pieces{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.pc{border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:600;background:var(--paper);max-width:100%;text-align:left}
.pc[aria-pressed=true]{background:var(--ink);color:var(--cream);border-color:var(--ink)}
.tabs{display:flex;gap:4px;margin-top:14px}
.tab{padding:10px 14px;font-weight:600;font-size:14px;color:var(--muted);border-bottom:3px solid transparent}
.tab[aria-selected=true]{color:var(--ink);border-color:var(--ink)}
.db{flex:1;overflow:auto;padding:24px 26px 60px}
.grid2{display:grid;grid-template-columns:1.25fr 1fr;gap:20px}
.box{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px}
.lab{font-family:"DM Mono",monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.q{font-family:Fraunces,serif;font-weight:700;font-size:24px;line-height:1.2}
.p{font-size:15px;margin-top:4px}
.box+.box{margin-top:14px}
.ul{margin:6px 0 0 18px}.ul li{margin:4px 0}
.human{background:var(--ink);color:var(--cream);border-color:var(--ink)}
.human .lab{color:var(--mint)}
.human .p{font-size:16px}
.krishpic{border-radius:var(--r);overflow:hidden;aspect-ratio:4/5;background:#ddd center/cover}
.src a{color:var(--ink);font-weight:600}
/* road */
.road{list-style:none;position:relative}
.road li{display:grid;grid-template-columns:34px 1fr;gap:12px;padding:0 0 18px;position:relative}
.road li::before{content:"";position:absolute;left:16px;top:30px;bottom:0;width:2px;background:var(--line)}
.road li:last-child::before{display:none}
.mk{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:14px;border:2px solid var(--line);background:var(--card)}
.done .mk{background:#14a36d;border-color:#14a36d;color:#fff}
.next .mk{background:var(--mint);border-color:var(--ink);color:var(--ink)}
.road h4{font-size:15px;margin-top:5px}
.road .w{font-size:13.5px;color:var(--muted)}
.road .who{display:inline-block;font-family:"DM Mono",monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;background:var(--paper);border:1px solid var(--line);border-radius:5px;padding:1px 6px;margin-left:6px;vertical-align:2px}
.next h4::after{content:"Next";font-family:"DM Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;background:var(--ink);color:var(--mint);border-radius:5px;padding:2px 6px;margin-left:8px;vertical-align:2px}
/* visuals */
.vgrid{display:grid;grid-template-columns:repeat(12,1fr);gap:18px}
.asset{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;display:flex;flex-direction:column;gap:10px}
.a12{grid-column:span 12}.a8{grid-column:span 8}.a7{grid-column:span 7}.a6{grid-column:span 6}.a5{grid-column:span 5}.a4{grid-column:span 4}.a3{grid-column:span 3}
.ahead{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
.ahead b{font-size:14px}.ahead span{font-family:"DM Mono",monospace;font-size:11px;color:var(--muted)}
.where{font-size:12.5px;color:var(--muted)}
.fit{position:relative;width:100%;overflow:hidden;border-radius:8px;background:#000}
.cv{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden}
.credits{margin-top:18px;font-size:12px;color:var(--faint)}
.carowrap{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
/* --- the mocks, drawn at real pixel size --- */
.cv{font-family:Inter,sans-serif;color:var(--cream)}
.mono{font-family:"DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase}
.fr{font-family:Fraunces,serif;font-weight:700;letter-spacing:-.01em}
.an{font-family:Anton,sans-serif;text-transform:uppercase;letter-spacing:.005em;line-height:1.14!important}
.hl{background:var(--mint);color:var(--ink);padding:0 .12em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.ph{position:absolute;background-size:cover;background-position:center}
.wm{position:absolute;display:flex;align-items:center;gap:.4em;font-family:Anton,sans-serif;letter-spacing:.02em}
.wm b{background:var(--mint);color:var(--ink);padding:0 .2em;border-radius:.1em}
.pill{position:absolute;font-family:Inter,sans-serif;font-weight:800;background:var(--ink);color:var(--cream);border-radius:.2em}
@media (max-width:1100px){.week{grid-template-columns:repeat(4,minmax(0,1fr))}.col{border-top:1px solid var(--line)}.col:nth-child(4n+1){border-left:0}.grid2{grid-template-columns:1fr}.a8,.a7,.a6,.a5{grid-column:span 12}.a4,.a3{grid-column:span 6}}
@media (max-width:700px){.wrap{padding:20px 16px 48px}.week{grid-template-columns:1fr}.col{border-left:0;min-height:0}.col .ch{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.dd{font-size:26px}
.dash{width:100vw}.dh{padding:14px 16px 0}.db{padding:18px 16px 48px}.a4,.a3{grid-column:span 12}.carowrap{grid-template-columns:repeat(2,1fr)}.tab{padding:10px 10px}}
@media (prefers-reduced-motion:reduce){.dash,.scrim{transition:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div><div class="brand"><span class="bars"><i></i><i></i><i></i><i></i></span>MAKE YOUR MIND/<b>UP</b></div>
      <h1 id="title"></h1><p class="asof" id="asof"></p></div>
    <div class="keys" id="keys"></div>
  </div>
  <div class="week" id="week" role="grid" aria-label="The week"></div>
  <p class="credits" id="note"></p>
</div>
<div class="scrim" id="scrim"></div>
<aside class="dash" id="dash" role="dialog" aria-modal="true" aria-labelledby="dtitle" aria-hidden="true">
  <div class="dh">
    <div class="row"><div><div class="lab" id="dmeta"></div><h2 id="dtitle"></h2></div><button class="close" id="close" aria-label="Close">×</button></div>
    <div class="pieces" id="pieces"></div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-tab="idea">The idea</button>
      <button class="tab" role="tab" data-tab="road">Road to ready</button>
      <button class="tab" role="tab" data-tab="visuals">Visuals</button>
    </div>
  </div>
  <div class="db" id="db" role="tabpanel"></div>
</aside>
<script id="data" type="application/json">__DATA__</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const SERIES = {'follow.the.money':['FOLLOW.THE.MONEY','var(--money)','Who gets paid'],'under.the.hood':['UNDER.THE.HOOD','var(--hood)','How it actually works'],
  'mind.the.gap':['MIND.THE.GAP','var(--gap)','The claim against the evidence'],'off':['OFF DAY','var(--off)','A lighter post'],'good':['GOOD NEWS','var(--good)','People doing more with AI']};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DAYN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dt = s => new Date(s + 'T12:00:00Z');
const label = s => { const d = dt(s); return `${DAYN[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const hl = (text, acc) => { const t = esc(text); if (!acc) return t; const a = esc(acc); return t.includes(a) ? t.replace(a, `<span class="hl">${a}</span>`) : t; };

/* ---------- mocks, at their real pixel sizes ---------- */
const WM = (x, y, size, on) => `<div class="wm" style="left:${x}px;top:${y}px;font-size:${size}px;color:${on||'var(--cream)'}"><span class="bars" style="height:${size*.9}px"><i style="width:${size*.2}px;height:35%"></i><i style="width:${size*.2}px;height:58%"></i><i style="width:${size*.2}px;height:80%"></i><i style="width:${size*.2}px;height:100%"></i></span>MAKE YOUR MIND/<b>UP</b></div>`;
const seriesTag = (p, day) => (SERIES[day.series]||SERIES.off)[0] + ' · ' + label(day.date).toUpperCase();
function ytThumb(p, day){ const m=p.mock; return `
  <div class="ph" style="right:0;top:0;width:640px;height:720px;background-image:url(${p.krish_img})"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,var(--ink) 47%,rgba(12,21,18,.0) 62%)"></div>
  <div class="mono" style="position:absolute;left:64px;top:60px;font-size:20px;color:var(--mint)">${esc(seriesTag(p,day))}</div>
  <div class="fr" style="position:absolute;left:64px;top:140px;width:640px;font-size:76px;line-height:1.02">${m.wide.map(l=>hl(l,m.accent)).join('<br>')}</div>
  ${WM(64,612,30)}`; }
function videoFrame(p){ const m=p.mock; return `
  <div class="ph" style="left:0;top:0;width:820px;height:1080px;background-image:url(${p.krish_img})"></div>
  <div style="position:absolute;left:820px;top:0;right:0;bottom:0;background:var(--ink)"></div>
  <div style="position:absolute;left:930px;top:250px;width:880px;background:var(--cream);color:var(--ink);border-radius:14px;padding:46px 52px;transform:rotate(-1.2deg);box-shadow:0 30px 80px rgba(0,0,0,.45)">
    <div class="mono" style="font-size:22px;color:#6b6457">${esc(m.proof_tag)}</div>
    <div class="fr" style="font-size:64px;line-height:1.08;margin-top:22px">${esc(m.proof)}</div></div>
  <div class="pill" style="left:70px;bottom:90px;font-size:44px;padding:10px 22px">${esc(m.caption)}</div>`; }
function substack(p, day){ const m=p.mock; const img=p.photo_img; return `
  <div style="position:absolute;inset:0;background:var(--cream)"></div>
  ${img?`<div class="ph" style="right:0;top:0;width:520px;height:630px;background-image:url(${img})"></div>`:`<div class="ph" style="right:0;top:0;width:520px;height:630px;background-image:url(${p.krish_img})"></div>`}
  <div class="mono" style="position:absolute;left:56px;top:54px;font-size:17px;color:#4a514d">${esc(seriesTag(p,day))}</div>
  <div class="fr" style="position:absolute;left:56px;top:118px;width:580px;font-size:58px;line-height:1.04;color:var(--ink)">${m.wide.map(l=>hl(l,m.accent)).join('<br>')}</div>
  ${WM(56,548,26,'var(--ink)')}`; }
function shortCover(p){ const m=p.mock; return `
  <div class="ph" style="inset:0;background-image:url(${p.krish_img})"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,21,18,.92) 0,rgba(12,21,18,.55) 36%,rgba(12,21,18,0) 58%)"></div>
  <div class="an" style="position:absolute;left:84px;right:84px;top:360px;font-size:132px;line-height:1.02">${m.kicker.map((l,i)=>i===m.kicker_accent?`<span class="hl">${esc(l)}</span>`:esc(l)).join('<br>')}</div>
  <div class="pill" style="left:84px;top:1530px;font-size:46px;padding:12px 24px;background:var(--cream);color:var(--ink)">${esc(m.caption)}</div>`; }
function tallThumb(p){ const m=p.mock; const img=p.photo_tall_img||p.photo_img; return `
  <div style="position:absolute;inset:0;background:var(--ink)"></div>
  <div class="ph" style="inset:0;background-image:url(${img||p.krish_img});opacity:.38"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,21,18,.2),rgba(12,21,18,.75))"></div>
  <div style="position:absolute;left:84px;right:84px;top:420px;background:var(--cream);color:var(--ink);border-radius:18px;padding:60px 60px 56px">
    <div class="an" style="font-size:${m.figure.value.length>5?170:230}px;line-height:.95">${esc(m.figure.value)}</div>
    <div class="fr" style="font-size:52px;line-height:1.12;margin-top:24px">${esc(m.figure.caption)}</div>
    <div class="mono" style="font-size:22px;color:#6b6457;margin-top:30px">${esc(m.figure.source)}</div></div>`; }
function feedSlide(p, day){ const m=p.mock; const img=p.photo_img||p.krish_img; return `
  <div style="position:absolute;inset:0;background:var(--cream)"></div>
  <div class="ph" style="left:70px;right:70px;top:440px;height:640px;border-radius:16px;background-image:url(${img})"></div>
  <div class="mono" style="position:absolute;left:70px;top:76px;font-size:22px;color:#4a514d">${esc((SERIES[day.series]||SERIES.off)[0])}</div>
  <div class="an" style="position:absolute;left:70px;right:70px;top:126px;font-size:96px;line-height:1.02;color:var(--ink)">${m.kicker.map((l,i)=>i===m.kicker_accent?`<span class="hl">${esc(l)}</span>`:esc(l)).join(' ')}</div>
  <div class="mono" style="position:absolute;left:70px;bottom:92px;font-size:20px;color:#4a514d">SWIPE →</div>`; }
function card(c, i, n, good){ const close=c.close; const first=i===0; const bg = close?'var(--ink)':(first&&good?'var(--mint)':(first?'var(--ink)':'var(--cream)')); const fg = (close||(first&&!good))?'var(--cream)':'var(--ink)'; return `
  <div style="position:absolute;inset:0;background:${bg}"></div>
  <div class="mono" style="position:absolute;left:84px;top:80px;font-size:22px;color:${fg};opacity:.7">${i+1} / ${n}</div>
  <div class="an" style="position:absolute;left:84px;right:84px;top:${first?300:360}px;font-size:${first?112:100}px;line-height:1.04;color:${fg}">${hl(c.words,c.accent)}</div>
  <div style="position:absolute;left:84px;right:84px;top:${first?900:800}px;bottom:${close?300:110}px;border-radius:22px;border:3px dashed ${fg};opacity:.55;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:40px">
    <div class="mono" style="font-size:22px;color:${fg};margin-bottom:18px">PICTURE</div>
    <div class="fr" style="font-size:44px;line-height:1.2;color:${fg}">${esc(c.picture)}</div></div>
  ${close?WM(84,1170,42):''}`; }
function emailMock(p){ return `
  <div style="position:absolute;inset:0;background:#fff;color:var(--ink)"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:120px;background:var(--ink)"></div>${WM(48,40,40)}
  <div class="fr" style="position:absolute;left:48px;top:160px;font-size:48px;color:var(--ink)">This week in AI and creative work</div>
  ${p.rows.map((r,i)=>`<div style="position:absolute;left:48px;right:48px;top:${270+i*120}px;display:flex;gap:26px;align-items:center;border-top:2px solid #eee;padding-top:22px"><div style="width:170px;height:96px;border-radius:8px;background:var(--ink);flex:none"></div><div style="font-size:34px;font-weight:700;color:var(--ink);line-height:1.2">${esc(r)}</div></div>`).join('')}`; }

function asset(cls, w, h, name, where, inner){ return `<div class="asset ${cls}"><div class="ahead"><b>${esc(name)}</b><span>${w} × ${h}</span></div>
  <div class="fit" style="aspect-ratio:${w}/${h}"><div class="cv" data-w="${w}" data-h="${h}" style="width:${w}px;height:${h}px">${inner}</div></div>
  <div class="where">${esc(where)}</div></div>`; }

/* ---------- road to ready ---------- */
const ROAD = {
  hero: p => { const st=p.steps||{}; const S=(key,t,who,w,def)=>[t,st[key]==='done'||def==='done'?'done':'todo',who,w]; const s=[
    S('approved','Approved by Krish','Krish','He picked this story for the day.','done'),
    ...((st.format==='open')?[S('format','Format set','Krish','Whether this extra piece is a full essay with videos, or a short.')]:[]),
    S('research','Research','Claude','Every fact checked against where it was first reported.'),
    S('lock','Story locked with Krish','Krish + Claude','A short interview to find the deeper story, then one locked line he signs.'),
    S('look','Look picked','Krish','How the video feels: which talking-head style and which real objects on screen.'),
    S('scripts','Scripts written and approved','Claude, then Krish','A long and a short script in his voice, read back by fresh readers, then his yes.'),
    S('teleprompter','On his teleprompter','Claude','The approved words go to his teleprompter app.'),
    S('record','Krish records','Krish','One long take and one short take, in his own room, on his phone.'),
    S('cut','Cut and checked','Engine, then a reviewer','16:9 and 9:16 cuts, captions, music; watched and heard in full before anyone calls it done.'),
    S('covers','Covers and thumbnails','Krish picks','Two or three options at every size; he picks the words after recording.'),
    S('article','Article written and fact-checked','Claude','The Substack article, ending with "3 things you can do tomorrow".'),
    S('growth','Handed to Growth to post','Growth','Scheduled on each channel. Nothing posts without his approval.')];
    return s; },
  carousel: p => [
    ['Approved by Krish','done','Krish','He picked this post for the day.'],
    ['Card words drafted','done','Claude','Each card readable in about three seconds.'],
    ['Drawn from the design library','todo','Claude','Rendered from the locked makeyourmindup templates, no other artwork.'],
    ['Checked at phone size','todo','Reviewer','The three-second check, then a fresh reader with none of the context.'],
    ['Handed to Growth to post','todo','Growth','Scheduled for the day on Instagram, Facebook and LinkedIn.']],
  choice: p => [
    ['Krish picks one, or none','todo','Krish','From the options on his board.'],
    ['Made from the design library','todo','Claude','Carousel or meme, to the same standard as the main pieces.'],
    ['Handed to Growth to post','todo','Growth','Scheduled for the day.']],
  email: p => [
    ['Drafted on Friday','todo','Claude','From the week\'s live pieces and six to ten checked news items.'],
    ['Krish approves the send','todo','Krish','One press: Approve for send.'],
    ['Goes out Saturday morning','todo','Growth','08:00 New York time.']],
};
function road(p){ const steps=(ROAD[p.kind]||ROAD.hero)(p); let nextSet=false;
  return `<ol class="road">${steps.map(([t,st,who,w],i)=>{ let cls=st==='done'?'done':''; if(st!=='done'&&!nextSet){cls='next';nextSet=true;}
    return `<li class="${cls}"><span class="mk">${st==='done'?'✓':i+1}</span><div><h4>${esc(t)}<span class="who">${esc(who)}</span></h4><div class="w">${esc(w)}</div></div></li>`;}).join('')}</ol>`; }

/* ---------- tabs ---------- */
function ideaTab(p){
  const human = p.human ? `<div class="box human"><div class="lab">How it feels human</div><div class="p">${esc(p.human)}</div><div class="p" style="opacity:.7;font-size:13px;margin-top:8px">A suggestion for the look, agreed with Krish before the scripts.</div></div>` : '';
  const left = `${p.question?`<div class="box"><div class="lab">The question it answers</div><div class="q">${esc(p.question)}</div></div>`:''}
    <div class="box"><div class="lab">In one line</div><div class="p">${esc(p.so_what)}</div></div>
    ${p.hook?`<div class="box"><div class="lab">The opening line</div><div class="p">${esc(p.hook)}</div></div>`:''}
    ${p.examples?`<div class="box"><div class="lab">What we show</div><ul class="ul">${p.examples.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
    ${p.options?`<div class="box"><div class="lab">On offer</div><ul class="ul">${p.options.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
    ${p.cards?`<div class="box"><div class="lab">Card by card</div><ol class="ul">${p.cards.map(c=>`<li>${esc(c.words)}</li>`).join('')}</ol></div>`:''}
    ${p.source&&p.source.label?`<div class="box src"><div class="lab">Source</div>${p.source.url?`<a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.source.label)}</a>`:esc(p.source.label)}</div>`:''}`;
  const right = `${p.krish_img?`<div class="krishpic" style="background-image:url(${p.krish_img})" role="img" aria-label="Krish on camera"></div>`:''}${human?'<div style="height:14px"></div>'+human:''}`;
  return `<div class="grid2"><div>${left}</div><div>${right}</div></div>`; }
function visualsTab(p, day){
  if (p.kind==='hero') return `<div class="lab" style="margin-bottom:10px">Wide: YouTube and Substack</div><div class="vgrid">
    ${asset('a6',1280,720,'YouTube thumbnail','The long video on YouTube: Krish\'s face and the claim in a few words.',ytThumb(p,day))}
    ${asset('a6',1200,630,'Substack cover','The article on Substack and the website.',substack(p,day))}
    ${asset('a12',1920,1080,'Inside the long video','Krish explains in his own room, and the proof slides in beside him as he names it.',videoFrame(p))}
  </div><div class="lab" style="margin:22px 0 10px">Tall: Shorts, Reels, TikTok and the feed</div><div class="vgrid">
    ${asset('a4',1080,1920,'Short video cover','Shorts, Reels and TikTok. Words inside the safe zone, clear of the buttons.',shortCover(p))}
    ${asset('a4',1080,1920,'Tall thumbnail','The figure that carries the story, for the grid.',tallThumb(p))}
    ${asset('a4',1080,1350,'Feed post, first slide','Instagram and Facebook feed, 4:5.',feedSlide(p,day))}
  </div>${p.credits?`<p class="credits">Photos: ${p.credits.map(esc).join('; ')}.</p>`:''}<p class="credits">Draft mocks for review. The final files come from the makeyourmindup cover system after Krish records and picks his words.</p>`;
  if (p.kind==='carousel') return `<div class="carowrap">${p.cards.map((c,i)=>asset('',1080,1350,`Card ${i+1}`, i===0?'The first card, seen in the feed.':(c.close?'The close, with the one wordmark.':'Swipe.'),card(c,i,p.cards.length,p.good))).join('')}</div><p class="credits">${esc(p.format)}. The words are the real approved words. Each card's picture is drawn from the makeyourmindup design library; the frame shows what it will be.</p>`;
  if (p.kind==='email') return `<div class="vgrid">${asset('a8',1200,900,'The weekly email','Inbox, Saturday morning.',emailMock(p))}</div>`;
  return `<div class="box"><div class="lab">Nothing to show yet</div><div class="p">The visuals appear once Krish picks the post.</div></div>`; }

/* ---------- calendar ---------- */
function evThumb(p, day){
  if (p.kind==='hero' && p.krish_img) return `<div class="th"><div class="cv" data-w="1280" data-h="720" style="width:1280px;height:720px">${ytThumb(p,day)}</div></div>`;
  if (p.kind==='carousel') return `<div class="th tall"><div class="cv" data-w="1080" data-h="1350" style="width:1080px;height:1350px">${card(p.cards[0],0,p.cards.length,p.good)}</div></div>`;
  return ''; }
const KIND = {hero:'Article · long video · short video', carousel:'Carousel', choice:'Off-day post', email:'Email'};
const STATUS = p => p.kind==='choice'?['d-open','Waiting on Krish\'s pick']:p.kind==='email'?['d-wait','Drafted Friday, his yes to send']:['d-ok','Approved'];
function build(){
  document.title = D.title; document.getElementById('title').textContent = D.title; document.getElementById('asof').textContent = D.as_of + '. Click any piece to open it.';
  document.getElementById('keys').innerHTML = ['follow.the.money','under.the.hood','mind.the.gap','off','good'].map(k=>`<span class="key"><span class="sw" style="background:${SERIES[k][1]}"></span>${SERIES[k][0].toLowerCase()}</span>`).join('');
  const wk = document.getElementById('week');
  wk.innerHTML = D.days.map((day,i)=>{ const d=dt(day.date); const s=SERIES[day.series]||SERIES.off;
    const head = `<div class="ch"><div class="dn">${DAYN[d.getUTCDay()].slice(0,3)}</div><div class="dd">${d.getUTCDate()}</div>${day.rest?'':`<span class="sl" style="background:${s[1]}">${s[0]}</span>`}</div>`;
    if (day.rest) return `<div class="col rest" role="gridcell">${head}<div class="restmsg">${esc(day.rest)}</div></div>`;
    const evs = day.pieces.map((p,j)=>{ const [c,t]=STATUS(p); return `<button class="ev" data-i="${i}" data-j="${j}" aria-label="Open ${esc(p.title)}">${evThumb(p,day)}<div class="tx"><div class="k">${esc(p.label||KIND[p.kind]||'')}</div><div class="t">${esc(p.title)}</div><div class="st"><span class="dot ${c}"></span>${esc(t)}</div></div></button>`; }).join('');
    return `<div class="col" role="gridcell">${head}<div class="evs">${evs}</div><button class="open-hint" data-i="${i}" data-j="0">Open the day →</button></div>`; }).join('');
  document.getElementById('note').textContent = 'Topics as approved on Krish\'s publish board. Nothing posts without his approval.';
  wk.querySelectorAll('button[data-i]').forEach(b=>b.addEventListener('click',()=>openDay(+b.dataset.i, +b.dataset.j)));
  fitAll(document); }
let cur = {day:0, piece:0, tab:'idea'}, lastFocus = null;
function openDay(i, piece=0, tab='idea'){ lastFocus = document.activeElement; cur={day:i,piece,tab}; render();
  document.getElementById('dash').classList.add('on'); document.getElementById('scrim').classList.add('on'); document.getElementById('dash').setAttribute('aria-hidden','false');
  document.getElementById('close').focus(); history.replaceState(null,'',`#${D.days[i].date}/${tab}/${piece}`); }
function closeDay(){ document.getElementById('dash').classList.remove('on'); document.getElementById('scrim').classList.remove('on'); document.getElementById('dash').setAttribute('aria-hidden','true'); history.replaceState(null,'',' '); if(lastFocus) lastFocus.focus(); }
function render(){ const day=D.days[cur.day], p=day.pieces[cur.piece], s=SERIES[day.series]||SERIES.off;
  document.getElementById('dmeta').innerHTML = `${esc(label(day.date))} · <span style="background:${s[1]};color:var(--ink);padding:1px 6px;border-radius:4px">${s[0]}</span> · ${esc(s[2])}`;
  document.getElementById('dtitle').textContent = p.title;
  document.getElementById('pieces').innerHTML = day.pieces.length>1 ? day.pieces.map((q,j)=>`<button class="pc" aria-pressed="${j===cur.piece}" data-j="${j}">${j+1}. ${esc(q.title.length>64?q.title.slice(0,62)+'…':q.title)}</button>`).join('') : '';
  document.querySelectorAll('.pc').forEach(b=>b.addEventListener('click',()=>{cur.piece=+b.dataset.j; render(); history.replaceState(null,'',`#${D.days[cur.day].date}/${cur.tab}/${cur.piece}`);}));
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected', t.dataset.tab===cur.tab));
  const body = document.getElementById('db');
  body.innerHTML = cur.tab==='idea'?ideaTab(p):cur.tab==='road'?`<div class="box">${road(p)}</div>`:visualsTab(p,day);
  body.scrollTop = 0; requestAnimationFrame(()=>fitAll(body)); }
function fitAll(root){ root.querySelectorAll('.cv').forEach(cv=>{ const box=cv.parentElement; const s=box.clientWidth/(+cv.dataset.w); cv.style.transform=`scale(${s})`; if(!box.classList.contains('fit')) box.style.height=(+cv.dataset.h*s)+'px'; }); }
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{cur.tab=t.dataset.tab; render(); history.replaceState(null,'',`#${D.days[cur.day].date}/${cur.tab}/${cur.piece}`);}));
document.getElementById('close').addEventListener('click',closeDay);
document.getElementById('scrim').addEventListener('click',closeDay);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.getElementById('dash').classList.contains('on')) closeDay(); });
addEventListener('resize',()=>fitAll(document));
build();
const h = location.hash.slice(1).split('/'); const hi = D.days.findIndex(d=>d.date===h[0]); if (hi>=0 && D.days[hi].pieces) openDay(hi,Math.min(+h[2]||0,D.days[hi].pieces.length-1),h[1]||'idea');
</script>
</body>
</html>
"""


# ---------------------------------------------------------------- draft: the week's data file from the live board

ENGINE_VIEW = 'https://content-engine-flame-nu.vercel.app/api/board/{week}/view'
SERIES_OF_DAY = {'mon': 'follow.the.money', 'wed': 'under.the.hood', 'fri': 'mind.the.gap', 'tue': 'off', 'thu': 'off', 'sat': 'good'}


def read_view(week, view_file=None):
    """The live board's view of the week: a saved copy, the board route (ENGINE_OPERATOR_TOKEN), or the engine host
    (a cloud session's proxy adds the key)."""
    if view_file:
        return json.loads(Path(view_file).read_text(encoding='utf-8'))
    try:
        sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
        import board_web  # noqa: PLC0415
        return board_web.call('GET', f'/api/board/{week}/view')
    except Exception:  # noqa: BLE001 - fall through to the engine host
        import urllib.request  # noqa: PLC0415
        with urllib.request.urlopen(ENGINE_VIEW.format(week=week), timeout=60) as r:
            return json.load(r)


def ideas_index():
    """Every option in every week's ideas.json, by id (main pieces) and by off-day id, newest week last."""
    by_id = {}
    for f in sorted((ROOT / 'docs' / 'plans').glob('*-week/ideas.json')):
        wk = f.parent.name[:10]
        try:
            d = json.loads(f.read_text(encoding='utf-8'))
        except ValueError:
            continue
        for opts in (d.get('days') or {}).values():
            for o in opts if isinstance(opts, list) else []:
                if isinstance(o, dict) and o.get('id'):
                    by_id[str(o['id']).lower()] = o
        for opts in (d.get('offdays') or {}).values():
            for o in opts if isinstance(opts, list) else []:
                if isinstance(o, dict) and o.get('id'):
                    by_id[f'off:{wk}:' + str(o['id']).lower()] = o  # off-day ids repeat across weeks
    return by_id


def hero_from(o, title):
    pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else {}
    style = o.get('style') if isinstance(o.get('style'), dict) else {}
    exp = style.get('experiment') if isinstance(style.get('experiment'), dict) else {}
    head = pitch.get('headline') or title
    return {'kind': 'hero', 'title': head, 'question': (pitch.get('question') or '').replace('Wildcard: ', ''),
            'so_what': o.get('so_what') or '', 'hook': pitch.get('hook') or '', 'examples': (pitch.get('examples') or [])[:3],
            'human': exp.get('why') or '', 'source': o.get('source') or {},
            'krish': None, 'photo': None,
            'mock': {'wide': [head], 'accent': '', 'kicker': head.split()[:3], 'kicker_accent': 1,
                     'proof_tag': '', 'proof': '', 'figure': {'value': '', 'caption': '', 'source': ''}, 'caption': ''}}


def draft(week, out, view_file=None):
    """A first calendar.json for the week from the live board and the weeks' ideas.json: every approved piece and
    off-day post, with the idea filled in. The session then writes each hero's mock words, picks a Krish frame and a
    licensed photo, and checks every line against the source (.agents/skills/content-calendar/SKILL.md)."""
    from datetime import date, timedelta  # noqa: PLC0415
    view, ideas = read_view(week, view_file), ideas_index()
    monday = date.fromisoformat(week)
    days = [{'date': (monday - timedelta(days=1)).isoformat(), 'rest': 'No posts. Sunday is when next week\'s ideas are chosen.'}]
    for d in view.get('days') or []:
        key = d.get('day')
        entry = {'date': d.get('date'), 'series': SERIES_OF_DAY.get(key, 'off'), 'pieces': []}
        for pc in d.get('pieces') or []:
            o = ideas.get(str(pc.get('id') or '').lower())
            piece = hero_from(o, pc.get('title') or '') if o else {'kind': 'hero', 'title': pc.get('title') or '', 'so_what': '', 'mock': None}
            piece['id'] = f"{key}-{str(pc.get('id'))[:8]}"
            piece['steps'] = {'research': 'done' if any('research' in str(x.get('h', '')).lower() and 'none' not in str(x.get('p', '')).lower()
                                                         for x in d.get('detail') or [] if isinstance(x, dict)) else 'todo'}
            entry['pieces'].append(piece)
        approved_off = False
        for opt in d.get('options') or []:
            if key not in ('tue', 'thu', 'sat') or opt.get('status') != 'approved':
                continue
            o = ideas.get(f'off:{week}:' + str(opt.get('id') or '').lower()) or {}
            cards = [{'words': c.get('words', ''), 'picture': c.get('picture', '')} for c in o.get('cards') or [] if isinstance(c, dict)]
            if cards:
                approved_off = True
                cards[-1]['close'] = True
                entry['pieces'].append({'id': f"{key}-{opt.get('id')}", 'kind': 'carousel', 'format': o.get('format') or opt.get('format') or '',
                                        'title': o.get('hook') or opt.get('title') or '', 'so_what': o.get('copy') or '',
                                        'source': o.get('source') or {}, 'cards': cards, 'good': key == 'sat'})
        if not approved_off and key in ('tue', 'thu'):
            entry['pieces'].append({'id': f'{key}-choice', 'kind': 'choice', 'title': 'Off-day post: still to pick',
                                    'so_what': 'Krish has not picked this day\'s post yet.',
                                    'options': [o.get('title') or '' for o in d.get('options') or [] if o.get('status') == 'open'][:6]})
        if key == 'sat':
            entry['pieces'].append({'id': 'sat-email', 'kind': 'email', 'title': 'makeyourmindup weekly',
                                    'so_what': 'The week\'s pieces in one email, with six to ten checked news items. Drafted on Friday; it goes out only if Krish approves it.',
                                    'rows': [p['title'] for dd in days[1:] + [entry] for p in dd.get('pieces') or [] if p.get('kind') == 'hero'][:3]
                                    + ['Plus six to ten checked stories from the week']})
        days.append(entry)
    data = {'_about': 'Drafted by scripts/calendar/make_calendar.py draft from the live board; finish it as .agents/skills/content-calendar/SKILL.md says.',
            'week': week, 'title': f"The week of {monday.day} {monday.strftime('%b')} to {(monday + timedelta(days=5)).day} {(monday + timedelta(days=5)).strftime('%b')}",
            'as_of': f"Board read {date.today().isoformat()}", 'days': days}
    Path(out).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    todo = [p['id'] for dd in days for p in dd.get('pieces') or [] if p.get('kind') == 'hero']
    print(f'wrote {out}: {sum(len(dd.get("pieces") or []) for dd in days)} items; write the mock words, frame and photo for {", ".join(todo) or "none"}')


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'draft':
        ap = argparse.ArgumentParser(description='Draft the week\'s calendar.json from the live board.')
        ap.add_argument('cmd'); ap.add_argument('week', help='the Monday, YYYY-MM-DD')
        ap.add_argument('--out', required=True); ap.add_argument('--view', help='a saved copy of the board view')
        a = ap.parse_args()
        return draft(a.week, a.out, a.view)
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('data')
    ap.add_argument('--krish', required=True, help='folder of Krish frames k1.jpg, k2.jpg ... from his own published cuts')
    ap.add_argument('--photos', help='commons.json: Commons title to {file, artist, lic}; files relative to it')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    data = json.loads(Path(a.data).read_text(encoding='utf-8'))
    unfinished = [p['id'] for d in data['days'] for p in d.get('pieces') or []
                  if p.get('kind') == 'hero' and not ((p.get('mock') or {}).get('figure') or {}).get('value')]
    if unfinished:
        sys.exit('make_calendar: write the mock words first (wide, kicker, proof, figure, caption) for ' + ', '.join(unfinished))
    base = Path(a.photos).parent if a.photos else Path('.')
    missing = resolve(data, a.krish, a.photos, base)
    page = (PAGE.replace('__TITLE__', html.escape(data.get('title') or 'Content calendar'))
            .replace('__INK__', INK).replace('__CREAM__', CREAM).replace('__MINT__', MINT)
            .replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/')))
    Path(a.out).write_text(page, encoding='utf-8')
    print(f'wrote {a.out} ({len(page) // 1024} KB)')
    for m in missing:
        print(f'no photo yet, drawn without it: {m}')


if __name__ == '__main__':
    main()
