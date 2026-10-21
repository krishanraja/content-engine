#!/usr/bin/env python3
"""title_check: the anti-dumb filter on every title a reader sees first.

Krish, 2026-10-14, on Wednesday's "Muse vs ChatGPT isn't a fair fight" and
"Muse isn't ChatGPT. There are now three kinds of AI.": "no one has ever said
'Muse versus ChatGPT' is a fair fight! The titles can't be boring, but they
also can't just be made from nothing. Of course, Muse isn't ChatGPT. That's
a stupid thing to say. It's dumb. We need an anti-dumb filter. We need titles
that people will go, 'Oh, I need to read that. That's going to be awesome.'
... this sort of crap cannot be allowed to pass in the future, ever". He liked
"Muse's real rival: Siri."

A title passes only when it is none of these (house rule TITLE_EARNS_THE_CLICK):

  - a straw man: knocking down a claim nobody made ("X isn't Y", "X vs Y
    isn't a fair fight", "X is not just Y", "stop calling X a Y");
  - the obvious or a bare topic: no named company, product or person doing
    something, and no number (a label like "Three kinds of AI" or "Whose side
    is it on?" says what the piece is about, not why to read it);
  - a stock headline: "explained", "everything you need to know", "here's
    why", "the truth about", "you won't believe", "what you need to know",
    "game changer", "a closer look", "deep dive", "the future of";
  - made from nothing: a name or a number in it that the piece never says
    (checked when the piece's words are given).

    python title_check.py "Title" [more titles] [--source body.md [--source script.md]]
    python title_check.py lessons            what Krish's verdicts teach, and his picked and rejected titles
    python title_check.py verdict "Title" --picked|--rejected --why "..." --krish "his words" [--surface card] [--piece UUID]
    python title_check.py --self-test

The filter is the floor. What is good is what Krish picks (Krish, 2026-10-14:
"figure out why I dislike it, and iterate, and understand what I actually
like, and then encode that into the system forever"). Every title is written
against config/title-verdicts.json (its lessons and his picked and rejected
titles), offered to him as a few options, and used only once he has picked
it: `gate()` refuses a title with no "picked" verdict, and names his reason
for one he rejected. No card, cover, publish page or video title is made
from a title he has not picked.

Exit 0 when every title passes, 1 with each refusal named. video_card.py,
publish_manager.py and build.py (covers) call `problems()` on their titles.
"""
import argparse
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VERDICTS = REPO / 'config' / 'title-verdicts.json'

STRAWMAN = [
    (re.compile(r"\b(isn'?t|is not|aren'?t|are not|wasn'?t|was not)\s+(a\s+)?fair\s+fight\b", re.I), 'calls a comparison unfair that nobody made'),
    (re.compile(r"^\s*[\w'’.&-]+(?:\s+[\w'’.&-]+){0,3}\s+(isn'?t|is not|aren'?t|are not)\s+(?!only\b|just\b)[\w'’.&-]+(?:\s+[\w'’.&-]+){0,3}\s*[.!?]?\s*(?:$|[.!?:])", re.I),
     'says what something is not (a straw man: nobody claimed it was)'),
    (re.compile(r"\b(isn'?t|is not|aren'?t|are not)\s+(just|only|simply)\b", re.I), '"X isn\'t just Y" is a straw man'),
    (re.compile(r"\bstop\s+calling\b", re.I), 'argues with a name nobody gave it'),
    (re.compile(r"\bit'?s not\s+[^,.]+[,.]\s*it'?s\b", re.I), '"it\'s not X, it\'s Y" is a straw man'),
    (re.compile(r"\b\w+\s+(vs\.?|versus)\s+\w+", re.I), '"X vs Y" is a matchup label, not a reason to read'),
]
STOCK = re.compile(r"\b(explained|everything you need to know|here'?s why|here is why|the truth about|you won'?t believe|what you need to "
                   r"know|game[- ]changer|a closer look|deep dive|the future of|all you need|why it matters|let'?s talk about)\b", re.I)
NUMBER = re.compile(r"\d")
# A number in words ("a million new ChatGPT users in one hour", "every four weeks") earns a line only beside a name:
# "Three kinds of AI" is still a bare taxonomy.
NUMBER_WORD = re.compile(r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|hundred|thousand|"
                         r"million|billion|trillion|half|third|quarter|dozen|twice)\b", re.I)
