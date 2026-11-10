#!/usr/bin/env python3
"""The video style catalogue: complete video styles, chosen as one thing before the script is written.

    python3 scripts/video_styles.py                     # the catalogue, one line per style
    python3 scripts/video_styles.py --check             # every id a style points at exists (exit 1 if not)
    python3 scripts/video_styles.py --render OUT_DIR [--thumbs THUMBS.json]
                                                        # one page Krish opens: every style, its evidence, its gaps

A style bundles the playbook format, script format, production format, lengths, hook, motion style, caption look,
picture modules, sound, opening, close and devices, and points at the banks that already hold them:
config/style-references.json (formats and bank), config/ve/formats, config/ve/recipes, config/ve/devices.json,
config/music-library.json, apps/control-plane/api/_video.ts (lengths) and config/failures.json (what it prevents).
Evidence card ids are checked for shape only; whether a card exists needs a database read. --thumbs takes a JSON object of inspiration card id to a data: URI, read beforehand from inspiration_items; the
rendered page never reaches the network itself. Every krish_verdict stays 'untested' until Krish rates the style.
"""
import argparse
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGUE = os.path.join(ROOT, 'config', 'video-styles.json')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
VERDICTS = ('untested', 'liked', 'trial', 'not for us')
MAPPINGS = ('engine guess', 'Krish')
CAPTION_MODULES = ('kinetic-serif-captions', 'word-bounce-in', 'vertical-captions')
STATUSES = ('seed', 'candidate', 'retired')


def read_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def banks():
    s = read_json('config/style-references.json')
    tracks = read_json('config/music-library.json')['tracks']
    tracks = tracks if isinstance(tracks, list) else list(tracks.values())
    devices = read_json('config/ve/devices.json')
    devices = devices.get('devices', devices)
    with open(os.path.join(ROOT, 'apps/control-plane/api/_video.ts'), encoding='utf-8') as f:
        lengths = set(re.findall(r"^\s+id: '([^']+)'", f.read(), re.M))
    return {
        'script': {x['id'] for x in s['formats']['script']},
        'production': {x['id'] for x in s['formats']['production']},
        'bank': {x['id'] for x in s['bank']},
        'layer': {x['id']: x.get('layer') for x in s['bank']},
        'said': {(k, x['id']): [e.get('said', '') for e in x.get('evidence') or []]
                 for k in ('script', 'production') for x in s['formats'][k]},
        'motion': {x['id'] for x in s['bank'] if x.get('layer') == 'motion'},
        'tracks': {x['id'] for x in tracks if x.get('status') == 'approved'},
        'devices': set(devices) if isinstance(devices, dict) else {x['id'] for x in devices},
        'lengths': lengths,
        'failures': {x['id'] for x in read_json('config/failures.json')['failures']},
    }


def quote_found(said, source, b):
    """True when his words appear verbatim in the source a quote names. Sources outside config/ and docs/ (an
    inspiration card's why_like) need a database read and are not checked offline."""
    parts = source.split()
    if parts[0] == 'config/style-references.json' and len(parts) >= 3 and parts[1].startswith('formats.'):
        return said in b['said'].get((parts[1].split('.', 1)[1], parts[2]), [])
    if not parts[0].startswith(('config/', 'docs/')):
        return True
    path = os.path.join(ROOT, parts[0])
    if not os.path.exists(path):
        return False
    with open(path, encoding='utf-8') as f:
        text = f.read()
    if path.endswith('.json'):
        text = json.dumps(json.loads(text), ensure_ascii=False)
        said = json.dumps(said, ensure_ascii=False)[1:-1]
    return said in text


