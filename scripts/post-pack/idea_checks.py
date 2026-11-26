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
import json
from pathlib import Path
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
            'from_press': o.get('from_press'), 'returns': returns, 'warning': o.get('warning'), 'research_prompt': o.get('research_prompt'),
            'his_tick': his_tick(o), 'refused_before': o.get('refused_before') if isinstance(o.get('refused_before'), list) else []}


def his_tick(o):
    """The id of his tick when an option came from an Inspiration card he ticked (inspiration_act.py place writes
    from_inspiration), else None."""
    tick = o.get('from_inspiration') if isinstance(o, dict) else None
    return str(tick['action_id']) if isinstance(tick, dict) and tick.get('action_id') else None


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


def why_touched(opt, r, subject):
    """Why an option is on a refusal, in words: it is the idea he refused, or which name it shares with his refusal and
    where that name stands in the option. Every line that names a match says this, so a hold is never unexplained."""
    if is_return_of(opt, r):
        return 'it is the same idea he refused'
    shown = next((n for n in opt.get('names') or [] if n == subject or mentions(subject, n)), subject)
    return f'the name "{subject}" is in his refusing words and the option names "{shown}"'


def tick_note(r, subject):
    """What an idea from his tick carries about a refusal it touches, for the board and To approve to show beside it:
    the subject, his words (the refusing clause, exactly, or his whole words), the day he said them, and where."""
    return {'subject': subject, 'said': r.get('quote') or r.get('said') or None, 'at': day_of(r['at']), 'via': r['via'], 'ref': r['ref']}


# ---------------------------------------------------------------------------------------------------------------------
# The checks. Each returns findings: {'code', 'ref', 'line', ...}; board_feed.py prints the lines.


def refused_findings(opts, refused, ask_ids, said=(), unvetoed=(), p6=False):
    """Each option on a subject he refused before the board (item 1).

    code 'refused': a hard refusal (his Reject), or a soft one once he approves P6. The run fails.
    code 'warned': a soft refusal (refusing words inside another press): a warning line on the option, his words.
    code 'warned_first': a warned option placed first on its day (or recommended). The run fails.
    code 'his_tick': an option from an Inspiration card he ticked (from_inspiration) on a subject he refused. Ruling
    (Krish, 2026-11-12): his own tick outranks an older refusal; the idea comes to him with the refusal shown, and only
    his Approve places it. It never fails a run: the option carries the refusal in refused_before (tick_note) instead.
    Ideas the engine proposes on its own keep every check above.
    Passes: an option that answers one of his asks (its covers name one), a subject he raised again later, a subject he
    gave back with his press (unvetoed), and the return of an idea he pressed Next week on after refusing, which must
    come back deeper instead (returns_findings).
    Every line says which refusal matched and why (why_touched)."""
    out = []
    # One finding per option and subject: a Reject before refusing words in another press, the newest first.
    order = sorted(sorted(refused['refusals'], key=lambda r: r['at'], reverse=True), key=lambda r: not r['hard'])
    for opt in opts:
        seen = set()
        tick = opt.get('his_tick')
        for r in order:
            subject = touches(opt, r)
            if not subject or subject.lower() in seen:
                continue
            if not tick and set(opt.get('covers') or []) & set(ask_ids):
                continue
            if subject != 'this idea' and (raised_again(subject, r, said) or lifted_by(subject, r, unvetoed)):
                continue
            if any(is_return_of(opt, f) and f['at'] >= r['at'] for f in refused['filed']):
                continue
            seen.add(subject.lower())
            line = f'{opt["ref"]} is on {subject}, which he refused on {day_of(r["at"])} ({r["via"]}, {r["ref"]}): {why_touched(opt, r, subject)}'
            if tick:
                shown = any(isinstance(n, dict) and n.get('ref') == r['ref'] for n in opt.get('refused_before') or [])
                out.append({'code': 'his_tick', 'ref': opt['ref'], 'subject': subject, 'refusal': r['ref'], 'note': tick_note(r, subject), 'shown': shown,
                            'line': f'his tick: {line}; his tick ({tick}) is newer and outranks it, so the idea goes to him with that '
                                    'refusal shown beside it' + (' (refused_before)' if shown else ' (not yet in its refused_before: '
                                                                 'inspiration_act.py place writes it)') + ', and only his Approve places it'})
                continue
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
            continue  # a day with no options at all is coverage_problems' to refuse (week_plan.py)
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
# The research prompt asks for the 5 Whys (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of
# everything that suggests predictions, calls, dated, odds or scores): from the 30 Nov board, the first gathered after
# the ruling, each research_prompt names the 5 Whys (or the why-ladder) as well as running 150 characters or more.
WHYS_FROM = '2026-11-30'
ASKS_WHYS = re.compile(r'\b(?:5|five)\s+whys?\b|\bwhy-ladder\b', re.I)


def research_prompt_problems(rp, week):
    """Why a research_prompt is not ready to paste into deep research, [] when it is: 150 characters or more, and from
    WHYS_FROM it asks for the 5 Whys (one sourced answer per Why)."""
    if not (isinstance(rp, str) and len(rp.strip()) >= 150):
        return ['no ready research prompt (research_prompt, ready to paste into deep research, 150 characters or more)']
    if str(week) >= WHYS_FROM and not ASKS_WHYS.search(rp):
        return ['the research prompt does not ask for the 5 Whys (one sourced answer per Why, two sources on two domains, '
                'the counter-evidence, an honest stop and a landing with an open question): from '
                f'{WHYS_FROM} every research_prompt asks for them']
    return []


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
            out += [{'code': 'research_prompt', 'ref': ref, 'line': f'{ref}: {p}'} for p in research_prompt_problems(o.get('research_prompt'), week)]
            if o.get('source_tag') not in SOURCE_TAGS:
                out.append({'code': 'source_tag', 'ref': ref, 'line': f'{ref}: source_tag is one of {", ".join(SOURCE_TAGS)}'})
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        for o in opts if isinstance(opts, list) else []:
            if isinstance(o, dict) and not o.get('weekly') and not is_template(o) and o.get('source_tag') not in SOURCE_TAGS:
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
            if not isinstance(o, dict) or o.get('weekly') or is_template(o):
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


GOOD_NEWS_KINDS = ('business', 'health', 'lab', 'science', 'work', 'money', 'learning', 'climate', 'creative', 'people', 'safety', 'other')


def goodnews_mix_findings(ideas):
    """Item 12: each Saturday good-news story says what kind of good it is (kind, one of GOOD_NEWS_KINDS), so the board
    shows the week's mix. The cap on medical stories is goodnews_findings' (Krish, 2026-11-19; config/good-news.json)."""
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


# ---------------------------------------------------------------------------------------------------------------------
# Repeats: what went out, or is on its way, is never offered again (Krish, 2026-11-16, of the 16 Nov board: "this
# week's Ideas Board needs to not contain mostly things we published last week").
#
# Measured on that board: its Friday option on the Axiom proof was Saturday 14's live carousel (one Axiom page), its
# Tuesday burntokens was Friday 13's live piece (one Amazon page), frenemies and ownref were Friday 13's beststicker
# again (the same Home Depot interview, Microsoft's Critique and the NeurIPS study), and five stories sat on the board
# twice, once as a piece and once as an off day. The run plans eight days ahead, and the old check compared ids only.
# So an option is a repeat when, against the posts on the last three weeks' boards (sources.json recent_posts, read
# from each week's live board model: every piece and every post he approved, made, scheduled or live):
#   (a) its primary source is a post's primary source (the same page, canonical: host without www, no tracking
#       parameters, no fragment, no trailing slash);
#   (b) its hook or headline is a post's title, or a recent piece's idea, word for word (lower case, punctuation off);
#   (c) it re-offers an option id from an earlier board that he did not send back (File for later, Save as a trend,
#       Improve) and that is not one of his own open ideas;
#   (d) its primary source is another option's on the same board, unless one of them supports that day's approved
#       piece (`supports`: a carousel that carries the piece further);
#   (e) it cites two or more of the same works as one post (its whole evidence is that post's).
# Two posts may still cite one article (docs/PUBLISH_BOARDS.md, "One post, one item"): only the primary source counts
# in (a) and (d), and (e) needs two works in common.

REPEAT_FROM = '2026-11-23'  # the first board gathered with recent_posts: from it, a gather without them fails the gate
EVIDENCE_MIN = 2
TRACKING = re.compile(r'^(?:utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|igsh|si|ref|ref_src|ref_url|cmpid|ocid|'
                      r'mkt_tok|_hsenc|_hsmi|guccounter|guce_referrer|guce_referrer_sig|smid|sh)$', re.I)


