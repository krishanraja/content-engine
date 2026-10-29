#!/usr/bin/env python3
"""The creative direction: what every beat of a cut shows, written by Claude before Krish records, signed by him
after he sees the storyboard, and the only brief a production session (Codex or Claude) renders from.

Krish, 2026-10-24: "Once the videos are recorded, Claude gets the scripts and the visual creative direction locked so
that codex can take over on the video production ... the copy of the article and what goes in the visuals etc is all
Claude responsibility." Wednesday 21 Oct had no direction and the production session improvised 38 one-off scripts;
Friday 23 Oct had one (docs/plans/2026-10-23-friday/creative-direction.md) and it is the model. The standard is
docs/CREATIVE_DIRECTION.md; this file holds it:

    python3 scripts/post-pack/creative_direction.py template docs/plans/PLAN --cut long --script FILE [--take on_camera|voiceover]
    python3 scripts/post-pack/creative_direction.py check docs/plans/PLAN/creative-direction.json [--for-render]
    python3 scripts/post-pack/creative_direction.py choices docs/plans/PLAN/creative-direction.json
    python3 scripts/post-pack/creative_direction.py self-test

`check` refuses a direction that leaves any spoken word without a decided picture, a picture without its source, a
beat without the point it lands (house rule VISUAL_EXPLAINS), crowded on-screen words, a module not in the style bank,
a face in every beat when the style says otherwise, or no brand reference. `--for-render` also needs Krish's signed
words bound to the exact script text (sha256): a script changed after he signed makes the direction stale.
quick-edit's kit.py and make.py call gate() and refuse to render without it.

The choices under test (Rulings, Krish, 2026-10-29: "we need to test and learn"; config/reference-cuts.json
`under_test`) ride on the direction as `production_choices`: the opening, the sound on the big moment, and the lead
picture, which the storyboard he signs shows as two stills, the series picture from the brand book and a story object,
with Claude's pick marked (Krish picked: "Choose per piece"). His signature accepts the pick unless he ticks the other.
`check` never refuses a direction over them, a missing tick included; `choices` prints them for the storyboard, and
making.py <piece> choices records them on the piece.
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STYLES = ROOT / 'config' / 'style-references.json'
BAR = ROOT / 'config' / 'reference-cuts.json'  # the bar; its `under_test` holds each choice's default and options
FILE = 'creative-direction.json'
# Pieces published on or after this day render only from a signed direction (the first Sunday of the new loop).
FROM = date(2026, 10, 26)
PICTURES = ('face', 'screen', 'chart', 'card', 'photo', 'footage', 'logo', 'document')
MAX_SCREEN_WORDS = 12        # Wednesday's figures were "too wordy"; a viewer reads about this many in a beat
MIN_POINT_WORDS = 4
DEFAULT_MAX_FACE_SHARE = 0.6  # Krish, 2026-10-23: "not have my face in absolutely everything"
ACCEPTANCE = [
    'Watched end to end at full size, at the speed the audience sees it, by a reviewer who did not make the cut',
    'Every spoken word heard continuously: no chopped syllable at any join (audio compared around each edit boundary)',
    'Every picture lands on the words it proves, framing centred, logos at equal size, no shake left in',
    'Brand matches the reference frame: wordmark, captions, palette and the intro sting',
    'Fact, transport and editorial status reported separately; ready only when all three pass',
]


# Each series' own picture: the brand book (v1.5, p. 11, "Its device.") gives one to each section.
SERIES_PICTURE = {
    'follow.the.money': 'The money map and the receipt: flows between parties, width is the amount.',
    'under.the.hood': 'Real or theatre: the shipped thing, apart, every part stamped.',
    'mind.the.gap': 'Threads on a time axis that bend and meet, ending in a dated call.',
}
LEAD_PICTURES = ('series_picture', 'story_object')
# With the hook as the intro there is no sting, and a new direction says so rather than leaving brand.intro_sting for a
# session to fill with a sting its opening does not use (ruling 8, under test).
NO_STING = 'none: the hook is the intro (under test, ruling 8)'


class DirectionError(Exception):
    pass


def words(text):
    """The spoken words, in order, for matching: lower case, letters, digits and apostrophes only."""
    text = re.sub(r'\[[^\]]*\]|\([^)]*cue[^)]*\)', ' ', str(text or ''))  # stage notes are not spoken
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?", text.lower().replace('’', "'"))


def spoken(text):
    """The words he says, as quick-edit reads them (story_check.spoken_paragraphs), so the signature and the render
    see the same script: headings and stage notes are not spoken."""
    sys.path.insert(0, str(HERE))
    import story_check
    paras = story_check.spoken_paragraphs(str(text or ''))
    return '\n\n'.join(paras) if paras else str(text or '')


def script_hash(text):
    """sha256 of the script's spoken words: whitespace and markdown changes keep it, a changed word breaks it."""
    return hashlib.sha256(' '.join(words(spoken(text))).encode('utf-8')).hexdigest()


