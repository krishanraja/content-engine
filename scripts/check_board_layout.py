#!/usr/bin/env python3
"""check:board-layout: the publish board keeps its one fixed layout, and only the engine draws it.

Krish, 2026-10-21: "Once that's all done the rest of the content engine needs to know how to feed it and not be
permitted to change random parts of the UI and UX but feed it in the right way consistently. That applies to Claude
and to Codex." Then: no approval prompts for board edits; the layout is held by CI and changes only with his recorded
words (Ruling, Krish, 2026-10-21). This check is that lock, for Claude and Codex alike, because CI runs it on every pull
request (npm run verify).

    python3 scripts/check_board_layout.py            # the checks
    python3 scripts/check_board_layout.py --browser  # also: no sideways scroll and 44px targets at 390px (Playwright)
    python3 scripts/check_board_layout.py --update --approved "Krish, YYYY-MM-DD: <his exact words>"
                                                     # rewrite the snapshot, with the words he approved the change in

1. Three fed weeks (empty, Sunday's ideas, mid-week) build, pass week_board.verify(), and have exactly the structure
   recorded in fixtures/week-board/fixed-layout.json: the tabs, each day's steps, and what sits in each step.
2. Nothing but the board's own builders stamps a board: a script that patches a built board and stamps it again is
   how the layout drifted before (docs/plans/2026-10-19-*). The three that did it are named and frozen.
3. The lock: the snapshot also records the sha256 of the layout file and the colours (LOCKED) and the words Krish
   approved the last change in (`approved`). The check fails when either file or the structure differs from the
   snapshot, so a layout change passes CI only once --update has written it with his recorded words.
4. --browser: at 390px wide no tab scrolls sideways and every button, link button, tick and tab is at least 44px tall.
"""
import argparse
import hashlib
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
# The files the layout and its colours are made of, held by their hash: a change to either needs his recorded words.
LOCKED = ('config/board-layout.json', 'scripts/post-pack/tokens.css')
APPROVED = re.compile(r'^Krish, (\d{4}-\d{2}-\d{2}): (\S.{9,})$', re.S)
# The board's builders, its gate and its tests may stamp a page; nothing else.
STAMPERS = {'scripts/post-pack/week_board.py', 'scripts/post-pack/board_web.py', 'scripts/post-pack/publish_manager.py',
            'scripts/post-pack/engine_stamp.py', 'scripts/hooks/artifact_gate.py', 'scripts/check_board_layout.py',
            'tests/board_web_test.py', 'tests/engine-gates.test.ts'}
# Written before the fixed layout, each patching a built board by hand; kept as history, never a pattern.
FROZEN = {'docs/plans/2026-10-19-monday/build_release_board.py', 'docs/plans/2026-10-19-week/update_wednesday.py',
          'docs/plans/2026-10-19-board-delivery/build_boards.py', 'docs/plans/2026-10-19-week/update_wednesday_21oct.py'}
# One-off feeders: a script per day that drives week_board.py with its own mix of inputs. Each one made its day's tab look
# different from the last (Krish, 2026-10-24: "The publish board changes format every single time I look at it"), so
# these are history and no new one may be written: a session feeds the board through week_board.py's own inputs
# (docs/PUBLISH_BOARDS.md, "The fixed layout").
FEEDERS = {
    'docs/plans/2026-10-19-board-delivery/build_boards.py',
    'docs/plans/2026-10-19-board-delivery/verify_live.py',
    'docs/plans/2026-10-19-monday/build_release_board.py',
    'docs/plans/2026-10-19-monday/verify_release.py',
    'docs/plans/2026-10-19-week/update_friday_23oct.py',
    'docs/plans/2026-10-19-week/update_wednesday.py',
    'docs/plans/2026-10-19-week/update_wednesday_21oct.py',
    'docs/plans/2026-10-21-wednesday/feed_board.py',
    'docs/plans/2026-10-21-wednesday/prepare_fact_adjudication.py',
    'docs/plans/2026-10-21-wednesday/prepare_publish.py',
    'docs/plans/2026-10-21-wednesday/readback.py',
    'docs/plans/2026-10-21-wednesday/readback_revision.py',
    'docs/plans/2026-10-21-wednesday/record_fact_adjudication.py',
    'docs/plans/2026-10-21-wednesday/record_playback_acceptance.py',
    'docs/plans/2026-10-21-wednesday/submit_article_revision.py',
}
TITLE = 'Warner sued Suno. Now it takes a cut.'


