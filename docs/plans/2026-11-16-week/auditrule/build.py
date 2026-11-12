"""Six cards for the Tue 17 Nov off-day carousel (auditrule), in the AI-broke-Git look."""
import pathlib
D = pathlib.Path(__file__).parent

CSS = """
@font-face{font-family:Anton;src:url(fonts/Anton-Regular.ttf)}
@font-face{font-family:Archivo;src:url(fonts/Archivo-Variable.ttf);font-weight:100 900}
@font-face{font-family:'IBM Plex Mono';src:url(fonts/IBMPlexMono-Regular.ttf);font-weight:400}
@font-face{font-family:'IBM Plex Mono';src:url(fonts/IBMPlexMono-Medium.ttf);font-weight:500}
:root{--ink:#0C1512;--deep:#070D0B;--cream:#F4EFE4;--green:#2F6B5C;--mint:#7EF0C0;--butter:#FFD84D;--coral:#FF6A4D}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;background:var(--ink)}
.card{position:relative;width:1080px;height:1350px;overflow:hidden;color:var(--cream);font-family:Archivo,sans-serif;
  background-color:var(--ink);
  background-image:linear-gradient(rgba(126,240,192,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(126,240,192,.035) 1px,transparent 1px);
  background-size:6px 6px}
.pad{position:absolute;inset:0;padding:110px 80px 150px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.eyebrow{font-family:'IBM Plex Mono';font-weight:500;font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:#B9C9C1}
.h{font-family:Anton;font-size:104px;line-height:1.02;text-transform:uppercase;margin-top:26px}
.h .m{color:var(--mint);display:block}
.body{font-weight:500;font-size:44px;line-height:1.28;color:#E9E2D4;max-width:900px}
.mark{position:absolute;right:56px;bottom:52px;width:78px}
.mark img{width:100%;display:block}
.rows{width:100%;margin:56px 0 52px;display:flex;flex-direction:column;gap:22px}
.row{display:flex;align-items:center;gap:30px;padding:30px 36px;border-radius:22px;background:rgba(244,239,228,.04);border:2px solid rgba(244,239,228,.12);text-align:left}
.row .who{flex:none;width:300px;display:flex;align-items:center;justify-content:flex-start;font-family:Anton;font-size:64px;text-transform:uppercase}
.row .who.tile{background:var(--cream);border-radius:16px;height:110px;padding:0 26px;justify-content:center}
.row .who img{max-width:248px;max-height:62px;display:block}
.row .what{flex:1;font-weight:600;font-size:44px;line-height:1.15}
.row .chip{flex:none;width:92px;height:92px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.row .chip svg{width:52px;height:52px}
.yes{background:var(--mint)} .no{background:var(--coral)}
.quote{font-weight:500;font-size:40px;line-height:1.25;color:var(--cream)}
.cite{font-family:'IBM Plex Mono';font-size:24px;letter-spacing:.1em;color:#9FB3AA;margin-top:14px;text-transform:uppercase}
.logo-top{height:120px;margin-bottom:34px}
"""
TICK = '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#0C1512" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CROSS = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="#0C1512" stroke-width="3.4" stroke-linecap="round"/></svg>'
MARK = '<div class="mark"><img src="brand/makeyourmindup-mark.png"></div>'


def page(inner, extra_css=''):
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{extra_css}</style></head><body><div class="card">{inner}</div></body></html>'


def row(who, what, ok):
    tile = ' tile' if who.startswith('<img') else ''
    return f'<div class="row"><div class="who{tile}">{who}</div><div class="what">{what}</div><div class="chip {"yes" if ok else "no"}">{TICK if ok else CROSS}</div></div>'


cards = {}

