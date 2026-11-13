"""A day's publishing materials: the shape the overnight run and the joins reel file on the piece (a status, a note,
sections of labelled files and copy), checked by validate(). The live board's day shows what is filed on the piece
(docs/PUBLISH_BOARDS.md, "Sessions and materials"). It never changes a day's state or records a making step. The old
board's materials card that drew this shape was retired with the old boards (Ruling, Krish, 2026-11-13).
"""
import re
from urllib.parse import urlparse

# The Download first rows a material file may stand in for while the making record has no cut for it. The record wins
# whenever it has the cut; the day's state never changes.
FILLS = ('video-long', 'video-short', 'video-feature', 'thumb-long', 'thumb-short', 'thumb-feature')


def validate(data, piece):
    if not isinstance(data, dict) or data.get('piece_id') != piece:
        raise ValueError('Publishing materials must belong to this day\'s piece')
    if data.get('status') not in ('ready', 'review') or not data.get('note'):
        raise ValueError('Publishing materials require an explicit status and note')
    sections = data.get('sections')
    if not isinstance(sections, list) or not sections:
        raise ValueError('Publishing materials require sections')
    seen, filled = set(), set()
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
            preview = item.get('preview')
            if preview and not (isinstance(preview, str) and preview.startswith('data:image/jpeg;base64,')):
                raise ValueError('Publishing material previews must be embedded JPEG images')
            fills = item.get('fills')
            if fills is not None and (fills not in FILLS or fills in filled):
                raise ValueError(f'A publishing material fills one of {", ".join(FILLS)}, each once')
            if fills:
                filled.add(fills)
        for item in section.get('copy', []):
            if not item.get('label') or not isinstance(item.get('text'), str) or not item['text'].strip():
                raise ValueError('Publishing copy requires a label and nonempty text')
    for ref, text in data.get('copy_updates', {}).items():
        if not re.fullmatch(r'(mon|wed|fri)-c[0-9]+', ref) or not isinstance(text, str) or not text.strip():
            raise ValueError('Copy updates require an existing day copy ID and nonempty text')
    return data
