"""A mix of businesses and creators, and what AI changes under the hood: the lens gate on the Sunday ideas board.

Ruling (Krish, 2026-11-28): "I want a mix, not a lean." And: "a mix, or a multilayered combo is better than one or the
other. therein lies the ability to tell better stories." So a story may be both (a business and the people who make the
work in it) and counts on each side; every hero day and every off day's explainers carry both sides.

Ruling (Krish, 2026-11-27): "My ideas board has become a little bit too focused on individual creators and not enough
on what it was before, which is businesses and, under the hood, how AI is changing things."

From the lens's `from` board every open Monday, Wednesday and Friday option says which way it faces (lens.subject,
business or creator), who it is about (lens.who, named in its story) and what AI changes in how that business works
(lens.under_the_hood, one plain line that is not its so-what). A business subject leads on a business word or a named
business in what it leads on (its question, headline, hook and first sentence), and one whose creator words are at least as
many as its business words holds only when its who is itself a business. Each open hero day carries at least
min_each_per_day options with a business side and as many with a creator side (a layered option counts on each), and
each off day's explainers min_each_offday of each. An option from
his own words (source_kind his) or his Inspiration tick (from_inspiration) is his and is never checked or counted.

Every word reads config/lens.json. It lives apart from idea_checks.py and config/beat.json, as the touch gate does in
board_feed.py, so the story engine v5 blind proof's frozen engine files (config/story-proof.json engine_files) are
unchanged.
"""
import json
import re
from pathlib import Path

import idea_checks as ic

ROOT = Path(__file__).resolve().parents[2]
LENS = json.loads((ROOT / 'config' / 'lens.json').read_text(encoding='utf-8'))
CODE = 'lens'
RULE = '(Rulings, Krish, 2026-11-27 and 2026-11-28: a mix of businesses and creators, layered where it can be, and what AI changes under the hood; config/lens.json)'

BUSINESS = ic.keyword_pattern(LENS.get('business_keywords'))
CREATOR = ic.keyword_pattern(LENS.get('creator_keywords'))
NOT_WHEN = ic.keyword_pattern(LENS.get('not_when'))
_NOT_BUSINESS = {str(e).lower() for e in LENS.get('not_business_entities') or []}
ENTITIES = [str(e) for row in ic.BEAT['focus_sectors'] for e in row.get('entities') or [] if str(e).lower() not in _NOT_BUSINESS]


def _bare(text):
    """Some words with the lens's exception phrases taken out first ('neural network' is not a network business)."""
    return NOT_WHEN.sub(' ', str(text or ''))


def business_backed(text):
    """Whether some words name a business: a business word from the lens row or a named company, body, platform,
    league or venue of the focus sectors (creator tools, single creators and events left out)."""
    text = _bare(text)
    return bool(BUSINESS.search(text)) or any(ic.mentions(e, text) for e in ENTITIES)


def creator_led(text):
    """Whether some words lead on a person who makes the work: creator words from the lens row at least as many as its
    business words and named businesses. A story about a business paying its writers names both, the business more."""
    text = _bare(text)
    creators = len(CREATOR.findall(text))
    business = len(BUSINESS.findall(text)) + sum(1 for e in ENTITIES if ic.mentions(e, text))
    return creators > 0 and creators >= business


SUBJECTS = ('business', 'creator', 'both')


def creator_named(text):
    """Whether some words name a person who makes the work: a creator word from the lens row."""
    return bool(CREATOR.search(_bare(text)))


def names(who, text):
    """Whether a story names its who, case-blind and as whole words."""
    return bool(who) and re.search(r'(?<![A-Za-z0-9])' + re.escape(who) + r'(?![A-Za-z0-9])', str(text or ''), re.I) is not None


def story_text(o):
    """What a hero says it is about, in its own words: its topic, its story, its fact and its so-what."""
    return ' '.join(str(p) for p in (ic.option_topic(o, True), o.get('story'), o.get('fact'), o.get('so_what')) if p)


def his(o):
    """An option that is his: placed from his Inspiration tick, or from his own words."""
    return bool(o.get('from_inspiration')) or o.get('source_kind') == 'his'


def _mix_line(where, kinds, need, ref_list):
    """The mix line for a day short of either side, or None. A layered option (both) counts on each side."""
    sides = {'business': len(kinds['business']) + len(kinds['both']), 'creator': len(kinds['creator']) + len(kinds['both'])}
    short = [k for k in ('business', 'creator') if sides[k] < need]
    if not short:
        return None
    counts = ', '.join(f'{len(kinds[k])} {k}' for k in ('business', 'creator', 'both'))
    want = ' and '.join(f'at least {need} with a {k} side' for k in short)
    return (f'is not a mix: {counts} ({", ".join(ref_list) or "none labelled"}); it needs {want}, and a layered story '
            f'(both) counts on each side (Ruling, Krish, 2026-11-28: "I want a mix, not a lean."; config/lens.json)')