# A capitalised word that is not the first word: a named company, product or person.
NAME = re.compile(r"(?<!^)(?<![.!?]\s)\b([A-Z][\w'’&.-]*[a-z0-9][\w'’&.-]*|[A-Z]{2,}[a-z]*)\b")
VERB_HINT = re.compile(r"\b(\w{3,}ed|is|are|was|were|has|have|had|can|will|won'?t|can'?t|does|did|makes?|made|gets?|got|pays?|paid|"
                       r"sells?|sold|buys?|bought|blocks?|lets?|ties?|beats?|loses?|lost|wins?|won|picks?|reads?|keeps?|kept|runs?|ran|"
                       r"hides?|hid|knows?|knew|owns?|takes?|took|breaks?|broke|says?|said|wants?|needs?|goes|went|comes?|came|"
                       r"shows?|tells?|told|sees?|saw|finds?|found|leaves?|left|stops?|starts?|kills?|lets?|lock(?:ed|s)?)\b", re.I)
# A first word is a name unless it is an everyday word that opens a sentence.
OPENERS = {'the', 'a', 'an', 'this', 'that', 'these', 'those', 'why', 'how', 'what', 'who', 'whose', 'when', 'where', 'which', 'my', 'your',
           'our', 'their', 'his', 'her', 'its', 'it', 'i', 'we', 'you', 'they', 'one', 'two', 'three', 'four', 'five', 'six', 'ten', 'every',
           'each', 'all', 'no', 'none', 'nobody', 'only', 'soon', 'by', 'in', 'on', 'at', 'for', 'from', 'with', 'after', 'before', 'now',
           'here', 'there', 'is', 'are', 'can', 'do', 'does', 'will', 'should', 'would', 'did', 'if', 'so', 'but', 'and', 'or', 'stop',
           'ready', 'big', 'small', 'most', 'first', 'last', 'new', 'old', 'next', 'more', 'less', 'some', 'many', 'few', 'ai'}
# A claim with a stake: a contrast or an extreme, with something done.
STAKE = re.compile(r"\b(only|every|none|nobody|no one|first|last|most|least|never|always|already|just)\b", re.I)


# The format label Krish puts first on a video post's title (title-verdicts.json: "Say the format up front ... 'VIDEO:' for the
# Substack video post"): a label, never a name the piece has to say.
FORMAT_LABEL = re.compile(r"^\s*VIDEO\s*:\s*")


def names_in(title):
    title = FORMAT_LABEL.sub('', title)
    found = set(NAME.findall(title))
    first = re.match(r"\s*([\w'’]+)", title)
    if first and re.sub(r"['’]s$", '', first.group(1)).lower() not in OPENERS and not first.group(1)[0].isdigit():
        found.add(first.group(1))
    return {re.sub(r"['’]s$", '', n) for n in found if n.upper() not in {'I', 'AI', 'AIS', 'MY', 'A'} and n.lower() not in {'i', 'my'}}


# Words that are capitalised in a piece but name nothing a stranger knows.
NOT_A_SUBJECT = {'i', 'ai', 'ais', 'a', 'the', 'my', 'we', 'you', 'it', 'this', 'that', 'so', 'now', 'and', 'but', 'video', 'think', 'free',
                 'plus', 'pro', 'medium', 'high', 'low', 'auto', 'extended', 'sally'}


def piece_names(source):
    """The real things the piece names (products, companies, people): words it
    capitalises mid-sentence, less the ones that name nothing a stranger knows."""
    text = ' '.join(str(source or '').split())
    found = set()
    for m in re.finditer(r"(?<![.!?:]\s)(?<!^)\b([A-Z][\w'’&.-]*[A-Za-z0-9])", text):
        w = re.sub(r"['’]s$", '', m.group(1)).lower()
        if w not in NOT_A_SUBJECT and len(w) >= 2:
            found.add(w)
    return found