def canon_url(url):
    """A page as compared: host in lower case without www, the path without its trailing slash, the query without
    tracking parameters, no fragment and no scheme. None when it is not a web address."""
    from urllib.parse import urlsplit, parse_qsl, urlencode
    s = str(url or '').strip()
    if not re.match(r'^https?://', s, re.I):
        return None
    try:
        p = urlsplit(s)
        host = (p.hostname or '').lower()
    except ValueError:
        return None
    if host.startswith('www.'):
        host = host[4:]
    if not host:
        return None
    query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if not TRACKING.match(k)]
    return host + p.path.rstrip('/') + ('?' + urlencode(query) if query else '')


def text_key(text):
    """Words as a hook is compared: lower case, every run of anything but a to z and 0 to 9 one space (the same rule
    as one post's hook key, _onePost.ts hookWords). None under 12 characters: too plain to name one post."""
    w = re.sub(r'[^a-z0-9]+', ' ', str(text or '').replace('’', "'").lower()).strip()
    return w if len(w) >= 12 else None


def source_of(o):
    """{label, url} of an option's primary source: its `source`, else the first of its `sources`, else its first
    story's."""
    src = o.get('source') if isinstance(o, dict) else None
    if isinstance(src, dict) and (src.get('url') or src.get('href')):
        return {'label': str(src.get('label') or ''), 'url': src.get('url') or src.get('href')}
    for s in (o.get('sources') or []) if isinstance(o, dict) else []:
        if isinstance(s, dict) and (s.get('url') or s.get('href')):
            return {'label': str(s.get('label') or ''), 'url': s.get('url') or s.get('href')}
    for st in (o.get('stories') or []) if isinstance(o, dict) else []:
        s = st.get('source') if isinstance(st, dict) else None
        if isinstance(s, dict) and s.get('url'):
            return {'label': str(s.get('label') or ''), 'url': s['url']}
    clip = (o.get('template') or {}).get('clip') if isinstance(o, dict) and is_template(o) else None
    if isinstance(clip, dict) and clip.get('page'):  # a meme template: its clip's page is its source
        return {'label': str((o.get('template') or {}).get('credit') or ''), 'url': clip['page']}
    if isinstance(src, dict):
        return {'label': str(src.get('label') or ''), 'url': None}
    if isinstance(src, str):
        m = re.search(r'https?://\S+', src)
        return {'label': src, 'url': m.group(0) if m else None}
    return {'label': '', 'url': None}


def primary_url(o):
    return canon_url(source_of(o).get('url'))


def citations(labels):
    """The works some source labels cite: each label cut at its semicolons."""
    return [c.strip() for lab in labels or [] for c in str(lab or '').split(';') if c and c.strip()]


def option_citations(o):
    labels = [source_of(o).get('label')] + [s.get('label') for s in (o.get('sources') or []) if isinstance(s, dict)]
    return citations(labels)


CITE_PLAIN = {'own', 'post', 'study', 'report', 'blog', 'news', 'newsroom', 'research', 'interview', 'video', 'page', 'paper',
              'press', 'release', 'article', 'official', 'podcast', 'survey', 'filing', 'quoting', 'quoted', 'undated', 'others',
              'also', 'your', 'saved', 'folder'}
MONTH_YEAR = re.compile(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(19\d\d|20\d\d)\b')


def work_marks(citation):
    """What names one cited work: its proper names (outlet, company, venue, author, in lower case) and its dates (days,
    months and years)."""
    text = str(citation or '')
    days = set(dates_in(text))
    months = {f'{y}-{MONTHS[m.lower()]:02d}' for m, y in MONTH_YEAR.findall(text)} | {d[:7] for d in days}
    years = set(re.findall(r'\b(?:19|20)\d\d\b', text))
    tokens = set()
    for w in re.findall(r"[A-Z][A-Za-z0-9&]*(?:['’][A-Za-z]+)?", text):
        w = re.sub(r"['’]s$", '', w).lower()
        if len(w) >= 3 and w not in STOP and w not in CITE_PLAIN and not w.isdigit():
            tokens.add(w)
    return {'tokens': tokens, 'days': days, 'months': months, 'years': years}


def same_work(a, b):
    """Whether two citations name one work: a name in common, and their dates agree. Two exact days decide alone; a day
    beside a month only, or no dates beside a shared year, needs two names in common or the same year."""
    shared = a['tokens'] & b['tokens']
    if not shared:
        return False
    if a['days'] and b['days']:
        return bool(a['days'] & b['days'])
    if a['months'] and b['months'] and not a['months'] & b['months']:
        return False
    if a['years'] and b['years'] and not a['years'] & b['years']:
        return False
    # Two names in common, never one name and a year: "The Register, Oct 2026 (Anthropic Scion)" and "The Register, Oct
    # 2026 (Microsoft layoffs)" are two works.
    return len(shared) >= 2


def shared_works(ours, theirs):
    """The works two lists of citations have in common, one to one: [(ours, theirs)]."""
    a = [(c, work_marks(c)) for c in ours]
    b = [(c, work_marks(c)) for c in theirs]
    used, out = set(), []
    for ca, ma in a:
        for n, (cb, mb) in enumerate(b):
            if n not in used and same_work(ma, mb):
                used.add(n)
                out.append((ca, cb))
                break
    return out


def headline_of(o):
    """A publishing-day option's headline: pitch.headline, else the 'Headline:' line of its story."""
    pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else {}
    if pitch.get('headline'):
        return str(pitch['headline'])
    m = re.search(r'Headline:\s*(.+?)(?:\s+Hook:|$)', str(o.get('story') or ''))
    return m.group(1).strip(' "“”') if m else None


def option_keys(o, main):
    """The words an option is known by for (b): its hook, title and headline (and a publishing-day option's story)."""
    vals = [o.get('hook'), o.get('title'), headline_of(o) if main else None]
    return {k for k in (text_key(v) for v in vals) if k}


def approved_pieces(ideas, sources):
    """{day: piece id} of the week's publishing days that already hold their approved piece: ideas.json locked, and the
    pieces the gather says are scheduled on the week's days."""
    out = {}
    for day, lock in ((ideas or {}).get('locked') or {}).items():
        if isinstance(lock, dict) and lock.get('piece_id'):
            out[str(day)[:3]] = str(lock['piece_id']).lower()
    week = str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '')[:10]
    try:
        start = date.fromisoformat(week)
    except ValueError:
        return out
    offset = {(start.toordinal() + n): d for d, n in (('mon', 0), ('wed', 2), ('fri', 4))}
    for rows in ((sources or {}).get('scheduled') or {}).values():
        for r in rows or []:
            if isinstance(r, dict) and r.get('id') and r.get('scheduled_for'):
                try:
                    d = offset.get(date.fromisoformat(str(r['scheduled_for'])[:10]).toordinal())
                except ValueError:
                    continue
                if d:
                    out.setdefault(d, str(r['id']).lower())
    return out


def supported(o, approved):
    """The approved piece an option says it supports (`supports`: "mon", "wed", "fri" or the piece's id), or None."""
    s = str(o.get('supports') or '').strip().lower()
    if not s:
        return None
    if s[:3] in approved:
        return approved[s[:3]]
    return s if s in approved.values() else None


def stage_key(p):
    st = p.get('stage')
    return str(st.get('key') if isinstance(st, dict) else st or '')


def post_name(p):
    """A recent post as he reads it: "Fri 13 Nov's piece "Title" (live)"."""
    try:
        when = date.fromisoformat(str(p.get('date'))[:10]).strftime('%a %d %b').replace(' 0', ' ')
    except ValueError:
        when = f"{p.get('day')} of the week of {p.get('week')}"
    what = 'piece' if p.get('type') == 'piece' else (p.get('kind_label') or p.get('kind') or 'post').lower()
    return f'{when}\'s {what} "{str(p.get("title") or "")[:90]}" ({stage_key(p)})'


def board_raw(ideas):
    """[(ref, day, main, option)] for every option on the board, the weekly series included."""
    out = []
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    for day in ('mon', 'wed', 'fri'):
        out += [(f'{day}-{n}', day, True, o) for n, o in enumerate(days.get(day) or [], 1) if isinstance(o, dict)]
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        out += [(f'off-{day}-{o.get("id")}', day, False, o) for o in (opts if isinstance(opts, list) else []) if isinstance(o, dict)]
    return out


