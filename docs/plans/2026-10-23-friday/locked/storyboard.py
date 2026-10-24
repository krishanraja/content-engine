"""Draws the storyboard for Krish's sign-off: one frame per beat, for each of the four videos, from the locked files
and the real captures. A storyboard, not the render: the frames show what is on screen, where, and with which words
and source; the motion is described under each frame and built by Codex from motion-system.md.

    python docs/plans/2026-10-23-friday/locked/storyboard.py   # writes .cache/sb/storyboard-<take>.html and .jpg
"""
import base64, html, json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).parent
EVID = ROOT / '.cache/friday-evidence'
SB = ROOT / '.cache/sb'
T = json.loads((HERE / 'timings.json').read_text())
V = json.loads((HERE / 'visual-copy.json').read_text())['beats']
A = json.loads((HERE / 'assets.json').read_text())['assets']
CAPFILE = {k: Path(v['file']).name for k, v in A.items() if k.startswith('E-')}


def img(path, w=None):
    data = base64.b64encode(Path(path).read_bytes()).decode()
    return f'data:image/{"png" if str(path).endswith(".png") else "jpeg"};base64,{data}'


_cache = {}
def small(path, width):
    key = (str(path), width)
    if key not in _cache:
        out = SB / f'_{Path(path).stem}-{width}.jpg'
        if not out.exists():
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-vf', f'scale={width}:-1', '-q:v', '4', str(out)], check=True)
        _cache[key] = img(out)
    return _cache[key]


def passport(fields, mark=''):
    rows = ''.join(f'<div class="pf"><span>{html.escape(k)}</span><b class="">{html.escape(v)}</b></div>' for k, v in fields)
    return f'<div class="pp"><div class="pph">PASSPORT · AI</div><div class="ppb"><div class="ppm">{html.escape(mark)}</div><div>{rows}</div></div><div class="mrz">P&lt;AI&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div></div>'


def stage(bid, spec, take):
    pics = ' '.join(spec['pictures'])
    words = spec.get('on_screen', [])
    fields = [tuple(w.split(': ', 1)) for w in words if re.match(r'^(BORN|LIVES|PART): ', w)]
    other = [w for w in words if not re.match(r'^(BORN|LIVES|PART): ', w)]
    parts = []
    if 'F-xinjiang' in pics and 'F-turkmenistan' in pics:
        parts.append(f'<div class="split"><img src="{small(SB/"xj-refusal.jpg", 420)}"><img src="{small(SB/"tk-answer.jpg", 420)}"></div>')
    elif 'F-xinjiang' in pics:
        parts.append(f'<img class="full" src="{small(SB/"xj-refusal.jpg", 640)}">')
    caps = [k for k in CAPFILE if k in pics or spec.get('label') == k]
    if caps and not parts:
        parts.append(f'<img class="sheet" src="{small(EVID/CAPFILE[caps[0]], 640)}">')
    if 'O-chat' in pics:
        parts.append(f'<img class="full" src="{small(SB/"xj-answer.jpg", 640)}">')
    if 'O-split' in pics:
        amber = [w for w in words if w.isupper() and w.isalpha()] or ['COUNTRY']
        parts.append('<div class="prompts">' + ''.join((f'<div>...a board briefing on opening a sales office in <b>{html.escape(a.title())}</b>...</div>' if a in ('TAIWAN','SINGAPORE') else f'<div>...our suppliers gets its cotton from <b>{html.escape(a.title())}</b>...</div>') for a in amber) + '</div>')
        other = []
    if '3 x 2 grid' in pics:
        cells = [('CLAUDE','&#10003;','&#10003;'),('CHATGPT','&#10003;','&#10003;'),('DEEPSEEK','','&#10003;')] if take.endswith('5min') else [('CLAUDE','&#10003;',''),('CHATGPT','&#10003;','')]
        parts.append('<table class="grid3"><tr><th></th><th>XINJIANG</th>' + ('<th>TURKMENISTAN</th>' if take.endswith('5min') else '') + '</tr>' + ''.join(f'<tr><th>{a}</th><td>{x}</td>' + (f'<td>{y}</td>' if take.endswith('5min') else '') + '</tr>' for a,x,y in cells) + '</table>')
    if 'O-tiles' in pics or 'tiles' in pics:
        m = re.search(r'(\d+) flip amber', pics)
        n = int(m.group(1)) if m else (100 if 'all mint' in pics else 0)
        mint = 'all mint' in pics
        cells = ''.join(f'<i class="{"m" if mint else ("a" if i < n else "")}"></i>' for i in range(100)) if (m or mint) else ''
        if cells:
            parts.append(f'<div class="tiles">{cells}</div>')
    borns = [f for f in fields if f[0] == 'BORN']
    if len(borns) > 2:
        parts.append('<div class="deck">' + ''.join(passport([f]) for f in borns) + '</div>')
    elif fields or 'passport' in pics.lower():
        parts.append(passport(fields or [('BORN', ''), ('LIVES', '')]))
    if 'O-route' in pics or 'route' in pics:
        parts.append('<div class="route"><span>PHONE</span><em></em><span class="srv">SERVER</span></div>')
    if 'O-checklist' in pics:
        parts.append('<div class="check">' + ''.join(f'<div>&#10003; {html.escape(w)}</div>' for w in words) + '</div>')
        other = []
    if 'O-outro' in pics:
        parts.append('<div class="outro">makeyourmindup.ai</div>')
    big = [w for w in other if re.fullmatch(r'[\d.]+%|\d+x|\d+|A DRAW|DEEPSEEK 63%|\d OF 3', w)]
    small_words = [w for w in other if w not in big]
    if big:
        parts.append('<div class="big">' + ' '.join(html.escape(b) for b in big) + '</div>')
    if small_words:
        parts.append('<div class="tags">' + ''.join(f'<span>{html.escape(w)}</span>' for w in small_words) + '</div>')
    label = spec.get('label', '')
    lab = A.get(label, {}).get('label', label) if label else ''
    face = spec.get('cam', '').lower().startswith('face') and take.startswith('cam')
    facehtml = f'<img class="face" src="{small(SB/"face-tall-full.jpg", 160)}">' if face else ''
    return f'<div class="stage {spec["surface"]}">{facehtml}{"".join(parts)}{f"<div class=lab>{html.escape(lab)}</div>" if lab else ""}</div>'