cards['card-1'] = page("""
<img src="cover.png" style="position:absolute;left:0;top:0;width:1080px;height:1350px;object-fit:cover;object-position:50% 0">
<div style="position:absolute;left:0;right:0;top:770px;bottom:0;background:linear-gradient(to bottom,rgba(12,21,18,0) 0%,#0C1512 70px)"></div>
<div style="position:absolute;left:60px;right:60px;top:822px;text-align:center">
  <div class="h" style="font-size:92px;margin-top:0">Your AI thinks<br>it's the best.<span class="m">Guess who told it.</span></div>
  <div class="body" style="margin:24px auto 0;font-size:40px">Why big companies never let an AI mark its own homework.</div>
</div>""" + MARK)

cards['card-2'] = page(f"""
<div class="pad">
  <div class="eyebrow">At school</div>
  <div class="h">You don't mark<br><span class="m">your own test.</span></div>
  <div class="rows">
    {row('You', 'mark your own test', False)}
    {row('Teacher', 'marks your test', True)}
  </div>
  <div class="body">Grown-ups have the same rule at work. The people who check a company's money are not allowed to check their own sums.</div>
</div>{MARK}""")

cards['card-3'] = page(f"""
<div class="pad">
  <div class="eyebrow">Why it matters for AI</div>
  <div class="h">AIs give<br><span class="m">themselves better marks.</span></div>
  <div style="position:relative;width:420px;height:420px;margin:58px 0 54px">
    <div style="position:absolute;inset:0;border-radius:50%;background:var(--butter);box-shadow:0 0 0 14px rgba(255,216,77,.18),0 30px 60px rgba(0,0,0,.45);transform:rotate(-8deg);display:flex;align-items:center;justify-content:center">
      <div style="font-family:Anton;font-size:96px;line-height:.95;color:#0C1512;text-transform:uppercase">I'm<br>the<br>best</div>
    </div>
  </div>
  <div class="body">Scientists asked AIs to mark pieces of writing. The AIs gave their own writing better marks than people did.</div>
</div>{MARK}""")

cards['card-4'] = page(f"""
<div class="pad">
  <img class="logo-top" src="logos/homedepot.png">
  <div class="eyebrow">One of America's biggest shops</div>
  <div class="h" style="font-size:96px">One AI answers.<br><span class="m">A rival AI checks.</span></div>
  <div class="rows">
    {row('<img src="logos/google.png">', 'Its AI answers the customer', True)}
    {row('<img src="logos/openai.png">', 'Its AI checks the answer', True)}
  </div>
  <div class="body">Home Depot's tech boss says she likes the two AIs pulling against each other.</div>
</div>{MARK}""")

cards['card-5'] = page(f"""
<div class="pad">
  <img class="logo-top" style="height:78px;margin-top:20px" src="logos/microsoft.png">
  <div class="eyebrow">The company behind Windows does it too</div>
  <div class="h" style="font-size:96px">One AI writes.<br><span class="m">A rival AI checks.</span></div>
  <div class="rows">
    {row('<img src="logos/openai.png">', 'Its AI writes the report', True)}
    {row('<img src="logos/claude.png">', 'This AI checks it before you read it', True)}
  </div>
  <div class="body">Microsoft says the checked reports came out better.</div>
</div>{MARK}""")

cards['card-6'] = page("""
<div class="pad" style="justify-content:center;padding-bottom:300px">
  <div class="h" style="font-size:120px">Never let an AI<br><span class="m">mark its own homework.</span></div>
  <div class="body" style="margin-top:44px">Ask a different AI to check the answer.</div>
</div>
<div style="position:absolute;left:0;right:0;bottom:110px;display:flex;flex-direction:column;align-items:center;gap:28px">
  <div style="font-family:'IBM Plex Mono';font-weight:500;font-size:34px;letter-spacing:.12em;text-transform:uppercase;color:var(--mint)">Follow for more</div>
  <img src="brand/makeyourmindup-horizontal.png" style="width:360px">
</div>""")

for name, html in cards.items():
    (D / f'{name}.html').write_text(html)
print(len(cards), 'cards')