def sent_back(sources):
    """{(kind, id)} he sent back to come again (File for later, Save as a trend, Improve; Next week on an off day; an
    idea in his idea queue): a return may re-use its id, and the return check holds it to depth."""
    out = set()
    for a in answers_of(sources):
        if a['kind'] in ('filed', 'trend', 'improved'):
            if a.get('idea_id'):
                out.add(('main', a['idea_id']))
            if a.get('option'):
                out.add(('off', str(a['option']).lower()))
    for o in (sources or {}).get('recent_offdays') or []:
        if isinstance(o, dict) and o.get('verdict') in ('next_week', 'trend', 'improve', 'improved', 'filed') and o.get('id'):
            out.add(('off', str(o['id']).lower()))
    # His idea queue: the ideas he filed for later before the ideas gate kept his presses (the 26 Oct board's), each
    # offered first in the weeks after (plan-week, step 1).
    for q in (sources or {}).get('queue') or []:
        if isinstance(q, dict) and q.get('id'):
            out.add(('main', str(q['id']).lower()))
    return out


def his_open(sources):
    """The ids of his own ideas still owed a place: every must_cover id, every ask, and his own ideas in the pool."""
    ids = {str(i).lower() for i in his_ids(sources)}
    pool = [c for s in (sources or {}).get('series') or [] for c in s.get('pool') or []] + list((sources or {}).get('unassigned') or [])
    return ids | {str(c.get('id')).lower() for c in pool if isinstance(c, dict) and c.get('source_kind') == 'his' and c.get('id')}


def repeat_findings(ideas, sources, earlier=None):
    """Each option that repeats a recent post, a recent piece, an earlier board's option or another option on this
    board (the five rules above). earlier: [{week, day, id, main}], the options of the earlier boards (sources.json
    earlier_options, or board_feed.py reads the plan files). Every line names what it repeats and why."""
    out = []
    posts = [p for p in (sources or {}).get('recent_posts') or [] if isinstance(p, dict)]
    pieces = [p for p in (sources or {}).get('recent') or [] if isinstance(p, dict)]
    approved = approved_pieces(ideas, sources)
    back = sent_back(sources)
    mine = his_open(sources)
    by_url = {}
    for p in posts:
        u = canon_url(p['primary'] if 'primary' in p else (p.get('urls') or [None])[0])
        if u:
            by_url.setdefault(u, []).append(p)
    post_keys = {}
    for p in posts:
        k = text_key(p.get('title'))
        if k:
            post_keys.setdefault(k, p)
    piece_keys = {}
    for p in pieces:
        k = text_key(p.get('idea'))
        if k:
            piece_keys.setdefault(k, p)
    seen_earlier = {}
    for e in earlier or []:
        if isinstance(e, dict) and e.get('id'):
            seen_earlier.setdefault(('main' if e.get('main') else 'off', str(e['id']).lower()), e)

    def carried(o, p):
        """The option is that post's own item, carried before it went live, or supports that very piece."""
        if o.get('item') and p.get('item') and str(o['item']) == str(p['item']) and stage_key(p) != 'live':
            return True
        sp = supported(o, approved)
        return bool(sp and p.get('piece_id') and sp == str(p['piece_id']).lower())

    def his(o):
        """His own idea or the idea from a card he ticked: a repeat on it is shown to him beside it, never failing the run,
        as his tick on a subject he refused is (Ruling, Krish, 2026-11-12: his own tick outranks an older refusal)."""
        return o.get('source_kind') == 'his' or bool(o.get('from_inspiration')) or str(o.get('id') or '').lower() in mine

    board = board_raw(ideas)
    found_from = len(out)
    for ref, day, main, o in board:
        label = f'{ref} ({str(o.get("id") or "")[:8]})' if main else ref
        weekly = bool(o.get('weekly'))
        url = primary_url(o)
        if weekly:
            # A weekly series recurs by design; its stories may not repeat a post.
            for n, st in enumerate(o.get('stories') or [], 1):
                su = canon_url((st.get('source') or {}).get('url')) if isinstance(st, dict) and isinstance(st.get('source'), dict) else None
                for p in by_url.get(su, []) if su else []:
                    out.append({'code': 'repeat', 'ref': ref, 'rule': 'a', 'post': p.get('key'),
                                'line': f'repeat: {label} story {n} is the primary source of {post_name(p)}: {su}; find another story'})
            continue
        # (a) the same primary source as a recent post.
        for p in by_url.get(url, []) if url else []:
            if not carried(o, p):
                out.append({'code': 'repeat', 'ref': ref, 'rule': 'a', 'post': p.get('key'),
                            'line': f'repeat: {label} has the same primary source as {post_name(p)}, week of {p.get("week")}: {url}; '
                                    'what went out, or is on its way, is never offered again'})
        # (b) the same hook or headline as a recent post or piece.
        for k in sorted(option_keys(o, main)):
            p = post_keys.get(k)
            if p and not carried(o, p) and not (url and any(x is p for x in by_url.get(url, []))):
                out.append({'code': 'repeat', 'ref': ref, 'rule': 'b', 'post': p.get('key'),
                            'line': f'repeat: {label} carries the words of {post_name(p)}, week of {p.get("week")}: "{k}"'})
            q = piece_keys.get(k)
            if q:
                out.append({'code': 'repeat', 'ref': ref, 'rule': 'b', 'post': q.get('id'),
                            'line': f'repeat: {label} carries the words of the piece "{str(q.get("idea") or "")[:90]}" ({q.get("scheduled_for")})'})
        # (c) an option id an earlier board offered, not a return he asked for.
        kind = 'main' if main else 'off'
        oid = str(o.get('id') or '').lower()
        e = seen_earlier.get((kind, oid)) if oid else None
        if e and (kind, oid) not in back and oid not in mine and not o.get('item'):
            out.append({'code': 'repeat', 'ref': ref, 'rule': 'c', 'post': f'{e.get("week")}/{e.get("day")}',
                        'line': f'repeat: {label} is the option "{oid}" the board of {e.get("week")} offered on {e.get("day")}, and he did not '
                                'send it back (File for later, Save as a trend, Improve): a new idea needs a new story'})
        # (e) the same evidence as a recent post: two or more cited works in common.
        cites = option_citations(o)
        if len(cites) >= EVIDENCE_MIN:
            for p in posts:
                if carried(o, p) or (url and any(x is p for x in by_url.get(url, []))):
                    continue
                both = shared_works(cites, citations(p.get('labels') or []))
                if len(both) >= EVIDENCE_MIN:
                    out.append({'code': 'repeat', 'ref': ref, 'rule': 'e', 'post': p.get('key'),
                                'line': f'repeat: {label} cites {len(both)} of the works {post_name(p)} cited, week of {p.get("week")} ('
                                        + '; '.join(b for _, b in both) + '): the same evidence is the same post'})
    # (d) two options on this board with one primary source. An off-day option tied to a publishing day's piece (its
    # `supports`, or `ties_to` naming Mon, Wed or Fri) carries that day's story by design (Ruling, Krish, 2026-11-13: "we
    # have carousels that support Monday, Wednesday, or Friday"), approved or not yet.
    def tied(x_ref, x, y_ref):
        if not x_ref.startswith('off-') or y_ref.startswith('off-'):
            return False
        said = str(x.get('supports') or '').strip().lower()[:3] or (re.match(r'\s*(mon|wed|fri)', str(x.get('ties_to') or ''), re.I) or [None, ''])[1].lower()
        return bool(said) and y_ref.startswith(f'{said}-')
    groups = {}
    for ref, day, main, o in board:
        if o.get('weekly'):
            continue
        url = primary_url(o)
        if url:
            groups.setdefault(url, []).append((ref, o))
    for url, members in groups.items():
        if len(members) < 2:
            continue
        for ref, o in members:
            twins = [r for r, x in members if r != ref and not (supported(o, approved) or supported(x, approved))
                     and not tied(ref, o, r) and not tied(r, x, ref)
                     # His own idea keeps the story: the twin is the engine option's to answer, never his.
                     and not (his(o) and not his(x))]
            if twins:
                label = ref if ref.startswith('off-') else f'{ref} ({str(o.get("id") or "")[:8]})'
                out.append({'code': 'repeat', 'ref': ref, 'rule': 'd', 'post': ', '.join(twins),
                            'line': f'repeat: {label} has the same primary source as {", ".join(twins)} on this '
                                    f'board: {url}; one story is one option (a carousel for a day\'s piece says so in supports or ties_to)'})
    # A repeat on his own idea or his tick is shown to him with it, never failing the run (NOTE_CODES).
    refs_his = {ref for ref, _, _, o in board if his(o)}
    for f in out[found_from:]:
        if f['ref'] in refs_his and f['code'] == 'repeat':
            f['code'] = 'his_repeat'
            f['line'] = 'shown with the repeat (his own idea): ' + f['line'][len('repeat: '):]
    return out


REVIEW_FROM = '2026-11-16'  # the first board a fresh reader's same-story review is required on (Krish, 2026-11-16)
STORY_VERDICTS = ('new', 'same_story')


