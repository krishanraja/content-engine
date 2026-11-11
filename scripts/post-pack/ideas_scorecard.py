#!/usr/bin/env python3
"""The ideas board's scorecard: what Krish's real presses on one board say, counted in code, each count with the one
written rule it was counted by (the ideas quality plan, item 11: "the baseline comes from code, not from a reader's
judgement. Where the script and this plan disagree, the script wins").

    python3 scripts/post-pack/board_feed.py scorecard <Monday>    # reads the board's presses through the engine

Pure: score(week, ideas, presses, asks) counts; board_feed.py reads the presses (GET /api/board/<Monday>/outcomes:
idea_outcomes, or the board_history of a week before the ideas gate, or the triage marks of the 26 Oct board) and the
week's ideas.json, prints every label beside his exact words, and writes docs/plans/<Monday>-week/scorecard.json with
ids, labels and counts only, never his words. He can overrule any label in the Sunday say-back.

The target is judged on the boards for the weeks of 23 Nov, 30 Nov, 7 Dec and 14 Dec together; one board is a small
sample.
"""
import re
from datetime import datetime

import idea_checks as ic

# Each count and the rule it is counted by. A count is never quoted without its rule.
RULES = {
    'options_main': 'Options on Monday, Wednesday and Friday on the board as he first saw it (ideas.json days).',
    'options_off': 'Off-day options on the board, the weekly good news left out (ideas.json offdays).',
    'pressed_share': 'Share of all options with a final press of his (any of the five outcomes). Under 0.8 is flagged: pressing less never passes for success.',
    'picks': 'His Approve on a publishing day, as it stood at the end (his last pick of each day).',
    'picks_as_written': ('Picks on which nothing he said (the pick\'s note or any other press on that option) asks to reframe it, deepen it '
                         'or say it simpler (idea_checks.PART_WORDS).'),
    'rank1_picked': 'Picks that were the first option of their day (the one the board led with).',
    'wasted_presses': ('Presses (his last on each option, and his words on a pick) that are a Reject worded as refusing or repeating '
                       '(boring, lame, no point, don\'t understand; told you, I just said), or that ask for research, depth or '
                       'simpler words. The 10x number: target at most 1 a board.'),
    'wasted_without_pick_depth': 'The same, leaving out depth or simpler asks made on a pick.',
    'main_rejects': 'Final Reject (not for us, a Drop) on a publishing day\'s option.',
    'main_rejects_with_curious': 'Main rejects plus a "curious" verdict whose words refuse (19 Oct triage only).',
    'offday_rejects_refusing': 'Off-day options he rejected in refusing words (boring, lame, no point, don\'t understand).',
    'refused_subject_options': 'Options on a subject he refused before the board (idea_checks.refused_findings: refused or warned).',
    'big_question': ('A publishing day\'s option is a big question when the first sentence of what it says (so_what) names no company, '
                     'product, person or study; otherwise it is one event. Counted for options and for picks.'),
    'asks_as_typed': ('An option answers his ask as typed when it covers the ask and carries his typed words whole (in its from line, '
                      'so_what or story). Counted for options and for picks.'),
    'minutes': 'His pressing time on the board: from his first press to his last in each sitting (a gap over 60 minutes starts a new sitting), summed.',
}


def stamp(at):
    return ic.stamp(at)


def minutes(times):
    """His pressing time from his press times: each sitting's first to last, a gap over 60 minutes a new sitting."""
    ts = sorted(datetime.fromisoformat(stamp(t)) for t in times if stamp(t))
    total, start, last = 0.0, None, None
    for t in ts:
        if last is None or (t - last).total_seconds() > 3600:
            if start is not None:
                total += (last - start).total_seconds()
            start = t
        last = t
    if start is not None:
        total += (last - start).total_seconds()
    return round(total / 60, 1)


def big_or_single(o):
    """'big' or 'single' (RULES big_question): the first sentence of what it says names a company, product, person or
    study, or it does not."""
    first = (ic.sentences(o.get('so_what') or '') or [''])[0]
    return 'single' if ic.names(first) else 'big'


def final_presses(presses):
    """His last press on each document, as it stood (a press taken back leaves nothing)."""
    last = {}
    for p in sorted(presses, key=lambda p: stamp(p.get('at'))):
        last[p['doc']] = p
    return {d: p for d, p in last.items() if p.get('outcome') not in (None, 'withdrawn')}


def label(p):
    """The labels of one press, beside his words: its outcome and the parts his words carry."""
    parts = ic.parts_of(p.get('words')) + (['repeat'] if ic.REPEAT.search(str(p.get('words') or '')) else [])
    wasted = (p.get('outcome') == 'rejected' and bool({'refuse', 'repeat'} & set(parts))) or bool({'depth', 'simpler'} & set(parts))
    return {'doc': p['doc'], 'outcome': p.get('outcome'), 'parts': parts, 'wasted': wasted, 'at': stamp(p.get('at'))}


