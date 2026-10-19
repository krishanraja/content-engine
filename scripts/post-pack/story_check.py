"""The story check for a video script, done by rule rather than by a model.

Krish, 2026-10-06, of the Higgsfield launch script (walk log F75): "I can't
even say it out loud as it confuses the hell out of me reading it", then of
the second version: "what does that mean? We've never introduced that concept
yet ... It also barely connects to the next bits, the takeaways ... now it
just ends randomly on 85%, with nothing after that, no outro." He approved the
five-point story check the same evening ("happy with that idea"); the house
rules FOR_THE_EAR and STORY_ARC carry it to every writer and judge.

A model cannot be trusted to grade its own story, so this file checks the
parts a rule can see, and refuses to pack a script that fails one:

  - it opens on a question (in the first 90 spoken words);
  - a script of a minute or more ends with a spoken outro after the call,
    so it never stops dead on the number;
  - it never speaks the article's headings or stamps aloud
    ("The billion: REAL, with small print", "One: the billion.");
  - nothing in it is still marked NOT YET FACT-CHECKED;
  - when it says which cut it is, it is that long. Krish, 2026-10-11: "I
    always want a 3-minute video and a 90-second version" (house rule
    TWO_CUTS), then, 2026-10-19: "let's make the 3-minute scripts into
    5-minute scripts and videos". At an unhurried 150 spoken words a minute,
    the long cut is 675 to 825 words (about 4:30 to 5:30) and the short cut 160 to 225
    words (about 1:05 to 1:30). The series line counts toward it;
  - when its series is known (--series, the piece's lane_slot), it opens
    with that series' line, word for word, as its first two sentences, and
    never says "I'm Krish" again after it. Krish, 2026-10-12: "We need
    something catchy at the start of a video script like "Here's what you
    need to know about how money is changing because of AI. I'm Krish." at
    the start of follow.the.money videos. And then similar for the weds and
    fri scripts", and of the close, "Drop it at the end" (house rule
    SERIES_OPENER). The three lines are SERIES_OPENERS in
    apps/control-plane/api/_houseRules.ts, read from there;
  - a 12-year-old can follow it, heard once (house rule R7, the hard gate on
    every script). Krish, 2026-10-12: "Every single script should be
    understandable by a 12-year-old. I can't even understand what I'm
    reading off the teleprompter. I thought we had hard gates for this?" No
    spoken sentence over 20 words, at most 12 words a sentence on average, a
    reading grade of 6 or less, no quotation over four words, and none of
    the grown-up words on the list (licensing, settlement, revenue, model,
    copyright and the rest) unless the same sentence says what it means in
    plain words. The numbers and the list are SCRIPT_READING in
    apps/control-plane/api/_houseRules.ts, read from there. A formula alone
    misses a script that loses a child on its ideas, so make-piece then has
    two fresh readers hear it as a 12-year-old would.

Whether every beat follows from the last still needs a reader. The rule
catches the failures that sank the Higgsfield script; reading it aloud once
catches the rest.

    python scripts/post-pack/story_check.py SCRIPT [SCRIPT ...]
    python scripts/post-pack/story_check.py --cut long SCRIPT    # or --cut short
    python scripts/post-pack/story_check.py --cut long --series follow_the_money SCRIPT
    python scripts/post-pack/story_check.py --self-test

Without --cut, a file whose name says "90", "short" or "vertical" is the
short cut and one whose name says "long", "3min", "5min" or "wide" is the long cut;
any other name is checked for everything but length.
"""

import functools
import json
import re
import sys
from pathlib import Path

UNCHECKED = 'NOT YET FACT-CHECKED'
OPENING_WORDS = 90
SHORT_WORDS = 160  # under about a minute: no room for an outro
WORDS_PER_MINUTE = 150
CUTS = {
    # cut: (fewest words, most words, what Krish asked for)
    'long': (675, 825, 'a 5-minute video'),
    # 195: Wednesday's 222 words ran 99 seconds with the intro and outro, and Reels over 90 s were cut off
    # (Krish, 2026-10-14: "I'm noticing on Instagram that sometimes my reels are getting cut off"). At his pace
    # 195 words keep the finished cut under 89 s, inside every platform's line (docs/research/2026-10-14-platform-length-limits.md).
    'short': (160, 195, 'a 90-second version that finishes under 89 seconds'),
    # The Spotify audio edition (docs/SPOTIFY.md; Krish, 2026-10-14: "create scripts for everything"): the article
    # read for the ear, about 8 to 12 minutes. Its chapters live beside it in <script>.chapters.md: the script is
    # only the spoken words (house rule SCRIPT_ONLY), because it goes straight onto the teleprompter.
    'audio': (1200, 1700, 'a Spotify audio edition of about 8 to 12 minutes'),
    # The week's deep cut (house rule DEEP_CUT; config/deep-cuts.json): one piece a week, chosen by its breakout
    # score, records 8 to 12 minutes in place of its 5-minute cut, for YouTube long-form and Spotify. Krish,
    # 2026-10-14: "perhaps the third video length also becomes the Spotify audio track".
    'deep': (1200, 1700, 'the week\'s deep video of about 8 to 12 minutes'),
}
OUTRO = re.compile(r'makeyourmindup', re.I)
META_START = re.compile(r'^\s*(changes from|before you record|the story in one line|#{1,3}\s)', re.I)
SAY_LINE = re.compile(r'^\s*(?:\*\*say:\*\*|say:)\s*(.*)$', re.I)
STAGE = re.compile(r'\\?\[[^\]]*\\?\]')
SPOKEN_STAMP = re.compile(r'\b(REAL|THEATRE)\b')
SPOKEN_LABEL = re.compile(r'(^|[.!?]\s+)(One|Two|Three|Four|Five|Six)\s*:\s*the\s+\w+\s*\.', re.I)
HEADING_MARKUP = re.compile(r'\*\*[^*]+:\*\*|\*\*[^*]+\*\*\s*:')
# House rule SCRIPT_ONLY (Krish, 2026-10-09): "make sure my video scripts are
# literally just scripts without all the excess internal monologue commentary
# (forever)". The script is only the words he says, as plain paragraphs.
NOT_SPOKEN = [
    (re.compile(r'\\?\[[^\]]*\\?\]'), 'a bracketed stage direction'),
    (re.compile(r'^\s*(?:\*{1,2}|_)?\s*(?:on screen|screen|say|shot|b-roll|visual|cut to|end card|joke option|alt(?:ernative)?|note)\s*(?:\*{1,2}|_)?\s*:', re.I | re.M), 'a label such as "On screen:" or "Say:"'),
    (re.compile(r'^\s*#{1,6}\s', re.M), 'a heading'),
    (re.compile(r'^\s*(?:\*\*)?\[?\d{1,2}:\d{2}\]?(?:\*\*)?\s*$', re.M), 'a timing'),
    (re.compile(r'^\s*(?:---|\*\*\*)\s*$', re.M), 'a divider'),
    (re.compile(r'^\s*(?:[-*\u2022]|\d+\.)\s', re.M), 'a list'),
    (re.compile(r'^\s*beat\s+\d+', re.I | re.M), 'a beat number'),
]
# House rule HOOK_AND_CTA: the outro says there is a full article and where.
ARTICLE = re.compile(r'\b(article|full piece|full story|full teardown|read it|the rest)\b', re.I)