def video(cut, letter, seconds):
    drive = lambda c: f'https://drive.google.com/file/d/{c * 25}/view'
    return {'cut': cut, 'url': drive(letter), 'seconds': seconds, 'thumbnail': {'url': drive(chr(ord(letter) + 1))}}


def weeks(tmp):
    """{name: page} for three fed weeks in the fixed layout."""
    monday = wb.LAYOUT_FROM
    mon = wb.stand_in(tmp, 'mon', TITLE, 'follow.the.money')
    one = lambda k, n: {'so_what': f'What a leader finds out {k}{n}.', 'story': f'The story {k}{n}.', 'why_now': 'This week.',
                        'fact': 'A checked fact.', 'source': {'label': 'Source', 'url': 'https://example.com/source'},
                        'source_kind': ('his', 'inspo', 'engine', 'engine')[n - 1],
                        'why_here': 'close to your Story mark on "Who pays for a free AI picture"' if n == 2 else None,
                        'beats': ['What happened', 'Why it matters to a leader', 'What they would do']}
    ideas = wb.read_ideas({'week_start': monday.isoformat(), 'days': {k: [one(k, n) for n in range(1, 5)] for k, *_ in wb.DAYS}}, monday)
    queue = [{'id': wb.FRI_ID, 'so_what': 'A saved idea.', 'series': 'mind_the_gap', 'triage': {'verdict': 'angle', 'angle': 'who pays'}},
             {'id': wb.WED_ID, 'so_what': 'Another saved idea.', 'series': None, 'triage': None}]
    combine = wb.read_combine([{'members': [wb.FRI_ID, wb.WED_ID], 'series': 'mind_the_gap', 'thesis': 'Two saved ideas make one argument.',
                                'joins': ['The first idea', 'What links them', 'The bigger point']}], queue)
    brief = wb.read_brief({'idea': 'The idea.', 'flow': ['One', 'Two', 'Three'], 'ending': 'The end.', 'takeaway': 'The takeaway.',
                           'angle': 'The angle.', 'tone': 'Warm.', 'reader': 'Leaders at mid-sized firms.', 'agreed': True})
    # The Drafts step fed in full: what his saved edit carried (Also changed), and what was learned from his edits.
    sweep = wb.read_sweep({'day': 'wed', 'piece_id': wb.WED_ID,
                           'also_changed': [{'id': 's1', 'where': 'Wednesday, Five-minute script', 'kind': 'number_fact',
                                             'from': '40 percent', 'to': '38 percent', 'context': 'About 38 percent of firms pay.'}],
                           'suggestions': [{'id': 't1', 'where': 'Friday, Article', 'kind': 'tone', 'from': 'really cheap', 'to': 'cheap'}],
                           'held': [{'where': 'Wednesday, 90-second script', 'why': 'you have recorded it'}],
                           'gates': [{'where': 'Wednesday, Five-minute script', 'check': 'story_check', 'ok': True, 'problems': []}]})
    lessons = wb.read_lessons([{'id': 'lesson-1', 'assertion': 'On the publish board Krish made 3 number or fact edits in 28 days.',
                                'evidence_count': 3, 'kind': 'number_fact', 'status': 'proposed'}])
    # Krish's presses (Krish, 2026-10-28): the off days on Sunday, and Titles, Approve scripts, Approve for publish and
    # Reject asset in the week.
    opt = lambda k, n: {'id': f'o{n}', 'format': ('meme', 'news carousel', 'level-up move')[n - 1], 'source': 'A cue',
                        'copy': f'The draft copy for {k} option {n}.'}
    offdays = wb.read_offdays({k: [opt(k, n) for n in (1, 2)] for k, *_ in wb.OFF_DAYS})
    titles = {'wed': wb.read_titles({'piece_id': wb.WED_ID, 'long_title': ['Who pays for a free AI picture', 'Free AI pictures are not free'],
                                     'short_title': ['Who pays?'], 'long_thumbnail': ['WHO PAYS'], 'short_thumbnail': ['WHO PAYS']})}
    out = {'empty': wb.board(monday)[0],
           'sunday': wb.board(monday, ideas=ideas, queue=queue, combine=combine, offdays=offdays)[0],
           'midweek': wb.board(monday, {'mon': mon}, {'mon': wb.MON_ID, 'wed': wb.WED_ID, 'fri': wb.FRI_ID},
                               review={'wed': [('article', 'Article draft', '# The heading\n\nWords.\n\nMore words here.'),
                                               ('long', 'Five-minute script', 'Said.')]},
                               videos={'mon': [video('long', 'a', 305), video('short', 'c', 86)]},
                               draft={'wed'}, calls={'wed': ['A call to make']}, queue=queue, ideas=ideas,
                               briefs={'wed': brief, 'fri': dict(brief, agreed=False)}, sweeps={'wed': sweep}, lessons=lessons,
                               titles=titles, manifests={'mon': 'd' * 64})[0]}
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
    # The Ideas and Queue tabs are fed too: what one idea card holds, and the Queue tab's top-level blocks (with a
    # Could combine card when there is one).
    card = re.search(r'<article class="id-card".*?</article>', page, re.S)
    if card:
        out['idea_card'] = blocks(card.group(0)[card.group(0).index('>') + 1:-len('</article>')])
    start = page.rfind('<div', 0, page.find('id="panel-queue"'))
    queue = wb.div_at(page, start)
    out['queue'] = blocks(queue[queue.index('>') + 1:-len('</div>')])
    combo = re.search(r'<article class="q-combo".*?</article>', queue, re.S)
    if combo:
        out['combine_card'] = blocks(combo.group(0)[combo.group(0).index('>') + 1:-len('</article>')])
    # The off days on the Ideas tab, and what one option holds (Krish, 2026-10-28).
    off = re.search(r'<section class="off-days".*?</section>', page, re.S)
    if off:
        out['offdays'] = blocks(off.group(0)[off.group(0).index('>') + 1:-len('</section>')])
    card = re.search(r'<article class="off-card".*?</article>', page, re.S)
    if card:
        out['offday_card'] = blocks(card.group(0)[card.group(0).index('>') + 1:-len('</article>')])
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
                problems += editor_in_browser(page, web)
            if name == 'sunday':
                # His Combine tap saves queue/combine-1 through the board API, with its members (Krish, 2026-10-21:
                # nothing in the queue is combined without his word; the tap is that word).
                week = wb.LAYOUT_FROM.isoformat()
                saved = []

                def api(route):
                    req = route.request
                    path = req.url.split('board.test', 1)[1].split('?')[0]
                    if path == '/sunday.html':
                        return route.fulfill(status=200, content_type='text/html', body=web)
                    if req.method == 'PUT':
                        body = json.loads(req.post_data or '{}').get('body')
                        saved.append((path, body))
                        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'revision': 1, 'body': body}))
                    # A stale combine-1 from another group: its tap must not show on this card.
                    stale = [{'id': 'combine-1', 'revision': 1, 'updated_by': 'Krish',
                              'body': {'combine': True, 'pick': 'combine-1', 'members': [wb.MON_ID, wb.WED_ID]}}]
                    answer = ({'ok': True, 'weeks': [week]} if path == '/api/board/weeks' else
                              {'ok': True, 'documents': stale if path == f'/api/board/{week}/queue' else [], 'next_offset': None})
                    return route.fulfill(status=200, content_type='application/json', body=json.dumps(answer))
                page.route(re.compile(r'^https://board\.test/'), api)
                page.goto('https://board.test/sunday.html#queue')
                page.wait_for_timeout(300)
                state = page.evaluate('''() => { const b = document.querySelector('[data-act="combine"][data-for="combine-1"]');
                    return [b.disabled, b.textContent, document.getElementById('combine-1').classList.contains('on')] }''')
                if state != [False, 'Combine these', False]:
                    problems.append(f'sunday: a tap saved for other ideas shows as asked on this Combine card ({state})')
                else:
                    page.click('[data-act="combine"][data-for="combine-1"]')
                    page.wait_for_timeout(300)
                    hit = [b for p, b in saved if p == f'/api/board/{week}/queue/combine-1']
                    if (not hit or hit[0].get('combine') is not True or hit[0].get('pick') != 'combine-1'
                            or sorted(hit[0].get('members') or []) != sorted([wb.FRI_ID, wb.WED_ID])):
                        problems.append(f'sunday: tapping Combine did not save queue/combine-1 with its members ({saved})')
                page.unroute(re.compile(r'^https://board\.test/'))
                problems += presses_in_browser(page, web)
            if name == 'midweek':
                problems += decisions_in_browser(page, web)
        if errors:
            problems.append(f'page errors: {errors[:3]}')
        b.close()
    return problems


