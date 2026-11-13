"""The engine's stamp on a page it built, so a page edited by hand, or made
some other way, cannot be published as if the engine made it.

Krish, 2026-10-14: "why are Wednesday and Friday built differently to
Monday? ... I thought I didn't need to keep telling you this sort of stuff?",
then "how are you going to ensure all this stuff ... can never be had again".
The stamp is the sha256 of the page without its stamp line; any change after
the build breaks it. publish_manager.py stamps the publish page it builds
(the board pages that also wore it were retired on 13 Nov 2026).
"""
import hashlib
import re

STAMP = re.compile(r'<meta name="mymu-engine" content="([a-z_]+) sha256=([0-9a-f]{64})">\n')


def stamp(page, kind):
    """The page with the engine's stamp as its first line."""
    page = STAMP.sub('', page)
    digest = hashlib.sha256(page.encode('utf-8')).hexdigest()
    return f'<meta name="mymu-engine" content="{kind} sha256={digest}">\n' + page


def stamp_problem(page, kind):
    """None when the engine built this page and nothing changed it since; else why not."""
    m = STAMP.match(page)
    if not m:
        return f'no engine stamp: this {kind} page was not built by the engine (or was built before the stamp existed); rebuild it with the engine'
    if m.group(1) != kind:
        return f'the stamp says this is a {m.group(1)} page, not a {kind} page'
    if hashlib.sha256(page[m.end():].encode('utf-8')).hexdigest() != m.group(2):
        return f'this {kind} page was changed after the engine built it (a hand edit); rebuild it with the engine instead'
    return None


def self_test():
    page = stamp('<title>T</title>\n<p>x</p>\n', 'publish_page')
    fails = [name for name, ok in [
        ('a fresh stamp passes', stamp_problem(page, 'publish_page') is None),
        ('a hand edit is caught', 'hand edit' in (stamp_problem(page.replace('<p>x', '<p>y'), 'publish_page') or '')),
        ('an unstamped page is caught', 'no engine stamp' in (stamp_problem('<title>T</title>', 'publish_page') or '')),
        ('the wrong kind is caught', 'not a carousel page' in (stamp_problem(page, 'carousel') or '')),
        ('stamping twice keeps one stamp', stamp(page, 'publish_page').count('mymu-engine') == 1),
    ] if not ok]
    print('engine stamp self-test ' + ('FAILED: ' + ', '.join(fails) if fails else 'passed'))
    return 1 if fails else 0


if __name__ == '__main__':
    raise SystemExit(self_test())