def review_findings(ideas, sources, week):
    """A retold story shares no link and no sentence with the post it retells, so no rule above can see it (Krish,
    2026-11-16: '"AI is about to start messaging you first" was posted last week. Why is it on my ideas board for this
    week?': Thu 5 Nov's No spending, no sending short, offered again for Tue 17 under new words). A fresh reader (a
    separate subagent with none of the run's reasoning) reads every option beside the words of what went out on the last
    three weeks' boards (sources.json recent_posts, each with its words) and writes ideas.json repeat_review:
    {"reader": "<who read>", "checked": [{"ref": "<board ref or option id>", "verdict": "new" | "same_story",
    "of": "<the recent post's key>", "why": "<one line>"}]}. From REVIEW_FROM every option needs its verdict, and one the
    reader calls the same story fails the gate (his own idea is shown with it, never failed)."""
    if str(week) < REVIEW_FROM:
        return []
    board = board_raw(ideas)
    rv = (ideas or {}).get('repeat_review') if isinstance((ideas or {}).get('repeat_review'), dict) else {}
    reader = str(rv.get('reader') or '').strip()
    checked = {}
    for c in rv.get('checked') or []:
        if isinstance(c, dict) and str(c.get('ref') or '').strip():
            checked[str(c['ref']).strip().lower()] = c
    mine = his_open(sources)
    out = []
    for ref, day, main, o in board:
        label = f'{ref} ({str(o.get("id") or "")[:8]})' if main else ref
        oid = str(o.get('id') or '').lower()
        c = checked.get(ref.lower()) or (checked.get(oid) if oid else None)
        if not reader or c is None or c.get('verdict') not in STORY_VERDICTS:
            out.append({'code': 'repeat', 'ref': ref, 'rule': 'f',
                        'line': f'repeat: {label} has no same-story verdict from a fresh reader (ideas.json repeat_review, '
                                'references/lookalike.md, "The same story under new words")'})
            continue
        if c['verdict'] == 'same_story':
            his = o.get('source_kind') == 'his' or bool(o.get('from_inspiration')) or oid in mine
            of = str(c.get('of') or 'a recent post')[:120]
            why = ' '.join(str(c.get('why') or '').split())[:200]
            line = f'{label} tells the same story as {of}{f" ({why})" if why else ""}: what went out is never offered again under new words'
            out.append({'code': 'his_repeat' if his else 'repeat', 'ref': ref, 'rule': 'f', 'post': of,
                        'line': ('shown with the repeat (his own idea): ' if his else 'repeat: ') + line})
    return out


ASK_REF = re.compile(r'^ask[/-](?P<id>[0-9a-f-]{8,})', re.I)


def held_ask_findings(ideas, sources, week):
    """An ask of his held back keeps what he saved (Krish, 2026-11-16: "feedback and suggestions like 'Let's make a
    hilarious meme' end up in the ideas board without any context of what I actually wanted to make a hilarious meme
    about. We've now ended up with a vague instruction where I actually put on the inspiration board something very
    specific."). From REVIEW_FROM a held ask from a card carries a title that names what it is about (never his words
    alone), his words exactly in said, and the card's own link in source, so the board shows the thing he saved."""
    if str(week) < REVIEW_FROM:
        return []
    cards = {}
    insp = (sources or {}).get('inspiration') if isinstance((sources or {}).get('inspiration'), dict) else {}
    for group in ('fresh', 'feed', 'cards', 'ticked'):
        for c in insp.get(group) or []:
            if isinstance(c, dict) and c.get('id'):
                cards.setdefault(str(c['id']).lower(), c)
    out = []
    for h in (ideas or {}).get('held') or []:
        if not isinstance(h, dict):
            continue
        m = ASK_REF.match(str(h.get('ref') or ''))
        if not m:
            continue
        ref = str(h.get('ref'))
        card = cards.get(m.group('id').lower())
        said = ' '.join(str(h.get('said') or '').split())
        title = ' '.join(str(h.get('title') or '').split())
        src = h.get('source') if isinstance(h.get('source'), dict) else {}
        if len(said) < 3:
            out.append({'code': 'held', 'ref': ref, 'line': f'held: {ref} carries his words exactly in said'})
        his_words = ' '.join(str(said or (card or {}).get('saved_why') or (card or {}).get('note_for_claude') or '').split()).lower()
        t = title.lower().rstrip('.')
        if len(title) < 12 or (his_words and (t in his_words or his_words.rstrip('.') in t)):
            out.append({'code': 'held', 'ref': ref, 'line': f'held: {ref} has a title that names what it is about (the post he saved and what to make of it), '
                        'never his words alone; his words go in said'})
        link = card.get('link') if card else None
        if link and canon_url(src.get('url')) != canon_url(link):
            out.append({'code': 'held', 'ref': ref, 'line': f'held: {ref} came from a card he saved: its source is the card\'s own link ({link}), '
                        'so the board shows what he saved'})
    return out


def repeat_read_findings(sources, week):
    """The repeat check could not read what went out: a failed read is said, and from REPEAT_FROM a gather without the
    posts fails the gate."""
    err = (sources or {}).get('recent_posts_error')
    if err:
        return [{'code': 'repeat', 'ref': 'sources', 'rule': 'read',
                 'line': f'repeat: the last weeks\' posts could not be read ({str(err)[:300]}); gather again, so what went out is never offered again'}]
    if str(week) >= REPEAT_FROM and not isinstance((sources or {}).get('recent_posts'), list):
        return [{'code': 'repeat', 'ref': 'sources', 'rule': 'read',
                 'line': 'repeat: sources.json has no recent_posts (the gather predates them); gather again, so what went out is never offered again'}]
    return []


# ---------------------------------------------------------------------------------------------------------------------
# The shape of every option from the 23 Nov board (Krish, 2026-11-16: "The suggestions ... should be either one clear
# theme containing lots of different news stories or one clear story that we can dive into. The goal should always be
# immediate utility for the user, or interest, or humor." And: "Everything should be tinged with a humorous angle, all
# scripts for pieces and all suggestions for off days.")

AIM_FROM = '2026-11-23'
SHAPES = ('theme', 'story')
AIMS = ('utility', 'interest', 'humour')
THEME_STORIES = 3
DIVE_MIN = 20


def theme_urls(o):
    """The distinct sourced stories a theme carries: its stories' sources and its sources, by page."""
    urls = []
    for st in o.get('stories') or []:
        s = st.get('source') if isinstance(st, dict) else None
        u = canon_url(s.get('url') if isinstance(s, dict) else (st.get('url') if isinstance(st, dict) else None))
        if u and u not in urls:
            urls.append(u)
    for s in o.get('sources') or []:
        u = canon_url(s.get('url') or s.get('href')) if isinstance(s, dict) else None
        if u and u not in urls:
            urls.append(u)
    return urls


def needs_lookalike(o):
    """Whether an option names the lookalike pattern it comes from: every option but his own (his idea, an idea he
    recorded, his tick), the weekly series and a meme template (its clip is the model, template_findings)."""
    return not (o.get('weekly') or o.get('source_kind') == 'his' or o.get('kind') == 'recorded' or o.get('from_inspiration')
                or is_template(o))


def offday_carousel(ref, o):
    """An off-day carousel that is neither the weekly good news nor a meme nor an idea of his or one he records: the
    kind whose aim is utility (Krish, 2026-11-16)."""
    if not str(ref).startswith('off-') or o.get('weekly') or o.get('source_kind') == 'his' or o.get('kind') in ('recorded', 'good_news', 'meme'):
        return False
    fmt = f'{o.get("kind") or ""} {o.get("format") or ""}'.lower()
    return 'carousel' in fmt and 'meme' not in fmt and 'good news' not in fmt and 'uplifting' not in fmt