def text_once(page, selector, prefix, timeout_ms=5000):
    """The element's text once it starts with prefix, or as it stands when the wait runs out, read once. A fixed 400 ms
    pause raced the save on a slow CI runner (28 October 2026, PR 208): the bar was read before it said Saved, and the
    failure message, which read it again, showed 'Saved'."""
    try:
        page.wait_for_function(
            '([s, p]) => { const e = document.querySelector(s); return !!e && e.innerText.trim().startsWith(p) }',
            arg=[selector, prefix], timeout=timeout_ms)
    except Exception:  # noqa: BLE001 - a wait that runs out is reported by the check that reads the text
        pass
    return page.locator(selector).inner_text().strip()


def until(page, ready, timeout_ms=5000):
    """Wait until ready() holds, up to timeout_ms, letting the page answer its requests meanwhile; a fixed pause raced
    a slow runner (text_once)."""
    waited = 0
    while not ready() and waited < timeout_ms:
        page.wait_for_timeout(100)
        waited += 100


def editor_in_browser(page, web):
    """The Drafts editor by touch, through the board API (Krish, 2026-10-21: "edit in line myself and save changes to
    get picked up"): tap a paragraph, change it, Done, the bar counts it, Save, Saved, and the save is edits/wed-article
    with the store's fields and the hash of the words it was made on; then picked words get a comment pinned to their
    paragraph; then a save that meets another session's save says it was not saved."""
    import hashlib as _h
    week = wb.LAYOUT_FROM.isoformat()
    saved, state = [], {'conflict': False}
    base = '# The heading\n\nWords.\n\nMore words here.'

    def api(route):
        req = route.request
        path = req.url.split('board.test', 1)[1].split('?')[0]
        if path == '/midweek.html':
            return route.fulfill(status=200, content_type='text/html', body=web)
        if req.method == 'PUT':
            body = json.loads(req.post_data or '{}').get('body')
            if state['conflict'] and '/edits/' in path:
                return route.fulfill(status=409, content_type='application/json',
                                     body=json.dumps({'ok': False, 'error': 'revision_conflict', 'body': {'text': 'theirs'}, 'revision': 7}))
            saved.append((path, body))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'revision': 1, 'body': body}))
        answer = {'ok': True, 'weeks': [week]} if path == '/api/board/weeks' else {'ok': True, 'documents': [], 'next_offset': None}
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(answer))
    problems = []
    page.route(re.compile(r'^https://board\.test/'), api)
    try:
        page.goto('https://board.test/midweek.html#wednesday/drafts')
        page.wait_for_timeout(300)
        count = page.locator('.rv-save[data-save-day="wed"] .rv-count')
        page.click('#rvp-wed-article-1')
        page.fill('.rv-pedit .rv-ptext', 'Fewer words.')
        page.click('.rv-pedit button:text("Done")')
        if count.inner_text().strip() != '1 unsaved change':
            problems.append(f'midweek: an edited paragraph is not counted on the Save bar ({count.inner_text()!r})')
        page.click('[data-act="save-all"][data-day="wed"]')
        bar = text_once(page, '.rv-save[data-save-day="wed"] .rv-count', 'Saved')
        hit = [b for p, b in saved if p == f'/api/board/{week}/edits/wed-article']
        want = base.replace('Words.', 'Fewer words.')
        if not hit or hit[-1].get('text') != want or hit[-1].get('day') != 'wed' or hit[-1].get('item') != 'article' \
                or hit[-1].get('base_sha256') != _h.sha256(base.encode()).hexdigest() or not hit[-1].get('at'):
            problems.append(f'midweek: Save did not keep the paragraph in edits/wed-article with its fields ({hit})')
        if not bar.startswith('Saved'):
            problems.append(f'midweek: after Save the bar does not say Saved ({bar!r})')
        if page.locator('#rvp-wed-article-1').inner_text().strip() != 'Fewer words.':
            problems.append('midweek: the saved paragraph does not read as he wrote it')
        # Picked words, then Comment on this: the comment carries its draft, paragraph and the words.
        page.evaluate('''() => { const p = document.querySelector('#rvp-wed-article-2 p'); const r = document.createRange();
            r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }''')
        page.wait_for_timeout(400)
        if not page.locator('.rv-cbtn').is_visible():
            problems.append('midweek: picking words in a draft does not offer Comment on this')
        else:
            page.click('.rv-cbtn')
            page.fill('dialog.wb-sheet textarea', 'Say who.')
            page.click('dialog.wb-sheet .wb-save')
            until(page, lambda: any(p.startswith(f'/api/board/{week}/comments/') for p, _ in saved))
            note = [b for p, b in saved if p.startswith(f'/api/board/{week}/comments/')]
            if not note or note[-1].get('quote') != 'More words here.' or note[-1].get('paragraph') != 2 \
                    or note[-1].get('box') != 'wed-article' or note[-1].get('anchor') != 'rvp-wed-article-2':
                problems.append(f'midweek: the comment is not pinned to its draft, paragraph and words ({note})')
            page.keyboard.press('Escape')
        # A save that meets another session's: said, never lost silently.
        state['conflict'] = True
        page.click('#rvp-wed-article-2', timeout=5000)
        page.fill('.rv-pedit .rv-ptext', 'Other words.')
        page.click('.rv-pedit button:text("Done")')
        page.click('[data-act="save-all"][data-day="wed"]')
        bar = text_once(page, '.rv-save[data-save-day="wed"] .rv-count', 'Not saved')
        if not bar.startswith('Not saved'):
            problems.append(f'midweek: a save that met another session\'s is not said ({bar!r})')
    finally:
        page.unroute(re.compile(r'^https://board\.test/'))
    return problems


