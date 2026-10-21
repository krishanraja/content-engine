#!/usr/bin/env python3
"""check:board-layout: the publish board keeps its one fixed layout, and only the engine draws it.

Krish, 2026-10-21: "Once that's all done the rest of the content engine needs to know how to feed it and not be
permitted to change random parts of the UI and UX but feed it in the right way consistently. That applies to Claude
and to Codex." Hooks stop a Claude session; this check stops everything else, Codex included, because CI runs it on
every pull request (npm run verify).

    python3 scripts/check_board_layout.py            # the checks
    python3 scripts/check_board_layout.py --browser  # also: no sideways scroll and 44px targets at 390px (Playwright)
    python3 scripts/check_board_layout.py --update   # rewrite the layout snapshot (only with Krish: board-ui-guard)

1. Three fed weeks (empty, Sunday's ideas, mid-week) build, pass week_board.verify(), and have exactly the structure
   recorded in fixtures/week-board/fixed-layout.json: the tabs, each day's steps, and what sits in each step.
2. Nothing but the board's own builders stamps a board: a script that patches a built board and stamps it again is
   how the layout drifted before (docs/plans/2026-10-19-*). The three that did it are named and frozen.
3. --browser: at 390px wide no tab scrolls sideways and every button, link button, tick and tab is at least 44px tall.
"""
import argparse
import json
import re
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import week_board as wb  # noqa: E402
import title_check  # noqa: E402

SNAPSHOT = ROOT / 'fixtures' / 'week-board' / 'fixed-layout.json'
# The board's builders, its gate and its tests may stamp a page; nothing else.
STAMPERS = {'scripts/post-pack/week_board.py', 'scripts/post-pack/board_web.py', 'scripts/post-pack/publish_manager.py',
            'scripts/post-pack/engine_stamp.py', 'scripts/hooks/artifact_gate.py', 'scripts/check_board_layout.py',
            'tests/board_web_test.py', 'tests/engine-gates.test.ts'}
# Written before the fixed layout, each patching a built board by hand; kept as history, never a pattern.
FROZEN = {'docs/plans/2026-10-19-monday/build_release_board.py', 'docs/plans/2026-10-19-week/update_wednesday.py',
          'docs/plans/2026-10-19-board-delivery/build_boards.py', 'docs/plans/2026-10-19-week/update_wednesday_21oct.py'}
TITLE = 'Warner sued Suno. Now it takes a cut.'


def video(cut, letter, seconds):
    drive = lambda c: f'https://drive.google.com/file/d/{c * 25}/view'
    return {'cut': cut, 'url': drive(letter), 'seconds': seconds, 'thumbnail': {'url': drive(chr(ord(letter) + 1))}}


def weeks(tmp):
    """{name: page} for three fed weeks in the fixed layout."""
    monday = wb.LAYOUT_FROM
    mon = wb.stand_in(tmp, 'mon', TITLE, 'follow.the.money')
    one = lambda k, n: {'so_what': f'What a leader finds out {k}{n}.', 'story': f'The story {k}{n}.', 'why_now': 'This week.',
                        'fact': 'A checked fact.', 'source': {'label': 'Source', 'url': 'https://example.com/source'}}
    ideas = wb.read_ideas({'week_start': monday.isoformat(), 'days': {k: [one(k, n) for n in range(1, 5)] for k, *_ in wb.DAYS}}, monday)
    queue = [{'id': wb.FRI_ID, 'so_what': 'A saved idea.', 'series': 'mind_the_gap', 'triage': {'verdict': 'angle', 'angle': 'who pays'}},
             {'id': wb.WED_ID, 'so_what': 'Another saved idea.', 'series': None, 'triage': None}]
    brief = wb.read_brief({'idea': 'The idea.', 'flow': ['One', 'Two', 'Three'], 'ending': 'The end.', 'takeaway': 'The takeaway.',
                           'angle': 'The angle.', 'tone': 'Warm.', 'reader': 'Leaders at mid-sized firms.', 'agreed': True})
    out = {'empty': wb.board(monday)[0],
           'sunday': wb.board(monday, ideas=ideas, queue=queue)[0],
           'midweek': wb.board(monday, {'mon': mon}, {'mon': wb.MON_ID, 'wed': wb.WED_ID, 'fri': wb.FRI_ID},
                               review={'wed': [('article', 'Article draft', 'Words.'), ('long', 'Five-minute script', 'Said.')]},
                               videos={'mon': [video('long', 'a', 305), video('short', 'c', 86)]},
                               draft={'wed'}, calls={'wed': ['A call to make']}, queue=queue, ideas=ideas,
                               briefs={'wed': brief, 'fri': dict(brief, agreed=False)})[0]}
    return out


def blocks(html):
    """The classes of the top-level blocks in a piece of markup, in order."""
    out, at = [], 0
    while True:
        m = re.compile(r'<(div|section|p|ol|ul|dl|article|label|h[1-3]|nav|pre|button|a)\b([^>]*)>').search(html, at)
        if not m:
            return out
        cls = re.search(r'\sclass="([^"]+)"', m.group(2))
        out.append(f'{m.group(1)}.{cls.group(1)}' if cls else m.group(1))
        tag = m.group(1)
        depth, i = 0, m.start()
        for t in re.finditer(rf'<{tag}\b|</{tag}>', html[m.start():]):
            depth += 1 if not t.group(0).startswith('</') else -1
            if depth == 0:
                i = m.start() + t.end()
                break
        at = i if i > m.start() else m.end()


