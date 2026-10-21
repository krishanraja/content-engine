"""Publishing materials may be available before a piece passes its readiness gates.

This card never changes a day's state or records a making step. Its source travels
with the board so ordinary rebuilds keep the downloads and their explicit holds.
"""
import html
import json
import re
from urllib.parse import urlparse


def validate(data, piece):
    if not isinstance(data, dict) or data.get('piece_id') != piece:
        raise ValueError('Publishing materials must belong to this day\'s piece')
    if data.get('status') not in ('ready', 'review') or not data.get('note'):
        raise ValueError('Publishing materials require an explicit status and note')
    sections = data.get('sections')
    if not isinstance(sections, list) or not sections:
        raise ValueError('Publishing materials require sections')
    seen = set()
    for section in sections:
        sid = section.get('id', '')
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,60}', sid) or sid in seen:
            raise ValueError('Publishing material section IDs must be unique stable slugs')
        seen.add(sid)
        if not section.get('title'):
            raise ValueError('Publishing material sections require a title')
        for item in section.get('files', []):
            url = item.get('url', '')
            parsed = urlparse(url)
            if not item.get('label') or not (parsed.scheme == 'https' and parsed.netloc or
                                            url.startswith('/api/board/')):
                raise ValueError('Publishing materials require labelled HTTPS or board asset links')
        for item in section.get('copy', []):
            if not item.get('label') or not isinstance(item.get('text'), str) or not item['text'].strip():
                raise ValueError('Publishing copy requires a label and nonempty text')
    for ref, text in data.get('copy_updates', {}).items():
        if not re.fullmatch(r'(mon|wed|fri)-c[0-9]+', ref) or not isinstance(text, str) or not text.strip():
            raise ValueError('Copy updates require an existing day copy ID and nonempty text')
    return data


def update_copy(panel, day, data):
    """Refresh an existing copy box without losing its stable comment anchor."""
    for ref, text in data.get('copy_updates', {}).items():
        if not ref.startswith(day + '-'):
            raise ValueError('Copy updates cannot cross days')
        pattern = r'(<pre\b[^>]*\bid="' + re.escape(ref) + r'"[^>]*>).*?</pre>'
        def replace(match):
            opening = re.sub(r'\sdata-raw="[^"]*"', '', match[1])
            return opening[:-1] + f' data-raw="{html.escape(text, quote=True)}">{html.escape(text)}</pre>'
        panel, count = re.subn(pattern, replace, panel, flags=re.S)
        if count != 1:
            raise ValueError(f'Copy update target {ref} is missing or ambiguous')
    return panel


def previous(page):
    """The materials a board carries, by day: from its own card, or from a made day's Download first (render_group)."""
    return {day: json.loads(html.unescape(raw)) for day, raw in re.findall(
        r'<div class="(?:rec|dl-group mat)" id="(mon|wed|fri)-materials" data-materials="([^"]*)"', page)}


def render_group(day, data):
    """The same materials inside a made day's Download first, on boards in the fixed layout (week_board.py
    run_sheet): each file one big button in the day's one list of downloads, the copy beside it, under the ids
    render() gives them, so a rebuild (previous) and a copy refresh (update_copy) still find them."""
    e = html.escape
    parts = [f'<div class="dl-group mat" id="{day}-materials" data-materials="{e(json.dumps(data), quote=True)}">',
             f'<h3 class="dl-h">Prepared for this piece: {"on a review hold" if data["status"] == "review" else "ready"}</h3>',
             f'<p class="dl-note">{e(data["note"])}</p>']
    for section in data['sections']:
        sid = f'{day}-materials-{section["id"]}'
        parts += [f'<section class="sec" id="{sid}"><h4 class="dl-sub">{e(section["title"])}</h4>']
        if section.get('note'):
            parts += [f'<p class="dl-note">{e(section["note"])}</p>']
        if section.get('files'):
            parts += ['<ol class="dl-list">']
            for item in section['files']:
                parts += [f'<li class="dl-item" data-dl="material"><a class="btnlink dl-btn" href="{e(item["url"], quote=True)}" '
                          f'target="_blank" rel="noopener">{e(item["label"])}</a></li>']
            parts += ['</ol>']
        for i, item in enumerate(section.get('copy', [])):
            cid = f'{sid}-copy-{i}'
            parts += [f'<div class="card"><div class="row"><span class="lab">{e(item["label"])}</span><div class="btns">'
                      f'<button type="button" data-act="text" data-ref="{cid}">Copy</button></div></div>',
                      f'<pre class="txt" id="{cid}" data-raw="{e(item["text"], quote=True)}">{e(item["text"])}</pre>',
                      '<div class="status" aria-live="polite"></div></div>']
        parts += ['</section>']
    return ''.join(parts) + '</div>'


def render(day, data):
    e = html.escape
    parts = [f'<div class="rec" id="{day}-materials" data-materials="{e(json.dumps(data), quote=True)}">',
             '<div class="rec-head"><h2>Publishing files and copy</h2>',
             f'<span class="kick">{"Review hold" if data["status"] == "review" else "Files prepared"}</span></div>',
             f'<p class="rec-how">{e(data["note"])}</p>']
    for section in data['sections']:
        sid = f'{day}-materials-{section["id"]}'
        parts += [f'<section class="sec" id="{sid}"><div class="sec-head"><h3>{e(section["title"])}</h3></div>']
        if section.get('note'):
            parts += [f'<p>{e(section["note"])}</p>']
        parts += ['<div class="btns">']
        for item in section.get('files', []):
            parts += [f'<a class="btnlink" href="{e(item["url"], quote=True)}" target="_blank" rel="noopener">{e(item["label"])}</a>']
        parts += ['</div>']
        for i, item in enumerate(section.get('copy', [])):
            cid = f'{sid}-copy-{i}'
            parts += [f'<div class="card"><div class="lab">{e(item["label"])}</div>',
                      f'<div class="btns"><button type="button" data-act="text" data-ref="{cid}">Copy {e(item["label"])}</button></div>',
                      f'<pre class="txt" id="{cid}" data-raw="{e(item["text"], quote=True)}">{e(item["text"])}</pre>',
                      '<div class="status" aria-live="polite"></div></div>']
        parts += ['</section>']
    return ''.join(parts) + '</div>'