def board_api(page, web, name, saved, answer=None):
    """Serve one fed board and its store at https://board.test, keeping each write in saved as (path, body); answer(path,
    body) may give the server's own answer to a write (a press's send or inbox)."""
    week = wb.LAYOUT_FROM.isoformat()
    docs = {}

    def api(route):
        req = route.request
        path = req.url.split('board.test', 1)[1].split('?')[0]
        if path == f'/{name}.html':
            return route.fulfill(status=200, content_type='text/html', body=web)
        if req.method == 'PUT':
            body = json.loads(req.post_data or '{}').get('body')
            saved.append((path, body))
            extra = (answer(path, body) if answer else None) or {}
            body = dict(body, **extra.pop('body', {}))
            collection, doc = path.split('/')[-2:]
            docs.setdefault(collection, {})[doc] = body
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'revision': 1, 'body': body, **extra}))
        collection = path.rsplit('/', 1)[-1]
        documents = [{'id': k, 'revision': 1, 'updated_by': 'Krish', 'body': v} for k, v in docs.get(collection, {}).items()]
        reply = {'ok': True, 'weeks': [week]} if path == '/api/board/weeks' else {'ok': True, 'documents': documents, 'next_offset': None}
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(reply))
    page.route(re.compile(r'^https://board\.test/'), api)
    return week