def bank():
    data = json.loads(STYLES.read_text(encoding='utf-8'))
    f = data.get('formats') or {}
    return ({m['id'] for m in data.get('bank') or []},
            {x['id']: x for x in f.get('script') or []}, {x['id']: x for x in f.get('production') or []})


def krish_said(signed):
    return isinstance(signed, dict) and signed.get('by') == 'Krish' and len(str(signed.get('said') or '').split()) >= 2 \
        and re.match(r'^\d{4}-\d{2}-\d{2}$', str(signed.get('on') or ''))


def check(doc, scripts=None, for_render=False):
    """Problems with a direction, [] when it is ready. scripts: {cut: the script text as it is now}; when given, every
    cut's beats must cover exactly its words in order, and (for_render) Krish's signature must be on that text."""
    out = []
    if not isinstance(doc, dict):
        return ['a direction is a JSON object (docs/CREATIVE_DIRECTION.md)']
    modules, script_formats, production_formats = bank()
    style = doc.get('style') or {}
    if style.get('script') not in script_formats:
        out.append(f'style.script {style.get("script")!r} is not a script format in config/style-references.json')
    if style.get('production') not in production_formats:
        out.append(f'style.production {style.get("production")!r} is not a production format in config/style-references.json')
    brand = doc.get('brand') or {}
    for key in ('series', 'reference', 'captions', 'intro_sting'):
        if not brand.get(key):
            out.append(f'brand.{key} is missing: the cut is compared with an approved earlier frame and the brand before it renders')
    cuts = doc.get('cuts') or {}
    if not cuts:
        out.append('no cuts: give cuts.long and cuts.short, each with its beats')
    voice_led = style.get('production') == 'voice-led-pictures'
    for cut, c in cuts.items():
        beats = (c or {}).get('beats') or []
        if not beats:
            out.append(f'{cut}: no beats')
            continue
        if c.get('take') not in ('on_camera', 'voiceover'):
            out.append(f'{cut}: take is on_camera or voiceover')
        faces = 0
        for n, b in enumerate(beats, 1):
            where = f'{cut} beat {n}'
            if not words(b.get('words')):
                out.append(f'{where}: no words; every beat carries the exact words it sits under')
            if len(str(b.get('point') or '').split()) < MIN_POINT_WORDS:
                out.append(f'{where}: no point; say what this beat makes the viewer understand (VISUAL_EXPLAINS)')
            pic = b.get('picture') or {}
            kind = pic.get('kind')
            if kind not in PICTURES:
                out.append(f'{where}: picture.kind is one of {", ".join(PICTURES)}')
            elif kind == 'face':
                faces += 1
                if voice_led or c.get('take') == 'voiceover':
                    out.append(f'{where}: his face in a voice-led cut; give the picture that proves the words')
            else:
                if not str(pic.get('what') or '').strip():
                    out.append(f'{where}: picture.what says exactly what is on screen')
                src = str(pic.get('source') or '')
                if not (src.startswith('https://') or src.startswith('capture:') or src.startswith('docs/') or src.startswith('config/')):
                    out.append(f'{where}: picture.source is an https link, a repository path or capture:<what he records>')
                if not str(pic.get('source_label') or '').strip() and kind in ('screen', 'chart', 'photo', 'footage', 'document'):
                    out.append(f'{where}: picture.source_label, shown on screen, names where it came from')
            text = str(b.get('on_screen_text') or '')
            if len(text.split()) > MAX_SCREEN_WORDS:
                out.append(f'{where}: {len(text.split())} words on screen; at most {MAX_SCREEN_WORDS}, or it reads as a slide')
            for m in b.get('modules') or []:
                if m not in modules:
                    out.append(f'{where}: module {m!r} is not in the style bank')
        share = faces / len(beats)
        limit = float(doc.get('max_face_share', DEFAULT_MAX_FACE_SHARE))
        if share > limit:
            out.append(f'{cut}: his face is {round(share * 100)}% of the beats; at most {round(limit * 100)}% (Krish, 2026-10-23)')
        if scripts is not None:
            text = scripts.get(cut)
            if text is None:
                out.append(f'{cut}: no script to check the beats against')
            else:
                said, beat_words = words(spoken(text)), [w for b in beats for w in words(b.get('words'))]
                if said != beat_words:
                    k = next((i for i, (a, z) in enumerate(zip(said, beat_words)) if a != z), min(len(said), len(beat_words)))
                    out.append(f'{cut}: the beats do not cover the script word for word; first difference at word {k + 1}: '
                               f'script "{" ".join(said[k:k + 6])}", beats "{" ".join(beat_words[k:k + 6])}"')
                if for_render:
                    signed = doc.get('signed') or {}
                    if not krish_said(signed):
                        out.append('not signed: Krish signs the storyboard in his own words (signed.by "Krish", said, on)')
                    elif (signed.get('script_sha256') or {}).get(cut) != script_hash(text):
                        out.append(f'{cut}: the script changed after Krish signed; show him the storyboard again')
    article = doc.get('article') or {}
    for n, v in enumerate(article.get('visuals') or [], 1):
        if not all(str(v.get(k) or '').strip() for k in ('point', 'question', 'source')):
            out.append(f'article visual {n}: point, the reader\'s question it answers and its source')
    if doc.get('acceptance') != ACCEPTANCE:
        out.append('acceptance must be the standard list (creative_direction.ACCEPTANCE); it is what the reviewer signs against')
    return out