def aim_findings(ideas, week, patterns=None, feed_urls=None, warnings=(), feed_text=None):
    """From AIM_FROM, every option says its shape (one clear theme with at least three sourced stories, or one clear
    story with the mechanism to dive into), its aim (utility, interest or humour), its funny angle in one plain line,
    and the lookalike pattern and the feed post it beats (lookalike.json, lookalike-input.json). patterns: the pattern
    ids in lookalike.json, or None when the week has none; feed_urls: the post URLs in lookalike-input.json; warnings:
    lookalike-input.json's (a stale sheet, a feed fallback), each said word for word in ideas.json _about."""
    if str(week) < AIM_FROM:
        return []
    out = []
    about = str((ideas or {}).get('_about') or '')
    out += [{'code': 'aim', 'ref': 'lookalike', 'line': f'aim: ideas.json _about does not say, word for word: {w}'} for w in warnings or [] if w not in about]
    pats = set(patterns or [])
    feed = {canon_url(u) for u in feed_urls or [] if canon_url(u)}
    # No post to draw patterns from (lookalike.py said so in a warning, which _about must carry): the shape, aim and
    # funny line still hold; the pattern and the post an option beats cannot be asked for.
    no_feed = not feed and any(str(w).startswith('No lookalike this week') for w in warnings or [])
    if patterns is None and not no_feed:
        out.append({'code': 'aim', 'ref': 'lookalike', 'line': 'aim: no lookalike.json for the week; run lookalike.py prepare and check, '
                    'then name each option\'s pattern'})
    for ref, day, main, o in board_raw(ideas):
        label = f'{ref} ({str(o.get("id") or "")[:8]})' if main else ref
        shape = o.get('shape')
        if shape not in SHAPES:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} says its shape: "theme" (one topic, three or more sourced stories) '
                        'or "story" (one primary source and the mechanism to dive into)'})
        elif shape == 'theme' and len(theme_urls(o)) < THEME_STORIES:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} is a theme with {len(theme_urls(o))} sourced stories; a theme '
                        f'carries at least {THEME_STORIES} different ones (stories or sources, each with its url)'})
        elif shape == 'story' and not (primary_url(o) and len(str(o.get('dive') or ((o.get('template') or {}).get('why_it_works') if is_template(o) else '') or '').strip()) >= DIVE_MIN):
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} is a story: one primary source (source.url) and dive, the '
                        'mechanism to dive into, in a sentence'})
        if o.get('aim') not in AIMS:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} says what it is for: aim is "utility", "interest" or "humour"'})
        elif offday_carousel(ref, o) and o.get('aim') != 'utility':
            # Krish, 2026-11-16: "Off day Carousels should have that level of utility: attention-grabbing headline and
            # visual, and actual real utility."
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} is an off-day carousel: its aim is "utility", a headline and a '
                        'picture that stop the scroll and something the reader can use the same day, at the level of the best posts '
                        'in his Instagram inspo sheet'})
        funny = str(o.get('funny') or '').strip()
        if len(funny) < 10 or '\n' in funny or len(funny) > 240 or '\u2014' in funny:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} carries its humorous angle in funny: one plain line, no em dash'})
        if not needs_lookalike(o) or no_feed:
            continue
        look = o.get('lookalike') if isinstance(o.get('lookalike'), dict) else {}
        if patterns is not None and look.get('pattern') not in pats:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} names its lookalike pattern (lookalike.pattern, one of '
                        f'{", ".join(sorted(pats)) or "the patterns in lookalike.json"})'})
        if canon_url(look.get('beats')) not in feed:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} names the feed post it beats (lookalike.beats, a post URL in '
                        'lookalike-input.json)'})
        # Krish, 2026-11-16: "You are more than welcome to copy any ideas but we just change the copy, we change the
        # branding, we change the imagery, and ideally we have our own take on the card". Its take is its own, said in one
        # line; its words are never theirs.
        if len(str(look.get('our_take') or '').strip()) < 10:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} says its own take on the post it draws on (lookalike.our_take, '
                        'one line: what we say that they did not)'})
        theirs = (feed_text or {}).get(canon_url(look.get('beats')) or '')
        run = copied_run(option_words(o), theirs) if theirs else None
        if run:
            out.append({'code': 'aim', 'ref': ref, 'line': f'aim: {label} copies the words of the post it draws on ("{run}"): '
                        'the idea, the news and the format may be theirs, the copy is ours'})
    return out


OFFDAY_BREADTH = 5  # options each off day offers from the 23 Nov board (it was four to six)
AIM_SPREAD = 2      # aims a day of three or more options spans


def breadth_findings(ideas, week):
    """Krish, 2026-11-16: "There's not enough quality and breadth of ideas flowing through to this week's or next week's
    boards." From AIM_FROM each off day offers at least OFFDAY_BREADTH options, and a day of three or more spans at least
    AIM_SPREAD of utility, interest and humour, so a day is never four of one kind."""
    if str(week) < AIM_FROM:
        return []
    out = []
    by_day = {}
    for ref, day, main, o in board_raw(ideas):
        if not is_template(o):  # a meme template rides on top of the day's options (Krish, 2026-11-17)
            by_day.setdefault((day, main), []).append(o)
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day in ('tue', 'thu', 'sat'):
        n = len([o for o in offdays.get(day) or [] if isinstance(o, dict) and not is_template(o)])
        if day in offdays and n < OFFDAY_BREADTH:
            out.append({'code': 'aim', 'ref': f'off-{day}', 'line': f'aim: {day} offers {n} options; an off day offers at least {OFFDAY_BREADTH}, '
                        'from different sources (the sheet, the web, his cards), so he has a real choice'})
    for (day, main), opts in by_day.items():
        aims = {o.get('aim') for o in opts if o.get('aim') in AIMS}
        if len(opts) >= 3 and len(aims) < AIM_SPREAD:
            out.append({'code': 'aim', 'ref': f'{"" if main else "off-"}{day}', 'line': f'aim: {day}\'s {len(opts)} options are all '
                        f'{", ".join(sorted(aims)) or "without an aim"}; a day spans at least {AIM_SPREAD} of utility, interest and humour'})
    return out


COPY_RUN = 7


# Saturday's good news (Krish, 2026-11-19, of Sat 28's ideas board: "These are still all just one idea, mostly, and
# they're not good news carousels. Some of them are memes that are sneaking through, and the only actual uplifting
# carousel is about AI in hospital again, which is all we post about. We should find good news that's not medical
# stuff."). Every rule reads config/good-news.json, so a new topic, limit or keyword is a row there.

def good_news_config():
    return json.loads((Path(__file__).resolve().parents[2] / 'config' / 'good-news.json').read_text(encoding='utf-8'))


GOOD_NEWS = good_news_config()
GOOD_NEWS_FROM = GOOD_NEWS['from']


def is_good_news(o):
    """A Saturday option that is a good-news carousel: kind good_news, the weekly series, or a format that says so."""
    if not isinstance(o, dict):
        return False
    if saturday_kind(o) == 'good_news':
        return True
    fmt = str(o.get('format') or '').lower()
    return bool(re.search(r'uplifting|good[- ]news', fmt)) and 'meme' not in fmt


def topic_kind_of(text):
    """The good-news topic a text is about, by the keywords in config/good-news.json (most hits wins), or None."""
    t = ' ' + re.sub(r'[^a-z0-9 ]+', ' ', str(text or '').lower()) + ' '
    best, n = None, 0
    for row in GOOD_NEWS['topics']:
        hits = sum(t.count(f' {k} ') for k in row.get('keywords') or [])
        if hits > n:
            best, n = row['kind'], hits
    return best


def option_topic_kind(o):
    """An option's lead theme: its own topic_kind, else read from its topic, hook and title, else the kind three or more
    of its stories share (lead_stories). None for a mixed carousel with no lead, which Krish allows (2026-11-19: "Can
    mix if no1 is implemented properly")."""
    kinds = {r['kind'] for r in GOOD_NEWS['topics']}
    own = o.get('topic_kind')
    if own in kinds:
        return own
    found = topic_kind_of(' '.join(str(o.get(f) or '') for f in ('topic', 'hook', 'title')))
    if found:
        return found
    counts = {}
    for st in o.get('stories') or []:
        if isinstance(st, dict) and st.get('kind') in kinds:
            counts[st['kind']] = counts.get(st['kind'], 0) + 1
    lead = max(sorted(counts), key=counts.get) if counts else None
    return lead if lead and counts[lead] >= GOOD_NEWS['lead_stories'] else None


def helps_ok(st):
    """A story says who it helps and how, against the bar: smarter, better, happier or more successful."""
    h = st.get('helps') if isinstance(st.get('helps'), dict) else {}
    return len(str(h.get('who') or '').strip()) >= 3 and str(h.get('how') or '').strip().lower() in GOOD_NEWS['bar']['helps']


