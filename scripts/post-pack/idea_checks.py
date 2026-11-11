#!/usr/bin/env python3
"""The ideas board's checks in code: what Krish refused stays refused, a return comes back deeper, and an option is his
only when it points to his own words (the ideas quality plan, Wave 1; the board for the week of 23 November is the
first one they hold).

Krish, 2026-11-09, of the 16 Nov board: "I just said that Infosys is boring so why did you make the piece about
Infosys?" and "Told you already. Infosys is boring." The 7 Nov run had his "Infosys is boring as hell" (a Track press,
3 Nov) and ranked Infosys first anyway: nothing in code read his refusals. And of the wider lesson: "I would much rather
the engine know what kind of thing doesn't fly with me, rather than implement incredibly specific rules everywhere which
came from feedback on one piece of content for one specific reason." So every check here is narrow. It keys on the
subject he refused (a name his refusing words share with the option he refused), never on every company or study an
option names; it is shown to him with his words; one press undoes it; and anything that answers his own ask passes.

Pure functions: no I/O, no model, no spend. board_feed.py reads sources.json and ideas.json and calls them (cover and
gate); tests/ideas_history_test.py replays them on every past board with only what was known before it.

Two shapes go in:
  - a refusal: a subject he refused, from his Reject press (hard: an option on it fails the run) or from refusing
    words inside another press (soft: a warning on the option, never placed first, until he approves the rule P6);
  - an option: what the board offers, reduced to what the checks read (its ref, day, place, idea id, names, covers).
Live adapters build both from sources.json and ideas.json; the history fixture stores them already reduced: ids,
names and short hashes, never his words.
"""
import hashlib
import re
from datetime import date

# The words that refuse (the plan's list, "boring", "lame", "no point" or "don't understand", and their spellings).
REFUSE = re.compile(r"\b(?:boring|lame|pointless|no point|(?:do not|don't|dont|don’t)\s+(?:really\s+)?(?:understand|get the point)"
                    r"|no idea what the point)\b", re.I)
# A press that says he has said it before.
REPEAT = re.compile(r"\b(?:told you|i just said|already said|said already)\b", re.I)
# The kinds of part a worded press splits into (item 4), and the words that mark each: the scorecard's labels and the
# floor under the run's own split. One press can hold several.
PART_WORDS = {
    'refuse': REFUSE,
    'depth': re.compile(r"\b(?:research\w*|evidence\w*|deeper|depth|deep dive|perplexity|substantiat\w*|5 whys|five whys|"
                        r"more substance|10 times|ten times|keep an eye)\b", re.I),
    'simpler': re.compile(r"\b(?:simple|simpler|simplif\w*|too complex|complex to understand|less finicky|less technical|confus\w*|plain english)\b", re.I),
    'reframe': re.compile(r"\b(?:broader|wider|bigger|instead|real question|needs to be about|should be about|main narrative|"
                          r"becomes a|big-picture|big picture|turn this in ?to|merge)\b", re.I),
    'format': re.compile(r"\b(?:carousel|meme|talking head|to-camera|caption|voiceover|cover page|infographic\w*|video and audio)\b", re.I),
    'wish': re.compile(r"\b(?:i like|i love|really interesting|great piece|great topic|we should|i want|let's do|let's run|let's make)\b", re.I),
}
PART_KINDS = tuple(PART_WORDS)

# Capitalised words that are never a subject: sentence openers, pronouns, days, months, and words too general to veto.
STOP = set('''
a an the this that these those it it's its we we'll we're we've let let's lets you your you're he she they them their our my me i i'm
i've i'd i'll not no yes yeah so but and or if when what why how who who's where which is are was were do does did done told just maybe
also then there here good great real really ok okay pov number one two three four five six seven eight nine ten headline hook story
monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun january february march april may june
july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec ai it us uk eu ceo cto cfo coo
needs need make move keep figure ditch hilarious funny new now today tomorrow week next last first every each all some any
please thanks thank sorry wow oh hi hey dear note fyi ps you'll you've you'd they're they'll there's that's what's here's isn't
don't doesn't won't can't ais llm llms gpu gpus across another anyone as ask asks before below both by can case could count even
everyone find for from in imagine into most out outside panel people pick plus pro quote run same small take teach thread turn
underneath unpack use agents companies leaders researchers staff voters weeks mondays wednesdays fridays merge reskin hypothesise
boss after at of on to with without while than over under about only inside why's how's
'''.split())


def short_hash(text):
    """The first 16 hex characters of the sha256 of some words: what a fixture keeps instead of the words."""
    return hashlib.sha256(str(text or '').encode('utf-8')).hexdigest()[:16]


def norm(text):
    """Words as compared: lower case, one space, curly quotes straightened."""
    return ' '.join(str(text or '').replace('’', "'").replace('“', '"').replace('”', '"').lower().split())


def day_of(at):
    return str(at or '')[:10]


def stamp(at):
    """A time as compared, whatever the store wrote: 'YYYY-MM-DDTHH:MM:SS' (UTC), '' when there is none."""
    t = str(at or '').strip().replace(' ', 'T')
    return t[:19] if re.match(r'^\d{4}-\d\d-\d\d', t) else ''


def sentences(text):
    """Words cut into sentences at a full stop, question or exclamation mark followed by a space (so "Character.AI"
    stays whole); a mark inside quotation marks does not end one."""
    text = str(text or '')
    out, start, quoted = [], 0, False
    for i, ch in enumerate(text):
        if ch == '"':
            quoted = not quoted
        elif ch == '“':
            quoted = True
        elif ch == '”':
            quoted = False
        elif ch in '.!?' and not quoted and (i + 1 == len(text) or text[i + 1].isspace()):
            if text[start:i + 1].strip():
                out.append(text[start:i + 1].strip())
            start = i + 1
    if text[start:].strip():
        out.append(text[start:].strip())
    return out