def under_test(path=BAR):
    """choice id -> its entry in the bar's `under_test` (default, options, ruling): the one home of the defaults."""
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    return {c['id']: c for c in (data.get('under_test') or {}).get('choices') or []}


def choices_block(series='', path=BAR):
    """A direction's starting production_choices: each default from the bar, the sound only once he has approved a set
    by ear, and both lead pictures to draw as stills for the storyboard, the pick left for Claude to propose."""
    tested = under_test(path)
    sound = tested.get('big_moment_sound') or {}
    return {
        'opening': (tested.get('opening') or {}).get('default', ''),
        'lead_picture': {
            'series_picture': {'what': SERIES_PICTURE.get(series, ''), 'still': ''},
            'story_object': {'what': '', 'still': ''},
            'proposed': '',
            'ticked': None,
        },
        'big_moment_sound': sound.get('default', '') if sound.get('approved_set') else sound.get('until_approved', ''),
    }


def production_choices(doc):
    """What the piece used of each choice under test, flat, for the making record: his tick where he ticked the other
    lead picture, else Claude's proposal. A choice not yet made is left out; nothing here is ever refused."""
    block = (doc or {}).get('production_choices') or {}
    lead = block.get('lead_picture') if isinstance(block.get('lead_picture'), dict) else {}
    out = {'opening': block.get('opening'), 'lead_picture': lead.get('ticked') or lead.get('proposed'),
           'big_moment_sound': block.get('big_moment_sound')}
    return {k: v for k, v in out.items() if isinstance(v, str) and v}


def choice_lines(doc):
    """The choices as the storyboard shows them: both lead pictures as stills, the proposal marked."""
    block = (doc or {}).get('production_choices') or {}
    lead = block.get('lead_picture') if isinstance(block.get('lead_picture'), dict) else {}
    picked = lead.get('ticked') or lead.get('proposed')
    lines = [f'Opening (under test): {block.get("opening") or "not set"}']
    for n, key in enumerate(LEAD_PICTURES):
        still = lead.get(key) if isinstance(lead.get(key), dict) else {}
        mark = ' <- his tick' if lead.get('ticked') == key else ' <- Claude proposes' if lead.get('proposed') == key else ''
        lines.append(f'Lead picture {"AB"[n]}, {key.replace("_", " ")}: {still.get("what") or "(to draw)"}; still: '
                     f'{still.get("still") or "(to draw)"}{mark}')
    lines.append(f'His signature accepts {picked.replace("_", " ") if picked else "the proposal"} unless he ticks the '
                 'other; no storyboard waits on a tick.')
    lines.append(f'Sound on the big moment (under test): {block.get("big_moment_sound") or "not set"}')
    return lines