def structure(page):
    """The layout of a board, as data: each tab, and for each day each step's top-level blocks."""
    out = {'tabs': re.findall(r'role="tab" id="tab-([a-z]+)"', page), 'days': {}}
    for name in wb.TOP_TABS[2:]:
        start = page.rfind('<div', 0, page.find(f'id="panel-{name}"'))
        panel = wb.div_at(page, start)
        day = {}
        for sub in wb.DAY_STEPS:
            s = panel.find(f'<div class="subpanel" role="tabpanel" id="{name[:3]}-sub-{sub}"')
            inner = wb.div_at(panel, s)
            inner = inner[inner.index('>') + 1:-len('</div>')]
            day[sub] = blocks(inner)
        out['days'][name] = day
    return out


def stamp_callers():
    bad = []
    for path in list(ROOT.glob('scripts/**/*.py')) + list(ROOT.glob('docs/**/*.py')) + list(ROOT.glob('apps/**/*.ts')) + list(ROOT.glob('tests/**/*.*')):
        rel = path.relative_to(ROOT).as_posix()
        if rel in STAMPERS or rel in FROZEN or 'node_modules' in rel:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue
        if re.search(r'\bengine_stamp\b', text):
            bad.append(rel)
    return bad


def browser(pages, tmp):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return ['--browser: Python Playwright is not installed (pip install playwright==1.55.0)']
    import board_web
    problems = []
    with sync_playwright() as pw:
        exe = Path('/opt/pw-browsers/chromium')
        b = pw.chromium.launch(**({'executable_path': str(exe)} if exe.exists() else {}))
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route(re.compile(r'^https?://'), lambda r: r.abort())
        for name, html in pages.items():
            web, _ = board_web.web_page(html, {'week_start': wb.LAYOUT_FROM.isoformat()})
            f = Path(tmp) / f'{name}.html'
            f.write_text(web, encoding='utf-8')
            for tab in wb.TOP_TABS:
                views = [f'{tab}/{s}' for s in wb.DAY_STEPS] if tab in wb.TOP_TABS[2:] else [tab]
                for view in views:
                    page.goto(f.as_uri() + '#' + view)
                    page.wait_for_timeout(150)
                    m = page.evaluate('''() => {
                      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 };
                      const small = [...document.querySelectorAll('button,a.btn,a.btnlink,label.tick,label.pick,[role=tab]')].filter(vis)
                        .filter(el => el.getBoundingClientRect().height < 43.5).map(el => (el.textContent || '').trim().slice(0, 30));
                      return { wide: document.documentElement.scrollWidth > document.documentElement.clientWidth, small };
                    }''')
                    if m['wide']:
                        problems.append(f'{name} #{view}: scrolls sideways at 390px')
                    if m['small']:
                        problems.append(f'{name} #{view}: {len(m["small"])} target(s) under 44px: {m["small"][:3]}')
            if name == 'midweek':
                # The steps work by touch: Record opens its panel, closes Publish, says so in the address, and its
                # Copy buttons work.
                page.goto(f.as_uri())
                page.click('#tab-monday')
                page.click('#mon-st-record')
                shown = page.evaluate('''() => [!document.getElementById('mon-sub-record').hidden,
                    document.getElementById('mon-sub-publish').hidden, location.hash]''')
                if shown != [True, True, '#monday/record']:
                    problems.append(f'midweek: tapping Record did not open it alone ({shown})')
                page.locator('#mon-sub-record button[data-act="text"]').first.click()
        if errors:
            problems.append(f'page errors: {errors[:3]}')
        b.close()
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--update', action='store_true')
    ap.add_argument('--browser', action='store_true')
    args = ap.parse_args(argv)
    problems = []
    with tempfile.TemporaryDirectory() as tmp, title_check.picked_for_tests([TITLE], tmp):
        pages = weeks(tmp)
        for name, page in pages.items():
            problems += [f'{name}: {p}' for p in wb.verify(page)]
        got = {name: structure(page) for name, page in pages.items()}
        if args.update:
            SNAPSHOT.write_text(json.dumps({'_about': 'The fixed layout of the publish board, as check_board_layout.py reads it from three '
                                            'fed weeks. A change here is a change to the board Krish works in: only with him.',
                                            'layout_version': wb.LAYOUT['version'], 'weeks': got}, indent=1) + '\n', encoding='utf-8')
            print(f'check:board-layout: wrote {SNAPSHOT.relative_to(ROOT)}')
        else:
            try:
                want = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                want = {}
            if want.get('weeks') != got:
                for name in got:
                    if (want.get('weeks') or {}).get(name) != got[name]:
                        problems.append(f'{name}: the board\'s structure differs from {SNAPSHOT.relative_to(ROOT)}: the layout changed. '
                                        'If Krish approved the change, run with --update and commit the snapshot with his words.')
        if args.browser:
            problems += browser(pages, tmp)
    problems += [f'{rel}: stamps a board outside the board\'s builders (engine_stamp); feed week_board.py instead of patching its page'
                 for rel in stamp_callers()]
    if problems:
        print('check:board-layout FAILED:\n  ' + '\n  '.join(problems))
        return 1
    print('check:board-layout passed: three fed weeks in the fixed layout, nothing else stamps a board'
          + (', and every view fits a phone' if args.browser else ''))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
