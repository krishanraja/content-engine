"""Friday 23 Oct, "two passports": every beat of the four videos, timed to Krish's takes.

Each beat starts on an anchor phrase found in the take's own word timings (faster-whisper small.en, the same
transcriber make.py uses) and ends where the next beat starts. Run it from the repository root:

    python docs/plans/2026-10-23-friday/locked/beats.py WORDS_DIR

WORDS_DIR holds cam-5min.words.json, cam-90s.words.json, vo-a.words.json (the 90-second voiceover) and
vo-b.words.json (the 5-minute voiceover), made by scripts/quick-edit/make.py's transcribe(). It writes timings.json
beside this file. visual-copy.json carries what goes on screen for each beat id; this file only says when.
"""
import json, re, sys
from pathlib import Path

TAKES = {
    'vo-5min':  {'words': 'vo-b.words.json', 'file': 'slice_FC18A811-B2D8-44A1-9CFF-CA579835B370_1.m4a',
                 'sha256': '30ed0af98c2c', 'shape': '16:9'},
    'cam-5min': {'words': 'cam-5min.words.json', 'file': 'Fri 23 Oct - 5-minute - Two passports~2.mp4',
                 'sha256': '87819f842b76', 'shape': '16:9 (take is portrait 1080x1920, rotation -90)'},
    'vo-90s':   {'words': 'vo-a.words.json', 'file': 'slice_7C38672A-B9E8-46D3-A454-284B913D6D74_1.m4a',
                 'sha256': '007db593baa4', 'shape': '9:16'},
    'cam-90s':  {'words': 'cam-90s.words.json', 'file': 'Fri 23 Oct - 90-second - Two passports~2.mp4',
                 'sha256': 'bb5209f5c752', 'shape': '9:16 (take is portrait 1080x1920, rotation -90)'},
}