def problems(doc, b=None):
    b = b or banks()
    out = []
    formats = doc.get('playbook_formats') or {}
    styles = doc.get('styles') or []
    if not styles:
        out.append('no styles')
    seen = set()

    def need(sid, field, value, pool, label):
        if value not in pool:
            out.append(f'{sid}: {field} {value!r} is not in {label}')

    for st in styles:
        sid = st.get('id', '?')
        if sid in seen:
            out.append(f'{sid}: duplicate id')
        seen.add(sid)
        need(sid, 'status', st.get('status'), STATUSES, 'the statuses')
        need(sid, 'krish_verdict', st.get('krish_verdict'), VERDICTS, 'the verdicts')
        if st.get('krish_verdict') != 'untested' and not (st.get('krish_rating') or {}).get('said'):
            out.append(f'{sid}: a verdict other than untested needs krish_rating with his words')
        need(sid, 'playbook_mapping', st.get('playbook_mapping'), MAPPINGS, 'the mappings')
        need(sid, 'playbook_format', st.get('playbook_format'), formats, 'playbook_formats')
        need(sid, 'script_format', st.get('script_format'), b['script'], 'formats.script')
        need(sid, 'production_format', st.get('production_format'), b['production'], 'formats.production')
        need(sid, 'motion_style', st.get('motion_style'), b['motion'], 'the motion layer')
        need(sid, 'caption_look', st.get('caption_look'), CAPTION_MODULES, 'the caption modules')
        for m in st.get('picture_modules') or []:
            need(sid, 'picture_module', m, b['bank'], 'the style bank')
        for end in ('opening', 'close'):
            v = st.get(end)
            if not isinstance(v, dict) or len(v) != 1 or not (v.get('id') or v.get('text')):
                out.append(f'{sid}: {end} must be {{"id": bank id}} or {{"text": words}}')
            elif v.get('id'):
                need(sid, end, v['id'], b['bank'], 'the style bank')
                if b['layer'].get(v['id']) not in (None, end):
                    out.append(f'{sid}: {end} {v["id"]!r} is a {b["layer"][v["id"]]} module, not one for {end}')
        for ln in st.get('lengths') or []:
            need(sid, 'length', ln, b['lengths'], '_video.ts lengths')
        if not st.get('lengths'):
            out.append(f'{sid}: no lengths')
        for d in st.get('devices') or []:
            need(sid, 'device', d, b['devices'], 'config/ve/devices.json')
        track = (st.get('sound') or {}).get('track')
        if track is not None:
            need(sid, 'sound.track', track, b['tracks'], 'config/music-library.json')
        for fid in st.get('prevents') or []:
            need(sid, 'prevents', fid, b['failures'], 'config/failures.json')
        if st.get('ve_format') and not os.path.exists(os.path.join(ROOT, 'config/ve/formats', st['ve_format'] + '.json')):
            out.append(f'{sid}: ve_format {st["ve_format"]} has no config/ve/formats file')
        if st.get('recipe') and not os.path.exists(os.path.join(ROOT, st['recipe'])):
            out.append(f'{sid}: recipe {st["recipe"]} does not exist')
        ev = st.get('evidence') or {}
        for cid in ev.get('cards') or []:
            if not UUID.match(cid):
                out.append(f'{sid}: evidence card {cid!r} is not an inspiration_items id')
        for w in ev.get('krish_words') or []:
            if not w.get('said') or not w.get('source'):
                out.append(f'{sid}: krish_words needs said and source')
                continue
            if not quote_found(w['said'], w['source'], b):
                out.append(f'{sid}: not found verbatim in {w["source"]}: {w["said"][:60]!r}')
    return out


def esc(v):
    return html.escape(str(v)) if v is not None else ''


PAGE_CSS = """
:root{--bg:#f6f4ef;--ink:#1d1d1b;--soft:#6b6a65;--card:#fff;--line:#e2ded4;--accent:#0f6b5c}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--ink:#ecebe6;--soft:#a3a29c;--card:#1f1f1d;--line:#33322e;--accent:#5cc2ad}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}h1{font-size:26px;margin:0 0 4px}p.lead{color:var(--soft);margin:0 0 24px}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 20px}
h2{margin:0;font-size:20px}.tag{display:inline-block;font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--line);color:var(--soft);margin:4px 4px 0 0}
.tag.fmt{border-color:var(--accent);color:var(--accent)}.pitch{font-size:16px;margin:10px 0 14px}
dl{display:grid;grid-template-columns:150px 1fr;gap:4px 14px;margin:0}dt{color:var(--soft)}dd{margin:0}
.thumbs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.thumbs img{height:150px;border-radius:8px;border:1px solid var(--line)}
blockquote{margin:6px 0;padding-left:10px;border-left:3px solid var(--accent)}ul{margin:4px 0 0;padding-left:18px}
@media (max-width:640px){dl{grid-template-columns:1fr}dt{margin-top:6px}}
"""