def names_nothing(title, source):
    """A line on a surface a stranger sees first that names no real thing from
    the piece (Krish, 2026-10-17, of "YOU'RE ON LOW", "OLD BEAT NEW" and "WHO
    PICKED LOW?": "This isn't a well-known concept and it's not a well-known
    media business"), or None when it names one."""
    known = piece_names(source)
    words = {re.sub(r"['’]s$", '', w).lower() for w in re.findall(r"[\w'’&.-]+", str(title))}
    words |= {w.rstrip('.') for w in words}
    if known and not (words & known):
        return ('names no real thing a stranger would know (a product, a company, a person from the piece): the piece\'s own '
                'shorthand is only legible to someone who has already watched it (Krish, 2026-10-17: "I can\'t release a Substack cover '
                'image that says you\'re on low. What the hell does that even mean?")')
    return None


def problems(title, source=None):
    """The reasons a title fails, [] when it passes. source: the piece's own
    words (body and scripts), to check its names and numbers are the piece's."""
    t = ' '.join(str(title or '').split())
    if not t:
        return ['no title']
    out = []
    for rx, why in STRAWMAN:
        if rx.search(t):
            out.append(why)
    m = STOCK.search(t)
    if m:
        out.append(f'"{m.group(0)}" is a stock headline phrase')
    names = names_in(t)
    earned = (NUMBER.search(t) or (names and (VERB_HINT.search(t) or NUMBER_WORD.search(t))) or len(names) >= 2
              or (STAKE.search(t) and VERB_HINT.search(t)))
    if not earned:
        out.append('a bare topic or the obvious: name who does what, or give the number that surprises (why would someone have to read it?)')
    if source:
        hay = ' '.join(str(source).split()).lower()
        for n in sorted(names):
            if n.lower() not in hay:
                out.append(f'"{n}" is not in the piece: a title is made from the piece, never from nothing')
        for num in {n.rstrip('.,') for n in re.findall(r"\d[\d,.]*%?", t)}:
            if num.lower() not in hay:
                out.append(f'"{num}" is not in the piece')
    return out


def verdicts_path():
    return Path(os.environ.get('MYMU_TITLE_VERDICTS') or VERDICTS)


def load_verdicts():
    path = verdicts_path()
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'lessons': [], 'verdicts': []}


def norm(title):
    t = str(title or '').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return ' '.join(t.split()).strip().lower()


def verdict_of(title, data=None):
    """Krish's latest verdict on this exact title, or None."""
    data = data or load_verdicts()
    hits = [v for v in data.get('verdicts', []) if norm(v.get('title')) == norm(title)]
    return hits[0] if hits else None


# A pointer at something the line never names ("one setting", "this setting",
# "the setting behind it"). Friday 17 October's cold read: every fresh reader
# got the gist and still asked "which setting?", and called each line a tease.
HIDDEN_POINTER = re.compile(r"\b(?:this|that|one|a|the)\s+(?:\w+\s+)?(setting|thing|trick|secret|feature|switch|button)\b"
                            r"(?!\s+(?:for|called|named|that (?:decides|sets|controls))\b)", re.I)


def hidden_pointer(title):
    """The line points at a thing it never names, or None."""
    m = HIDDEN_POINTER.search(str(title or ''))
    if not m:
        return None
    return (f'points at something it never names ("{m.group(0)}"): say what it is (e.g. "the setting for how hard it thinks"); '
            'a line that hides what it is about reads as a tease (cold read, 2026-10-17: every reader asked which setting)')


def surface_problems(title, surface, source=None):
    """The checks that depend on where the line shows: a line on a surface a
    stranger sees first must name a real thing from the piece, and must not
    point at a thing it never names."""
    out = []
    if surface in PACKAGING_FIRST_SEEN:
        why = names_nothing(title, source) if source else None
        if why:
            out.append(why)
        hid = hidden_pointer(title)
        if hid:
            out.append(hid)
    return out


PACKAGING_FIRST_SEEN = {'article', 'cover', 'youtube', 'thumbnail', 'shorts', 'tall_cover', 'title_card'}