# beat id: {take: anchor}. A take missing from a beat does not have it.
LONG = [
    ('L01-hook',        {'vo-5min': 'you may already', 'cam-5min': 'you may already'}),
    ('L02-why',         {'vo-5min': "i've been having", 'cam-5min': "i've been having"}),
    ('L03-airbnb',      {'vo-5min': 'start with airbnb', 'cam-5min': "let's start with airbnb"}),
    ('L04-fling',       {'vo-5min': 'he called it fast', 'cam-5min': 'he called it fast'}),
    ('L05-cursor',      {'vo-5min': "then there's cursor", 'cam-5min': "then there's cursor"}),
    ('L06-lindy',       {'vo-5min': 'and lindy', 'cam-5min': 'and lindy'}),
    ('L07-race',        {'vo-5min': "now who's", 'cam-5min': "now who's"}),
    ('L08-stanford',    {'vo-5min': 'stanford counts', 'cam-5min': 'stanford counts'}),
    ('L09-gap',         {'vo-5min': 'but by march', 'cam-5min': 'but by march'}),
    ('L10-everyone',    {'vo-5min': 'and everyone else', 'cam-5min': 'and now everyone else'}),
    ('L11-sovereign',   {'vo-5min': "that's what people mean", 'cam-5min': "and that's what people mean"}),
    ('L12-korea',       {'vo-5min': 'south korea even', 'cam-5min': 'south korea even'}),
    ('L13-awkward',     {'vo-5min': "that's pretty awkward", 'cam-5min': 'that was pretty awkward'}),
    ('L14-passports',   {'vo-5min': "so here's the trick", 'cam-5min': 'so think of it'}),
    ('L15-born',        {'vo-5min': 'where it was born shapes', 'cam-5min': 'where it was born shapes'}),
    ('L16-third',       {'vo-5min': 'more than a third', 'cam-5min': 'and more than a third'}),
    ('L17-deepseek63',  {'vo-5min': 'deepseek did it', 'cam-5min': 'deepseek did it'}),
    ('L18-claude',      {'vo-5min': 'but claude', 'cam-5min': 'but claude'}),
    ('L19-grok',        {'vo-5min': 'and china has', 'cam-5min': 'and china has'}),
    ('L20-boss',        {'vo-5min': 'which is one way', 'cam-5min': "i suppose it's one"}),
    ('L21-lives',       {'vo-5min': 'now the second passport', 'cam-5min': 'now the second passport'}),
    ('L22-app',         {'vo-5min': "use deepseek's own", 'cam-5min': "if you use deepseek's"}),
    ('L23-home',        {'vo-5min': 'but you can bring', 'cam-5min': 'but you can bring'}),
    ('L24-selfhost',    {'vo-5min': 'and what about running', 'cam-5min': 'so what about running'}),
    ('L25-nist',        {'vo-5min': "well america's government", 'cam-5min': "well america's government"}),
    ('L26-takechina',   {'vo-5min': 'you can take deepseek', 'cam-5min': 'so you can take'}),
    ('L27-tried',       {'vo-5min': 'so i tried it', 'cam-5min': 'so i tried it'}),
    ('L28-method',      {'vo-5min': 'if only the china', 'cam-5min': 'if only the china'}),
    ('L29-cotton',      {'vo-5min': 'first a supplier', 'cam-5min': 'first i tried a'}),
    ('L30-blocked',     {'vo-5min': 'now america has blocked', 'cam-5min': 'now america has blocked'}),
    ('L31-flagged',     {'vo-5min': 'claude and chat', 'cam-5min': 'claude and jack'}),
    ('L32-deleted',     {'vo-5min': 'now watch deepseek', 'cam-5min': 'but for xinjiang'}),
    ('L33-taiwan',      {'vo-5min': 'then a board', 'cam-5min': 'then i did'}),
    ('L34-draw',        {'vo-5min': 'for taiwan all', 'cam-5min': 'for the taiwan question'}),
    ('L35-knew',        {'vo-5min': 'on xinjiang deepseek knew', 'cam-5min': 'on xinjiang deepseek knew'}),
    ('L36-call',        {'vo-5min': 'so my call', 'cam-5min': 'so my call'}),
    ('L37-cheap',       {'vo-5min': 'and if you just want', 'cam-5min': 'at the end of'}),
    ('L38-supply',      {'vo-5min': 'but remember what', 'cam-5min': 'but just remember what'}),
    ('L39-reckon',      {'vo-5min': 'i reckon the', 'cam-5min': 'and i reckon'}),
    ('L40-do',          {'vo-5min': "here's what i'd", 'cam-5min': "and here's what i'd"}),
    ('L41-close',       {'vo-5min': 'the full deep', 'cam-5min': 'the full deep'}),
]
SHORT = [
    ('S01-hook',        {'vo-90s': 'you may already', 'cam-90s': 'you might already'}),
    ('S02-airbnb',      {'vo-90s': "airbnb's boss", 'cam-90s': "airbnb's boss"}),
    ('S03-fling',       {'vo-90s': 'he called it fast', 'cam-90s': 'he called it fast'}),
    ('S04-passports',   {'vo-90s': 'see every ai', 'cam-90s': 'see every ai'}),
    ('S05-newspaper',   {'vo-90s': 'where it was born shapes', 'cam-90s': 'where it was born shapes'}),
    ('S06-third',       {'vo-90s': 'and a third of', 'cam-90s': 'and about a third'}),
    ('S07-claude',      {'vo-90s': 'claude an american', 'cam-90s': 'claude an american'}),
    ('S08-lives',       {'vo-90s': 'where it lives decides', 'cam-90s': 'so where it lives'}),
    ('S09-work',        {'vo-90s': 'and at work', 'cam-90s': 'but does this matter'}),
    ('S10-flagged',     {'vo-90s': 'two flagged', 'cam-90s': 'two flagged'}),
    ('S11-deleted',     {'vo-90s': 'now watch deepseek', 'cam-90s': 'deepseek wrote an'}),
    ('S12-call',        {'vo-90s': 'my call is', 'cam-90s': 'my call is'}),
    ('S13-do',          {'vo-90s': "and here's what", 'cam-90s': "now here's what"}),
    ('S13b-recap',      {'cam-90s': "so that's the two passports"}),
    ('S13c-second',     {'cam-90s': 'and of course keep'}),
    ('S14-close',       {'vo-90s': 'the full deep', 'cam-90s': 'the full deep'}),
]


def norm(t):
    return re.sub(r"[^a-z0-9']", '', t.lower().replace('’', "'"))


def find(words, anchor, start):
    want = [norm(a) for a in anchor.split()]
    toks = [norm(w['w']) for w in words]
    for i in range(start, len(toks) - len(want) + 1):
        if toks[i:i + len(want)] == want:
            return i
    raise SystemExit(f'anchor not found after word {start}: "{anchor}"')


def time_take(take, beats, words, duration):
    out, idx = [], 0
    hits = []
    for bid, anchors in beats:
        if take not in anchors:
            continue
        idx = find(words, anchors[take], idx)
        hits.append((bid, idx))
    for n, (bid, i) in enumerate(hits):
        j = hits[n + 1][1] if n + 1 < len(hits) else len(words)
        seg = words[i:j]
        out.append({'beat': bid, 'start': round(seg[0]['s'], 2),
                    'end': round(words[j]['s'], 2) if j < len(words) else round(duration, 2),
                    'said': ''.join(w['w'] for w in seg).strip()})
    return out


def main(words_dir):
    here = Path(__file__).parent
    result = {'_about': 'Beat timings in seconds of each raw take, from beats.py. Regenerate, never hand-edit.'}
    for take, meta in TAKES.items():
        d = json.loads((Path(words_dir) / meta['words']).read_text())
        beats = LONG if '5min' in take else SHORT
        result[take] = {**{k: v for k, v in meta.items() if k != 'words'}, 'duration': round(d['duration'], 2),
                        'beats': time_take(take, beats, d['words'], d['duration'])}
    (here / 'timings.json').write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n')
    for take in TAKES:
        print(take, len(result[take]['beats']), 'beats, ends', result[take]['beats'][-1]['end'])


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.cache/takes')