def render(doc, thumbs=None):
    thumbs = thumbs or {}
    fmts = doc['playbook_formats']
    parts = ['<!doctype html><html lang="en"><head><meta charset="utf-8">',
             '<meta name="viewport" content="width=device-width,initial-scale=1">',
             f'<title>Video style catalogue</title><style>{PAGE_CSS}</style></head><body><main>',
             '<h1>Video style catalogue</h1>',
             '<p class="lead">Each style is the whole video, chosen before the script: format, hook, length, picture, '
             'motion, captions and sound. Every verdict is untested until you rate it; every format mapping marked '
             '"engine guess" waits on your yes.</p>']
    for st in doc['styles']:
        ev = st.get('evidence') or {}
        snd = st.get('sound') or {}
        parts.append('<section>')
        parts.append(f'<h2>{esc(st["name"])}</h2>')
        parts.append(f'<span class="tag fmt">{esc(fmts.get(st["playbook_format"], st["playbook_format"]))}'
                     f' ({esc(st.get("playbook_mapping", ""))})</span>'
                     f'<span class="tag">{esc(st["status"])}</span><span class="tag">verdict: {esc(st["krish_verdict"])}</span>')
        parts.append(f'<p class="pitch">{esc(st["pitch"])}</p>')
        imgs = [thumbs[c] for c in ev.get('cards') or [] if c in thumbs]
        if imgs:
            parts.append('<div class="thumbs">' + ''.join(f'<img alt="inspiration card" src="{esc(u)}">' for u in imgs) + '</div>')
        rows = [
            ('Script format', st['script_format']), ('Production', st['production_format']),
            ('Lengths', ', '.join(st['lengths'])), ('Hook', st['hook']), ('Opening', st['opening'].get('id') or st['opening'].get('text')),
            ('Close', st['close'].get('id') or st['close'].get('text')), ('Motion style', st['motion_style']), ('Captions', st['caption_look']),
            ('Picture', ', '.join(st.get('picture_modules') or [])),
            ('Sound', f'{snd.get("track") or "no track yet"}; big moment: {snd.get("big_moment") or "none"}'),
            ('Devices', ', '.join(st.get('devices') or []) or 'none named'),
            ('Prevents', ', '.join(st.get('prevents') or [])),
            ('Performance', ev.get('performance') or 'no measurement yet'),
        ]
        g = st.get('measured_grammar')
        if g:
            rows.append(('Measured grammar', f'{", ".join(g["tags"])} ({g["cards"]} card, {g["source"]})'))
        parts.append('<dl>' + ''.join(f'<dt>{esc(k)}</dt><dd>{esc(v)}</dd>' for k, v in rows) + '</dl>')
        words = ev.get('krish_words') or []
        if words:
            parts.append('<p><strong>Your words</strong></p>' + ''.join(
                f'<blockquote>{esc(w["said"])}<br><small>{esc(w["source"])}</small></blockquote>' for w in words))
        for label, key in (('Never', 'never'), ('Missing to build it', 'gaps')):
            if st.get(key):
                parts.append(f'<p><strong>{label}</strong></p><ul>' + ''.join(f'<li>{esc(x)}</li>' for x in st[key]) + '</ul>')
        parts.append('</section>')
    parts.append('</main></body></html>')
    return '\n'.join(parts)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--render', metavar='OUT_DIR')
    ap.add_argument('--thumbs', metavar='THUMBS_JSON')
    a = ap.parse_args(argv)
    with open(CATALOGUE, encoding='utf-8') as f:
        doc = json.load(f)
    if a.check or a.render:
        out = problems(doc)
        for p in out:
            print('video-styles:', p, file=sys.stderr)
        if a.check:
            print(f'video-styles: {len(doc.get("styles", []))} styles, {len(out)} problems')
            return 1 if out else 0
        if out:
            return 1
        thumbs = {}
        if a.thumbs:
            with open(a.thumbs, encoding='utf-8') as f:
                thumbs = json.load(f)
        os.makedirs(a.render, exist_ok=True)
        path = os.path.join(a.render, 'video-style-catalogue.html')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(render(doc, thumbs))
        print(f'wrote {path}')
        return 0
    for st in doc['styles']:
        print(f"{st['status']:<9} {st['playbook_format']:<18} {st['id']:<18} {st['pitch']}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