def clauses(text):
    """Sentences cut again at "but" and at semicolons: "Infosys is boring as hell but X is a really interesting topic" is
    two clauses, one refusing and one wishing."""
    out = []
    for s in sentences(text):
        out += [c.strip(' ,;') for c in re.split(r';|,?\s+\bbut\b\s+', s) if c and c.strip(' ,;')]
    return out


def refusing(text):
    """The clauses of his words that refuse (REFUSE), in order."""
    return [c for c in clauses(text) if REFUSE.search(c)]


def questions(text):
    """Every question he asked: each sentence ending in a question mark, and each quoted phrase that is one."""
    out = []
    for s in sentences(text):
        out += [q.strip() for q in re.findall(r'["“]([^"”]+\?)["”]', s)]
        if re.sub(r'["“][^"”]*["”]', ' ', s).strip().endswith('?'):
            out.append(s.strip())
    return list(dict.fromkeys(out))


def names(text):
    """The names in some words: runs of capitalised words, openers, pronouns, days, months and general words taken off
    each end, a possessive taken off ("Alibaba's" is Alibaba)."""
    out = []
    for run in re.finditer(r"(?:[A-Z][A-Za-z0-9&’'\.\-]*)(?:\s+[A-Z][A-Za-z0-9&’'\.\-]*)*", str(text or '')):
        words = [re.sub(r"(?:['’]s|['’])$", '', w).rstrip('.-') for w in run.group(0).split()]
        while words and words[0].lower() in STOP:
            words.pop(0)
        while words and words[-1].lower() in STOP:
            words.pop()
        name = ' '.join(words)
        if name and name not in out and len(name) <= 40 and len(re.findall(r'\d', name)) < 3:
            out.append(name)
    return out


def mentions(name, text):
    """Whether some words name it, as a whole word."""
    return bool(name) and re.search(r'(?<![A-Za-z0-9])' + re.escape(name) + r'(?![A-Za-z0-9])', str(text or '')) is not None


def subjects_of(refused_words, option_text):
    """The subjects a refusal keys on: the names his refusing words share with the option he refused. Never every name
    the option carries."""
    shown = names(option_text)
    return [n for n in names(refused_words) if any(n == s or mentions(n, s) for s in shown)]


def parts_of(text):
    """The kinds of part his words carry, by the words that mark each (PART_WORDS)."""
    return [k for k, rx in PART_WORDS.items() if rx.search(str(text or ''))]


def offday_id(doc):
    """'infosys' from 'queue/off-tue-infosys' or 'off-sat-infosys'."""
    m = re.match(r'^(?:queue/)?off-(?:mon|tue|wed|thu|fri|sat|sun)-(.+)$', str(doc or ''))
    return m.group(1) if m else None


# ---------------------------------------------------------------------------------------------------------------------
# What he said


def refusal(ref, at, words, *, hard, idea_id=None, option=None, day=None, week=None, option_text='', via=''):
    """One refusal, from one answer of his. hard: his Reject (or not for us, or a Drop). soft: refusing words inside
    another press. subjects: the names it keys on; empty, it keys on the refused idea itself (idea_id, or the off-day
    option's id)."""
    words = str(words or '')
    refused = refusing(words)
    keyed = ' '.join(refused) if refused else (words if hard else '')
    return {'ref': ref, 'at': stamp(at), 'week': week, 'day': day, 'idea_id': str(idea_id).lower() if idea_id else None,
            'option': option, 'hard': bool(hard), 'subjects': subjects_of(keyed, option_text) if keyed else [],
            'said': words or None, 'quote': refused[0] if refused else (words or None), 'via': via}


def answers_of(sources):
    """His latest answer on each idea of the boards before this one, as {ref, kind, at, idea_id, option, said, week,
    doc, day, text}: sources.json outcomes (the ideas gate) first, then his off-day verdicts on weeks the outcomes do not
    hold."""
    out, seen = [], set()
    outs = (sources or {}).get('outcomes') if isinstance((sources or {}).get('outcomes'), dict) else {}
    for kind in ('rejected', 'filed', 'trend', 'improved'):
        for o in outs.get(kind) or []:
            if not isinstance(o, dict):
                continue
            doc = str(o.get('doc') or (f"queue/{o['option']}" if o.get('option') else ''))
            seen.add((str(o.get('week')), doc))
            shown = o.get('shown') if isinstance(o.get('shown'), dict) else {}
            out.append({'ref': f"{o.get('week')}/{doc}", 'kind': kind, 'at': stamp(o.get('at')), 'week': o.get('week'), 'day': o.get('day'),
                        'doc': doc, 'idea_id': str(o['idea_id']).lower() if o.get('idea_id') else None, 'option': offday_id(doc),
                        'said': o.get('said'), 'text': ' '.join(str(x) for x in (o.get('idea'), option_text_off(shown) if shown else '') if x)})
    kinds = {'reject': 'rejected', 'next_week': 'filed', 'trend': 'trend', 'improve': 'improved'}
    for v in ((sources or {}).get('offday_verdicts') or {}).get('verdicts') or []:
        if not isinstance(v, dict) or v.get('side') != 'idea' or v.get('verdict') not in kinds:
            continue
        doc = f"queue/{v.get('option')}"
        if (str(v.get('week')), doc) in seen:
            continue
        seen.add((str(v.get('week')), doc))
        out.append({'ref': f"{v.get('week')}/{doc}", 'kind': kinds[v['verdict']], 'at': stamp(v.get('at')), 'week': v.get('week'),
                    'day': v.get('day'), 'doc': doc, 'idea_id': None, 'option': offday_id(doc), 'said': v.get('words'), 'text': v.get('hook') or ''})
    return out


