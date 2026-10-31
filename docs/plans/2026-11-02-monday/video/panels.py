"""Monday 2 November's moving panels and both make.py configs, from the signed direction and his heard words.

Every picture beat of creative-direction.json becomes one moving panel drawn by scenes.html ("The Ladder"), at the
panel size make.py lays beside his face (1314 x 1080) or above it (1080 x 1000). Each beat's moves land on his own
words: the beat's window and its event words are read from his take (takes/<cut>.words.json, the transcript make.py
also hears with), never typed in. The 90-second cut's panels are split into pages at their event words, so make.py's
9:16 gate (a picture over 90% of his words, no gap over 1.5 s, 20 changes a minute) sees the changes the motion makes.

    python docs/plans/2026-11-02-monday/video/panels.py render [long|short] [--only l05,l06]
    python docs/plans/2026-11-02-monday/video/panels.py configure

Run from the repository root after kit.py and prepare_takes.py.
"""
import glob
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = ROOT / 'docs/plans/2026-11-02-monday'
HERE = Path(__file__).resolve().parent
WORK = ROOT / '.cache/produce/2026-11-02-9a0c97af'
PANELS = WORK / 'panels'
FPS = 30
SIZE = {'16x9': (1314, 1080), '9x16': (1080, 1000)}
SRC = '../imagery/src/'
R = 'ANTHROPIC · OCT 2026'
IMF = 'IMF · BESSEN 2015'
NPR = 'NPR PLANET MONEY · 2015'
STAN = 'HOSSEINI & LICHTINGER · 2025'