def gate(post_path, cut, script_text, publish_day=None):
    """For quick-edit before it draws or renders: the signed direction beside post.json, checked against the script
    it is about to use. Returns {path, sha256, signed} or raises DirectionError. Before FROM it returns None."""
    if publish_day is not None and publish_day < FROM:
        return None
    path = Path(post_path).resolve().parent / FILE
    if not path.exists():
        raise DirectionError(f'no {FILE} beside {Path(post_path).name}: Claude writes the creative direction before Krish records '
                             f'and he signs the storyboard (docs/CREATIVE_DIRECTION.md); nothing renders without it')
    raw = path.read_bytes()
    try:
        doc = json.loads(raw.decode('utf-8'))
    except ValueError as e:
        raise DirectionError(f'{path}: not JSON ({e})')
    if cut not in (doc.get('cuts') or {}):
        raise DirectionError(f'{path} has no {cut} cut: every cut is directed and signed before it renders')
    problems = [p for p in check(doc, {cut: script_text}, for_render=True) if p.startswith(f'{cut}') or not re.match(r'^(long|short|feature)\b', p)]
    if problems:
        raise DirectionError(f'{path} is not ready to render the {cut} cut:\n  ' + '\n  '.join(problems))
    try:
        shown = path.relative_to(ROOT).as_posix()  # the same file on either runner machine
    except ValueError:
        shown = str(path)
    return {'path': shown, 'sha256': hashlib.sha256(raw).hexdigest(), 'signed': doc['signed']}


def template(plan, cut, script_text, take='on_camera'):
    """A starting direction: one beat per sentence of the script, every decision left for Claude to make."""
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', ' '.join(spoken(script_text).split())) if s.strip()]
    beats = [{'words': s, 'point': '', 'picture': {'kind': '', 'what': '', 'source': '', 'source_label': ''},
              'on_screen_text': '', 'modules': [], 'motion': '', 'timing': 'from the take (narration_diff.py)'} for s in sentences]
    path = Path(plan) / FILE
    doc = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {
        'piece_id': '', 'publish_day': '', 'style': {'script': '', 'production': ''},
        'brand': {'series': '', 'reference': '', 'captions': '', 'intro_sting': ''},
        'max_face_share': DEFAULT_MAX_FACE_SHARE, 'cuts': {}, 'article': {'visuals': []}, 'do_not': [],
        'acceptance': ACCEPTANCE, 'signed': {'by': '', 'said': '', 'on': '', 'script_sha256': {}}}
    doc['cuts'][cut] = {'take': take, 'beats': beats}
    doc.setdefault('production_choices', choices_block(str((doc.get('brand') or {}).get('series') or '')))
    brand = doc.setdefault('brand', {})
    if not brand.get('intro_sting') and (doc['production_choices'] or {}).get('opening') == 'hook_is_intro':
        brand['intro_sting'] = NO_STING
    return path, doc