def refusals_from(sources, shown_text=None):
    """Every refusal of his the sources hold, and every Next week press: {'refusals': [...], 'filed': [...]}.
    shown_text(answer) -> the words of the option he answered, when the answer does not carry them (board_feed.py reads
    the earlier board's ideas.json). Only his own answers count: the ideas gate's outcomes, his off-day verdicts, his
    feedback cues in his words, and his Drops."""
    shown_text = shown_text or (lambda a: '')
    out, filed = [], []
    for a in answers_of(sources):
        text = ' '.join(x for x in (a['text'], shown_text(a)) if x)
        if a['kind'] == 'filed':
            filed.append(a)
        if a['kind'] == 'rejected':
            out.append(refusal(a['ref'], a['at'], a['said'], hard=True, idea_id=a['idea_id'], option=a['option'], day=a['day'],
                               week=a['week'], option_text=text, via='reject'))
        elif a['said'] and refusing(a['said']):
            out.append(refusal(a['ref'], a['at'], a['said'], hard=False, idea_id=a['idea_id'], option=a['option'], day=a['day'],
                               week=a['week'], option_text=text, via=a['kind']))
    hard = {r['idea_id'] for r in out if r['idea_id'] and r['hard']}
    cues = (sources or {}).get('cues') if isinstance((sources or {}).get('cues'), dict) else {}
    for kind, items in cues.items():
        for c in items if isinstance(items, list) else []:
            if not isinstance(c, dict):
                continue
            idea = str(c.get('subject_ref') or '').lower() or None
            if kind == 'not_for_us':
                if not (idea and idea in hard):
                    out.append(refusal(f"cue/{c.get('id')}", c.get('said_at'), c.get('said'), hard=True, idea_id=idea, option_text=c.get('subject'), via='not_for_us'))
            elif c.get('said') and refusing(c['said']) and not any(r['idea_id'] == idea and norm(r['said']) == norm(c['said']) for r in out):
                out.append(refusal(f"cue/{c.get('id')}", c.get('said_at'), c.get('said'), hard=False, idea_id=idea, option_text=c.get('subject'), via=kind))
    for d in ((sources or {}).get('taste') or {}).get('drops') or []:
        if isinstance(d, dict) and d.get('id') and str(d['id']).lower() not in hard:
            out.append(refusal(f"drop/{d['id']}", d.get('at'), d.get('reason'), hard=True, idea_id=d['id'], option_text=d.get('idea'), via='drop'))
    return {'refusals': out, 'filed': filed}


def his_words(sources):
    """[(at, words, ref)]: everything he said that the sources hold, refusing clauses taken out (his asks, cues, worded
    presses, relayed words and the ideas he dropped in). A subject named here after a refusal is raised again."""
    out = []
    for a in (sources or {}).get('asks') or []:
        if isinstance(a, dict) and isinstance(a.get('his_words'), dict):
            out.append((stamp(a.get('words_at')), ' '.join(str(v) for v in a['his_words'].values() if v), f"ask/{a.get('id')}"))
    for a in answers_of(sources):
        if a['said']:
            out.append((a['at'], a['said'], a['ref']))
    for kind, items in ((sources or {}).get('cues') or {}).items():
        for c in items if isinstance(items, list) else []:
            if isinstance(c, dict) and c.get('said'):
                out.append((stamp(c.get('said_at')), c['said'], f"cue/{c.get('id')}"))
    for r in (sources or {}).get('his_relayed') or []:
        if isinstance(r, dict):
            out.append((stamp(r.get('created_at')), ' '.join(str(x) for x in (r.get('title'), r.get('detail')) if x), f"said/{r.get('id')}"))
    pool = [c for s in (sources or {}).get('series') or [] for c in s.get('pool') or []] + list((sources or {}).get('unassigned') or [])
    for c in pool:
        if isinstance(c, dict) and c.get('source_kind') == 'his' and c.get('his_via') == 'said':
            out.append((stamp(c.get('created_at')), str(c.get('idea') or ''), f"idea/{c.get('id')}"))
    return [(at, ' '.join(c for c in clauses(w) if not REFUSE.search(c)), ref) for at, w, ref in out]


def raised_again(subject, r, said):
    """The ref of the words in which he raised the subject again after refusing it, or None."""
    for at, words, ref in said:
        if at > r['at'] and ref != r['ref'] and mentions(subject, words):
            return ref
    return None


def lifted_by(subject, r, unvetoed):
    """His press that gave a refused subject back (queue/veto-<subject> on a later board), or None."""
    for u in unvetoed or []:
        if isinstance(u, dict) and str(u.get('subject') or '').lower() == str(subject).lower() and stamp(u.get('at')) > r['at']:
            return u
    return None


# ---------------------------------------------------------------------------------------------------------------------
# What the board offers


def option_text_main(o):
    pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else {}
    return ' '.join(str(x) for x in (o.get('so_what'), o.get('story'), *[pitch.get(k) for k in ('question', 'headline', 'hook', 'take')],
                                    *(pitch.get('chain') or []), *(pitch.get('examples') or [])) if x)


def option_text_off(o):
    pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else {}
    return ' '.join(str(x) for x in (o.get('title'), o.get('hook'), o.get('copy'), *[pitch.get(k) for k in ('see', 'lands', 'share')]) if x)


MONTHS = {m: i for i, m in enumerate(('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'), 1)}


def dates_in(text):
    """Every '28 Oct 2026', '28 October 2026' or YYYY-MM-DD date in some words, as YYYY-MM-DD."""
    out = re.findall(r'\b20\d\d-\d\d-\d\d\b', str(text or ''))
    for d, m, y in re.findall(r'\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (20\d\d)\b', str(text or '')):
        try:
            out.append(date(int(y), MONTHS[m.lower()], int(d)).isoformat())
        except ValueError:
            pass
    return sorted(set(out))