def score(week, ideas, presses, asks=(), refused_refs=None):
    """The scorecard for one board. presses: [{doc, outcome, via, day, idea_id, words, at}] his presses on it (picks/<day>
    for an Approve on a publishing day, queue/<day>-<n> for a press on its options, queue/off-<day>-<id> on an off day).
    asks: [{id, words}] his asks known before the board. refused_refs: the option refs on a subject he refused, or None
    when not read."""
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    main = [(d, n, o) for d in ('mon', 'wed', 'fri') for n, o in enumerate(days.get(d) or [], 1) if isinstance(o, dict)]
    off = [(d, o) for d, opts in offdays.items() for o in (opts if isinstance(opts, list) else []) if isinstance(o, dict) and not o.get('weekly')]
    final = final_presses(presses)
    picks = {}
    for doc, p in final.items():
        m = re.match(r'^picks/(mon|wed|fri)$', doc)
        if m and p.get('outcome') == 'approved':
            picks[m.group(1)] = p
    ref_of = {str(o.get('id') or '').lower(): f'{d}-{n}' for d, n, o in main if o.get('id')}
    pick_refs = {d: ref_of.get(str(p.get('idea_id') or '').lower(), p.get('pick')) for d, p in picks.items()}
    pressed = {doc.split('/', 1)[1] for doc in final if doc.startswith('queue/')} | set(pick_refs.values())
    shown = len(main) + len(off)
    labels = [label(p) for p in final.values()]
    wasted = [lab for lab in labels if lab['wasted']]
    on_pick = [lab for lab in wasted if lab['doc'].startswith('picks/') and lab['outcome'] == 'approved' and not {'refuse', 'repeat'} & set(lab['parts'])]
    main_rejects = [lab for lab in labels if lab['outcome'] == 'rejected' and re.match(r'^queue/(mon|wed|fri)-\d+$', lab['doc'])]
    curious = [p for p in final.values() if p.get('verdict') == 'curious' and ic.refusing(p.get('words'))]
    off_refusing = [lab for lab in labels if lab['outcome'] == 'rejected' and lab['doc'].startswith('queue/off-') and 'refuse' in lab['parts']]
    kinds = {f'{d}-{n}': big_or_single(o) for d, n, o in main}
    ask_words = {str(a.get('id')): ic.norm(a.get('words')) for a in asks if a.get('words')}
    as_typed = sorted(f'{d}-{n}' for d, n, o in main
                      if any(c in ask_words and ask_words[c] and ask_words[c] in ic.norm(' '.join(str(o.get(k) or '') for k in ('from', 'so_what', 'story')))
                             for c in o.get('covers') or []))
    covering = sorted(f'{d}-{n}' for d, n, o in main if set(map(str, o.get('covers') or [])) & set(ask_words))
    # Taken as written: nothing he said on the picked option (the pick's own note, or any other press on it) asks to
    # reframe it, deepen it or say it simpler.
    def said_on(day):
        return [picks[day].get('words')] + [q.get('words') for doc, q in final.items() if doc == f'queue/{pick_refs[day]}']
    picks_written = [d for d in picks if not {'reframe', 'depth', 'simpler'} & {k for w in said_on(d) for k in ic.parts_of(w)}]
    out = {
        'week': week,
        'counts': {
            'options_main': len(main), 'options_off': len(off),
            'pressed_share': round(len(pressed & ({f'{d}-{n}' for d, n, _ in main} | {f'off-{d}-{o.get("id")}' for d, o in off})) / shown, 2) if shown else None,
            'picks': len(picks), 'picks_as_written': len(picks_written),
            'rank1_picked': sum(1 for r in pick_refs.values() if str(r).endswith('-1')),
            'wasted_presses': len(wasted), 'wasted_without_pick_depth': len(wasted) - len(on_pick),
            'main_rejects': len(main_rejects), 'main_rejects_with_curious': len(main_rejects) + len(curious),
            'offday_rejects_refusing': len(off_refusing),
            'refused_subject_options': None if refused_refs is None else len(refused_refs),
            'big_question': {'options': sum(1 for k in kinds.values() if k == 'big'), 'picks': sum(1 for r in pick_refs.values() if kinds.get(r) == 'big')},
            'asks_as_typed': {'options_covering_an_ask': len(covering), 'as_typed': len(as_typed),
                              'picks_as_typed': sum(1 for r in pick_refs.values() if r in as_typed)},
            'minutes': minutes(p.get('at') for p in presses if p.get('via') != 'approve_publish'),
        },
        'flags': (['pressed under 80% of the options: a quiet board never passes for success']
                  if shown and len(pressed) / shown < 0.8 else []),
        'picks': pick_refs,
        'kinds': kinds,
        'labels': [{k: lab[k] for k in ('doc', 'outcome', 'parts', 'wasted')} for lab in labels],
        'rules': RULES,
    }
    return out