# id, beat number (1-based, creative-direction.json), scene, params, events {name: heard word or phrase}
LONG = [
    ('l01', 1, 'label', {'text': 'ANTHROPIC · ITS OWN STAFF', 'img': SRC + 'report-cover.jpg'}, {}),
    ('l02', 2, 'build', {}, {'y2030': '2030'}),
    ('l03', 3, 'doc', {'img': SRC + 'report-cover.jpg', 'credit': R, 'travel': 0.02}, {}),
    ('l04', 4, 'four', {'credit': R, 'rebuild': True}, {'early': 'early', 'four': 'four'}),
    ('l05', 5, 'drop', {'credit': R}, {'fewer': 'fewer', 'drop': 'twenty', 'land': 'nine'}),
    ('l06', 6, 'bars', {'credit': R, 'label': 'AUGUST · HOURS WORKED'}, {'august': 'august', 'staff': 'agents', 'hours': 'hours'}),
    ('l07', 7, 'doc', {'img': SRC + 'report-managers.jpg', 'credit': R, 'text': '1 IN 3 ML MANAGERS'}, {'label': 'managers'}),
    ('l09', 9, 'doc', {'img': SRC + 'stanford.jpg', 'credit': STAN, 'travel': 0.03}, {}),
    ('l10', 10, 'lines', {'text': 'SINCE 2023 · FIRMS USING AI', 'credit': STAN}, {'split': 'while'}),
    ('l11', 11, 'doc', {'img': SRC + 'stanford-slower.jpg', 'credit': STAN}, {}),
    ('l12', 12, 'label', {'text': 'ATMS · SPREADSHEETS', 'words': ['ATMS', 'SPREADSHEETS']}, {'w0': 'before', 'w1': 'twice'}),
    ('l13', 13, 'branch', {'credit': IMF, 'text': '1988 TO 2004'}, {'close': '13'}),
    ('l14', 14, 'copies', {'credit': IMF}, {'more': 'more', 'pct': 'percent'}),
    ('l15', 15, 'doc', {'img': SRC + 'imf.jpg', 'credit': IMF}, {}),
    ('l16', 16, 'ledger', {'credit': NPR}, {'gone': 'gone', 'added': 'added'}),
    ('l18', 18, 'taller', {}, {'bigger': 'bigger'}),
    ('l20', 20, 'firststep', {}, {'tellers': 'tellers', 'accountant': 'accountant'}),
    ('l21', 21, 'gap', {'taller': True}, {'first': 'first'}),
    ('l22', 22, 'doc', {'img': SRC + 'report-object-level.jpg', 'credit': R}, {}),
    ('l24', 24, 'doc', {'img': SRC + 'report-not-hired.jpg', 'credit': R}, {}),
    ('l25', 25, 'doc', {'img': SRC + 'report-judgment.jpg', 'credit': R}, {}),
    ('l27', 27, 'judgement', {}, {'judgement': 'judgment.'}),
    ('l29', 29, 'stat', {'credit': R}, {'n75': '75'}),
    ('l30', 30, 'line2030', {}, {'juniors': 'juniors'}),
    ('l31', 31, 'sheet', {'mode': 'open'}, {}),
    ('l32', 32, 'sheet', {'mode': 'weeks'}, {'weeks': 'weeks'}),
    ('l33', 33, 'sheet', {'mode': 'macro'}, {'first': 'first', 'second': 'second', 'third': 'does the second'}),
    ('l35', 35, 'calendar', {}, {'shrink': 'shrink'}),
    ('l37', 37, 'questions', {'text': 'NEXT HIRING MEETING', 'cards': ['Who on this team will be a senior in 2030?', 'What are they learning on today?']},
     {'q0': 'senior', 'q1': 'learning'}),
    ('l40', 40, 'action', {'kicker': '1 · EACH TEAM, 4 YEARS OUT', 'text': 'Who will be senior, and what they learn on now'}, {}),
    ('l41', 41, 'action', {'kicker': '2 · YOUR LAST 3 HIRES', 'text': 'If AI left a junior role empty, where does that learning happen now?'}, {}),
    ('l42', 42, 'action', {'kicker': '3 · ONE DULL WEEKLY JOB', 'text': 'By hand first, then the fix with AI'}, {}),
]
SHORT = [
    ('s01', 1, 'label', {'text': 'ANTHROPIC · ITS OWN STAFF', 'img': SRC + 'report-cover.jpg'}, {}),
    ('s02', 2, 'drop', {'credit': R, 'cx': 0.32}, {'fewer': 'fewer', 'drop': 'one', 'land': '10'}),
    ('s03', 3, 'doc', {'img': SRC + 'report-managers.jpg', 'credit': R, 'text': '1 IN 3 ML MANAGERS'}, {'label': 'managers'}),
    ('s04', 4, 'copies', {'credit': 'IMF · NPR PLANET MONEY', 'n': 10}, {'more': 'cash', 'pct': 'spreadsheets'}),
    ('s06', 6, 'gap', {'cx': 0.5, 'y2030': True}, {'first': 'first'}),
    ('s07', 7, 'doc', {'img': SRC + 'report-not-hired.jpg', 'credit': R}, {}),
    ('s08', 8, 'sheet', {'mode': 'macro'}, {'first': 'job', 'second': 'spot', 'third': 'better'}),
    ('s09', 9, 'questions', {'text': 'BEFORE YOU CUT A JUNIOR ROLE', 'cards': ['Who will your seniors be?', 'What are they learning on today?'], 'cx': 0.5},
     {'q0': 'seniors', 'q1': 'learning'}),
    ('s11', 11, 'action', {'kicker': '1 · NAME THEM  ·  2 · ONE DULL JOB', 'text': "Name each team's future seniors. Give a junior one dull weekly job."}, {}),
]
# where the 90-second cut's panels turn the page (event names); every other beat is one page
SHORT_PAGES = {'s02': ['drop', 'land'], 's04': ['pct'], 's06': ['first'], 's08': ['second', 'third'], 's09': ['q0', 'q1']}
# the 90-second cut's beat 5 ("But I think this time is different", 3.1 s on his face alone) would leave a 3.1 s gap
# under make.py's 9:16 gate: s04's past scene holds through it, still settling (recorded in production_notes).
SHORT_HOLD = {'s04': 5}