def reduce_option(o, day, pos, main):
    """An option as the checks read it: its ref, day, place (1 is the one its day leads with), idea id, names, covers,
    how it came, a short hash of its words (so a return that came back unchanged is seen), the dates its sources carry,
    and what the run wrote beside it (from_press, returns, warning, research_prompt)."""
    text = option_text_main(o) if main else option_text_off(o)
    src = o.get('source') if isinstance(o.get('source'), dict) else {}
    returns = o.get('returns') if isinstance(o.get('returns'), dict) else None
    dates = dates_in(' '.join(str(x) for x in (src.get('label'), o.get('why_now')) if x))
    if returns:
        dates += [str(s.get('date'))[:10] for s in returns.get('sources') or [] if isinstance(s, dict) and s.get('date')]
    return {'ref': f'{day}-{pos}' if main else f'off-{day}-{o.get("id")}', 'day': day, 'pos': pos, 'main': main,
            'idea_id': str(o['id']).lower() if main and o.get('id') else None, 'off_id': None if main else str(o.get('id') or ''),
            'names': names(text), 'covers': [str(c) for c in o.get('covers') or []], 'source_kind': o.get('source_kind'),
            'recommended': bool(o.get('recommended')), 'text16': short_hash(norm(text)), 'source_dates': sorted(set(dates)),
            'from_press': o.get('from_press'), 'returns': returns, 'warning': o.get('warning'), 'research_prompt': o.get('research_prompt')}


def board_options(ideas):
    """Every option on an ideas board, reduced: the publishing days in their order, then the off days (the weekly good
    news is a series, not an idea, and is left out)."""
    out = []
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    for day in ('mon', 'wed', 'fri'):
        out += [reduce_option(o, day, n, True) for n, o in enumerate(days.get(day) or [], 1) if isinstance(o, dict)]
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        out += [reduce_option(o, day, n, False) for n, o in enumerate(opts if isinstance(opts, list) else [], 1)
                if isinstance(o, dict) and not o.get('weekly')]
    return out


def his_ids(sources):
    """The ids of everything of his an option may answer: every must_cover id (routed cards, asks, relayed words, ideas he
    dropped in) and every ask."""
    ids = {str(m.get('id')) for m in (sources or {}).get('must_cover') or [] if isinstance(m, dict) and m.get('id')}
    return ids | {str(a.get('id')) for a in (sources or {}).get('asks') or [] if isinstance(a, dict) and a.get('id')}


def is_return_of(opt, a):
    """Whether an option is the idea an earlier answer of his was on: the same idea row, or the same off-day option."""
    return bool((a.get('idea_id') and opt.get('idea_id') == a['idea_id']) or (a.get('option') and opt.get('off_id') == a['option']))


def touches(opt, r):
    """The subject of a refusal an option is on, or None: the refused idea itself, or a name the refusal keys on."""
    if is_return_of(opt, r):
        return (r['subjects'] or ['this idea'])[0]
    for s in r.get('subjects') or []:
        if any(s == n or mentions(s, n) for n in opt.get('names') or []):
            return s
    return None


# ---------------------------------------------------------------------------------------------------------------------
# The checks. Each returns findings: {'code', 'ref', 'line', ...}; board_feed.py prints the lines.


def refused_findings(opts, refused, ask_ids, said=(), unvetoed=(), p6=False):
    """Each option on a subject he refused before the board (item 1).

    code 'refused': a hard refusal (his Reject), or a soft one once he approves P6. The run fails.
    code 'warned': a soft refusal (refusing words inside another press): a warning line on the option, his words.
    code 'warned_first': a warned option placed first on its day (or recommended). The run fails.
    Passes: an option that answers one of his asks (its covers name one), a subject he raised again later, a subject he
    gave back with his press (unvetoed), and the return of an idea he pressed Next week on after refusing, which must
    come back deeper instead (returns_findings)."""
    out = []
    for opt in opts:
        for r in refused['refusals']:
            subject = touches(opt, r)
            if not subject:
                continue
            if set(opt.get('covers') or []) & set(ask_ids):
                continue
            if subject != 'this idea' and (raised_again(subject, r, said) or lifted_by(subject, r, unvetoed)):
                continue
            if any(is_return_of(opt, f) and f['at'] >= r['at'] for f in refused['filed']):
                continue
            line = f'{opt["ref"]} is on {subject}, which he refused on {day_of(r["at"])} ({r["via"]}, {r["ref"]})'
            if r['hard'] or p6:
                out.append({'code': 'refused', 'ref': opt['ref'], 'subject': subject, 'refusal': r['ref'],
                            'line': f'refused: {line}; leave it out, or answer one of his asks that raises it again'})
                continue
            out.append({'code': 'warned', 'ref': opt['ref'], 'subject': subject, 'refusal': r['ref'], 'at': day_of(r['at']),
                        'line': f'warned: {line}; it carries his words as its warning line'})
            if opt.get('main') and (opt.get('pos') == 1 or opt.get('recommended')):
                out.append({'code': 'warned_first', 'ref': opt['ref'], 'subject': subject, 'refusal': r['ref'],
                            'line': f'warned first: {line}; an option he warned off is never placed first on its day'})
    return out