def goodnews_findings(ideas, week, history=None):
    """From GOOD_NEWS_FROM, Saturday is only good-news carousels (Ruling, Krish, 2026-11-19: "Sat should just be good
    news carousels - 5 great things AI is doing for people (ideally things that make people smarter or better or happier
    or more successful)."): at least min_options of them, none a meme, explainer or one-story carousel; each its five
    stories (or stories_to_find), each story with its kind, its https source and who it helps and how (helps: {who, how},
    how one of the bar's words). A carousel may mix topics ("Can mix if no1 is implemented properly"); where one leads
    (lead_stories of its stories, or its topic says so), no two options share it, it is not a lead of the repeat_weeks
    Saturdays before, and a medical lead is refused while those Saturdays carried medical_recent_max medical stories. A
    carousel that medicine does not lead carries at most medical_stories_max medical stories. history: [{"week",
    "kind", "medical"}] of the Saturdays before."""
    if str(week) < GOOD_NEWS_FROM:
        return []
    cfg = GOOD_NEWS
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    sat = [o for o in offdays.get('sat') or [] if isinstance(o, dict) and not is_template(o)]
    out = []

    def say(ref, line):
        out.append({'code': 'goodnews', 'ref': ref, 'line': f'goodnews: {ref} {line}'})

    from datetime import date as _d
    start = _d.fromisoformat(str(week))
    recent, medical_recent = {}, 0
    for h in history or []:
        try:
            back = (start - _d.fromisoformat(str(h.get('week')))).days
        except ValueError:
            continue
        if 0 < back <= 7 * cfg['repeat_weeks']:
            if h.get('kind'):
                recent.setdefault(h['kind'], str(h.get('week')))
            medical_recent += int(h.get('medical') or 0)
    labels = {r['kind']: r['label'] for r in cfg['topics']}
    good = []
    for o in sat:
        ref = f'off-sat-{o.get("id")}'
        if not is_good_news(o):
            say(ref, f'is "{o.get("format") or "a post with no format"}"; Saturday offers only good-news carousels ({cfg["bar"]["words"]}). '
                     'A meme belongs in the meme templates lane, an explainer on Tuesday or Thursday')
            continue
        good.append(o)
    # A board with no Saturday at all is the breadth check's (OFFDAY_BREADTH); one with a Saturday offers enough good news.
    if 'sat' in offdays and len(good) < cfg['min_options']:
        say('sat', f'has {len(good)} good-news carousel{"s" if len(good) != 1 else ""}; Saturday offers at least {cfg["min_options"]}, each a different five')
    seen, seen_sources = {}, {}
    for o in good:
        ref = f'off-sat-{o.get("id")}'
        lead = option_topic_kind(o)
        stories = [st for st in o.get('stories') or [] if isinstance(st, dict)]
        if lead:
            if lead in seen:
                say(ref, f'is led by the same theme ({labels.get(lead, lead)}) as off-sat-{seen[lead]}; each Saturday option is a different five')
            seen.setdefault(lead, o.get('id'))
            if lead in cfg['medical'] and medical_recent >= cfg['medical_recent_max'] and lead not in recent:
                say(ref, f'is led by medicine, and the Saturdays of the last {cfg["repeat_weeks"]} weeks already carried '
                         f'{medical_recent} medical stories; find good news outside medicine. {cfg["why_medical_wins"]}')
            if lead in recent:
                say(ref, f'is led by {labels.get(lead, lead)}, the lead of the Saturday in the week of {recent[lead]}; no lead comes back '
                         f'within {cfg["repeat_weeks"]} weeks. {cfg["why_medical_wins"] if lead in cfg["medical"] else ""}'.rstrip())
        for st in stories:
            url = str(((st.get('source') or {}) if isinstance(st.get('source'), dict) else {}).get('url') or '')
            if url and url in seen_sources and seen_sources[url] != o.get('id'):
                say(ref, f'repeats a story off-sat-{seen_sources[url]} carries ({url}); each Saturday option is a different five')
            seen_sources.setdefault(url, o.get('id'))
        if len(stories) < cfg['stories'] and not o.get('stories_to_find'):
            say(ref, f'holds {len(stories)} stor{"y" if len(stories) == 1 else "ies"}; a good-news carousel is {cfg["stories"]} great things AI is doing for people '
                     '(or stories_to_find: true, for the board\'s "Find the other N stories")')
        for i, st in enumerate(stories, 1):
            if st.get('kind') not in GOOD_NEWS_KINDS or not str(((st.get('source') or {}) if isinstance(st.get('source'), dict) else {}).get('url') or '').startswith('https://'):
                say(ref, f'story {i} needs its kind and its https source')
            if not helps_ok(st):
                say(ref, f'story {i} says who it helps and how (helps: {{"who", "how"}}, how one of: {", ".join(cfg["bar"]["helps"])})')
        if lead not in cfg['medical']:
            med = sum(1 for st in stories if st.get('kind') in cfg['medical'])
            if med > cfg['medical_stories_max']:
                say(ref, f'carries {med} medical stories; a carousel medicine does not lead carries at most {cfg["medical_stories_max"]}')
    return out


def goodnews_history(sources, earlier_ideas):
    """[{"week", "kind"}]: the topics of the Saturdays before, from what went out or is on its way (sources.json
    recent_posts on a Saturday) and the weekly good news each earlier board planned (its ideas.json)."""
    out = []
    for p in (sources or {}).get('recent_posts') or []:
        if isinstance(p, dict) and p.get('day') == 'sat':
            kind = topic_kind_of(' '.join(str(p.get(f) or '') for f in ('title', 'words')))
            if kind:
                out.append({'week': p.get('week'), 'kind': kind, 'medical': 1 if kind in GOOD_NEWS['medical'] else 0})
    for week, data in earlier_ideas or []:
        for o in ((data or {}).get('offdays') or {}).get('sat') or []:
            if isinstance(o, dict) and (o.get('weekly') == 'good_news' or is_good_news(o)):
                kind = option_topic_kind(o)
                med = sum(1 for st in o.get('stories') or [] if isinstance(st, dict) and st.get('kind') in GOOD_NEWS['medical'])
                out.append({'week': week, 'kind': kind if o.get('weekly') == 'good_news' else None, 'medical': med})
    return out



# ---------------------------------------------------------------------------------------------------------------------
# Saturday is carousels modelled on his sheet, and memes have their own lane (Krish, 2026-11-17, looking at Sat 21 Nov's
# board: "I feel like we are very much missing the point of the Saturday suggestions. Each suggestion should be a
# carousel like one carousel from my Instagram Inspo sheet, not just one story."). From the 30 Nov board; earlier boards
# keep the shape they were made in, as SHAPE_FROM does.

SATURDAY_FROM = '2026-11-30'
SATURDAY_KINDS = ('good_news',)  # Krish, 2026-11-19: Saturday is good-news carousels only (config/good-news.json saturday_kinds)
SATURDAY_CARDS = (4, 10)  # a Saturday carousel's cards: at least four, at most ten (Buffer posts ten images at most)


def saturday_kind(o):
    """A Saturday option's kind: its own `kind`, or good_news for the weekly series that predates the field."""
    return o.get('kind') or ('good_news' if o.get('weekly') == 'good_news' else None)


def saturday_findings(ideas, week, flows=None, feed_urls=None, carousel_urls=None):
    """From SATURDAY_FROM every Saturday option is a carousel (kind good_news, explainer or supporting; no meme,
    voiceover or recorded option on Saturday) modelled card for card on one carousel in his Instagram inspo sheet: its
    lookalike.beats names that post (a URL in the week's lookalike-input.json, a carousel there when the input says what
    each post is), its lookalike.pattern has a card_flow in lookalike.json, and its cards and direction.frames follow that
    card_flow one for one, 4 to 10 cards. The weekly good news follows a pattern's card_flow too: its stories fill the
    middle cards, so its flow holds a card for each story and two more (the cover and the close).

    flows: {pattern id: [card jobs]} from lookalike.json, or None when the week has none; feed_urls: the post URLs in
    lookalike-input.json (the input is never committed, so a later job may not hold it: the post is then held to an https
    page, and the aim check says the rest); carousel_urls: those of them the input says are carousels, or None when it
    cannot say."""
    if str(week) < SATURDAY_FROM:
        return []
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    feed = {canon_url(u) for u in feed_urls or [] if canon_url(u)}
    carousels = None if carousel_urls is None else {canon_url(u) for u in carousel_urls if canon_url(u)}
    lo, hi = SATURDAY_CARDS
    out = []

    def say(ref, line):
        out.append({'code': 'saturday', 'ref': ref, 'line': f'saturday: {ref} {line}'})

    for o in offdays.get('sat') or []:
        if not isinstance(o, dict):
            continue
        ref = f'off-sat-{o.get("id")}'
        kind = saturday_kind(o)
        if kind not in SATURDAY_KINDS:
            say(ref, f'is a {kind or "post with no kind"}; every Saturday option is a carousel (kind {", ".join(SATURDAY_KINDS)}): '
                     'memes have their own lane on Tuesday and Thursday, and no voiceover or recorded option goes on Saturday')
            continue
        look = o.get('lookalike') if isinstance(o.get('lookalike'), dict) else {}
        weekly = bool(o.get('weekly'))  # the weekly series; every other good-news carousel names its sheet carousel
        if not weekly:
            beats = canon_url(look.get('beats'))
            if not beats or not str(look.get('beats')).startswith('https://'):
                say(ref, 'names the carousel in his Instagram inspo sheet it is modelled on (lookalike.beats, an https post URL)')
            elif feed and beats not in feed:
                say(ref, 'names a post that is not in the week\'s lookalike-input.json (lookalike.beats); model it on a carousel in his sheet')
            elif carousels is not None and feed and beats not in carousels:
                say(ref, 'is modelled on a post the sheet does not hold as a carousel (lookalike.beats); pick one of his sheet\'s carousels')
        if flows is None:
            say(ref, 'has no lookalike.json for the week to take its card flow from; run lookalike.py prepare and check')
            continue
        flow = flows.get(str(look.get('pattern') or ''))
        if not isinstance(flow, list) or len(flow) < 3:
            say(ref, 'names a lookalike pattern with a card_flow (lookalike.pattern), the sheet carousel\'s card-by-card flow it follows')
            continue
        cards = o.get('cards') if isinstance(o.get('cards'), list) else []
        frames = ((o.get('direction') or {}).get('frames') if isinstance(o.get('direction'), dict) else None) or []
        if not lo <= len(flow) <= hi:
            say(ref, f'follows a card_flow of {len(flow)} cards; a Saturday carousel is {lo} to {hi} cards')
        if len(cards) != len(flow):
            say(ref, f'has {len(cards)} cards; it follows its pattern\'s card_flow card for card ({len(flow)} cards: '
                     + '; '.join(str(x) for x in flow)[:300] + ')')
        if len(frames) != len(flow):
            say(ref, f'has {len(frames)} direction.frames; the direction follows the same card_flow ({len(flow)} frames)')
        if weekly:
            n = len([s for s in o.get('stories') or [] if isinstance(s, dict)])
            if n and len(flow) < n + 2:
                say(ref, f'follows a card_flow of {len(flow)} cards for {n} stories; its stories fill the middle cards, '
                         'so the flow holds a cover, a card for each story and a close')
    return out