def words_of(cut):
    return json.loads((PLAN / 'takes' / f'{cut}.words.json').read_text())['words']


def norm(w):
    return re.sub(r"[^a-z0-9%]", '', w.lower())


def secs(stamp):
    m, s = stamp.split(':')
    return int(m) * 60 + float(s)


def window(beat):
    a, b = beat['timing'].split(' in the take')[0].split('-')
    return secs(a), secs(b)


def heard_between(ws, s, e):
    return [w for w in ws if w['s'] >= s - 0.05 and w['e'] <= e + 0.05]


def event_time(ws, s, e, phrase):
    toks = [norm(x) for x in phrase.split()]
    for i, w in enumerate(ws):
        if w['s'] < s - 0.05 or w['s'] > e:
            continue
        if all(i + k < len(ws) and norm(ws[i + k]['w']) == toks[k] for k in range(len(toks))):
            return round(w['s'] - s, 3)
    return None


def beats():
    d = json.loads((PLAN / 'creative-direction.json').read_text())
    return {c: d['cuts'][c]['beats'] for c in ('long', 'short')}


def plan(cut):
    spec = LONG if cut == 'long' else SHORT
    bs, ws = beats()[cut], words_of(cut)
    out = []
    for cid, n, scene, params, evs in spec:
        s, e = window(bs[n - 1])
        if cut == 'short' and cid in SHORT_HOLD:
            e = window(bs[SHORT_HOLD[cid] - 1])[1]
        heard = heard_between(ws, s, e)
        events = {k: event_time(ws, s, e, p) for k, p in evs.items()}
        missing = [k for k, v in events.items() if v is None]
        events = {k: v for k, v in events.items() if v is not None}
        out.append({'id': cid, 'beat': n, 'scene': scene, 'params': {**params, 'dur': e - s}, 'events': events, 'missing': missing,
                    's': s, 'e': e, 'start': ' '.join(w['w'].strip() for w in heard[:3]), 'end': ' '.join(w['w'].strip() for w in heard[-3:]),
                    'heard': heard})
    return out


class Encoder:
    def __init__(self, out):
        self.p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', str(FPS), '-i', '-',
                                   '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', str(FPS), str(out)],
                                  stdin=subprocess.PIPE)

    def add(self, jpg):
        self.p.stdin.write(jpg)

    def close(self):
        self.p.stdin.close()
        assert self.p.wait() == 0


def render(cut, only=None):
    from playwright.sync_api import sync_playwright
    PANELS.mkdir(parents=True, exist_ok=True)
    shape = '16x9' if cut == 'long' else '9x16'
    w, h = SIZE[shape]
    exe = next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))), None)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.goto((HERE / 'scenes.html').as_uri())
        pg.evaluate('document.fonts.ready')
        for item in plan(cut):
            if only and item['id'] not in only:
                continue
            pg.evaluate('([s,p,e,w,h])=>setup(s,p,e,w,h)', [item['scene'], item['params'], item['events'], w, h])
            pg.wait_for_timeout(250)
            seconds = item['e'] - item['s'] + 2.0      # room for make.py's padding, so a panel never loops back to its start
            out = PANELS / f"{item['id']}-{shape}.mp4"
            enc = Encoder(out)
            for n in range(round(seconds * FPS)):
                pg.evaluate(f'draw({n / FPS:.4f})')
                enc.add(pg.screenshot(type='jpeg', quality=92))
            enc.close()
            if item['id'] in SHORT_PAGES and cut == 'short':
                split(item, out, shape)
            print('drew', out.name, f"{seconds:.1f}s", ('missing events: ' + ','.join(item['missing'])) if item['missing'] else '')
        b.close()