# Krish's house rules, where the series lines and the reading gate live once
# for every tool (SERIES_OPENERS and SCRIPT_READING, each a JSON object
# between its two marker lines).
HOUSE_RULES = Path(__file__).resolve().parents[2] / 'apps' / 'control-plane' / 'api' / '_houseRules.ts'
# His name, said again after the series line (house rule SERIES_OPENER).
KRISH_NAME = re.compile(r"\b(?:I['\u2019]m|I am)\s+Krish\b", re.I)


def house_block(name, path=HOUSE_RULES):
    """The JSON object between "// NAME:BEGIN" and "// NAME:END" in the
    house rules. Raises ValueError when it is not there or not JSON."""
    text = Path(path).read_text(encoding='utf-8')
    begin, end = f'// {name}:BEGIN', f'// {name}:END'
    if text.count(begin) != 1 or text.count(end) != 1:
        raise ValueError(f'{Path(path).name} has no single {name} block between its markers')
    block = text.split(begin, 1)[1].split(end, 1)[0]
    try:
        return json.loads(block[block.index('{'):block.rindex('}') + 1])
    except ValueError as error:
        raise ValueError(f'the {name} block in {Path(path).name} is not JSON: {error}')


@functools.lru_cache(maxsize=None)
def series_openers():
    """{lane_slot: the series line}, from the house rules (SERIES_OPENERS)."""
    return {slot: entry['line'] for slot, entry in house_block('SERIES_OPENERS').items()}


@functools.lru_cache(maxsize=None)
def reading_rules():
    """The reading gate's numbers and grown-up words (SCRIPT_READING)."""
    rules = house_block('SCRIPT_READING')
    for key in ('max_sentence_words', 'max_average_words', 'max_grade', 'max_quote_words', 'jargon'):
        if key not in rules:
            raise ValueError(f'SCRIPT_READING has no {key}')
    return rules


def _plain(text):
    """Words as they are said: curly quotes straight, spaces single."""
    return ' '.join(str(text).replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"').split())


def opener_of(text):
    """The series line a script opens with, word for word, or None."""
    said = _plain(text)
    for line in series_openers().values():
        want = _plain(line)
        if said.startswith(want) and (len(said) == len(want) or said[len(want)] == ' '):
            return line
    return None


def series_problems(beats, series):
    """Why the script breaks house rule SERIES_OPENER, or []. series is the
    piece's lane_slot, or None: then only a script that opens with a series
    line is held to saying "I'm Krish" once."""
    said = _plain(' '.join(beats))
    found = []
    opened = opener_of(said)
    if series:
        line = series_openers().get(series)
        if line is None:
            return [f'"{series}" is not a series with a line ({", ".join(series_openers())}); nothing was checked for it']
        if opened != line:
            first = ' '.join(re.split(r'(?<=[.!?])\s+', said)[:2])
            found.append(f'it does not open with its series line, word for word, said first and before the hook: "{line}" (house rule '
                         f'SERIES_OPENER, Krish, 2026-10-12). It opens: "{first[:120]}"')
    rest = said[len(_plain(opened)):] if opened else (said if series else '')
    if KRISH_NAME.search(rest):
        found.append('it says "I\'m Krish" again after the series line: his name is said once, in that line, and the close ends '
                     'without it (house rule SERIES_OPENER; Krish, 2026-10-12: "Drop it at the end")')
    return found


# ---------------------------------------------------------------- reading age 12

SENTENCE_END = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9"$\u00a3\u201c\'])|(?<=[.!?]["\u201d\u2019)])\s+')
WORD = re.compile(r"[A-Za-z0-9$\u00a3\u20ac][A-Za-z0-9$\u00a3\u20ac'\u2019,.%-]*[A-Za-z0-9%]|[A-Za-z0-9]")
QUOTE = re.compile(r'"([^"]+)"|\u201c([^\u201d]+)\u201d')
# A word is explained in its own sentence when the sentence says what it is:
# "a token is just a word", "royalties, which are money paid", "called a
# licence", "copyright (who owns a song)".
EXPLAINED = (r'\b{w}\s+(?:is|are|means|mean)\s+(?:just\s+|simply\s+|basically\s+|really\s+)?(?:a|an|the|what|when|how|where|who|money|'
             r'someone|something|like|any|each|every|your|their|its|paying|being|getting|letting)\b',
             r'\b{w},?\s+(?:which|that)\s+(?:is|are|means|mean)\b',
             r'\b{w},\s+(?:or|meaning|in other words|that is)\b',
             r'\b{w}\s*\(',
             r'\bcalled\s+(?:a\s+|an\s+|the\s+)?{w}\b')


def sentences(paragraphs):
    """The spoken sentences, paragraph by paragraph: a sentence ends at . ! or
    ? before a capital, a number or a quote, or inside a closing quote or
    bracket; a paragraph always ends one."""
    out = []
    for para in paragraphs:
        out += [x.strip() for x in SENTENCE_END.split(' '.join(str(para).split())) if re.search(r'[A-Za-z0-9]', x)]
    return out


def words_of(sentence):
    return [w.strip("'\u2019.,") for w in WORD.findall(sentence)]


def syllables(word):
    """A word's syllables, by the usual rough rule: vowel groups, less a
    silent e or ed. A number is said, so it counts as one per digit group."""
    w = re.sub(r'[^a-z]', '', word.lower())
    if not w:
        return max(1, len(re.findall(r'\d+', word))) if re.search(r'\d', word) else 0
    if len(w) <= 3:
        return 1
    w = re.sub(r'(?:[^laeiouy]es|[^laeiouytd]ed|[^laeiouy]e)$', lambda m: m.group(0)[0], w)
    w = re.sub(r'^y', '', w)
    return max(1, len(re.findall(r'[aeiouy]+', w)))


def grade_of(sents):
    """The Flesch-Kincaid grade of the spoken sentences."""
    words = [w for s in sents for w in words_of(s)]
    if not sents or not words:
        return 0.0
    count = sum(syllables(w) for w in words)
    return round(0.39 * len(words) / len(sents) + 11.8 * count / len(words) - 15.59, 1)


def _family(term):
    """The words of the list that are one word to a listener: "token" and
    "tokens", "licence" and "licensing". Five letters in common is the rule."""
    return term.lower()[:5]