def returns_findings(opts, answers, earlier_text16, shape=True):
    """Each option that comes back after his File for later, Save as a trend or Improve press, and why it is not ready
    (item 3). It comes back only with all four: his words (returns.said, exact), an answer to each question he asked
    (returns.answers [{q, a}]), a source newer than his press, and changed copy, and with a ready research prompt;
    otherwise it is held (ideas.json held) and the reason shown. earlier_text16(answer) -> the short hash of what was
    shown when he pressed, or None when that board is not on hand. shape=False reads only what any board can show (the
    copy and the sources' dates), for boards made before these fields existed."""
    out = []
    for opt in opts:
        for a in answers:
            if a['kind'] not in ('filed', 'trend', 'improved') or not is_return_of(opt, a):
                continue
            ret = opt.get('returns') if isinstance(opt.get('returns'), dict) else None
            why = []
            if earlier_text16(a) is not None and earlier_text16(a) == opt.get('text16'):
                why.append('unchanged')
            if not any(d > day_of(a['at']) for d in opt.get('source_dates') or []):
                why.append('no_newer_source')
            if shape:
                if ret is None:
                    why.append('no_returns')
                elif a['said'] and norm(ret.get('said')) != norm(a['said']):
                    why.append('said_not_exact')
                asked = questions(a['said']) if a['said'] else []
                answered = {norm(x.get('q')) for x in (ret or {}).get('answers') or [] if isinstance(x, dict) and str(x.get('a') or '').strip()}
                if [q for q in asked if norm(q) not in answered]:
                    why.append('unanswered')
                if not (isinstance(opt.get('research_prompt'), str) and len(opt['research_prompt'].strip()) >= 150):
                    why.append('no_research_prompt')
            if why:
                words = {'unchanged': 'it came back unchanged', 'no_newer_source': f'no source newer than his press of {day_of(a["at"])}',
                         'no_returns': 'no returns block (his words, the answers to his questions, the newer sources)',
                         'said_not_exact': 'returns.said is not his words exactly', 'unanswered': 'a question he asked is unanswered',
                         'no_research_prompt': 'no ready research prompt'}
                out.append({'code': 'return', 'ref': opt['ref'], 'press': a['ref'], 'why': why,
                            'line': f'return without depth: {opt["ref"]} comes back after his {a["kind"]} press ({a["ref"]}, {day_of(a["at"])}): '
                                    + '; '.join(words[w] for w in why) + '. Hold it in ideas.json held with the reason, or bring it back deeper'})
    return out


def worded_presses(sources):
    """{ref: answer} for every worded press of his that is not a Reject, and every cue in his words: what an option may
    name as its from_press."""
    out = {a['ref']: a for a in answers_of(sources) if a['said'] and a['kind'] != 'rejected'}
    for kind, items in ((sources or {}).get('cues') or {}).items():
        for c in items if isinstance(items, list) else []:
            if isinstance(c, dict) and c.get('said') and kind != 'not_for_us' and c.get('use_origin') != 'model_guess':
                out[f"cue/{c.get('id')}"] = {'ref': f"cue/{c.get('id')}", 'said': c['said'], 'idea_id': str(c.get('subject_ref') or '').lower() or None}
    return out


def halves_findings(opts, sources, ideas, refused):
    """Krish, 2026-10-31: each publishing day has an option from him and one from the engine. Since the 16 Nov board (his
    half empty, so a mixed Track press on Infosys was read as an ask and Infosys placed first): an option is his only
    when it points to his own typed ask, card or material (covers, or its id is his own idea in the pool), or to a worded
    press of his (from_press) that does not refuse its subject; a day with nothing of his says so in ideas.json
    his_empty, never fills the half (item 2)."""
    out = []
    mine = his_ids(sources)
    pool = {str(c.get('id')).lower() for s in (sources or {}).get('series') or [] for c in s.get('pool') or []
            if isinstance(c, dict) and c.get('source_kind') in ('his', 'inspo')}
    pool |= {str(c.get('id')).lower() for c in (sources or {}).get('unassigned') or [] if isinstance(c, dict) and c.get('source_kind') in ('his', 'inspo')}
    worded = worded_presses(sources)
    locked = (ideas or {}).get('locked') if isinstance((ideas or {}).get('locked'), dict) else {}
    stated = (ideas or {}).get('his_empty') if isinstance((ideas or {}).get('his_empty'), dict) else {}
    for day, name in (('mon', 'Monday'), ('wed', 'Wednesday'), ('fri', 'Friday')):
        if day in locked:
            continue
        day_opts = [o for o in opts if o['main'] and o['day'] == day]
        if not day_opts:
            continue  # a day with no options at all is week_board's to refuse (at least four to pick from)
        his = []
        for o in day_opts:
            if o.get('source_kind') not in ('his', 'inspo'):
                continue
            basis = bool(set(o.get('covers') or []) & mine) or (o.get('idea_id') or '') in pool
            press = worded.get(str(o.get('from_press') or ''))
            if not basis and press:
                if any(r['ref'] == press['ref'] and touches(o, r) for r in refused['refusals']):
                    out.append({'code': 'press_refuses', 'ref': o['ref'], 'line': f'{name}: {o["ref"]} counts his press {press["ref"]} as an ask, '
                                'but that press refuses its subject; a press that refuses the subject never counts as his'})
                else:
                    basis = True
            if basis:
                his.append(o)
            elif not press:
                out.append({'code': 'not_his', 'ref': o['ref'], 'line': f'{name}: {o["ref"]} says it is his ({o.get("source_kind")}) but points to '
                            'nothing he typed: name the ask, card or material in covers, or his worded press in from_press, or call it engine'})
        if not his and not (isinstance(stated.get(day), str) and len(stated[day].strip()) >= 20):
            out.append({'code': 'his_empty', 'ref': day, 'line': f'{name}: no option of his; when nothing he typed fits, say so in ideas.json '
                        f'his_empty.{day} (a sentence), never fill the half'})
        if not any(o.get('source_kind') == 'engine' for o in day_opts):
            out.append({'code': 'no_engine', 'ref': day, 'line': f'{name}: no option from engine research (source_kind engine); half and half, each day has at least one'})
    return out