def presses_in_browser(page, web):
    """His presses on the Ideas tab by touch (Krish, 2026-10-28): Reject an idea, saved only once he says why; take a
    press back; Next week for the Monday after; a note on his pick; and Approve on an off-day option, bound to its
    copy."""
    saved, problems = [], []
    week = board_api(page, web, 'sunday', saved)
    nxt = (wb.LAYOUT_FROM + timedelta(days=7)).isoformat()
    last = lambda path: next((b for p, b in reversed(saved) if p == f'/api/board/{week}/{path}'), None)
    try:
        page.goto('https://board.test/sunday.html#ideas')
        page.wait_for_selector('[data-press="not_for_us"][data-for="mon-1"]:not([disabled])', timeout=5000)
        # Reject asks for his reason first and saves nothing until he gives one (the board refuses a Reject without it).
        page.click('[data-press="not_for_us"][data-for="mon-1"]')
        page.wait_for_selector('[data-press-note-for="mon-1"]:not([hidden])', timeout=5000)
        page.click('[data-act="save-press-note"][data-for="mon-1"]')
        said = text_once(page, '[data-pressstate="mon-1"]', 'Say why first')
        if last('queue/mon-1') or not said.startswith('Say why first'):
            problems.append(f'sunday: Reject saved without his reason, or did not ask for it ({said!r})')
        page.fill('[data-press-note="mon-1"]', 'Done to death this month.')
        page.click('[data-act="save-press-note"][data-for="mon-1"]')
        until(page, lambda: last('queue/mon-1'))
        body = last('queue/mon-1') or {}
        if (body.get('use') != 'not_for_us' or body.get('reason') != 'Done to death this month.' or body.get('pick') != 'mon-1'
                or body.get('queued') is not False or not body.get('so_what')):
            problems.append(f'sunday: Reject did not save queue/mon-1 with use not_for_us and his reason ({body})')
        state = text_once(page, '[data-pressstate="mon-1"]', 'Rejected')
        if not state.startswith('Rejected: Done to death this month.'):
            problems.append(f'sunday: a saved Reject does not say so with his reason ({state!r})')
        page.click('[data-press="not_for_us"][data-for="mon-1"]')
        until(page, lambda: (last('queue/mon-1') or {}).get('use', 'x') is None)
        if (last('queue/mon-1') or {}).get('use', 'x') is not None:
            problems.append('sunday: a second tap on the same press does not take it back')
        page.click('[data-press="next_week"][data-for="wed-2"]')
        until(page, lambda: last('queue/wed-2'))
        if (last('queue/wed-2') or {}).get('target_week') != nxt or (last('queue/wed-2') or {}).get('queued') is not True:
            problems.append(f'sunday: Next week is not saved for the Monday after ({last("queue/wed-2")})')
        page.click('label.pick:has(input[value="fri-3"])')
        until(page, lambda: last('picks/fri'))
        page.wait_for_selector('[data-pick-note-for="fri-3"]:not([hidden])', timeout=5000)
        page.fill('[data-pick-note-for="fri-3"] input', 'Lead with the deal.')
        page.click('[data-act="save-pick-note"][data-for="fri-3"]')
        until(page, lambda: (last('picks/fri') or {}).get('note'))
        if (last('picks/fri') or {}).get('note') != 'Lead with the deal.' or (last('picks/fri') or {}).get('pick') != 'fri-3':
            problems.append(f'sunday: his note on a pick is not saved with it ({last("picks/fri")})')
        page.click('[data-act="offday"][data-value="approve"][data-for="off-tue-o1"]')
        until(page, lambda: last('queue/off-tue-o1'))
        off = last('queue/off-tue-o1') or {}
        want = hashlib.sha256('The draft copy for tue option 1.'.encode()).hexdigest()
        if off.get('use') != 'offday' or off.get('day') != 'tue' or off.get('approved') is not True or off.get('copy_sha256') != want:
            problems.append(f'sunday: Approve on an off-day option did not save it bound to its copy ({off})')
    except Exception as error:  # noqa: BLE001 - a step that cannot run is reported, never passed
        problems.append(f'sunday: the presses could not be pressed ({str(error).splitlines()[0][:160]})')
    finally:
        page.unroute(re.compile(r'^https://board\.test/'))
    return problems


