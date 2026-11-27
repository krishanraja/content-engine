"""Businesses first, and under the hood: the lens gate on the Sunday ideas board.

Ruling (Krish, 2026-11-27): "My ideas board has become a little bit too focused on individual creators and not enough
on what it was before, which is businesses and, under the hood, how AI is changing things."

From the lens's `from` board every open Monday, Wednesday and Friday option says which way it faces (lens.subject,
business or creator), who it is about (lens.who, named in its story) and what AI changes in how that business works
(lens.under_the_hood, one plain line that is not its so-what). A business subject leads on a business word or a named
business in what it leads on (its question, headline, hook and first sentence), and one whose creator words are at least as
many as its business words holds only when its who is itself a business. No open hero day has more creator-led options than the row allows. An option from
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
RULE = '(Ruling, Krish, 2026-11-27: businesses first, and how AI is changing them under the hood; config/lens.json)'

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


def names(who, text):
    """Whether a story names its who, case-blind and as whole words."""
    return bool(who) and re.search(r'(?<![A-Za-z0-9])' + re.escape(who) + r'(?![A-Za-z0-9])', str(text or ''), re.I) is not None


def story_text(o):
    """What a hero says it is about, in its own words: its topic, its story, its fact and its so-what."""
    return ' '.join(str(p) for p in (ic.option_topic(o, True), o.get('story'), o.get('fact'), o.get('so_what')) if p)


def his(o):
    """An option that is his: placed from his Inspiration tick, or from his own words."""
    return bool(o.get('from_inspiration')) or o.get('source_kind') == 'his'


def lens_findings(ideas, week, status=None, before=None, cfg=None):
    """The lens gate lines (code lens), each {code, ref, line}. A day with an answered option is his and is never
    checked, as wildcard_findings does."""
    cfg = cfg or LENS
    if not cfg or str(week) < str(cfg.get('from') or '9999'):
        return []
    had = ic.keys_on(before) if before is not None else None
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    cap = int(cfg.get('max_creator_led_per_day', 1))
    min_words = int(cfg.get('under_the_hood_min_words', 8))
    max_chars = int(cfg.get('under_the_hood_max_chars', 240))
    out = []

    def say(ref, line):
        out.append({'code': CODE, 'ref': ref, 'line': f'{CODE}: {ref} {line}'})

    for day in ('mon', 'wed', 'fri'):
        opts = [(n, o) for n, o in enumerate(days.get(day) or [], 1) if isinstance(o, dict)]
        if not opts or any(not ic.option_open(ic.status_key(day, True, o), status, had) for _n, o in opts):
            continue
        creators = []
        for n, o in opts:
            if his(o):
                continue
            # The option's id beside its place, as story_findings labels it, so a re-run of some days keeps the line.
            ref = f'{day}-{n} ({str(o.get("id") or "")[:8]})'
            lens = o.get('lens')
            if not isinstance(lens, dict) or lens.get('subject') not in ('business', 'creator'):
                say(ref, f'has no lens: write lens {{subject: business or creator, who, under_the_hood}} {RULE}')
                continue
            topic = ic.option_topic(o, True)
            who = str(lens.get('who') or '').strip()
            if not who:
                say(ref, 'has no lens.who: the business or the person the story is about, by name')
            elif not names(who, story_text(o)):
                say(ref, f'names "{who}" as its lens.who, but its story never does')
            hood = str(lens.get('under_the_hood') or '').strip()
            if len(hood.split()) < min_words:
                say(ref, f'has no lens.under_the_hood of {min_words} words or more: one plain line of what AI changes in how '
                         'the business works (how the work is made, sold, priced, licensed or paid for)')
            elif '\n' in hood or len(hood) > max_chars:
                say(ref, f'has a lens.under_the_hood longer than one line ({max_chars} characters at most)')
            elif ic.norm(hood) == ic.norm(o.get('so_what') or ''):
                say(ref, 'repeats its so_what as lens.under_the_hood: say what changes in how the business works')
            if lens['subject'] == 'creator':
                creators.append(ref)
            elif not business_backed(topic):
                say(ref, 'says it is about a business, but what it leads on (its question, headline, hook and first sentence) '
                         f'names no company, label, studio, platform, club, league or market, so it is creator-led {RULE}')
            elif creator_led(topic) and not business_backed(who):
                say(ref, f'says it is about a business, but it leads on a creator and its lens.who "{who}" is not a business; '
                         f'label it creator, or lead on the business {RULE}')
        if len(creators) > cap:
            say(day, f'has {len(creators)} options led by one creator or one creator tool ({", ".join(creators)}); at most '
                     f'{cap} a day. Replace the rest with a business and how AI is changing it under the hood {RULE}')
    return out