def gate(title, source=None, data=None, *, piece_id=None):
    """problems() and Krish's verdict: [] only for a title he picked that also clears the floor."""
    out = problems(title, source)
    v = verdict_of(title, data)
    # A specific human pick can override a taste heuristic for this piece.
    # Preserve its raw findings, require the same approval words, and never
    # suppress a name/number absent from the source or affect another piece.
    override = v.get('editorial_override') if isinstance(v, dict) else None
    if (v and v.get('verdict') == 'picked' and piece_id and v.get('piece') == piece_id
            and isinstance(override, dict) and override.get('said') == v.get('krish')):
        allowed = set(override.get('findings') or []) & set(problems(title))
        out = [finding for finding in out if finding not in allowed]
    if v is None:
        out.append('Krish has not picked this title: offer him a few options written against `title_check.py lessons`, '
                   'and record his pick with `title_check.py verdict`')
    elif v.get('verdict') != 'picked':
        out.append(f'Krish rejected this title ({v.get("why")}; his words: "{v.get("krish")}")')
    return out


def record_verdict(title, verdict, why, krish, surface=None, piece=None, on=None):
    if verdict not in ('picked', 'rejected'):
        raise ValueError('a verdict is picked or rejected')
    if not str(why or '').strip() or not str(krish or '').strip():
        raise ValueError('a verdict carries why (what it teaches) and Krish\'s own words')
    data = load_verdicts()
    entry = {'title': ' '.join(str(title).split()), 'surface': surface or 'any', 'verdict': verdict, 'why': why.strip(),
             'krish': krish.strip(), 'on': on or date.today().isoformat()}
    if piece:
        entry['piece'] = piece
    data['verdicts'] = [entry] + [v for v in data.get('verdicts', []) if norm(v.get('title')) != norm(title)]
    verdicts_path().write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return entry


# The surfaces that package a piece, signed off only after he records it (house rule
# TITLES_AFTER_RECORDING; Krish, 2026-10-17: "only after recording do I really feel like I've got a message").
PACKAGING = {'article', 'subtitle', 'cover', 'youtube', 'thumbnail', 'shorts', 'tall_cover', 'title_card', 'card', 'divider'}


def takes_on_record(piece, call=None):
    """How many takes the piece has on its making record (None when the
    engine cannot be read)."""
    if call is None:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import making
        call = making._engine_call
    status, body = call('GET', f'/api/content-ideas/{piece}/making', None)
    try:
        data = json.loads(body) if body else {}
    except ValueError:
        return None
    if status != 200 or not isinstance(data, dict):
        return None
    m = data.get('making') if isinstance(data.get('making'), dict) else data
    return len(m.get('recordings') or [])


def pick_problem(surface, piece, before_recording=None, call=None):
    """Why a pick on this surface cannot be recorded yet, or None. A packaging
    pick needs the piece, and a take of it on the record, unless Krish has said
    in words that this one is signed off before he records."""
    if surface not in PACKAGING:
        return None
    if before_recording:
        return None if str(before_recording).strip().startswith('Krish') else \
            '--before-recording takes Krish\'s own words, starting "Krish, YYYY-MM-DD:"'
    if not piece:
        return f'a {surface} pick names its piece (--piece), so it can wait for the take (house rule TITLES_AFTER_RECORDING)'
    n = takes_on_record(piece, call)
    if n is None:
        return 'the piece\'s making record could not be read, so whether it has a take is not known: nothing was recorded; run it again'
    if n == 0:
        return (f'the piece has no take on the record yet, and a {surface} line is signed off only after Krish records it (house rule '
                'TITLES_AFTER_RECORDING; Krish, 2026-10-17: "only after recording do I really feel like I\'ve got a message"). '
                'Write the options from what he says in the take, then ask him')
    return None


class picked_for_tests:
    """A self-test's own verdicts: the given titles marked picked, in a file of
    their own, so a tool's tests check the tool, never Krish's real picks."""

    def __init__(self, titles, tmp):
        self.path = Path(tmp) / 'title-verdicts.test.json'
        self.path.write_text(json.dumps({'lessons': [], 'verdicts': [
            {'title': t, 'surface': 'test', 'verdict': 'picked', 'why': 'a test fixture', 'krish': 'test', 'on': '2026-10-14'}
            for t in titles]}), encoding='utf-8')
        self.before = None

    def __enter__(self):
        self.before = os.environ.get('MYMU_TITLE_VERDICTS')
        os.environ['MYMU_TITLE_VERDICTS'] = str(self.path)
        return self

    def __exit__(self, *exc):
        if self.before is None:
            os.environ.pop('MYMU_TITLE_VERDICTS', None)
        else:
            os.environ['MYMU_TITLE_VERDICTS'] = self.before