def _self_test():
    probs = []
    _, sf, pf = bank()
    script = 'I put two assistants head to head. One deleted its own answer. Here is what I would do with this info if I were you.'
    good = {
        'piece_id': '11111111-2222-4333-8444-555555555555', 'publish_day': '2026-10-26',
        'style': {'script': 'head-to-head', 'production': 'scoreboard-test'},
        'brand': {'series': 'mind.the.gap', 'reference': 'docs/plans/2026-10-23-friday/creative-direction.md', 'captions': 'kinetic-serif-captions', 'intro_sting': NO_STING},
        'cuts': {'long': {'take': 'on_camera', 'beats': [
            {'words': 'I put two assistants head to head.', 'point': 'the test is fair and the same for both', 'picture': {'kind': 'face'}, 'modules': ['live-scoreboard']},
            {'words': 'One deleted its own answer.', 'point': 'the censor acts after the answer is written', 'picture': {'kind': 'screen', 'what': 'the answer vanishing', 'source': 'capture:the DeepSeek moment', 'source_label': 'My test, 22 Oct'}, 'on_screen_text': 'It wrote it. Then deleted it.'},
            {'words': "Here is what I'd do with this info if I were you.", 'point': 'the viewer leaves with an action', 'picture': {'kind': 'card', 'what': 'three actions', 'source': 'docs/plans/x/actions.md'}}]}},
        'acceptance': ACCEPTANCE,
        'signed': {'by': 'Krish', 'said': 'storyboard signed, go', 'on': '2026-10-25', 'script_sha256': {}},
    }
    if 'head-to-head' not in sf or 'scoreboard-test' not in pf:
        probs.append('the formats it names are in the bank')
    script2 = script.replace("Here is what I would do", "Here is what I'd do")
    good['signed']['script_sha256']['long'] = script_hash(script2)
    if check(good, {'long': script2}, for_render=True) != []:
        probs.append(f'a complete signed direction passes: {check(good, {"long": script2}, for_render=True)}')
    dropped = json.loads(json.dumps(good)); dropped['cuts']['long']['beats'].pop(1)
    if not any('word for word' in p for p in check(dropped, {'long': script2})):
        probs.append('a line with no beat is refused')
    nosrc = json.loads(json.dumps(good)); nosrc['cuts']['long']['beats'][1]['picture']['source'] = ''
    if not any('picture.source' in p for p in check(nosrc, {'long': script2})):
        probs.append('a picture with no source is refused')
    wordy = json.loads(json.dumps(good)); wordy['cuts']['long']['beats'][1]['on_screen_text'] = ' '.join(['word'] * 20)
    if not any('words on screen' in p for p in check(wordy)):
        probs.append('a crowded frame is refused')
    pointless = json.loads(json.dumps(good)); pointless['cuts']['long']['beats'][2]['point'] = 'card'
    if not any('no point' in p for p in check(pointless)):
        probs.append('a beat with no point is refused')
    allface = json.loads(json.dumps(good))
    for b in allface['cuts']['long']['beats']:
        b['picture'] = {'kind': 'face'}
    if not any('his face is 100%' in p for p in check(allface)):
        probs.append('his face in every beat is refused')
    vo = json.loads(json.dumps(good)); vo['cuts']['long']['take'] = 'voiceover'
    if not any('face in a voice-led cut' in p for p in check(vo)):
        probs.append('a face in a voiceover take is refused')
    stale = json.loads(json.dumps(good))
    if not any('changed after Krish signed' in p for p in check(stale, {'long': script2 + ' One more line.'}, for_render=True)):
        probs.append('a script changed after signing is refused')
    unsigned = json.loads(json.dumps(good)); unsigned['signed'] = {'by': 'Claude', 'said': 'looks good', 'on': '2026-10-25'}
    if not any('not signed' in p for p in check(unsigned, {'long': script2}, for_render=True)):
        probs.append('a direction signed by anyone else is refused for render')
    nobrand = json.loads(json.dumps(good)); nobrand['brand'].pop('reference')
    if not any('brand.reference' in p for p in check(nobrand)):
        probs.append('a direction with no brand reference is refused')
    if script_hash('Hello,  **world**.') != script_hash('hello world'):
        probs.append('the script hash ignores formatting')
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        post = Path(tmp) / 'post.json'
        post.write_text('{}')
        try:
            gate(post, 'long', script2, date(2026, 10, 28))
            probs.append('no direction beside post.json stops the render')
        except DirectionError:
            pass
        if gate(post, 'long', script2, date(2026, 10, 23)) is not None:
            probs.append('a piece before the new loop is not held to it')
        (Path(tmp) / FILE).write_text(json.dumps(good))
        try:
            gate(post, 'short', script2, date(2026, 10, 28))
            probs.append('a cut the direction does not cover is refused')
        except DirectionError:
            pass
        try:
            rec = gate(post, 'long', script2, date(2026, 10, 28))
            if not rec or len(rec['sha256']) != 64:
                probs.append('the gate returns the direction it rendered from, by hash')
        except DirectionError as e:
            probs.append(f'a signed direction lets the render through: {e}')
        path, doc = template(tmp, 'short', script)
        if len(doc['cuts']['short']['beats']) != 3 or check(doc) == []:
            probs.append('the template has one beat per sentence and is not ready until filled')
        fresh = Path(tmp) / 'fresh'
        fresh.mkdir()
        _, new = template(fresh, 'long', script)
        if new['brand'].get('intro_sting') != NO_STING or any('brand.intro_sting' in p for p in check(new)):
            probs.append('a new direction that opens on the hook says it has no sting, and is not held for one')
        # The choices under test: each default from the bar, both lead pictures to draw, the pick left to Claude.
        seeded = doc.get('production_choices') or {}
        tested = under_test()
        if seeded.get('opening') != tested['opening']['default'] or seeded.get('opening') != 'hook_is_intro':
            probs.append('the template opens on the bar\'s default opening, the hook as the intro')
        if seeded.get('big_moment_sound') != 'none':
            probs.append('no sound on the big moment until he approves a set by ear')
        if sorted(k for k in seeded.get('lead_picture', {}) if k in LEAD_PICTURES) != sorted(LEAD_PICTURES) \
                or seeded['lead_picture'].get('proposed') or seeded['lead_picture'].get('ticked') is not None:
            probs.append('the template carries both lead pictures, with no pick made for Claude or him')
        bar = json.loads(BAR.read_text(encoding='utf-8'))
        bar['under_test']['choices'][2]['approved_set'] = 'config/music-library.json sfx, approved by ear'
        approved = Path(tmp) / 'bar.json'
        approved.write_text(json.dumps(bar))
        if choices_block('mind.the.gap', approved)['big_moment_sound'] != 'big_moment_only':
            probs.append('once he approves a set, the default is one sound on the big moment')
        if choices_block('mind.the.gap')['lead_picture']['series_picture']['what'] != SERIES_PICTURE['mind.the.gap']:
            probs.append('the series picture is the brand book\'s device for the piece\'s series')
    # No new refusal: a direction with no choices, or no pick and no tick, is checked exactly as before.
    for block in (None, choices_block()):
        undecided = json.loads(json.dumps(good))
        if block is not None:
            undecided['production_choices'] = block
        if check(undecided, {'long': script2}, for_render=True) != []:
            probs.append('a missing pick or tick never holds a direction back')
    picked = json.loads(json.dumps(good))
    picked['production_choices'] = choices_block('mind.the.gap')
    picked['production_choices']['lead_picture']['proposed'] = 'story_object'
    if production_choices(picked) != {'opening': 'hook_is_intro', 'lead_picture': 'story_object', 'big_moment_sound': 'none'}:
        probs.append(f'his signature accepts Claude\'s pick: {production_choices(picked)}')
    if not any(line.endswith('<- Claude proposes') and 'story object' in line for line in choice_lines(picked)):
        probs.append('the storyboard marks the proposal')
    picked['production_choices']['lead_picture']['ticked'] = 'series_picture'
    if production_choices(picked).get('lead_picture') != 'series_picture':
        probs.append('his tick on the other picture wins')
    if production_choices(good) != {}:
        probs.append('a direction with no choices records none')
    return probs


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd')
    t = sub.add_parser('template', help='start or extend a plan folder\'s creative-direction.json from a script')
    t.add_argument('plan')
    t.add_argument('--cut', required=True, choices=['long', 'short', 'feature'])
    t.add_argument('--script', required=True)
    t.add_argument('--take', default='on_camera', choices=['on_camera', 'voiceover'])
    c = sub.add_parser('check', help='check a direction; --for-render also needs his signature on the exact scripts')
    c.add_argument('path')
    c.add_argument('--script', action='append', default=[], metavar='CUT=FILE', help='the cut\'s script, to check word coverage')
    c.add_argument('--for-render', action='store_true')
    h = sub.add_parser('hash', help='the sha256 Krish signs for a script (signed.script_sha256.<cut>)')
    h.add_argument('script')
    k = sub.add_parser('choices', help='the choices under test, as the storyboard shows them and the record keeps them')
    k.add_argument('path')
    sub.add_parser('self-test')
    args = ap.parse_args(argv)
    if args.cmd == 'hash':
        print(script_hash(Path(args.script).read_text(encoding='utf-8-sig')))
        return 0
    if args.cmd == 'choices':
        doc = json.loads(Path(args.path).read_text(encoding='utf-8'))
        print('\n'.join(choice_lines(doc)))
        print('Recorded as: ' + json.dumps(production_choices(doc)))
        return 0
    if args.cmd == 'self-test':
        probs = _self_test()
        print('creative_direction self-test ' + ('FAILED:\n  ' + '\n  '.join(probs) if probs else 'passed'))
        return 1 if probs else 0
    if args.cmd == 'template':
        path, doc = template(args.plan, args.cut, Path(args.script).read_text(encoding='utf-8'), args.take)
        path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'wrote {path}: {len(doc["cuts"][args.cut]["beats"])} beats for the {args.cut} cut to direct')
        return 0
    if args.cmd == 'check':
        doc = json.loads(Path(args.path).read_text(encoding='utf-8'))
        scripts = {k: Path(v).read_text(encoding='utf-8') for k, v in (s.split('=', 1) for s in args.script)} or None
        probs = check(doc, scripts, args.for_render)
        print('direction ' + ('NOT READY:\n  ' + '\n  '.join(probs) if probs else 'ready' + (' to render' if args.for_render else ' for his storyboard sign-off')))
        return 1 if probs else 0
    ap.print_help()
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