CSS = '''body{margin:0;background:#F4EFE4;font:13px/1.35 Archivo,Arial,sans-serif;color:#0C1512}
h1{font:28px Anton,Impact,sans-serif;text-transform:uppercase;margin:18px 20px 4px} .sub{margin:0 20px 14px;color:#5b625e;max-width:1100px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:0 20px 24px}
.tall .grid{grid-template-columns:repeat(5,1fr)}
.f{background:#fffdf8;border:1px solid #d9d2c3;border-radius:6px;overflow:hidden}
.stage{position:relative;aspect-ratio:16/9;overflow:hidden;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;padding:8px;box-sizing:border-box}
.tall .stage{aspect-ratio:9/16;flex-direction:column}
.cream{background:#F4EFE4}.ink{background:#0C1512;color:#F4EFE4}
.sheet{max-width:62%;max-height:70%;box-shadow:0 8px 24px rgba(0,0,0,.25);border-radius:2px}.tall .sheet{max-width:96%;max-height:42%}
.full{max-width:92%;max-height:80%;border-radius:4px}.split{display:flex;gap:4px;width:96%}.split img{width:50%;border-radius:3px}
.tall .split{flex-direction:column}.tall .split img{width:100%}
.pp{background:#fffdf8;color:#0C1512;border:1px solid #d9d2c3;border-radius:6px;width:150px;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.pph{font:9px 'IBM Plex Mono',monospace;background:#0C1512;color:#7EF0C0;padding:3px 6px;border-radius:6px 6px 0 0}
.ppb{display:flex;gap:6px;padding:6px}.ppm{width:34px;height:42px;background:#e9e2d3;border-radius:3px}
.pf{font:9px 'IBM Plex Mono',monospace;display:flex;flex-direction:column;margin-bottom:3px}.pf span{color:#5b625e}.pf b{font-size:11px}.pf b.amb{color:#b0412e}
.mrz{font:8px 'IBM Plex Mono',monospace;background:#7EF0C0;padding:2px 6px;border-radius:0 0 6px 6px;overflow:hidden;white-space:nowrap}
.tiles{display:grid;grid-template-columns:repeat(20,8px);gap:2px}.tiles i{width:8px;height:8px;background:#d9d2c3}.tiles i.a{background:#b0412e}.tiles i.m{background:#7EF0C0}
.big{font:34px Anton,Impact,sans-serif;text-transform:uppercase}
.tags{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}.tags span{font:10px 'IBM Plex Mono',monospace;background:#0C1512;color:#F4EFE4;padding:2px 6px}
.ink .tags span{background:#7EF0C0;color:#0C1512}
.route{display:flex;align-items:center;gap:6px;font:10px 'IBM Plex Mono',monospace;color:#7EF0C0}.route em{width:110px;border-top:2px dashed #7EF0C0}.route .srv{border:1px solid #7EF0C0;padding:6px}
.check{font:12px 'IBM Plex Mono',monospace}.check div{margin:3px 0}
.prompts div{font:11px Archivo,sans-serif;background:#e9e2d3;border-radius:8px;padding:5px 8px;margin:3px}.prompts b{color:#b0412e}
.grid3{font:10px 'IBM Plex Mono',monospace;border-collapse:collapse}.grid3 td,.grid3 th{border:1px solid #d9d2c3;padding:4px 8px;text-align:center}.grid3 td{color:#1f7a52;font-size:14px}
.deck{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}.deck .pp{width:96px}.deck .ppm{width:20px;height:26px}
.outro{font:20px Anton,Impact,sans-serif}
.lab{position:absolute;left:6px;top:6px;font:9px 'IBM Plex Mono',monospace;background:#0C1512;color:#7EF0C0;padding:2px 5px}
.face{position:absolute;left:0;top:0;height:100%;border-right:2px solid #7EF0C0}.tall .face{height:auto;width:34%;top:auto;bottom:0;border:2px solid #7EF0C0}
.meta{padding:7px 9px}.meta .id{font:10px 'IBM Plex Mono',monospace;color:#5b625e}.meta .said{font-style:italic;margin:3px 0}.meta .how{color:#5b625e;font-size:11.5px}
.edit{background:#ffe4dc;color:#7a2a1a;font-size:11px;padding:3px 9px}'''