def jargon_in(sentence, rules=None):
    """The grown-up words in one sentence that it does not explain, one for
    each family of words: "tokens" is explained by "a token is just a word"."""
    low = _plain(sentence).lower()
    terms = (rules or reading_rules())['jargon']
    pattern = lambda term: re.escape(term.lower()).replace('\\ ', '\\s+')
    used = [t for t in terms if re.search(rf'(?<![\w-]){pattern(t)}(?![\w-])', low)]
    explained = {_family(t) for t in used if any(re.search(p.format(w=pattern(t)), low) for p in EXPLAINED)}
    found, seen = [], set()
    for term in used:
        family = _family(term)
        if family in explained or family in seen:
            continue
        seen.add(family)
        found.append(term)
    return found


def reading(paragraphs, rules=None):
    """The reading-age figures of the spoken words: sentences, words, the
    average, the grade, the long sentences, the long quotes, the grown-up
    words left unexplained (each with its sentence), and the share of long
    words (three syllables or more, names left out)."""
    rules = rules or reading_rules()
    sents = sentences(paragraphs)
    counts = [len(words_of(s)) for s in sents]
    long_s = [(n, s) for n, s in zip(counts, sents) if n > rules['max_sentence_words']]
    quotes = []
    for para in paragraphs:
        for m in QUOTE.finditer(_plain(para)):
            q = m.group(1) or m.group(2) or ''
            if len(words_of(q)) > rules['max_quote_words']:
                quotes.append(q.strip())
    # A word explained once stays explained: a listener remembers it (Krish,
    # 2026-10-13, on scripts made to re-explain every word: "they dont sound like me").
    jargon, explained = {}, set()
    for s in sents:
        unexplained = jargon_in(s, rules)
        for term in rules['jargon']:
            if re.search(rf'(?<![\w-]){re.escape(term.lower())}(?![\w-])', _plain(s).lower()) and term not in unexplained:
                explained.add(_family(term))
        for term in unexplained:
            if _family(term) not in explained:
                jargon.setdefault(term, s)
    hard, total = [], 0
    for s in sents:
        for i, w in enumerate(words_of(s)):
            total += 1
            if i > 0 and w[:1].isupper():
                continue  # a name
            if syllables(w) >= 3 and not re.search(r'\d', w):
                hard.append(w)
    return {'sentences': len(sents), 'words': sum(counts), 'average': round(sum(counts) / len(sents), 1) if sents else 0.0,
            'grade': grade_of(sents), 'long_sentences': long_s, 'quotes': quotes, 'jargon': jargon,
            'long_word_share': round(len(hard) / total, 3) if total else 0.0, 'long_words': sorted(set(hard))}


def reading_problems(paragraphs, rules=None):
    """Why a 12-year-old would not follow the script heard once, or []
    (house rule R7, the hard gate on every script)."""
    rules = rules or reading_rules()
    r = reading(paragraphs, rules)
    found = []
    if r['long_sentences']:
        n, s = max(r['long_sentences'])
        found.append(f'{len(r["long_sentences"])} spoken sentence{"s" if len(r["long_sentences"]) > 1 else ""} over '
                     f'{rules["max_sentence_words"]} words, the longest {n} ("{s[:90]}"): split each into two (house rule R7, reading age 12)')
    if r['sentences'] and r['average'] > rules['max_average_words']:
        found.append(f'its sentences average {r["average"]} words; a 12-year-old hearing it once needs {rules["max_average_words"]} or fewer '
                     '(house rule R7)')
    if r['grade'] > rules['max_grade']:
        found.append(f'it reads at grade {r["grade"]}, above {rules["max_grade"]}: shorter sentences and shorter, everyday words (house rule R7)')
    for q in r['quotes']:
        found.append(f'it quotes {len(words_of(q))} words ("{q[:70]}"): a quote cannot be heard as one, and it brings in grown-up '
                     f'language; say it in plain words, or quote at most {rules["max_quote_words"]} (house rule R7)')
    if r['jargon']:
        listed = '; '.join(f'"{term}" in "{s[:70]}"' for term, s in r['jargon'].items())
        found.append(f'it uses words a 12-year-old does not know, with no plain words for them in the same sentence: {listed}. Use an everyday '
                     'word, or say what it means right there (house rule R7)')
    return found


def spoken_paragraphs(text):
    """The words Krish will say, one entry per beat."""
    lines = text.replace('\r\n', '\n').split('\n')
    said = [m.group(1) for m in (SAY_LINE.match(line) for line in lines) if m]
    if said:
        return [s.strip() for s in said if s.strip()]
    if any(line.strip() == '---' for line in lines):
        lines = lines[[line.strip() for line in lines].index('---') + 1:]
    else:
        first = next((i for i, line in enumerate(lines) if STAGE.search(line)), None)
        if first is not None:
            lines = lines[first:]
    paragraphs, current = [], []
    for line in lines:
        if META_START.match(line):
            break
        words = STAGE.sub(' ', line).strip()
        if not line.strip():
            if current:
                paragraphs.append(' '.join(current))
                current = []
            continue
        if words:
            current.append(words)
        elif current:
            paragraphs.append(' '.join(current))
            current = []
    if current:
        paragraphs.append(' '.join(current))
    return [re.sub(r'\s+', ' ', p).strip() for p in paragraphs if p.strip()]


def cut_of(name):
    """The cut a file name says it is, or None."""
    n = str(name or '').lower()
    if re.search(r'deep', n):
        return 'deep'
    if re.search(r'audio|spotify|podcast', n):
        return 'audio'
    if re.search(r'90|short|vertical|tall', n):
        return 'short'
    if re.search(r'long|[35].?min|wide|three|five', n):
        return 'long'
    return None


def length_problem(words, cut):
    """The reason a script is the wrong length for its cut, or None."""
    if cut not in CUTS:
        return None
    low, high, asked = CUTS[cut]
    n = len(words)
    secs = round(n / WORDS_PER_MINUTE * 60)
    when = f'{secs // 60}:{secs % 60:02d}'
    if n > high:
        return (f'the {cut} cut runs {n} spoken words, about {when} at an unhurried pace, and Krish asked for {asked}: '
                f'cut it to {low} to {high} words (house rule {"DEEP_CUT" if cut == "deep" else "TWO_CUTS"})')
    if n < low:
        return (f'the {cut} cut is {n} spoken words, about {when}, short of {asked}: '
                f'it should run {low} to {high} words (house rule {"DEEP_CUT" if cut == "deep" else "TWO_CUTS"})')
    return None


# How long each cut may run as he says it (seconds): the 90-second cut under 89 s (TWO_CUTS, the platforms' line),
# the 5-minute cut by about 5:30, the deep cut 8 to 12 minutes (DEEP_CUT).
SPOKEN_CAP_S = {'short': 89, 'long': 330, 'deep': 720}