def lens_findings(ideas, week, status=None, before=None, cfg=None):
    """The lens gate lines (code lens), each {code, ref, line}. A day with an answered option is his and is never
    checked, as wildcard_findings does, so a board he already pressed is never asked to change."""
    cfg = cfg or LENS
    if not cfg or str(week) < str(cfg.get('from') or '9999'):
        return []
    had = ic.keys_on(before) if before is not None else None
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    min_each = int(cfg.get('min_each_per_day', 2))
    min_off = int(cfg.get('min_each_offday', 1))
    min_words = int(cfg.get('under_the_hood_min_words', 8))
    max_chars = int(cfg.get('under_the_hood_max_chars', 240))
    out = []

    def say(ref, line):
        out.append({'code': CODE, 'ref': ref, 'line': f'{CODE}: {ref} {line}'})

    def labelled(ref, o, main):
        """The option's subject when its lens holds, else None (each fault said)."""
        lens = o.get('lens')
        if not isinstance(lens, dict) or lens.get('subject') not in SUBJECTS:
            say(ref, f'has no lens: write lens {{subject: business, creator or both, who{", under_the_hood" if main else ""}}} {RULE}')
            return None
        topic = ic.option_topic(o, main)
        words = story_text(o) if main else ' '.join(p for p in (topic, ic.offday_words(o)) if p)
        who = str(lens.get('who') or '').strip()
        if not who:
            say(ref, 'has no lens.who: the business or the person the story is about, by name')
        elif not names(who, words):
            say(ref, f'names "{who}" as its lens.who, but its words never do')
        if main:
            hood = str(lens.get('under_the_hood') or '').strip()
            if len(hood.split()) < min_words:
                say(ref, f'has no lens.under_the_hood of {min_words} words or more: one plain line of what AI changes in how '
                         'the work is made, sold, priced, licensed or paid for')
            elif '\n' in hood or len(hood) > max_chars:
                say(ref, f'has a lens.under_the_hood longer than one line ({max_chars} characters at most)')
            elif ic.norm(hood) == ic.norm(o.get('so_what') or ''):
                say(ref, 'repeats its so_what as lens.under_the_hood: say what changes in how the work is made or paid for')
        if lens['subject'] == 'both' and not creator_named(words):
            # A layered story carries the business and the people who make the work; with no creator in it, it is a
            # business story.
            say(ref, 'says it is both, but its words name no creator, artist or performer beside the business; label it '
                     f'business, or bring in the people whose work it changes {RULE}')
            return 'business' if business_backed(topic) else None
        if lens['subject'] in ('business', 'both'):
            if not business_backed(topic):
                say(ref, f'says it is about a business{" and its creators" if lens["subject"] == "both" else ""}, but what it '
                         'leads on (its question, headline, hook and first sentence) names no company, label, studio, platform, '
                         f'club, league or market, so it is creator-led {RULE}')
                return 'creator'
            if lens['subject'] == 'business' and creator_led(topic) and not business_backed(who):
                say(ref, f'says it is about a business, but it leads on a creator and its lens.who "{who}" is not a business; '
                         f'label it creator, or lead on the business {RULE}')
                return 'creator'
        return lens['subject']

    for day in ('mon', 'wed', 'fri'):
        opts = [(n, o) for n, o in enumerate(days.get(day) or [], 1) if isinstance(o, dict)]
        if not opts or any(not ic.option_open(ic.status_key(day, True, o), status, had) for _n, o in opts):
            continue
        kinds = {'business': [], 'creator': [], 'both': []}
        engine = [(n, o) for n, o in opts if not his(o)]
        for n, o in engine:
            # The option's id beside its place, as story_findings labels it, so a re-run of some days keeps the line.
            ref = f'{day}-{n} ({str(o.get("id") or "")[:8]})'
            kind = labelled(ref, o, True)
            if kind:
                kinds[kind].append(ref)
        line = _mix_line(day, kinds, min(min_each, len(engine) // 2), kinds['business'] + kinds['creator'] + kinds['both'])
        if line:
            say(day, line)

    for day, opts in offdays.items():
        opts = [o for o in opts if isinstance(o, dict)] if isinstance(opts, list) else []
        if any(not ic.option_open(ic.status_key(day, False, o), status, had) for o in opts):
            continue
        explainers = [o for o in opts if o.get('kind') == 'explainer' and not his(o) and not o.get('weekly')]
        kinds = {'business': [], 'creator': [], 'both': []}
        for o in explainers:
            ref = f'off-{day}-{o.get("id")}'
            kind = labelled(ref, o, False)
            if kind:
                kinds[kind].append(ref)
        line = _mix_line(day, kinds, min(min_off, len(explainers) // 2), kinds['business'] + kinds['creator'] + kinds['both'])
        if line:
            say(f'off-{day}-explainers', line)
    return out