def decisions_in_browser(page, web):
    """His decisions on a day's tab by touch: Approve scripts sends the words the Drafts step shows and says what the
    server did; Titles saves his pick on each surface; Reject asset needs his reason; Approve for publish binds the
    manifest."""
    saved, problems = [], []
    answer = lambda path, body: ({'send': {'status': 'no_key'}, 'body': {'send': {'status': 'no_key', 'at': '2026-10-25T12:30:00Z'}}}
                                 if path.endswith('/picks/wed-scripts') else {'inbox': 'filed'} if '/picks/mon-reject-' in path else None)
    week = board_api(page, web, 'midweek', saved, answer)
    last = lambda path: next((b for p, b in reversed(saved) if p == f'/api/board/{week}/{path}'), None)
    try:
        page.goto('https://board.test/midweek.html#wednesday/drafts')
        page.wait_for_selector('[data-act="approve-scripts"][data-day="wed"]:not([disabled])', timeout=5000)
        page.click('[data-act="approve-scripts"][data-day="wed"]')
        until(page, lambda: last('picks/wed-scripts'))
        body = last('picks/wed-scripts') or {}
        if (body.get('kind') != 'approve_scripts' or body.get('approved') is not True or body.get('texts') != {'long': 'Said.'}
                or body.get('piece_id') != wb.WED_ID or not str((body.get('titles') or {}).get('long', '')).startswith('Wed 28 Oct - 5-minute - ')
                or 'send' in body):
            problems.append(f'midweek: Approve scripts did not save the exact words with their Teleprompter names ({body})')
        state = text_once(page, '[data-approvestate="wed"]', 'Approved')
        if 'a session sends exactly these words' not in state:
            problems.append(f'midweek: after Approve scripts the board does not say what the server did ({state!r})')
        page.goto('https://board.test/midweek.html#wednesday/record')
        page.wait_for_selector('[data-act="save-titles"][data-day="wed"]:not([disabled])', timeout=5000)
        page.click('label.pick:has(input[data-title-surface="long_title"][value="Free AI pictures are not free"])')
        page.click('[data-act="save-titles"][data-day="wed"]')
        until(page, lambda: last('picks/wed-titles'))
        if (last('picks/wed-titles') or {}).get('picks') != {'long_title': 'Free AI pictures are not free'}:
            problems.append(f'midweek: Titles did not save his pick ({last("picks/wed-titles")})')
        page.goto('https://board.test/midweek.html#monday/publish')
        page.wait_for_selector('[data-act="reject-asset"][data-for="mon-dl-video-short"]:not([disabled])', timeout=5000)
        page.click('[data-act="reject-asset"][data-for="mon-dl-video-short"]')
        page.click('[data-act="save-reject"][data-for="mon-dl-video-short"]')
        said = text_once(page, '[data-rejectstate="mon-dl-video-short"]', 'Say why')
        if last('picks/mon-reject-video-short') or not said.startswith('Say why'):
            problems.append('midweek: Reject asset saved without his reason')
        page.fill('[data-reject-for="mon-dl-video-short"] [data-reject-reason]', 'The captions drift.')
        page.fill('[data-reject-for="mon-dl-video-short"] [data-reject-at]', '1:23')
        page.click('[data-act="save-reject"][data-for="mon-dl-video-short"]')
        until(page, lambda: last('picks/mon-reject-video-short'))
        rej = last('picks/mon-reject-video-short') or {}
        if (rej.get('reason') != 'The captions drift.' or rej.get('at_ms') != 83000 or rej.get('asset') != 'video-short'
                or rej.get('formats') != ['short_video'] or rej.get('drive_id') != 'c' * 25 or rej.get('piece_id') != wb.MON_ID):
            problems.append(f'midweek: Reject asset did not save his reason with the file, its moment and Drive id ({rej})')
        page.click('[data-act="approve-publish"][data-day="mon"]')
        until(page, lambda: last('picks/mon-publish'))
        pub = last('picks/mon-publish') or {}
        if pub.get('approved') is not True or pub.get('manifest_sha256') != 'd' * 64 or pub.get('piece_id') != wb.MON_ID:
            problems.append(f'midweek: Approve for publish did not save the day, the piece and its manifest ({pub})')
    except Exception as error:  # noqa: BLE001 - a step that cannot run is reported, never passed
        problems.append(f'midweek: the day\'s presses could not be pressed ({str(error).splitlines()[0][:160]})')
    finally:
        page.unroute(re.compile(r'^https://board\.test/'))
    return problems