def warning_findings(opts, warned, said_of):
    """Each warned option carries its warning line for the board, in his words exactly: warning {subject, said, at}.
    said_of(refusal ref) -> his full words."""
    out = []
    by_ref = {o['ref']: o for o in opts}
    for w in warned:
        got = (by_ref.get(w['ref']) or {}).get('warning')
        got = got if isinstance(got, dict) else {}
        words = said_of(w['refusal']) or ''
        if str(got.get('subject') or '') != w['subject'] or not str(got.get('said') or '').strip() \
                or norm(got['said']) not in norm(words) or day_of(got.get('at')) != w['at']:
            out.append({'code': 'warning_line', 'ref': w['ref'], 'line': f'{w["ref"]}: carry its warning line, warning {{"subject": "{w["subject"]}", '
                        f'"said": <his refusing words, exact>, "at": "{w["at"]}"}} ({w["refusal"]})'})
    return out


def active_vetoes(refused, said=(), unvetoed=()):
    """The hard refusals with a named subject that still stand, newest first: the board's "Not offered again" lines."""
    out, seen = [], set()
    for r in sorted(refused['refusals'], key=lambda r: r['at'], reverse=True):
        if not r['hard']:
            continue
        for s in r['subjects']:
            if s.lower() in seen or lifted_by(s, r, unvetoed) or raised_again(s, r, said):
                continue
            seen.add(s.lower())
            out.append({'subject': s, 'said': r['said'], 'at': day_of(r['at']), 'ref': r['ref'], 'day': r.get('day')})
    return out


def vetoes_findings(ideas, vetoes):
    """ideas.json vetoes lists exactly the vetoes that stand, each with his words and the day he said them, so the board
    shows each one with its one-press undo."""
    got = {str(v.get('subject')): v for v in (ideas or {}).get('vetoes') or [] if isinstance(v, dict)}
    out = []
    for v in vetoes:
        g = got.pop(v['subject'], None)
        if not g or norm(g.get('said')) != norm(v['said']) or day_of(g.get('at')) != v['at']:
            out.append({'code': 'veto_line', 'ref': v['subject'], 'line': f'vetoes: list "Not offered again: {v["subject"]}" with his words '
                        f'({{"subject": "{v["subject"]}", "said": <his words, exact>, "at": "{v["at"]}", "ref": "{v["ref"]}"}})'})
    out += [{'code': 'veto_invented', 'ref': s, 'line': f'vetoes: "{s}" is not a subject he refused; the run never adds one'} for s in got]
    return out


SOURCE_TAGS = ('his_ask', 'his_card', 'his_idea', 'his_press', 'his_queue', 'inspo_card', 'newsletter', 'instagram', 'creator',
               'engine_research', 'radar', 'trade_press')
SHAPE_FROM = '2026-11-23'  # the first board the Wave 1 shape holds; earlier boards keep the shape they were made in


def question_problems(question):
    """The plain question a pitch opens on (house rules STORY_ARC, "Open on one clear question, in plain words", and
    BIG_PICTURE, a week's headline "is evidence inside the bigger story ... and never the story itself"): one sentence
    ending in a question mark, at most 25 words, naming no company, product, person or study. One company's news or one
    study goes inside the pitch as its example, never as the question."""
    q = str(question or '').strip()
    if not q:
        return ['has no question: the pitch opens on one plain question ending in "?"']
    out = []
    if not q.endswith('?'):
        out.append('question ends in "?"')
    if len(sentences(q)) > 1:
        out.append('question is one sentence')
    if len(q.split()) > 25:
        out.append(f'question is {len(q.split())} words; at most 25')
    named = names(re.sub(r'^\W*\w+', '', q))
    if named:
        out.append(f'question names {", ".join(named)}: the big question names no company, product, person or study; one goes inside the pitch as its example')
    return out


def shape_findings(ideas, week):
    """From the 23 Nov board: every publishing-day option leads with its plain question (pitch.question), carries a ready
    research prompt and a source tag; every off-day option a source tag (items 5, 7 and 11)."""
    if str(week) < SHAPE_FROM:
        return []
    out = []
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    for day in ('mon', 'wed', 'fri'):
        for n, o in enumerate(days.get(day) or [], 1):
            if not isinstance(o, dict):
                continue
            ref = f'{day}-{n}'
            pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else None
            if not pitch:
                out.append({'code': 'pitch', 'ref': ref, 'line': f'{ref}: no pitch; from {SHAPE_FROM} every option is a full pitch that opens on its plain question'})
            else:
                out += [{'code': 'question', 'ref': ref, 'line': f'{ref}: pitch {p}'} for p in question_problems(pitch.get('question'))]
            rp = o.get('research_prompt')
            if not (isinstance(rp, str) and len(rp.strip()) >= 150):
                out.append({'code': 'research_prompt', 'ref': ref, 'line': f'{ref}: no ready research prompt (research_prompt, ready to paste into deep research, 150 characters or more)'})
            if o.get('source_tag') not in SOURCE_TAGS:
                out.append({'code': 'source_tag', 'ref': ref, 'line': f'{ref}: source_tag is one of {", ".join(SOURCE_TAGS)}'})
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        for o in opts if isinstance(opts, list) else []:
            if isinstance(o, dict) and not o.get('weekly') and o.get('source_tag') not in SOURCE_TAGS:
                ref = f'off-{day}-{o.get("id")}'
                out.append({'code': 'source_tag', 'ref': ref, 'line': f'{ref}: source_tag is one of {", ".join(SOURCE_TAGS)}'})
    return out