def spoken_length_warning(words, cut, ledger=None):
    """How long the script will run as Krish says it, from his own takes
    (config/narration-ledger.json, narration_diff.py): he adds to every script
    (9% on Monday 12 Oct, 38% by Friday 16 Oct) at 170 to 180 words a minute, so
    a script inside its word count can still run over. A warning, never a refusal."""
    if cut not in SPOKEN_CAP_S:
        return None
    import narration_diff
    got = narration_diff.spoken_estimate(len(words), cut, ledger)
    if not got:
        return None
    secs, how = got
    if secs <= SPOKEN_CAP_S[cut]:
        return None
    cap = SPOKEN_CAP_S[cut]
    return (f'as Krish says it, this {cut} cut will run about {int(secs) // 60}:{int(secs) % 60:02d}, over {cap // 60}:{cap % 60:02d} '
            f'({how}): cut about {round(len(words) * (1 - cap / secs))} words (house rule SCRIPT_AS_HE_TALKS; a warning, not a refusal)')


REJECTED = Path(__file__).resolve().parents[2] / 'config' / 'rejected-lines.json'


def rejected_problems(spoken):
    """Lines Krish has already read and rejected (config/rejected-lines.json),
    refused in every later script so no mistake is made twice. Krish,
    2026-10-13: "I need a system that improves, not regresses"."""
    try:
        items = json.loads(REJECTED.read_text(encoding='utf-8')).get('rejected') or []
    except (OSError, ValueError):
        return []
    out = []
    for r in items:
        m = re.search(r['pattern'], spoken, re.I)
        if m:
            out.append(f'"{m.group(0)}" is a line Krish rejected ({r["on"]}: {r["said"]}); {r["instead"]}')
    return out


# A score said with nothing to measure it against (house rule PLAIN_SCORES).
# Krish, 2026-10-16, of Friday's 90-second script ("In a low gear, it scored
# 42 on their test. In its top gear, 58."): "What does 42 even mean? that is
# not understandable. We need to simplify this". Earlier the same day, of
# "7 to 20 points": "7-20 points of improvement is too complex".
SCORE_TALK = re.compile(r'\b(?:scor(?:e|es|ed|ing)|points?|rated|rank(?:s|ed)?|index|benchmark|test)\b', re.I)
_TENS = r'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety'
# An ordinal is a place, not a score: "start you in 1st gear" (Krish's own line, 16 Oct).
SCORE_NUMBER = re.compile(rf'(?<![\w$£€.])(?:\d+(?:\.\d+)?(?!(?:st|nd|rd|th)\b)|(?:{_TENS})(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)(?![\w.]*\d)', re.I)
# What makes a number mean something to the ear: a share, a multiple, a scale, an amount.
MEASURED = re.compile(r'[\s-]*(?:%|percent\b|per\s+cent\b|times\b|x\b|out\s+of\b|in\s+(?:a|every|each)\s+(?:hundred|ten|thousand)\b|'
                      r'(?:thousand|million|billion|hundred|dollars?|pounds?|euros?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|'
                      r'words?|people|users?)\b)', re.I)


SCORED = re.compile(r'\bscor(?:e|es|ed|ing)\b', re.I)
PERCENT = re.compile(r'[\s-]*(?:%|percent\b|per\s+cent\b)', re.I)
RELATIVE = re.compile(r'[\s-]*(?:%|percent|per\s+cent)\s+(?:higher|lower|more|less|better|worse|cheaper|dearer|up|down)\b', re.I)


def score_problems(paragraphs):
    """Scores a 12-year-old cannot weigh, heard once: a number said as a score
    or points, with no share, multiple or scale to tell the ear what it means.
    A sentence that follows a score sentence and says a bare number is one
    too ("In its top gear, 58.")."""
    found, after_score = [], False
    for s in sentences(paragraphs):
        plain = _plain(s)
        talk = bool(SCORE_TALK.search(plain))
        bare = []
        for m in SCORE_NUMBER.finditer(plain):
            n = m.group(0)
            before = plain[:m.start()].split()
            if re.fullmatch(r'(?:19|20)\d\d', n):
                continue  # a year
            if before and re.match(r'[A-Z]', before[-1]) and not before[-1].endswith((',', '.')):
                continue  # a name's number: Opus 5, GPT 6.1
            # A test score given as a percentage is still a score; "40% higher" is a comparison.
            # Krish, 2026-10-18, of the article's "scored 57.6% for $2.94, against 52.3% for $15.83":
            # vague scores mean nothing to a reader. Kept in step with bareScores in
            # apps/control-plane/api/_publishChecks.ts.
            if SCORED.search(plain) and PERCENT.match(plain[m.end():]) and not RELATIVE.match(plain[m.end():]):
                bare.append(n + '%')
                continue
            if MEASURED.match(plain[m.end():]) or re.search(r'\bout\s+of\s*$', plain[:m.start()], re.I):
                continue  # a share, a multiple, an amount, or the scale itself ("out of 100")
            bare.append(n)
        if bare and (talk or after_score):
            found.append(f'it says a score with nothing to measure it against ("{bare[0]}" in "{s[:80]}"): a listener cannot tell '
                         'what the number means. Say it as a plain comparison ("did much better", "about a third higher", '
                         '"beat the new one"), a share or a multiple (house rule PLAIN_SCORES; Krish, 2026-10-16: '
                         '"What does 42 even mean?")')
        after_score = talk or bool(bare and after_score)
    return found


def problems(text, cut=None, series=None):
    """Plain-words reasons this script is not ready, or [] when it passes.
    `cut` ('long' or 'short') adds the length rule; `series` (the piece's
    lane_slot) adds its series line. The reading gate (house rule R7) holds
    for every script."""
    found = []
    if UNCHECKED in text:
        found.append(f'some lines are marked {UNCHECKED}: add those facts to the article and run the fact check, or cut them')
    beats = spoken_paragraphs(text)
    words = ' '.join(beats).split()
    if not words:
        return found + ['no spoken words found: a script is only the words Krish says, one plain paragraph per thought (house rule SCRIPT_ONLY)']
    found += series_problems(beats, series)
    found += rejected_problems(' '.join(beats))
    found += score_problems(beats)
    # The hook's room starts after the series line, so the line never uses it up.
    opened = opener_of(' '.join(beats))
    hook = words[len(opened.split()):] if opened else words
    if '?' not in ' '.join(hook[:OPENING_WORDS]):
        found.append('it does not open on a question: say, in the first beat, the one question the script answers')
    extra = [name for rx, name in NOT_SPOKEN if rx.search(text)]
    if extra:
        found.append(f'it carries more than the words Krish says ({", ".join(extra)}): a script is only the spoken '
                     'words as plain paragraphs; shots go in the shot list and joke options beside it (house rule SCRIPT_ONLY)')
    if len(words) >= SHORT_WORDS and not OUTRO.search(beats[-1]):
        found.append('it stops without a spoken outro: after the call, say what this was, where the full piece is '
                     '(makeyourmindup.ai) and sign off, so it never ends on the number')
    elif len(words) >= SHORT_WORDS and not ARTICLE.search(beats[-1]):
        found.append('the outro never sends anyone to the article: say there is a full article, what it adds, that it is '
                     'free and where (makeyourmindup.ai) (house rule HOOK_AND_CTA)')
    too = length_problem(words, cut)
    if too:
        found.append(too)
    for beat in beats:
        quote_free = re.sub(r'"[^"]*"|\u201c[^\u201d]*\u201d', '', beat)
        if SPOKEN_STAMP.search(quote_free) or SPOKEN_LABEL.search(quote_free) or HEADING_MARKUP.search(beat):
            found.append(f'it speaks a heading or stamp aloud ("{beat[:70]}..."): say what the claim is and why it matters, '
                         'and leave REAL or THEATRE to the stamp on screen')
            break
    found += reading_problems(beats)
    return found