def file_hash(path):
    """sha256 of a text file with CRLF line ends read as LF, so git's Windows checkout hashes the same as Linux's."""
    return hashlib.sha256(Path(path).read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def hashes(root=ROOT):
    return {rel: file_hash(root / rel) for rel in LOCKED}


def approved_problem(words):
    """Why these are not his recorded words for a layout change, or None."""
    if not APPROVED.match(str(words or '').strip()):
        return '--approved must be "Krish, YYYY-MM-DD: <his exact words>", the words he approved this layout change in'
    return None


def snapshot_of(weeks_seen, files, approved):
    return {'_about': 'The fixed layout of the publish board, as check_board_layout.py reads it from three fed weeks, the hash of '
                      'its layout file and colours, and the words Krish approved it in. It changes only with --update --approved '
                      '(Ruling, Krish, 2026-10-21: the layout is held by CI and changes only with his recorded words).',
            'layout_version': wb.LAYOUT['version'], 'approved': approved, 'files': files, 'weeks': weeks_seen}


def lock_problems(want, weeks_seen, files):
    """Why the board as built is not the one the snapshot holds with his words, or []."""
    out = []
    fix = f'If Krish approved the change, run --update --approved "Krish, YYYY-MM-DD: <his words>" and commit {SNAPSHOT.relative_to(ROOT).as_posix()}.'
    if approved_problem(want.get('approved')):
        out.append(f'{SNAPSHOT.relative_to(ROOT).as_posix()} records no words of Krish approving the layout. {fix}')
    for rel, digest in files.items():
        if (want.get('files') or {}).get(rel) != digest:
            out.append(f'{rel} changed since the layout Krish approved (its sha256 differs from the snapshot). {fix}')
    for name in weeks_seen:
        if (want.get('weeks') or {}).get(name) != weeks_seen[name]:
            out.append(f'{name}: the board\'s structure differs from {SNAPSHOT.relative_to(ROOT).as_posix()}: the layout changed. {fix}')
    return out


def _feeder_case():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / 'docs' / 'plans' / '2026-10-28-wednesday').mkdir(parents=True)
        (root / 'docs' / 'plans' / '2026-10-28-wednesday' / 'feed.py').write_text('import week_board\n')
        (root / 'docs' / 'plans' / '2026-10-28-wednesday' / 'notes.py').write_text('print(1)\n')
        return feeder_scripts(root) == ['docs/plans/2026-10-28-wednesday/feed.py']