def held_findings(ideas):
    """ideas.json held: each return or ask held back, with the reason the board shows him."""
    out = []
    for h in (ideas or {}).get('held') or []:
        if not isinstance(h, dict) or not str(h.get('ref') or '').strip() or len(str(h.get('reason') or '').strip()) < 20:
            out.append({'code': 'held', 'ref': str((h or {}).get('ref') if isinstance(h, dict) else h), 'line': 'held: each entry is {"ref", "day", "reason"}, the reason a sentence he reads on the board'})
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Wave 1, the second part: his words split, his asks at full scope, off days that say what they learned, more looked at
# than shown, and the Saturday good news's mix. From the 23 Nov board (SHAPE_FROM), as cover findings.


def his_texts(sources):
    """Every piece of his words the sources hold, by ref: worded presses, off-day verdicts and notes, cues, asks."""
    out = {a['ref']: a['said'] for a in answers_of(sources) if a['said']}
    for v in ((sources or {}).get('offday_verdicts') or {}).get('verdicts') or []:
        if isinstance(v, dict) and v.get('words'):
            out.setdefault(f"{v.get('week')}/queue/{v.get('option')}#{v.get('side')}", v['words'])
    for kind, items in ((sources or {}).get('cues') or {}).items():
        for c in items if isinstance(items, list) else []:
            if isinstance(c, dict) and c.get('said'):
                out.setdefault(f"cue/{c.get('id')}", c['said'])
    for a in (sources or {}).get('asks') or []:
        if isinstance(a, dict) and isinstance(a.get('his_words'), dict):
            words = ' '.join(str(v) for v in a['his_words'].values() if v)
            if words:
                out.setdefault(f"ask/{a.get('id')}", words)
    return out


def quoted(text, words):
    """Whether some words are an exact quote of his (whitespace and curly quotes aside), at least three words long."""
    q = norm(text).strip(' "\'.,')
    return len(q.split()) >= 3 and q in norm(words)


def split_findings(ideas, sources):
    """Item 4: each worded press on the last board, split into its parts (refuse, reframe, depth, simpler, format, wish),
    each part an exact quote of his words, in ideas.json split [{"ref": "<week>/<doc>", "parts": [{"kind", "quote"}]}].
    A press whose words refuse (boring, lame, no point, don't understand) has a refuse part. The split is the run's
    reading; the quotes keep it honest, and the refusal checks never rely on it (refusals_from reads his words)."""
    week = str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '')
    if week < SHAPE_FROM:
        return []
    from datetime import date as _d, timedelta as _t
    last = (_d.fromisoformat(week) - _t(days=7)).isoformat()
    owed = {a['ref']: a for a in answers_of(sources) if a['said'] and str(a['week']) == last}
    got = {str(x.get('ref')): x for x in (ideas or {}).get('split') or [] if isinstance(x, dict)}
    out = []
    for ref, a in owed.items():
        s = got.get(ref)
        parts = [p for p in (s or {}).get('parts') or [] if isinstance(p, dict)]
        if not parts:
            out.append({'code': 'split', 'ref': ref, 'line': f'split: {ref} is a worded press of his on last week\'s board; split it into its parts, each an exact quote'})
            continue
        bad = [p for p in parts if p.get('kind') not in PART_KINDS or norm(p.get('quote')) not in norm(a['said']) or not norm(p.get('quote'))]
        if bad:
            out.append({'code': 'split', 'ref': ref, 'line': f'split: {ref}: every part is one of {", ".join(PART_KINDS)} and an exact quote of his words'})
        if REFUSE.search(a['said']) and not any(p.get('kind') == 'refuse' and REFUSE.search(str(p.get('quote') or '')) for p in parts):
            out.append({'code': 'split', 'ref': ref, 'line': f'split: {ref} refuses in his words (boring, lame, no point, don\'t understand) and has no refuse part quoting them'})
    return out


ROW = re.compile(r'\b[0-9a-f]{8}(?:-[0-9a-f]{4}){0,4}(?:-[0-9a-f]{12})?\b')


def known_ids(sources):
    """Every row id the sources name: what a held ask's reason may cite."""
    ids = set()
    for s in (sources or {}).get('series') or []:
        ids |= {str(c.get('id')).lower() for c in s.get('pool') or [] if isinstance(c, dict)}
    ids |= {str(c.get('id')).lower() for c in (sources or {}).get('unassigned') or [] if isinstance(c, dict)}
    for key in ('queue', 'recent', 'must_cover', 'asks'):
        ids |= {str(c.get('id')).lower() for c in (sources or {}).get(key) or [] if isinstance(c, dict)}
    for rows in ((sources or {}).get('scheduled') or {}).values():
        ids |= {str(c.get('id')).lower() for c in rows or [] if isinstance(c, dict)}
    return {i for i in ids if i and i != 'none'}