NAMES = {'vo-5min': '5-minute voiceover · 16:9 · pictures only', 'cam-5min': '5-minute on camera · 16:9 · his portrait panel left, the stage right',
         'vo-90s': '90-second voiceover · 9:16 · pictures only', 'cam-90s': '90-second on camera · 9:16'}


FIX = [(r'four slaver','forced labour'),(r'forced labor\b','forced labour'),(r'\brock checking','Grok checking'),(r'\bgrok\b','Grok'),(r'chat GPT','ChatGPT'),(r'Jack,? GPT,?','ChatGPT'),(r'MakeYourMindUp\.ai','makeyourmindup.ai'),(r'\bcursor\b','Cursor'),(r'\banthropic\b','Anthropic'),(r'a company here','company here'),(r'asked for Chinese','asked four Chinese'),(r'They asked Claude','I asked Claude')]
def fix(t):
    for a, b in FIX: t = re.sub(a, b, t)
    return t


def main():
    SB.mkdir(parents=True, exist_ok=True)
    edits = {}
    for take in NAMES:
        md = (HERE / f'script-{take}.md').read_text()
        edits[take] = {m.group(1): m.group(2) for m in re.finditer(r'- \*\*(\S+) · ([^*]+)\.\*\*', md)}
    for take, name in NAMES.items():
        tall = '90s' in take
        frames = []
        for b in T[take]['beats']:
            spec = V[b['beat']]
            ed = edits[take].get(b['beat'])
            frames.append(f'<div class="f">{stage(b["beat"], spec, take)}<div class="meta"><div class="id">{b["beat"]} · {b["start"]:.1f}-{b["end"]:.1f} s</div>'
                          f'<div class="said">"{html.escape(fix(b["said"])[:170])}{"..." if len(b["said"]) > 170 else ""}"</div>'
                          f'<div class="how">{html.escape(" / ".join(spec["pictures"])[:230])}</div>'
                          f'{"<div class=how><b>On camera:</b> " + html.escape(spec["cam"]) + "</div>" if take.startswith("cam") else ""}</div>'
                          f'{f"<div class=edit>Audio edit: {html.escape(ed)}</div>" if ed else ""}</div>')
        page = (f'<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;700&family=IBM+Plex+Mono&display=swap" rel="stylesheet">'
                f'<style>{CSS}</style><body class="{"tall" if tall else ""}"><h1>Two passports · {html.escape(name)}</h1>'
                f'<p class="sub">Storyboard for sign-off. One frame per beat, timed to the take ({T[take]["file"]}, {T[take]["duration"]} s). Cream = what an AI says; ink = where it lives. '
                f'Real captures and screen recordings; the moving objects are sketched here and built to motion-system.md.</p><div class="grid">{"".join(frames)}</div></body>')
        (SB / f'storyboard-{take}.html').write_text(page)
        print(take, len(frames), 'frames')


if __name__ == '__main__':
    main()