# The meme templates lane (Krish, 2026-11-17: "why can we not create a pipeline of existing meme videos that could be good
# to reskin, and show me those in here? Then I could think of a funny caption for it thats related to AI."). Each is an
# off-day option on Tuesday or Thursday with kind "meme" and a `template`, so his presses, notes, Move to and offday_items
# work as for any option; it never counts toward the day's options (OFFDAY_BREADTH).

TEMPLATE_FROM = '2026-11-30'
TEMPLATE_DAYS = ('tue', 'thu')
TEMPLATES = (6, 10)          # templates a week
TEMPLATE_PLACE_KINDS = 2     # kinds of place a week's templates come from, at least
TEMPLATE_PLACES = ('sheet', 'card', 'reddit', 'instagram', 'tiktok', 'youtube', 'pop_culture')
TEMPLATE_WEEKS = 3           # a template offered on the three boards before is not offered again
CAPTION_IDEAS = (2, 4)
CAPTION_WORDS = 20
# The humour engine's mechanism ids, pinned from krishanraja/humour-engine schemas/ontology.json (its mechanisms list).
# A template names the mechanisms that make its clip funny, in the engine's own words, so the two speak one language.
MECHANISMS = ('ambiguity', 'incongruity', 'misdirection', 'reversal', 'literalisation', 'exaggeration', 'understatement',
              'callback', 'self_defeating_logic', 'personification', 'irony', 'sarcasm', 'absurd_reasoning')
EM_DASH = '\u2014'
HANDLE = re.compile(r'(?:^|[\s(])(?:@[A-Za-z0-9_.]{2,}|/?u/[A-Za-z0-9_-]{3,})')


def is_template(o):
    """Whether an off-day option is a meme template: kind meme with a template object."""
    return isinstance(o, dict) and o.get('kind') == 'meme' and isinstance(o.get('template'), dict)


def template_page(o):
    """The page a template's clip lives on, canonical: how a template is known across weeks."""
    clip = (o.get('template') or {}).get('clip') if is_template(o) else None
    return canon_url(clip.get('page')) if isinstance(clip, dict) else None


def kill_list_vetoes(text):
    """The kill list's vetoes on some words ([] when clean): node vendor/makeyourmindup/kill-list/kill-list.mjs --stdin.
    A kill list that cannot run is a veto, never a pass."""
    import subprocess
    from pathlib import Path as _P
    script = _P(__file__).resolve().parents[2] / 'vendor' / 'makeyourmindup' / 'kill-list' / 'kill-list.mjs'
    try:
        # encoding: node reads and writes UTF-8; without it Windows pipes the locale's code page and an em dash passes.
        run = subprocess.run(['node', str(script), '--stdin'], input=str(text), capture_output=True, text=True, encoding='utf-8',
                             errors='replace', timeout=60)
    except (OSError, subprocess.SubprocessError) as error:
        return [f'the kill list could not run ({error})']
    if run.returncode == 0:
        return []
    return [line.split('  ')[2] if len(line.split('  ')) > 2 else line for line in run.stdout.splitlines() if line.startswith('VETO')] or ['the kill list refused it']


def caption_problems(text, credit='', kill=None):
    """Why one caption idea is not ready, or []: one line of at most CAPTION_WORDS words, no em dash, clean of the copy
    lint (channel_copy) and the kill list, and naming no handle and nobody from the clip's credit (never a real private
    person)."""
    import copy_lint as _cl
    t = ' '.join(str(text or '').split())
    if not t:
        return ['is empty']
    out = []
    if len(t.split()) > CAPTION_WORDS:
        out.append(f'is {len(t.split())} words; at most {CAPTION_WORDS}')
    if EM_DASH in str(text):
        out.append('has an em dash')
    hits = _cl.copy_lint(t, 'channel_copy')
    if hits:
        out.append('fails the copy lint (' + ', '.join(sorted({h['id'] for h in hits})) + ')')
    vetoes = (kill or kill_list_vetoes)(t)
    if vetoes:
        out.append('fails the kill list (' + ', '.join(sorted(set(vetoes))) + ')')
    if HANDLE.search(t):
        out.append('names an account; a caption never names a real private person')
    low = t.lower()
    names = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9_'.-]{2,}", str(credit or '')) if w.lower() not in STOP and w.lower() not in ('reddit', 'instagram', 'tiktok', 'youtube', 'via', 'original', 'unknown')]
    named = [w for w in names if re.search(rf'\b{re.escape(w.lower())}\b', low)]
    if named:
        out.append(f'names {", ".join(named)} from the clip\'s credit; a caption never names a real private person')
    return out


def template_problems(o, kill=None):
    """Why one meme template option is not ready to show, or [] (references/meme-roaster.md)."""
    t = o.get('template') if isinstance(o.get('template'), dict) else {}
    clip = t.get('clip') if isinstance(t.get('clip'), dict) else {}
    found = t.get('found') if isinstance(t.get('found'), dict) else {}
    https = lambda v: isinstance(v, str) and re.match(r'^https://[^\s"<>]+$', v) is not None
    line = lambda v: isinstance(v, str) and v.strip() and '\n' not in v.strip()
    out = []
    if not line(t.get('title')):
        out.append('template.title is one line')
    if not https(clip.get('url')) or not https(clip.get('page')):
        out.append('template.clip has an https url (the playable clip, or its page) and an https page')
    if clip.get('poster') is not None and not https(clip.get('poster')):
        out.append('template.clip.poster is an https image or null')
    if clip.get('seconds') is not None and (isinstance(clip.get('seconds'), bool) or not isinstance(clip.get('seconds'), (int, float)) or clip['seconds'] <= 0):
        out.append('template.clip.seconds is a number or null')
    if found.get('place') not in TEMPLATE_PLACES or not line(found.get('label')) or not https(found.get('url')):
        out.append(f'template.found says where it was found: place (one of {", ".join(TEMPLATE_PLACES)}), label and an https url')
    if not line(t.get('credit')):
        out.append('template.credit names who made the original')
    for k in ('what_happens', 'why_it_works'):
        if not line(t.get(k)) or len(t[k].strip()) < 12:
            out.append(f'template.{k} is one plain line')
        elif EM_DASH in t[k]:
            out.append(f'template.{k} has an em dash')
    mech = t.get('mechanism')
    if not isinstance(mech, list) or not mech or any(m not in MECHANISMS for m in mech):
        out.append(f'template.mechanism names the humour engine\'s mechanisms ({", ".join(MECHANISMS)})')
    moment = t.get('moment')
    if moment is not None and not (line(moment) and dates_in(moment)):
        out.append('template.moment is the pop-culture moment it rides, dated (YYYY-MM-DD or 28 Nov 2026), or null')
    if not (isinstance(t.get('date'), str) and re.match(r'^20\d\d-\d\d-\d\d$', t['date'])):
        out.append('template.date is YYYY-MM-DD')
    if o.get('aim') != 'humour':
        out.append('its aim is "humour"')
    if o.get('shape') != 'story':
        out.append('its shape is "story"')
    if not line(o.get('hook')):
        out.append('its hook is the template\'s title')
    ideas = o.get('caption_ideas')
    lo, hi = CAPTION_IDEAS
    if not isinstance(ideas, list) or not lo <= len(ideas) <= hi or not all(isinstance(x, str) for x in ideas):
        out.append(f'caption_ideas holds {lo} to {hi} drafts')
    else:
        for n, c in enumerate(ideas, 1):
            out += [f'caption idea {n} {p}' for p in caption_problems(c, t.get('credit'), kill)]
    return out