def self_test():
    """The lock itself: a changed layout file, colour file or structure fails, and only his recorded words pass it."""
    words = 'Krish, 2026-10-21: change the queue so I can combine ideas'
    seen = {'sunday': {'tabs': ['ideas', 'queue']}}
    files = {rel: 'a' * 64 for rel in LOCKED}
    good = snapshot_of(seen, files, words)
    checks = {
        'a snapshot with his words, the same files and the same structure passes': lock_problems(good, seen, files) == [],
        'a changed layout file fails': any('board-layout.json changed' in p for p in lock_problems(good, seen, dict(files, **{LOCKED[0]: 'b' * 64}))),
        'a changed colour file fails': any('tokens.css changed' in p for p in lock_problems(good, seen, dict(files, **{LOCKED[1]: 'b' * 64}))),
        'a changed structure fails': any('structure differs' in p for p in lock_problems(good, {'sunday': {'tabs': ['ideas']}}, files)),
        'a snapshot with no approved words fails': any('records no words' in p for p in lock_problems(dict(good, approved=None), seen, files)),
        'an update without his words is refused': approved_problem(None) is not None and approved_problem('looks fine') is not None,
        'an update with a date and his words is accepted': approved_problem(words) is None,
        'a new per-day feeder is refused, the frozen ones are history': _feeder_case(),
    }
    # Windows checks the layout file out with CRLF line ends; it is the same file and must hash the same.
    with tempfile.TemporaryDirectory() as tmp:
        lf = (ROOT / LOCKED[0]).read_bytes().replace(b'\r\n', b'\n')
        crlf, changed = Path(tmp) / 'crlf.json', Path(tmp) / 'changed.json'
        crlf.write_bytes(lf.replace(b'\n', b'\r\n'))
        changed.write_bytes(lf.replace(b'"layout_from"', b'"layout_frum"', 1))
        checks['a CRLF copy of the layout file hashes the same as the LF copy'] = file_hash(crlf) == file_hash(ROOT / LOCKED[0])
        checks['a real change to the layout file still changes its hash'] = file_hash(changed) != file_hash(ROOT / LOCKED[0])
    return [f'self-test: {name}' for name, ok in checks.items() if not ok]


def feeder_scripts(root=ROOT):
    """Scripts outside the board's builders that import or run week_board, other than the frozen history."""
    bad = []
    for path in root.glob('docs/**/*.py'):
        rel = path.relative_to(root).as_posix()
        if rel in FEEDERS or rel in FROZEN:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue
        if re.search(r'\bweek_board\b|\bboard_web\b', text):
            bad.append(rel)
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--update', action='store_true', help='rewrite the snapshot; needs --approved')
    ap.add_argument('--approved', metavar='WORDS', help='"Krish, YYYY-MM-DD: <his exact words>" approving this layout change')
    ap.add_argument('--browser', action='store_true')
    args = ap.parse_args(argv)
    if args.update and approved_problem(args.approved):
        print(f'check:board-layout --update refused: {approved_problem(args.approved)}')
        return 2
    problems = self_test()
    with tempfile.TemporaryDirectory() as tmp, title_check.picked_for_tests([TITLE], tmp):
        pages = weeks(tmp)
        for name, page in pages.items():
            problems += [f'{name}: {p}' for p in wb.verify(page)]
        got = {name: structure(page) for name, page in pages.items()}
        if args.update:
            SNAPSHOT.write_text(json.dumps(snapshot_of(got, hashes(), args.approved.strip()), indent=1) + '\n', encoding='utf-8')
            print(f'check:board-layout: wrote {SNAPSHOT.relative_to(ROOT).as_posix()}, approved: {args.approved.strip()}')
        else:
            try:
                want = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                want = {}
            problems += lock_problems(want, got, hashes())
        if args.browser:
            problems += browser(pages, tmp)
    problems += [f'{rel}: stamps a board outside the board\'s builders (engine_stamp); feed week_board.py instead of patching its page'
                 for rel in stamp_callers()]
    problems += [f'{rel}: a one-off board feeder; feed the board through week_board.py\'s own inputs (docs/PUBLISH_BOARDS.md), '
                 'never a script per day' for rel in feeder_scripts()]
    if problems:
        print('check:board-layout FAILED:\n  ' + '\n  '.join(problems))
        return 1
    print('check:board-layout passed: three fed weeks in the fixed layout Krish approved, its files unchanged, nothing else stamps a board'
          + (', and every view fits a phone' if args.browser else ''))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
