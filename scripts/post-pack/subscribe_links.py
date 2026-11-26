#!/usr/bin/env python3
"""subscribe_links: the tagged links content-engine writes into finished words, built exactly as Growth builds them.

Ruling (Krish, 2026-11-26): content-engine makes every asset, the per-channel words included, so the subscribe line a
post ends on is written here at make time and Growth posts the words as they are. Growth still owns the route itself
(growth-makeyourmindup specs/subscribe-route.json and engine/route.py); this mirrors its three builders:

    subscribe_url(channel, content)          route.subscribe_url: the subscribe page, all four tags, utm_medium social
    item_content(item, channel)               route.item_content: content_of(<board item id>-<channel>)
    edition_url(saturday, place, target=None) route.edition_url (growth PR 144): the weekly edition's own tags

The route's shape comes from vendor/makeyourmindup/subscribe-route.json (Growth's file, vendored byte for byte) when it
is on the checkout, else from config/subscribe-links.json. The vendored copy on main predates the weekly edition's
`edition` block; content-engine PR 979 brings it, and until then that block comes from the contract shape in
config/subscribe-links.json (the shared edition-contract.md, 25 Nov 2026). Offline only:
no network, no credentials; nothing here posts, sends or spends.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
import re
from urllib.parse import parse_qsl, urlencode, urlsplit

ROOT = Path(__file__).resolve().parents[2]
VENDORED = ROOT / 'vendor' / 'makeyourmindup' / 'subscribe-route.json'
CONTRACT = ROOT / 'config' / 'subscribe-links.json'


def config():
    """The contract file: lines, places and the shape used until the vendored copy lands."""
    return json.loads(CONTRACT.read_text(encoding='utf-8'))


def spec(vendored=VENDORED):
    """The route's shape: Growth's vendored file when present (its own keys win), else the contract."""
    base = config()
    if Path(vendored).is_file():
        grown = json.loads(Path(vendored).read_text(encoding='utf-8'))
        return {**base, **{k: grown[k] for k in ('page', 'medium', 'campaign', 'utm_content_pattern', 'sources',
                                                  'profile_link_channels', 'edition') if k in grown},
                'from': 'vendor/makeyourmindup/subscribe-route.json'
                        + ('' if 'edition' in grown else ' (its edition block from config/subscribe-links.json until PR 979)')}
    return {**base, 'from': 'config/subscribe-links.json'}


def _content_re(s):
    return re.compile(s['utm_content_pattern'])


def content_of(post_id, s=None):
    """A slot or post id as utm_content: lower case, each run of other characters one -, no leading - or _, at most 64."""
    s = s or spec()
    content = re.sub(r'[^a-z0-9_-]+', '-', str(post_id).strip().lower()).lstrip('-_')[:64]
    if not _content_re(s).match(content):
        raise ValueError('utm_content needs a slot or post id with a letter or digit')
    return content


def subscribe_url(channel, content, s=None):
    """The tagged subscribe page for one post on one channel (route.subscribe_url)."""
    s = s or spec()
    if channel not in s['sources']:
        raise ValueError('not one of the pinned channels: ' + str(channel))
    content = str(content).strip().lower()
    if not _content_re(s).match(content):
        raise ValueError('utm_content must be a post or slot id: lower case letters, digits, - and _, at most 64')
    return s['page'] + '?' + urlencode([('utm_source', channel), ('utm_medium', s['medium']),
                                        ('utm_campaign', s['campaign']), ('utm_content', content)])


def item_content(item, channel, s=None):
    """utm_content for a board item's post on one channel (route.item_content)."""
    s = s or spec()
    if channel not in s['sources']:
        raise ValueError('not one of the pinned channels: ' + str(channel))
    content = content_of(str(item) + '-' + channel, s)
    if not content.endswith('-' + channel):
        raise ValueError('a board item id that long would lose its channel: at most 64 characters in all')
    return content


def edition_content(saturday, place, s=None):
    """edition-<the Saturday>-<place>, or ValueError for any other date or place."""
    s = s or spec()
    text = saturday.isoformat()[:10] if isinstance(saturday, dt.date) else str(saturday)
    if not re.match(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}$', text):
        raise ValueError('the edition date is YYYY-MM-DD, not ' + text)
    try:
        day = dt.date.fromisoformat(text)
    except ValueError:
        raise ValueError('the edition date is not a real date: ' + text) from None
    if day.weekday() != 5:
        raise ValueError('the edition date is the Saturday it goes out, not ' + day.strftime('%A ') + text)
    if place not in s['edition']['places']:
        raise ValueError('not one of the edition places (' + ', '.join(s['edition']['places']) + '): ' + str(place))
    content = 'edition-' + text + '-' + place
    if not re.match(s['edition']['utm_content_pattern'], content):
        raise ValueError('not an edition utm_content: ' + content)
    return content


def edition_url(saturday, place, target=None, s=None):
    """One link in the weekly edition with its four tags (route.edition_url): a subscribe place to the one page, a
    piece or video place to the piece's own https address on the page's host; note goes to either."""
    s = s or spec()
    e = s['edition']
    content = edition_content(saturday, place, s)
    tags = [('utm_source', e['utm_source']), ('utm_medium', e['utm_medium']), ('utm_campaign', e['utm_campaign']),
            ('utm_content', content)]
    if target is None:
        if place in s['edition_target_places']:
            raise ValueError('a ' + place + ' link goes to the piece\'s own address: pass it as target')
        return s['page'] + '?' + urlencode(tags)
    if place in s['edition_page_places']:
        raise ValueError('a ' + place + ' link goes to the one subscribe page, never to another address')
    host = urlsplit(s['page']).hostname
    try:
        parts = urlsplit(str(target))
        port = parts.port
    except ValueError:
        raise ValueError('the piece address is not a URL: ' + str(target)) from None
    if (parts.scheme != 'https' or (parts.hostname or '').lower() != host or parts.username or parts.password
            or port is not None or not parts.path.strip('/')):
        raise ValueError('a piece link goes to the piece\'s own https address on ' + host + ', not ' + str(target))
    query = parse_qsl(parts.query, keep_blank_values=True)
    if any(key.lower().startswith('utm_') for key, _ in query):
        raise ValueError('the piece address already carries a utm_ tag; pass it without one')
    link = 'https://' + parts.netloc + parts.path + '?' + urlencode(query + tags)
    return link + ('#' + parts.fragment if parts.fragment else '')


def tags_of(url):
    """{utm tag: value} of a link, for checks."""
    return {k: v for k, v in parse_qsl(urlsplit(url).query) if k.startswith('utm_')}


def route_line(channel, content, s=None):
    """The subscribe line a post on `channel` ends on: the tagged link, the profile line on a profile-link channel, or
    None on a channel only Krish posts by hand (LinkedIn)."""
    s = s or spec()
    lines = s['lines']
    if channel in s['krish_click_only']:
        return None
    if channel in s['profile_link_channels']:
        return lines['profile']
    return lines['subscribe'].format(url=subscribe_url(channel, content, s))