def template_findings(ideas, week, earlier_pages=(), kill=None):
    """From TEMPLATE_FROM: each meme template is whole (template_problems), on Tuesday or Thursday, and new (its clip's
    page offered on none of the TEMPLATE_WEEKS boards before, earlier_pages, and once on this board); the week offers
    TEMPLATES of them, found in at least TEMPLATE_PLACE_KINDS kinds of place. kill: the kill list's checker (tests pass
    their own)."""
    if str(week) < TEMPLATE_FROM:
        return []
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    before = {canon_url(u) for u in earlier_pages or [] if canon_url(u)}
    out, seen, places, count = [], {}, set(), 0
    for day, opts in offdays.items():
        for o in opts if isinstance(opts, list) else []:
            if not is_template(o):
                continue
            count += 1
            ref = f'off-{day}-{o.get("id")}'
            say = lambda line: out.append({'code': 'template', 'ref': ref, 'line': f'template: {ref} {line}'})
            if day not in TEMPLATE_DAYS:
                say(f'is a meme template on {day}; templates go on Tuesday or Thursday (Move to puts the post on any day once he approves it)')
            for p in template_problems(o, kill):
                say(p)
            place = ((o.get('template') or {}).get('found') or {}).get('place')
            if place in TEMPLATE_PLACES:
                places.add(place)
            page = template_page(o)
            if page and page in before:
                say(f'was offered on a board in the last {TEMPLATE_WEEKS} weeks ({page}); a template is offered once')
            if page and page in seen:
                say(f'is the same clip as {seen[page]} on this board ({page})')
            if page:
                seen.setdefault(page, ref)
    lo, hi = TEMPLATES
    if not lo <= count <= hi:
        out.append({'code': 'template', 'ref': 'templates', 'line': f'template: the week offers {count} meme templates; it offers {lo} to {hi} '
                    'on Tuesday and Thursday (Krish, 2026-11-17), each with its clip, why it fits and caption ideas'})
    elif len(places) < TEMPLATE_PLACE_KINDS:
        out.append({'code': 'template', 'ref': 'templates', 'line': f'template: the week\'s templates come from {len(places)} kind of place; '
                    f'they come from at least {TEMPLATE_PLACE_KINDS} ({", ".join(TEMPLATE_PLACES)})'})
    return out


def option_words(o):
    """Every word an option would put in front of a reader: its hook, headline, copy, story and each card's words."""
    pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else {}
    parts = [o.get('hook'), o.get('title'), o.get('copy'), o.get('story'), pitch.get('headline'), pitch.get('hook')]
    parts += [c.get('words') for c in o.get('cards') or [] if isinstance(c, dict)]
    return ' '.join(str(p) for p in parts if p)


def copied_run(ours, theirs, n=COPY_RUN):
    """The first run of n words in a row that our words share with theirs, or None: borrowing a fact or a name is
    fine, carrying their sentence is not."""
    tok = lambda s: re.findall(r"[a-z0-9']+", str(s or '').lower())
    a, b = tok(ours), tok(theirs)
    if len(a) < n or len(b) < n:
        return None
    grams = {tuple(b[i:i + n]) for i in range(len(b) - n + 1)}
    for i in range(len(a) - n + 1):
        if tuple(a[i:i + n]) in grams:
            return ' '.join(a[i:i + n])
    return None


# The beat (Ruling, Krish, 2026-11-24: the engine brings stories in his focus sectors, media, entertainment, content,
# arts, music, creator tech, with the economics of AI inside them, and not governance, regulation, security or data
# breaches). Every word reads config/beat.json, as good_news_config() reads its file, so a keyword is a row there; the
# headline gate in apps/control-plane/api/_beat.ts reads the same rows.

def beat_config():
    return json.loads((Path(__file__).resolve().parents[2] / 'config' / 'beat.json').read_text(encoding='utf-8'))


def keyword_pattern(keywords):
    """Whole-word, case-blind regex over config keywords: a trailing * matches any ending, a space or hyphen either."""
    alts = []
    for k in keywords or []:
        k = str(k).strip().lower()
        stem, star = (k[:-1], True) if k.endswith('*') else (k, False)
        words = [re.escape(w) for w in re.split(r'[\s-]+', stem) if w]
        if words:
            alts.append(r'[\s-]+'.join(words) + (r'\w*' if star else ''))
    return re.compile(r'\b(?:' + '|'.join(alts) + r')\b', re.I) if alts else re.compile(r'(?!)')


BEAT = beat_config()
BEAT_FROM = BEAT['from']
BEAT_AVOID = [(row['label'], keyword_pattern(row.get('keywords'))) for row in BEAT['avoid']] + \
    [(BEAT['enterprise']['label'], keyword_pattern(BEAT['enterprise']['keywords']))]
BEAT_AVOID_EXCEPT = keyword_pattern(BEAT.get('avoid_not_when'))
BEAT_FOCUS = keyword_pattern([k for row in BEAT['focus_sectors'] for k in row.get('keywords') or []])
BEAT_FOCUS_EXCEPT = keyword_pattern(BEAT.get('focus_not_when'))


def off_beat(topic):
    """(what the avoid list calls it, the word that matched) when a topic is on the beat's avoid list and carries no
    focus-sector angle of its own, else None. Only the topic is read, never the option's whole body: one passing
    'design' or 'media' in a so-what would otherwise rescue a governance or breach option. The exception phrases are
    read first: 'job security' is not a security story and 'state of the art' is not an art story."""
    if BEAT_FOCUS.search(BEAT_FOCUS_EXCEPT.sub(' ', str(topic or ''))):
        return None
    bare = BEAT_AVOID_EXCEPT.sub(' ', str(topic or ''))
    for label, pattern in BEAT_AVOID:
        m = pattern.search(bare)
        if m:
            return label, m.group(0)
    return None


def option_topic(o, main):
    """What an option is about, in its own words: its title and hook, its plain question and headline, and its story's
    first sentence. Both the avoid list and the focus-sector angle are read here and nowhere else in the option."""
    pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else {}
    parts = [o.get('title'), o.get('hook')]
    if main:
        parts += [pitch.get('question'), pitch.get('headline'), pitch.get('hook'), (sentences(o.get('story') or '') or [''])[0]]
    return ' '.join(str(p) for p in parts if p)


def offbeat_findings(ideas, week):
    """From BEAT_FROM, an option whose topic is on the beat's avoid list (governance, regulation, compliance, policy,
    security, privacy, surveillance, breaches, enterprise productivity) and carries no focus-sector angle is refused,
    with the reason in plain words. The weekly good news is its own series with its own check and is left out."""
    if str(week) < BEAT_FROM:
        return []
    out = []
    for ref, day, main, o in board_raw(ideas):
        if o.get('weekly'):
            continue
        hit = off_beat(option_topic(o, main))
        if hit:
            label = f'{ref} ({str(o.get("id") or "")[:8]})' if main else ref
            out.append({'code': 'off_beat', 'ref': ref, 'line': f'off_beat: {label} is about "{hit[1]}" ({hit[0].lower()}) with no '
                        'focus-sector angle; the beat is AI in media, entertainment, arts, music, sports and creator tech, their economics '
                        'included (Ruling, Krish, 2026-11-24; config/beat.json). Find the creative angle or replace it'})
    return out


# The findings that fail the Sunday run (board_feed.py gate): a subject he refused offered again, a warned option placed
# first or shown without his words, a return that came back no deeper, a repeat of what went out (Krish, 2026-11-16),
# from the 23 Nov board an option without its shape, aim, humour and lookalike, and from the 30 Nov board a Saturday
# option that is not a sheet carousel followed card for card, or a meme template that is not whole (Krish, 2026-11-17).
# The rest of cover stays the run's to fix before it stops, as before. From the 30 Nov board an option off the beat
# (offbeat_findings; Ruling, Krish, 2026-11-24) fails it too.
GATE_CODES = ('refused', 'warned_first', 'warning_line', 'return', 'repeat', 'aim', 'saturday', 'template', 'goodnews', 'off_beat')
# What the checks say without failing anything: a warned option (it carries his words) and an idea from his tick on a
# subject he refused (it carries the refusal; Ruling, Krish, 2026-11-12).
NOTE_CODES = ('warned', 'his_tick', 'his_repeat')

# P6 ("A subject you call boring, lame or pointless in any press is vetoed until you raise it"): a proposed rule that
# waits for Krish's yes on his taste ledger. Until he approves it, refusing words outside a Reject warn and never block.
P6_APPROVED = False