def asks_findings(ideas, sources):
    """Item 6: his asks keep their scope, and a held ask shows its reason. An option that covers an ask quotes it word for
    word (asks [{"id", "said": his words exactly, "scope": "as_typed" or "narrowed", "why": when narrowed}]); an open ask
    left off the board is accounted with a reason that cites only rows that exist, and is a held line on the board
    (ideas.json held, ref "ask/<id>")."""
    week = str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '')
    if week < SHAPE_FROM:
        return []
    asks = {str(a.get('id')): a for a in (sources or {}).get('asks') or [] if isinstance(a, dict) and a.get('state') == 'open' and not a.get('style_only')}
    words = {i: ' '.join(str(v) for v in (a.get('his_words') or {}).values() if v) for i, a in asks.items()}
    out = []
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    covered = set()
    for label, o in [(f'{d}-{n}', o) for d in ('mon', 'wed', 'fri') for n, o in enumerate(days.get(d) or [], 1)] + \
                    [(f'off-{d}-{o.get("id")}', o) for d, opts in offdays.items() for o in (opts if isinstance(opts, list) else [])]:
        if not isinstance(o, dict):
            continue
        given = {str(x.get('id')): x for x in o.get('asks') or [] if isinstance(x, dict)}
        for c in o.get('covers') or []:
            if str(c) not in asks:
                continue
            covered.add(str(c))
            g = given.get(str(c))
            if not g or norm(g.get('said')) != norm(words[str(c)]):
                out.append({'code': 'ask_scope', 'ref': label, 'line': f'{label}: quote his ask {c} word for word in asks [{{"id", "said", "scope"}}]'})
            elif g.get('scope') not in ('as_typed', 'narrowed') or (g.get('scope') == 'narrowed' and len(str(g.get('why') or '').strip()) < 20):
                out.append({'code': 'ask_scope', 'ref': label, 'line': f'{label}: say whether it answers his ask {c} as typed, or why it narrows it (scope, why)'})
    accounted = (ideas or {}).get('accounted') if isinstance((ideas or {}).get('accounted'), dict) else {}
    held = {str(h.get('ref')) for h in (ideas or {}).get('held') or [] if isinstance(h, dict)}
    ids = known_ids(sources)
    for i in asks:
        if i in covered or i not in accounted:
            continue
        reason = str(accounted[i] or '')
        cited = [r for r in ROW.findall(reason.lower()) if not any(k.startswith(r) for k in ids)]
        if cited:
            out.append({'code': 'ask_held', 'ref': i, 'line': f'accounted {i}: the reason cites {", ".join(cited)}, which no row in sources.json is; cite a row that exists'})
        if f'ask/{i}' not in held:
            out.append({'code': 'ask_held', 'ref': i, 'line': f'accounted {i}: his ask is held; show it on the board (ideas.json held, ref "ask/{i}", the reason he reads)'})
    return out


def learned_findings(ideas, sources):
    """Item 8: every off-day option quotes the earlier verdict of his it learned from: a learned_from line holding an
    exact quote, three words or more, of his words in the sources (3 of 10 options did on the 16 Nov board, 0 of 13 on
    the 9 Nov board)."""
    week = str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '')
    if week < SHAPE_FROM:
        return []
    texts = list(his_texts(sources).values())
    out = []
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        for o in opts if isinstance(opts, list) else []:
            if not isinstance(o, dict) or o.get('weekly'):
                continue
            lines = [str(x) for x in o.get('learned_from') or [] if isinstance(x, str)]
            spans = [q for x in lines for q in re.findall(r'["“]([^"”]+)["”]', x)] + [re.sub(r'\s*\([^)]*\)\s*$', '', x) for x in lines]
            if not any(quoted(q, t) for q in spans for t in texts):
                out.append({'code': 'learned_from', 'ref': f'off-{day}-{o.get("id")}',
                            'line': f'off-{day}-{o.get("id")}: learned_from quotes the earlier verdict of his it learned from, his words exactly'})
    return out


CANDIDATES_MAX = 8


def considered_findings(ideas):
    """Item 10: look at more, show the best. ideas.json considered {"mon": n, ...}: how many candidates the run researched
    for each publishing day, at least as many as it shows and at most eight."""
    week = str((ideas or {}).get('week_start') or '')
    if week < SHAPE_FROM:
        return []
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    locked = (ideas or {}).get('locked') if isinstance((ideas or {}).get('locked'), dict) else {}
    got = (ideas or {}).get('considered') if isinstance((ideas or {}).get('considered'), dict) else {}
    out = []
    for day in ('mon', 'wed', 'fri'):
        if day in locked:
            continue
        shown = len(days.get(day) or [])
        n = got.get(day)
        if not isinstance(n, int) or not shown <= n <= CANDIDATES_MAX:
            out.append({'code': 'considered', 'ref': day, 'line': f'considered.{day}: how many candidates were researched for the day, '
                        f'from the {shown} shown up to {CANDIDATES_MAX}'})
    return out


GOOD_NEWS_KINDS = ('health', 'lab', 'science', 'work', 'money', 'learning', 'climate', 'creative', 'people', 'safety', 'other')


def goodnews_mix_findings(ideas):
    """Item 12: each Saturday good-news story says what kind of good it is (kind, one of GOOD_NEWS_KINDS), so the board
    shows the week's mix. The cap on health and lab stories waits for his yes; the mix is shown, never capped here."""
    week = str((ideas or {}).get('week_start') or '')
    if week < SHAPE_FROM:
        return []
    out = []
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        for o in opts if isinstance(opts, list) else []:
            if isinstance(o, dict) and o.get('weekly') == 'good_news' and o.get('stories'):
                bad = [str(i) for i, st in enumerate(o['stories'], 1) if not (isinstance(st, dict) and st.get('kind') in GOOD_NEWS_KINDS)]
                if bad:
                    out.append({'code': 'goodnews_kind', 'ref': f'off-{day}-{o.get("id")}',
                                'line': f'off-{day}-{o.get("id")}: stories {", ".join(bad)} need their kind, one of {", ".join(GOOD_NEWS_KINDS)}'})
    return out


def mix_of(stories):
    """'2 health, 1 work, 1 money, 1 creative': the kinds of the week's good news, most first."""
    counts = {}
    for st in stories or []:
        if isinstance(st, dict) and st.get('kind'):
            counts[st['kind']] = counts.get(st['kind'], 0) + 1
    return ', '.join(f'{n} {k}' for k, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))


# The findings that fail the Sunday run (board_feed.py gate): a subject he refused offered again, a warned option placed
# first or shown without his words, and a return that came back no deeper. The rest of cover stays the run's to fix
# before it stops, as before.
GATE_CODES = ('refused', 'warned_first', 'warning_line', 'return')

# P6 ("A subject you call boring, lame or pointless in any press is vetoed until you raise it"): a proposed rule that
# waits for Krish's yes on his taste ledger. Until he approves it, refusing words outside a Reject warn and never block.
P6_APPROVED = False