OPINION = re.compile(r"\b(?:my (?:bet|call|take|guess)|i think|i reckon|i'd bet|i would bet|if you ask me|"
                     r"i'm not convinced|i am not convinced|i don't buy|here's where i land)\b", re.I)


# A line saying the script, the video or the piece was made with AI (house
# rule NO_AI_DISCLOSURE_LINE). Krish, 2026-10-12: "Eliminate the "I made this with AI"
# entirely - no need, it's like verbal diahorrea", then "correct, make that a
# rule".
AI_LINE = re.compile(
    r"\b(?:i|we)(?:'ve| have)?\s+(?:\w+\s+){0,2}?(?:made|make|wrote|written|write|built|build|researched|produced|created)\s+"
    r"(?:all\s+of\s+)?(?:this|the\s+(?:video|script|piece|article|publication|newsletter))\b[^.!?]{0,40}?"
    r"\b(?:with|using|thanks\s+to)\b[^.!?]{0,30}?\b(?:claude|chatgpt|an?\s+ai|ai|a\s+model|an\s+llm)\b"
    r"|\bthis\s+(?:video|script|piece|article|publication|newsletter)\s+(?:was|is)\s+(?:made|written|built|produced)\s+"
    r"(?:with|by|using)\s+(?:the\s+help\s+of\s+)?(?:claude|chatgpt|an?\s+ai|ai)\b", re.I)


PERSONAL_INTRO = re.compile(r"\bI've been\b|\bI have been\b|\bbreak (?:it|this) down\b", re.I)


def warnings(text):
    """The sixth point, and the made-with-AI line, as warnings and never a refusal.

    Krish, 2026-10-09 (house rule VOICE_ON_CAMERA): the script is him reacting,
    with opinion and dry wit. A rule cannot grade a joke; it can see whether a
    script of a minute or more ever says an opinion as an opinion ("my bet",
    "I think", "my call"), kept apart from the checked facts. Whether the wit
    landed is for him. And it can see a line saying the script was made with
    AI (house rule NO_AI_DISCLOSURE_LINE), which he ruled out of every script on
    2026-10-12: cut it."""
    beats = spoken_paragraphs(text)
    words = ' '.join(beats).split()
    found = []
    if len(words) >= SHORT_WORDS and not OPINION.search(' '.join(beats)):
        found.append('it states no opinion as an opinion: somewhere say "I reckon", "I think" or "my call", kept apart '
                     'from the checked facts (house rule VOICE_ON_CAMERA; a warning, not a refusal)')
    for beat in beats:
        hit = AI_LINE.search(beat)
        if hit:
            found.append(f'it says it was made with AI ("{hit.group(0)[:80]}"): cut the line; Krish, 2026-10-12: "Eliminate the '
                         '"I made this with AI" entirely" (house rule NO_AI_DISCLOSURE_LINE; a warning, not a refusal)')
            break
    # PERSONAL_INTRO (Krish, 2026-10-13): after the series line, open on what he's
    # been doing with the thing and why it matters, then the break-down promise.
    if len(beats) > 1 and not PERSONAL_INTRO.search(beats[1]):
        found.append('the beat after the series line does not open the way Krish would: say what you have been doing with '
                     'the thing, why it matters, and that you wanted to break it down (house rule PERSONAL_INTRO; his line is in '
                     'config/golden-examples.json; a warning, not a refusal)')
    # How he says it, measured from his takes (SCRIPT_AS_HE_TALKS).
    found += spoken_habit_warnings(beats)
    # The share of long words: a rough figure (names left out), told, never refused.
    if beats:
        r = reading(beats)
        if r['long_word_share'] > LONG_WORD_SHARE:
            found.append(f'{r["long_word_share"]:.0%} of its words have three syllables or more (above {LONG_WORD_SHARE:.0%}): '
                         f'{", ".join(r["long_words"][:12])}; swap the ones you can for short words (house rule R7; a warning, not a refusal)')
    return found


LONG_WORD_SHARE = 0.06  # long words above this share are told, never refused

# How Krish says a script, measured from his takes (house rule SCRIPT_AS_HE_TALKS;
# docs/narration/week-of-12-oct): about one sentence in three opens with one of
# these, in every take, about twice the scripts' share.
JOINERS = ('so', 'and', 'but', 'now', 'see')
JOINER_SHARE = 0.25
BARE_PREDICTION = re.compile(r"^\s*(?:my prediction\s*[:.]|here'?s my bet\s*[:.]|my bet\s*[:.])\s*$", re.I)
DAY_DEADLINE = re.compile(r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)"
                          r"\s+20\d\d\b")
HIS_WORDS = [(re.compile(r"\bnobody\b", re.I), '"no one", not "nobody"'),
             (re.compile(r"\b(?:my bet|I bet|I'd bet)\b", re.I), '"I reckon", not "my bet" or "I bet"')]


def spoken_habit_warnings(beats):
    """Where a script is not written the way he says it (house rule
    SCRIPT_AS_HE_TALKS): warnings, never refusals."""
    found = []
    sents = [x for b in beats for x in re.split(r'(?<=[.!?])\s+', b) if words_of(x)]
    if len(sents) >= 12:
        share = sum(1 for x in sents if words_of(x)[0].lower() in JOINERS) / len(sents)
        if share < JOINER_SHARE:
            found.append(f'only {share:.0%} of its sentences open with So, And, But, Now or See; he opens about one in three that way '
                         'in every take (So before a result or the prediction, "Now," before a new step or a question): say the link in '
                         'the opening word (house rule SCRIPT_AS_HE_TALKS; a warning, not a refusal)')
    for x in sents:
        if BARE_PREDICTION.match(x):
            found.append(f'"{x.strip()}" stands alone; he never says a prediction label on its own: run it into the claim, "So my '
                         'prediction is that..." (house rule SCRIPT_AS_HE_TALKS; a warning, not a refusal)')
            break
    text = ' '.join(beats)
    day = DAY_DEADLINE.search(text)
    if day:
        found.append(f'"{day.group(0)}" is a day number; he says a deadline as a period ("by the end of December 2027"): keep the '
                     'exact day in the article and the prediction record (house rule SCRIPT_AS_HE_TALKS; a warning, not a refusal)')
    for rx, say in HIS_WORDS:
        if rx.search(text):
            found.append(f'write his words: {say} (house rule SCRIPT_AS_HE_TALKS; a warning, not a refusal)')
    return found