def load_playbook():
    path = Path(__file__).resolve().parents[2] / 'config' / 'hook-playbook.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def too_long(title, surface, playbook=None):
    """The surface's first readable space, from the hooks research; None when it fits."""
    limit = ((playbook or load_playbook()).get('surfaces', {}).get(surface) or {}).get('limit_chars')
    return f'{len(title)} characters; {surface} shows about {limit}' if limit and len(title) > limit else None


def krish_playbook_text(surface=None, playbook=None):
    """What the surface is for, then Krish's own playbook for it (2026-10-17), which wins over the research."""
    pb = playbook or load_playbook()
    lines = []
    where = (pb.get('surface_map') or {}).get(surface) if surface else None
    if where:
        lines.append(f'What {surface} is: {where}')
    mine = (pb.get('krish_playbook') or {}).get('surfaces') or {}
    for name, s in mine.items():
        if surface and name != surface:
            continue
        lines.append(f'Krish\'s playbook for {name} ({pb["krish_playbook"]["source"]}): {s.get("rule", "")}')
        for f in s.get('formulas', []):
            lines.append(f'  - {f["name"]}: {f["structure"]}. E.g. ' + ' / '.join(f'"{x}"' for x in f.get('examples', [])[:2]))
    return '\n'.join(lines)


def playbook_text(surface=None, playbook=None):
    pb = playbook or load_playbook()
    if not pb:
        return ''
    mine = krish_playbook_text(surface, pb)
    lines = ([mine, ''] if mine else []) + ['What the hooks research says (config/hook-playbook.json; his picks win where they differ):', '  ' + pb['formula']]
    lines += [f'  - {r}' for r in pb.get('everywhere', [])]
    for name, s in pb.get('surfaces', {}).items():
        if surface and name != surface:
            continue
        lines.append(f'{name} (about {s["limit_chars"]} characters): {s["formula"]}')
        lines.append('  works: ' + '; '.join(s.get('strong', [])))
        lines.append('  weak: ' + '; '.join(s.get('weak', [])))
    return '\n'.join(lines)


def story_text(plan):
    """The story every packaging line must tell (house rule STORY_FIRST), from
    the plan folder: Krish's own statement of it (story.md), then the outline's
    spine and answer, then the series' question. Krish, 2026-10-17: "The story
    is about ... It's a "mind the gap" piece remember. Why do I have to remind
    you about what this story is about?" """
    P = Path(plan)
    if not P.is_absolute():
        P = REPO / P
    out = []
    mine = P / 'story.md'
    if mine.exists():
        out.append('What the piece is about, in Krish\'s words:\n  ' + ' '.join(mine.read_text(encoding='utf-8').split()))
    outlines = sorted((P.parent).glob(f'{P.name[:10]}-outline*.md'), key=lambda f: (len(f.name), f.name))
    if outlines:
        text = outlines[-1].read_text(encoding='utf-8')
        for key in ('Spine', 'Answer'):
            m = re.search(rf'^{key}:\s*(.+)$', text, re.M)
            if m:
                out.append(f'{key} ({outlines[-1].name}): {m.group(1).strip()}')
    post = P / 'post.json'
    if post.exists():
        sub = json.loads(post.read_text(encoding='utf-8')).get('subchannel', '')
        key = sub.replace('.', '_')
        try:
            ch = json.loads((REPO / 'config' / 'studio.json').read_text(encoding='utf-8'))
            ch = ch['videos']['quick_edit']['house_style']['channels'] if 'videos' in ch else None
        except (KeyError, ValueError):
            ch = None
        if ch is None:
            raw = (REPO / 'config' / 'studio.json').read_text(encoding='utf-8')
            m = re.search(rf'"{key}":\s*\{{[^}}]*"question":\s*"([^"]+)"', raw)
            q = m.group(1) if m else None
        else:
            q = (ch.get(key) or {}).get('question')
        if q:
            out.append(f'The series ({sub}) asks: "{q}"')
    if not out:
        return ('NO STORY FOUND for ' + str(P) + ': write the piece\'s story first (story.md in the plan folder, Krish\'s words if he has '
                'said it), and judge every line by whether it tells it (house rule STORY_FIRST)')
    return 'THE STORY EVERY LINE MUST TELL (house rule STORY_FIRST):\n' + '\n'.join('  ' + o for o in out)