def split(item, whole, shape):
    """The 90-second cut's pages: the same continuous scene cut at its event words, each page from its own word on."""
    marks = [0.0] + [item['events'][k] for k in SHORT_PAGES[item['id']] if k in item['events']]
    for i, t0 in enumerate(marks):
        out = PANELS / f"{item['id']}-p{i + 1}-{shape}.mp4"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.3f}', '-i', str(whole), '-c:v', 'libx264', '-preset', 'medium',
                        '-crf', '16', '-pix_fmt', 'yuv420p', str(out)], check=True)


def page_words(item):
    """The heard words each page lands on (three words from its event word)."""
    out = [item['start']]
    for k in SHORT_PAGES.get(item['id'], []):
        if k not in item['events']:
            continue
        t = item['s'] + item['events'][k]
        idx = next(i for i, w in enumerate(item['heard']) if abs(w['s'] - t) < 0.02)
        out.append(' '.join(w['w'].strip() for w in item['heard'][idx:idx + 3]))
    return out


def cue(item, shape):
    c = {'id': item['id'], 'panel': f"../panels/{item['id']}-{shape}.mp4", 'start': item['start'], 'end': item['end']}
    if shape == '9x16' and item['id'] in SHORT_PAGES:
        on = page_words(item)
        files = [f"../panels/{item['id']}-p{i + 1}-{shape}.mp4" for i in range(len(on))]
        c.update({'panel': files[0], 'pages': {shape: files}, 'on': on})
    return c


def configure():
    kit = WORK / 'kit'
    common = {'crop': [1080, 1920, 0, 0], 'music': 'auto', 'series': 'follow_the_money', 'voice': 'repair', 'reframe': False,
              'max_gap': 0.9, 'pad_before': 0.2, 'pad_after': 0.3, 'captions': True, 'caption_style': 'house', 'strap': False}
    # Caption words where the transcriber and he differ, each with its evidence: medium.en and large-v3-turbo both
    # hear "behind Claude" at 0:05 of the long take (31 Oct); the rest are the transcriber's spellings of his words.
    long_replace = [['buying Claude', 'behind Claude'], ['its own stuff', 'its own staff'], ['hiring lists', 'hiring less'],
                    ['make your mind hop .ai', 'makeyourmindup.ai'], ['make your mind hop.ai', 'makeyourmindup.ai'],
                    ['makeyourmindup .ai', 'makeyourmindup.ai'], ['twenty seven percent', '27%'], ['nine percent', '9%']]
    short_replace = [['start to work', 'starter work'], ['makeyourmindup .ai', 'makeyourmindup.ai']]
    for cut, shape, extra in (('long', '16x9', {'remove': [{'say': "So we had one today and that's a"}], 'replacements': long_replace,
                                                 'music_mode': 'episode', 'music_seconds': 100}),
                              ('short', '9x16', {'remove': [], 'replacements': short_replace, 'music_seconds': 90})):
        path = kit / f'{cut}.json'
        cfg = json.loads(path.read_text(encoding='utf-8'))
        stable = WORK / 'takes' / f'{cut}-stable.mp4'
        cfg.update(common)
        cfg.update({'source': f"../takes/{cut}-stable.mp4" if stable.exists() else f"../takes/{cut}-cfr.mp4",
                    'cues': [cue(i, shape) for i in plan(cut)], **extra})
        path.write_text(json.dumps(cfg, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print('configured', cut, len(cfg['cues']), 'cues, source', cfg['source'])


if __name__ == '__main__':
    step = sys.argv[1]
    if step == 'render':
        cuts = [a for a in sys.argv[2:] if a in ('long', 'short')] or ['long', 'short']
        only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
        for c in cuts:
            render(c, only)
    elif step == 'plan':
        for c in ('long', 'short'):
            for i in plan(c):
                print(c, i['id'], f"{i['s']:.2f}-{i['e']:.2f}", '|', i['start'], '...', i['end'], '| events', i['events'], '| MISSING', i['missing'] or '')
    elif step == 'configure':
        configure()