CHAPTER_START = re.compile(r'starts:\s*"([^"]+)"')


def chapter_problems(text, chapters):
    """Why a chapter list beside a script (<script>.chapters.md) no longer
    fits it, or []. Each chapter's "starts:" words must be said in the
    script, in the list's order: once a script is cut, a stale start would
    put a YouTube or Spotify chapter on words that are never said."""
    said = _plain(' '.join(spoken_paragraphs(text)))
    found, at = [], 0
    for want in CHAPTER_START.findall(chapters):
        where = said.find(_plain(want), at)
        if where < 0:
            where_any = said.find(_plain(want))
            found.append(f'chapter start "{want}" is ' + ('said before the chapter above it' if where_any >= 0 else 'not in the script')
                         + '; fix the .chapters.md beside it')
        else:
            at = where
    return found


def check_file(path, cut=None, series=None):
    text = Path(path).read_text(encoding='utf-8-sig')
    found = problems(text, cut or cut_of(Path(path).name), series)
    chapters = Path(path).with_suffix('.chapters.md')
    if chapters.is_file():
        found += chapter_problems(text, chapters.read_text(encoding='utf-8-sig'))
    return found


def warn_file(path):
    return warnings(Path(path).read_text(encoding='utf-8-sig'))


# ---------------------------------------------------------------- self-test

HIGGSFIELD_V1 = '''Higgsfield, taken apart: the video script (about 3 minutes)
Square brackets say what is on screen. Everything else is said to camera.

\\[To camera\\] Before OpenAI shut down Sora, its biggest customer, Tech Times reported, was a company called Higgsfield. Then in September, Higgsfield's founder said it had crossed a billion dollars a year. So we took it apart.

\\[On screen: 4 WEEKS x 13\\] One: the billion. Real, with small print. The founder says they take the last four weeks of sales and multiply by thirteen. It's a pace, worked out from four weeks.

\\[On screen: OUR CALL\\] Our call: by the end of June 2027, Higgsfield raises money at a valuation of ten billion dollars or more. Eighty-five per cent sure.
'''

HIGGSFIELD_V2_END = '''[To camera]
In September, the boss of an AI video company called Higgsfield said it had crossed a billion dollars a year in sales. So is that billion real? Let's take it apart.

[On screen: THEATRE stamp]
Now the one bit that's theatre. On a podcast, the founder was asked, "You don't do paid?" He said, "We don't do paid." That's paid advertising in a nicer jacket. ''' + ' '.join(['More words that fill the middle of the script.'] * 20) + '''

[On screen: OUR CALL, BY 30 JUNE 2027, 85%]
So here's our call. By the end of June 2027, Higgsfield raises money at a valuation of ten billion dollars or more. How sure are we? Eighty-five per cent.

[End card, added in the edit]

Changes from version 1, and why
- No spoken sign-off.
'''

GOOD = '''I've been looking at what's really inside the AI everyone's selling us. I'm Krish.

So how do you lose your biggest supplier and keep growing? Let's take it apart.

One claim doesn't stand up. On a podcast, the founder was asked if Higgsfield pays for advertising. "We don't do paid," he said. ''' + ' '.join(['More words that fill the middle of the script.'] * 20) + '''

So here's our call. We're eighty-five per cent sure, and we'll mark it right or wrong on the day.

That's under.the.hood for this week. The full teardown is free at makeyourmindup.ai. Make your mind up.
'''

ONE_OFF = '''# 01 A one-off

## Script

**[0:00]**

**Say:** Why does your AI sound like a stranger? Because it has never met you.

*On screen:* Face.

**[0:10]**

**Say:** ''' + ' '.join(['Words that carry the middle of the script along.'] * 20) + '''

**[2:00]**

**Say:** So, this week: write your five lines. That's makeyourmindup. Make your mind up.

*On screen:* Full face.

## Before you record

- A note that is never spoken: REAL.
'''