def lessons_text(data=None):
    data = data or load_verdicts()
    lines = ['What Krish likes in a title (config/title-verdicts.json):']
    lines += [f'  - {l["lesson"]}' for l in data.get('lessons', [])]
    lines.append('Picked:')
    lines += [f'  + "{v["title"]}" ({v["surface"]}): {v["why"]}' for v in data.get('verdicts', []) if v.get('verdict') == 'picked']
    lines.append('Rejected:')
    lines += [f'  - "{v["title"]}" ({v["surface"]}): {v["why"]}' for v in data.get('verdicts', []) if v.get('verdict') != 'picked']
    return '\n'.join(lines)


def self_test():
    fails = []

    def check(name, got, want):
        if got != want:
            fails.append(f'{name}: got {got!r}, want {want!r}')

    body = ('Amazon blocked Muse from buying on its site. Walmart lets ChatGPT and Muse buy there. Meta made $59.36 billion from ads, '
            'out of $60.8 billion. Muse and Siri tie on 43 out of 60. Three kinds of AI.')
    for bad in ("Muse vs ChatGPT isn't a fair fight", "Muse isn't ChatGPT. There are now three kinds of AI.", 'Three kinds of AI',
                'Whose side is it on?', 'Who can read your stuff?', 'AI assistants, explained', "Here's why Muse matters", 'Why so many AIs',
                'Muse features', 'Who gets paid for AI songs',
                "Siri isn't just a voice", 'Stop calling Muse a chatbot', 'Each shop decides'):
        check(f'refused: {bad}', bool(problems(bad, body)), True)
    for good in ("Muse's real rival: Siri.", 'Amazon locked Muse out. Walmart let it in.', '97% of Meta\'s money comes from ads',
                 'Muse and Siri tie on 43. For opposite reasons.', 'Three kinds of AI. Only one runs your errands.'):
        check(f'passes: {good}', problems(good, body if '97' not in good else body + ' 97%'), [])
    check('made from nothing: a name the piece never says', any('Tesco' in p for p in problems('Tesco blocked Muse', body)), True)
    check('made from nothing: a number the piece never says', any('"12"' in p for p in problems('Muse wins 12 to 3', body)), True)
    for good in ('A million new ChatGPT users in one hour', 'Three Opus models in four months'):
        check(f'a number in words earns it: {good}', problems(good, 'ChatGPT users Opus models million hour three four months'), [])
    check('the VIDEO: format label is not a name', problems("VIDEO: We unpack why Amazon blocked Muse, and Walmart let it in", body), [])
    check('a name after the label is still checked', any('Tesco' in p for p in problems('VIDEO: Tesco blocked Muse', body)), True)
    # The gate: only a title Krish picked; a rejected one says why.
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        os.environ['MYMU_TITLE_VERDICTS'] = str(Path(tmp) / 'v.json')
        try:
            check('gate: a title nobody picked is refused', any('has not picked' in p for p in gate('Amazon locked Muse out. Walmart let it in.')), True)
            record_verdict('Amazon locked Muse out. Walmart let it in.', 'picked', 'a concrete twist', 'that one', 'card')
            check('gate: once picked it passes (quotes and spaces aside)', gate('Amazon locked Muse out.  Walmart let it in.'), [])
            record_verdict('Amazon locked Muse out. Walmart let it in.', 'rejected', 'flat', 'no, boring', 'card')
            check('gate: a later rejection wins, with his words', any('no, boring' in p for p in gate('Amazon locked Muse out. Walmart let it in.')), True)
            check('lessons list his picked and rejected titles', 'Amazon locked Muse out' in lessons_text(), True)
            piece = ('Anthropic makes Claude. It launched Opus 5.5 in September. OpenAI runs ChatGPT. Picture a woman called Sally. '
                     'It starts on Low, in a low gear. The old one beat the new one.')
            for bad in ("YOU'RE ON LOW.", 'OLD BEAT NEW.', 'WHO PICKED LOW?', 'Sally signs'):
                check(f'a line strangers see first that names nothing real is refused: {bad}',
                      any('names no real thing' in w for w in surface_problems(bad, 'thumbnail', piece)), True)
            for good in ("Claude's new model lost to its old one", 'ChatGPT starts you on its lowest setting', 'OPUS 5.5 LOST'):
                check(f'one that names a real thing passes: {good}', surface_problems(good, 'cover', piece), [])
            check('a card heading is not held to it (his words at that moment)', surface_problems('So what does matter?', 'card', piece), [])
            for bad in ('The newest Claude lost to an older Claude. One setting most people never change decided it.',
                        'ChatGPT and Claude: the setting that matters more than the model you pick',
                        'We unpack why the newest Claude lost to an older one, and the setting behind it',
                        'Why ChatGPT and Claude want you watching the model name, not this setting'):
                check(f'a hidden pointer is refused: {bad}', any('never names' in w for w in surface_problems(bad, 'youtube', piece)), True)
            for good in ('We unpack why the newest Claude lost to an older one, and the setting for how hard it thinks',
                         'ChatGPT has a setting for how hard it thinks. It matters more than the model.',
                         'The free Gemini app starts on a setting called Auto'):
                check(f'a named setting passes: {good}', any('never names' in w for w in surface_problems(good, 'shorts', piece)), False)
            none = lambda m, path, b: (200, json.dumps({'ok': True, 'making': {'recordings': []}}))
            one = lambda m, path, b: (200, json.dumps({'ok': True, 'making': {'recordings': [{'cut': 'long', 'path': 'recordings/x.mp4'}]}}))
            down = lambda m, path, b: (503, '{}')
            check('a packaging pick before the piece has a take is refused, naming the rule',
                  'TITLES_AFTER_RECORDING' in (pick_problem('youtube', 'p', None, none) or ''), True)
            check('after a take it is allowed', pick_problem('youtube', 'p', None, one), None)
            check('a packaging pick names its piece', 'names its piece' in (pick_problem('thumbnail', None, None, one) or ''), True)
            check('an unreadable record refuses rather than guess', 'could not be read' in (pick_problem('card', 'p', None, down) or ''), True)
            check('his own words let one through before recording; anyone else\'s do not',
                  (pick_problem('cover', 'p', 'Krish, 2026-10-20: sign this off now', none), bool(pick_problem('cover', 'p', 'sure', none))), (None, True))
            check('a surface that is not packaging is not held', pick_problem('spotify-show', None, None, none), None)
            pb = {'formula': 'f', 'everywhere': ['name it'], 'surfaces': {'youtube': {'limit_chars': 10, 'formula': 'yt', 'strong': ['s'], 'weak': ['w']},
                                                                        'blog': {'limit_chars': 60, 'formula': 'bl'}}}
            check('playbook: one surface only', ('yt' in playbook_text('youtube', pb), 'bl' in playbook_text('youtube', pb)), (True, False))
            mine = dict(pb, surface_map={'youtube': 'the long cut\'s title'}, krish_playbook={'source': 'x.md', 'surfaces': {
                'youtube': {'rule': 'punchy', 'formulas': [{'name': 'Time Bomb', 'structure': '[When] + [Change]', 'examples': ['AI in 2027']}]},
                'article': {'rule': 'deep', 'formulas': []}}})
            got = playbook_text('youtube', mine)
            check('playbook: what the surface is and his own formulas come first', (got.index('What youtube is') < got.index('Time Bomb') < got.index('hooks research'), 'deep' in got), (True, False))
            check('playbook: too long for the surface', bool(too_long('eleven char', 'youtube', pb)), True)
            check('playbook: fits', too_long('short', 'youtube', pb), None)
            try:
                record_verdict('X did Y', 'picked', '', '', 'card')
                check('a verdict without his words is refused', 'no error', 'error')
            except ValueError:
                check('a verdict without his words is refused', True, True)
        finally:
            os.environ.pop('MYMU_TITLE_VERDICTS', None)
    picked = {'title': 'Muse vs Grok Bot', 'verdict': 'picked', 'piece': 'test-piece',
              'krish': 'Use this exact title', 'editorial_override': {
                  'said': 'Use this exact title', 'findings': problems('Muse vs Grok Bot')}}
    scoped = {'lessons': [], 'verdicts': [picked]}
    check('an explicit pick can override the taste floor for its own piece',
          gate('Muse vs Grok Bot', data=scoped, piece_id='test-piece'), [])
    check('the override never crosses pieces or applies without a piece',
          (bool(gate('Muse vs Grok Bot', data=scoped, piece_id='other')),
           bool(gate('Muse vs Grok Bot', data=scoped))), (True, True))
    check('a taste override cannot remove source-grounding problems',
          bool(gate('Muse vs Grok Bot', 'Only apples.', scoped, piece_id='test-piece')), True)
    changed = {'lessons': [], 'verdicts': [{**picked, 'krish': 'Different approval words'}]}
    check('approval words must match the exact override record',
          bool(gate('Muse vs Grok Bot', data=changed, piece_id='test-piece')), True)
    if fails:
        print('title_check self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    s = story_text('docs/plans/2026-10-09-friday')
    if 'STORY_FIRST' not in s or 'so many recent AI model releases' not in s or 'What is the pattern' not in s:
        print('title_check self-test failed: story_text did not print the Friday story, spine and series question:\n' + s)
        return 1
    print('title_check self-test passed')
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv[:1] == ['lessons']:
        lp = argparse.ArgumentParser(description='Krish\'s lessons, then the hooks research for one surface.')
        lp.add_argument('--surface', help='youtube, shorts, cover, card, article, linkedin or blog')
        lp.add_argument('--plan', help="the piece's plan folder (docs/plans/...): prints the story every line must tell first")
        la = lp.parse_args(argv[1:])
        head = story_text(la.plan) if la.plan else ('NO STORY GIVEN: pass --plan docs/plans/<plan> so the round starts from the '
                                                     "piece's story (house rule STORY_FIRST)")
        print(head + '\n\n' + lessons_text() + '\n\n' + playbook_text(la.surface))
        return 0
    if argv[:1] == ['verdict']:
        vp = argparse.ArgumentParser(description='Record Krish\'s verdict on a title.')
        vp.add_argument('title')
        g = vp.add_mutually_exclusive_group(required=True)
        g.add_argument('--picked', action='store_true')
        g.add_argument('--rejected', action='store_true')
        vp.add_argument('--why', required=True, help='what it teaches')
        vp.add_argument('--krish', required=True, help='his own words')
        vp.add_argument('--surface', default='any')
        vp.add_argument('--piece')
        vp.add_argument('--before-recording', metavar='KRISH_WORDS',
                        help='only on his words ("Krish, YYYY-MM-DD: ..."): a packaging line he signs off before he records')
        v = vp.parse_args(argv[1:])
        why_not = pick_problem(v.surface, v.piece, v.before_recording) if v.picked else None
        if why_not:
            print(f'title_check: not recorded: {why_not}', file=sys.stderr)
            return 1
        e = record_verdict(v.title, 'picked' if v.picked else 'rejected', v.why, v.krish, v.surface, v.piece)
        print(f'recorded: {e["verdict"]} "{e["title"]}"')
        return 0
    ap = argparse.ArgumentParser(description='The anti-dumb filter on titles (house rule TITLE_EARNS_THE_CLICK).')
    ap.add_argument('titles', nargs='*')
    ap.add_argument('--source', action='append', default=[], help='the piece\'s words (body, scripts), to check names and numbers')
    ap.add_argument('--surface', help='also check the length against that surface\'s first readable space')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    source = ' '.join(Path(p).read_text(encoding='utf-8') for p in a.source) if a.source else None
    bad = 0
    for t in a.titles:
        why = gate(t, source)
        if a.surface:
            why += surface_problems(t, a.surface, source)
        if a.surface and too_long(t, a.surface):
            why.append(too_long(t, a.surface))
        print(('REFUSED  ' if why else 'passes   ') + t)
        for w in why:
            print('  - ' + w)
        bad += bool(why)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