def self_test():
    failures, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    v1 = problems(HIGGSFIELD_V1)
    check('version 1 has no opening question', any('open on a question' in p for p in v1), True)
    check('version 1 speaks a heading', any('heading or stamp' in p for p in v1), True)
    v2 = problems(HIGGSFIELD_V2_END)
    check('version 2 ends on the number', any('spoken outro' in p for p in v2), True)
    check('version 2 opens on a question', any('open on a question' in p for p in v2), False)
    check('a quoted "We don\'t do paid" is no heading', any('heading or stamp' in p for p in v2), False)
    check('version 3 shape passes', problems(GOOD), [])
    check('unchecked facts block it', any(UNCHECKED in p for p in problems(GOOD + '\n[NOT YET FACT-CHECKED]\n')), True)
    one_off = problems(ONE_OFF)
    check('a script with Say: lines, timings and notes is more than words', any('SCRIPT_ONLY' in p for p in one_off), True)
    check('stage directions are more than words', any('SCRIPT_ONLY' in p for p in problems(HIGGSFIELD_V1)), True)
    check('an outro with no article is refused',
          any('HOOK_AND_CTA' in p for p in problems(GOOD.replace('The full teardown is free at', 'Find us at'))), True)
    check('notes after the script are never spoken', any('heading or stamp' in p for p in problems(ONE_OFF)), False)
    short = 'Why does it matter? Because the price doubled. That is the whole story.\n'
    check('a short hook needs no outro', problems(short), [])
    once = reading(['Models are the AI engines underneath. ChatGPT has lots of models now.'])['jargon']
    check('a word explained once stays explained for the rest of the script', 'models' in once or 'model' in once, False)
    def warns(t):
        # The voice check alone: the intro and the spoken-habit warnings have their own tests.
        return [w for w in warnings(t) if 'PERSONAL_INTRO' not in w and 'SCRIPT_AS_HE_TALKS' not in w]
    check('a long script with no opinion gets a warning, never a refusal', len(warns(GOOD)), 1)
    check('a script whose second beat skips the personal intro gets a PERSONAL_INTRO warning',
          any('PERSONAL_INTRO' in w for w in warnings(GOOD)), True)
    check("his intro, \"I've been having a little play around with...\", clears it",
          any('PERSONAL_INTRO' in w for w in warnings(open(Path(__file__).resolve().parents[2] / 'docs/plans/2026-10-14-draft-script.md', encoding='utf-8').read())), False)
    talky = ' '.join(['So it costs more. And nobody checks. Now, is that fair? The app starts low.'] * 4)
    flat = ' '.join(['It costs more. People never check. Is that fair? The app starts low.'] * 4)
    check('a script that opens few sentences with a joiner is warned; one written his way is not',
          (any('So, And, But, Now or See' in w for w in spoken_habit_warnings([flat])),
           any('So, And, But, Now or See' in w for w in spoken_habit_warnings([talky]))), (True, False))
    check('a bare "My prediction:" and a day-number deadline are warned',
          (any('stands alone' in w for w in spoken_habit_warnings(['My prediction:', 'By 31 December 2027, it ships.'])),
           any('day number' in w for w in spoken_habit_warnings(['By 31 December 2027, it ships.']))), (True, True))
    check('"nobody" is warned towards his "no one"', any('"no one"' in w for w in spoken_habit_warnings([talky])), True)
    check('a long script that says "my bet" passes the voice check',
          warns(GOOD.replace("So here's our call.", "So here's my bet.")), [])
    check('a short hook needs no opinion', warnings(short), [])
    # House rule NO_AI_DISCLOSURE_LINE: the line Krish cut from Monday's and Friday's scripts on 2026-10-12.
    said_ai = warnings(GOOD.replace("So here's our call.", "My bet: yes. Yes, I made this with Claude's help. So here's our call."))
    check('a line saying it was made with Claude is a warning naming his rule, never a refusal',
          ([w for w in said_ai if 'NO_AI_DISCLOSURE_LINE' in w] != [], problems(GOOD.replace("So here's our call.", "I made this with Claude's help. So here's our call."))
           == problems(GOOD)), (True, True))
    check('a song made with an app, or "it", is not that line', [bool(AI_LINE.search(x)) for x in (
        'I made a song with Suno in ten minutes.', 'I made it with AI in ten minutes.', 'A fan made this with AI.')], [False, False, False])
    check('the voice warning never refuses', problems(GOOD), [])
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        led = Path(tmp) / 'ledger.json'
        led.write_text(json.dumps({'takes': [{'take': 'x', 'cut': 'short', 'date': '2026-10-14', 'said_more_pct': 38.3, 'words_a_minute': 174.2}]}))
        warned = spoken_length_warning(['w'] * 190, 'short', led)
        check('a 90-second script that will run long as he says it is a warning naming the time and the cut to make',
              (bool(warned), '1:30' in (warned or '') or '1:3' in (warned or ''), 'SCRIPT_AS_HE_TALKS' in (warned or '')), (True, True, True))
        check('one that fits is not', spoken_length_warning(['w'] * 150, 'short', led), None)
        check('no take of the cut, no warning', spoken_length_warning(['w'] * 900, 'deep', led), None)
    filler = lambda n: 'Why does the price matter? ' + ' '.join(['word'] * (n - 5))
    check('a 5-minute long cut passes the length rule', length_problem(filler(750).split(), 'long'), None)
    check('a 7-minute long cut is refused', 'cut it to 675 to 825' in (length_problem(filler(1000).split(), 'long') or ''), True)
    check('a 90-second short cut passes', length_problem(filler(185).split(), 'short'), None)
    check('a two-minute short cut is refused', 'TWO_CUTS' in (length_problem(filler(300).split(), 'short') or ''), True)
    check('a long cut far too short is refused', 'short of a 5-minute video' in (length_problem(filler(250).split(), 'long') or ''), True)
    check('no cut, no length rule', length_problem(filler(900).split(), None), None)
    check('a file named 90s is the short cut', cut_of('script-90s.md'), 'short')
    check('a file named long is the long cut', cut_of('script_long.md'), 'long')
    check('a file named audio is the Spotify audio edition', cut_of('2026-10-12-warner-suno-audio.md'), 'audio')
    check('a file named deep is the week\'s deep cut', cut_of('2026-10-09-draft-script-deep.md'), 'deep')
    check('a 1,500-word deep cut passes the length rule', length_problem(filler(1500).split(), 'deep'), None)
    check('a 450-word deep cut is refused, naming DEEP_CUT', 'DEEP_CUT' in (length_problem(filler(450).split(), 'deep') or ''), True)
    check('a 1,400-word audio edition passes the length rule', length_problem(filler(1400).split(), 'audio'), None)
    check('a plain name says nothing', cut_of('script.md'), None)
    check('problems() carries the length rule when the cut is known', any('TWO_CUTS' in p for p in problems(GOOD, 'long')), len(' '.join(spoken_paragraphs(GOOD)).split()) not in range(675, 826))

    # The series line (house rule SERIES_OPENER), read from the house rules.
    lines = series_openers()
    check('the three series lines, as Krish picked them, from the house rules', lines, {
        'follow_the_money': "I've been following how money is changing because of AI. I'm Krish.",
        'under_the_hood': "I've been looking at what's really inside the AI everyone's selling us. I'm Krish.",
        'mind_the_gap': "I've been keeping a beady eye on what's coming with AI, before everyone notices. I'm Krish."})
    check('a script that opens with its series line passes', problems(GOOD, None, 'under_the_hood'), [])
    check('another series\' line is refused, naming the right one',
          any('SERIES_OPENER' in p and "inside the AI everyone's selling us" in p for p in problems(GOOD, None, 'under_the_hood')
              + problems(GOOD.replace(lines['under_the_hood'], lines['mind_the_gap']), None, 'under_the_hood')), True)
    no_line = GOOD.split('\n\n', 1)[1]
    check('a script with no series line is refused once its series is known, and passes when it is not',
          (any('does not open with its series line' in p for p in problems(no_line, None, 'under_the_hood')), problems(no_line)), (True, []))
    check('the line must come first: the hook before it is refused',
          any('does not open with its series line' in p for p in problems(no_line.replace('Let\'s take it apart.', 'Let\'s take it apart. '
                                                                                           + lines['under_the_hood'], 1), None, 'under_the_hood')), True)
    check('curly apostrophes are the same words', problems(GOOD.replace("'", '\u2019'), None, 'under_the_hood'), [])
    again = GOOD.replace('Make your mind up.', "I'm Krish. Make your mind up.")
    check('"I\'m Krish" again after the line is refused, with the series known or not',
          (any('again after the series line' in p for p in problems(again, None, 'under_the_hood')), any('again after the series line' in p for p in problems(again))),
          (True, True))
    check('a series with no line is said, never guessed', series_problems(['x'], 'money_of_ai')[0].startswith('"money_of_ai" is not a series'), True)
    late = lines['follow_the_money'] + ' ' + ' '.join(['Word'] * 80) + ' and so who gets paid?'
    check('the hook\'s room starts after the series line: a question 81 words in passes', any('open on a question' in p for p in problems(late)), False)

    # Reading age 12 (house rule R7), read from the house rules.
    rules = reading_rules()
    check('the gate\'s numbers', (rules['max_sentence_words'], rules['max_average_words'], rules['max_grade'], rules['max_quote_words']), (20, 12, 6, 4))
    fine = 'Why does it matter? Because the price doubled. That is the whole story.'
    check('a plain short script passes the gate', reading_problems([fine]), [])
    long_one = 'Why does it matter? It ran ' + ' '.join(['and ran'] * 10) + '.'
    check('a sentence over 20 words is refused', any('over 20 words, the longest 22' in p for p in reading_problems([long_one])), True)
    wordy = ' '.join(['The cat sat on the big mat by the warm red door today.'] * 4)
    check('sentences averaging more than 12 words are refused', any('average 13' in p for p in reading_problems([wordy])), True)
    hard = 'Unprecedented regulatory uncertainty complicates international cooperation.'
    check('a reading grade above 6 is refused', any('reads at grade' in p for p in reading_problems([hard])), True)
    check('a quote over four words is refused; four are fine',
          (any('quotes 6 words' in p for p in reading_problems(['They called it "a functioning market for every song".'])),
           reading_problems(['They called it "a portion" of the cake.'])), (True, []))
    check('a grown-up word is refused unless its sentence says what it means',
          (any('"royalties"' in p for p in reading_problems(['Singers get royalties.'])),
           reading_problems(['Singers get royalties, which are money paid each time a song plays.']),
           reading_problems(['A token is just a word, and tokens are cheap.'])), (True, [], []))
    check('a list word inside a longer word is not that word', reading_problems(['The modelling clay was red.']), [])
    check('two words of the list: "fair use"', jargon_in('They say it was fair use.'), ['fair use'])
    check('a name inside a sentence is no long word', reading([fine + ' Ask Anthropic.'])['long_words'], [])
    check('syllables: rough, but right for the usual words',
          [syllables(w) for w in ('cat', 'table', 'wanted', 'jumped', 'everyone', 'music', '2027', '$150,000')], [1, 2, 2, 1, 3, 2, 1, 2])
    check('a line Krish rejected is refused in any later script (config/rejected-lines.json)',
          any('Krish rejected' in p for p in problems('It lives in a locked box on the company\'s computers.')), True)
    check('the gate refuses through problems(), for every script', any('house rule R7' in p for p in problems(fine + ' ' + long_one)), True)

    # A score with nothing to measure it against (house rule PLAIN_SCORES; Krish, 2026-10-16: "What does 42 even mean?").
    old_90s = ('In a low gear, it scored 42 on their test. In its top gear, 58. '
               'The older Opus 5, trying its hardest, only got 51.')
    check('Friday\'s bare scores are refused, each one, the follow-on "58." and "got 51" too',
          [p.split('"')[1] for p in score_problems([old_90s])], ['42', '58', '51'])
    check('"7 to 20 points" is a bare score', len(score_problems(['It scored 7 to 20 points higher in top gear.'])), 1)
    check('the forty-two said as a word is the same score', len(score_problems(['It scored forty-two on their test.'])), 1)
    check('plain comparisons, shares, multiples, names and years pass', score_problems([
        'In a hard test, the newest Claude in low gear lost to the older Claude in top gear.',
        'In its top gear, it did much better than in its lowest. The older Opus 5, in its top gear, beat the new one.',
        'Its score only goes up by about a third. It costs about eleven times as much.',
        'It scored 58 out of 100. I\'m 85% sure. In March 2025, a test ran on GPT 6.1 for 4 seconds.',
        'Before, one user in a hundred used thinking. After, seven in a hundred did.']), [])
    check('an ordinal after a test sentence is a place, not a score; a bare score next to one still is', (score_problems([
        'In a tough reasoning test, the newest Claude Opus in its lowest gear lost to the older one in top gear.',
        'So why do these tools start you in 1st gear? How hard it thinks is the gear - 1st, 2nd, 3rd, 21st.']),
        [p.split('"')[1] for p in score_problems(['In 1st gear it scored 42 on their test.'])]), ([], ['42']))
    check('a test score as a percentage is still a score (Krish, 2026-10-18)',
          bool(score_problems(['Opus 5.5 at medium scored 57.6% for $2.94, against 52.3% for $15.83.'])), True)
    check('a percentage that compares is fine', score_problems(['It scored 40% higher in its top gear.']), [])
    check('a score refuses through problems(), for every script', any('PLAIN_SCORES' in p for p in problems(fine + ' ' + old_90s)), True)

    # The chapter list beside a deep cut follows the words as they are now.
    listed = '- One | starts: "Why does it"\n- Two | starts: "That is the whole"\n'
    check('chapter starts said in order pass', chapter_problems(fine, listed), [])
    check('a chapter start the script no longer says is refused',
          any('not in the script' in p for p in chapter_problems(fine.replace('That is the whole story.', 'Some of both.'), listed)), True)
    check('chapter starts out of order are refused',
          any('before the chapter above it' in p for p in chapter_problems(fine, '- Two | starts: "That is the whole"\n- One | starts: "Why does it"\n')), True)

    # This week's unrecorded scripts, as their pieces' records hold them. Monday's
    # were recorded on the 12 October lines and keep those words; a script
    # already read on camera is never changed to suit a later line. Friday's v5
    # is the last the gate passed; his own v6 went through on his words
    # (making.py scripts --krish-words), so it is not held to the gate here.
    plans = Path(__file__).resolve().parents[2] / 'docs' / 'plans'
    for name, series in (('2026-10-14-draft-script.md', 'under_the_hood'), ('2026-10-14-draft-script-90s.md', 'under_the_hood'),
                         ('2026-10-09-script-deep-v5.md', 'mind_the_gap'), ('2026-10-09-script-90s-v5.md', 'mind_the_gap')):
        path = plans / name
        if path.is_file():
            text = path.read_text(encoding='utf-8')
            check(f'{name} opens with its series line and says "I\'m Krish" once',
                  series_problems(spoken_paragraphs(text), series), [])
    if failures:
        print('story check self-test FAILED:\n  ' + '\n  '.join(failures))
        return 1
    print(f'story check self-test passed: {count} checks')
    return 0


def main(argv):
    if argv[1:2] == ['--self-test']:
        return self_test()
    args = list(argv[1:])
    cut = series = None
    while args[:1] in (['--cut'], ['--series']) and len(args) >= 2:
        flag, value, args = args[0], args[1], args[2:]
        if flag == '--cut':
            cut = value if value in CUTS else None
            if cut is None:
                print(f'--cut must be one of {", ".join(CUTS)}')
                return 2
        else:
            if value not in series_openers():
                print(f'--series must be one of {", ".join(series_openers())} (the piece\'s lane_slot)')
                return 2
            series = value
    if not args:
        print(__doc__.strip())
        return 2
    worst = 0
    for path in args:
        found = check_file(path, cut, series)
        if found:
            worst = 1
            print(f'NOT READY  {path}')
            for item in found:
                print(f'  - {item}')
        else:
            print(f'ready      {path}')
        for item in warn_file(path):
            print(f'  WARN {item}')
        long_said = spoken_length_warning(words_of(' '.join(spoken_paragraphs(Path(path).read_text(encoding='utf-8-sig')))), cut)
        if long_said:
            print(f'  WARN {long_said}')
    return worst


if __name__ == '__main__':
    sys.exit(main(sys.argv))
