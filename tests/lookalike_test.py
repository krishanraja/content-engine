"""scripts/post-pack/lookalike.py: his Instagram inspo sheet read for the lookalike step of the Sunday ideas run, and the
patterns the run draws from it checked against what the sheet holds. Krish, 2026-11-16: "we also need to build a
lookalike model of stories that pull from the latest in [the Instagram inspo sheet] and then go and find similar if not
better stories on the web." Every post here is invented."""
import json
import sys
import tempfile
import unittest
from datetime import date, datetime
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import lookalike  # noqa: E402

HEAD = ['Post ID', 'Published (UTC)', 'Retrieved (UTC)', 'Type', 'Pages', 'Capture status', 'Headline', 'Faithful summary',
        'Future-of-AI claims', 'Named entities', 'Time horizon', 'Evidence or source named', 'Full caption',
        'Carousel slide text (ordered)', 'Post URL', 'Account']


def workbook(rows, themes=True):
    import openpyxl
    book = openpyxl.Workbook()
    posts = book.active
    posts.title = 'Posts'
    posts.append(HEAD)
    for r in rows:
        posts.append(r)
    if themes:
        t = book.create_sheet('Themes')
        t.append(['Theme', 'Why it travels'])
        t.append(['Robots at work', 'People like seeing the robot fail first'])
    out = BytesIO()
    book.save(out)
    return out.getvalue()


def row(n, published=None, retrieved=datetime(2026, 11, 16, 6, 0)):
    return [f'p{n}', published, retrieved, 'carousel', 5, 'ok', f'Headline {n}', f'What post {n} says.', '', 'Acme', 'now', 'a paper',
            'caption', 'slide one | slide two', f'https://www.instagram.com/p/post{n}/', '@someone']


TODAY = date(2026, 11, 16)
XLSX = lookalike.XLSX_TYPE


class PrepareTest(unittest.TestCase):
    def test_the_newest_posts_by_published_else_retrieved_with_how_fresh_the_sheet_is(self):
        rows = [row(1, published=datetime(2026, 11, 14, 9)), row(2, published=datetime(2026, 10, 1)), row(3)]  # row 3: backfill, no Published
        rows += [row(n, published=datetime(2026, 9, 1)) for n in range(4, 110)]
        with tempfile.TemporaryDirectory() as tmp:
            path, lines = lookalike.prepare('2026-11-23', call_bytes=lambda p: (200, workbook(rows), XLSX), plans=tmp, today=TODAY)
            data = json.loads(path.read_text())
        self.assertEqual(data['source'], 'sheet')
        self.assertEqual(len(data['posts']), lookalike.NEWEST)
        self.assertEqual([p['post_id'] for p in data['posts'][:3]], ['p3', 'p1', 'p2'], 'Retrieved stands in when Published is blank')
        self.assertEqual(data['freshness'], {'newest_published': '2026-11-14T09:00:00Z', 'newest_retrieved': '2026-11-16T06:00:00Z',
                                             'rows_total': 109, 'rows_last_7_days': 2})
        self.assertEqual(data['themes'], [{'Theme': 'Robots at work', 'Why it travels': 'People like seeing the robot fail first'}])
        self.assertEqual(data['warnings'], [])
        self.assertIn('sheet, 100 of 109 posts, 1 themes', lines[0])

    def test_a_stale_sheet_is_a_warning_never_a_quiet_skip(self):
        old = [row(1, published=datetime(2026, 11, 1), retrieved=datetime(2026, 11, 2))]
        with tempfile.TemporaryDirectory() as tmp:
            path, lines = lookalike.prepare('2026-11-23', call_bytes=lambda p: (200, workbook(old), XLSX), plans=tmp, today=TODAY)
            data = json.loads(path.read_text())
        self.assertEqual(len(data['warnings']), 1)
        self.assertTrue(data['warnings'][0].startswith('Stale sheet: '))
        self.assertTrue(any(line.startswith('  WARNING: Stale sheet') for line in lines))

    def test_when_the_sheet_cannot_be_read_it_says_why_and_uses_the_gathered_feed(self):
        feed = [{'title': 'A feed post', 'excerpt': 'It says.', 'account': '@a', 'url': 'https://www.instagram.com/p/feed1/', 'at': '2026-11-15T10:00:00+00:00'},
                {'title': 'No link', 'excerpt': 'x', 'url': None, 'at': '2026-11-15T10:00:00+00:00'}]
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / '2026-11-23-week'
            folder.mkdir()
            (folder / 'sources.json').write_text(json.dumps({'inspiration': {'lookalike_feed': feed, 'feed': []}}))
            path, _ = lookalike.prepare('2026-11-23', call_bytes=lambda p: (502, b'{"ok":false,"error":"sheet_unreadable"}', 'application/json'),
                                        plans=tmp, today=TODAY)
            data = json.loads(path.read_text())
            self.assertEqual(data['source'], 'feed_fallback')
            self.assertIn('HTTP 502', data['reason'])
            self.assertEqual([p['url'] for p in data['posts']], ['https://www.instagram.com/p/feed1/'])
            self.assertTrue(data['warnings'][0].startswith('Feed fallback: '))
            (folder / 'sources.json').unlink()
            with self.assertRaises(lookalike.LookalikeError):
                lookalike.prepare('2026-11-23', call_bytes=lambda p: (502, b'', 'application/json'), plans=tmp, today=TODAY)

    def test_an_answer_that_is_not_a_workbook_is_never_read_as_an_empty_sheet(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / '2026-11-23-week'
            folder.mkdir()
            (folder / 'sources.json').write_text(json.dumps({'inspiration': {'feed': [{'title': 't', 'url': 'https://www.instagram.com/p/f/', 'at': None}]}}))
            path, _ = lookalike.prepare('2026-11-23', call_bytes=lambda p: (200, b'<html>sign in</html>', 'text/html'), plans=tmp, today=TODAY)
            self.assertIn('not a workbook', json.loads(path.read_text())['reason'])
            path, _ = lookalike.prepare('2026-11-23', call_bytes=lambda p: (200, b'PK not really', XLSX), plans=tmp, today=TODAY)
            self.assertIn('openpyxl can read', json.loads(path.read_text())['reason'])


def pattern(n, **kw):
    return dict({'id': f'p{n}', 'pattern': 'A robot fails at a human job, then wins.', 'why_it_travels': 'People share a robot that slips.',
                 'aim': 'humour', 'examples': ['https://instagram.com/p/post1'], 'search_briefs': ['robots failing at work, this week']}, **kw)


class CheckTest(unittest.TestCase):
    given = {'posts': [{'url': 'https://www.instagram.com/p/post1/'}], 'warnings': []}

    def test_five_to_eight_patterns_each_drawn_from_posts_in_the_input(self):
        good = {'patterns': [pattern(n) for n in range(5)]}
        self.assertEqual(lookalike.check_lookalike(good, self.given), [])
        self.assertTrue(lookalike.check_lookalike({'patterns': [pattern(n) for n in range(4)]}, self.given)[0].startswith('patterns: 5 to 8'))
        made_up = {'patterns': [pattern(0, examples=['https://www.instagram.com/p/invented/'])] + [pattern(n) for n in range(1, 5)]}
        self.assertEqual(lookalike.check_lookalike(made_up, self.given),
                         ['p0: example https://www.instagram.com/p/invented/ is not a post in lookalike-input.json; use only the posts it holds'])
        bad = {'patterns': [pattern(0, aim='lands', search_briefs=[])] + [pattern(n) for n in range(1, 5)]}
        self.assertEqual(len(lookalike.check_lookalike(bad, self.given)), 2)

    def test_a_pattern_drawn_from_carousels_says_how_the_story_moves_card_to_card(self):
        # Krish, 2026-11-16: "Look at it for the way the narrative goes from card to card."
        given = {'posts': [{'url': 'https://www.instagram.com/p/post1/', 'type': 'carousel', 'pages': 5},
                           {'url': 'https://www.instagram.com/p/reel1/', 'type': 'reel', 'pages': 1}], 'warnings': []}
        flat = {'patterns': [pattern(n) for n in range(5)]}
        lines = lookalike.check_lookalike(flat, given)
        self.assertEqual(len(lines), 5, lines)
        self.assertTrue(all('card_flow' in line for line in lines))
        flow = ['A claim that stops the scroll', 'The proof', 'What it means for you', 'Three things to try']
        self.assertEqual(lookalike.check_lookalike({'patterns': [pattern(n, card_flow=flow) for n in range(5)]}, given), [])
        self.assertEqual(len(lookalike.check_lookalike({'patterns': [pattern(n, card_flow=flow[:2]) for n in range(5)]}, given)), 5)
        reels = {'patterns': [pattern(n, examples=['https://www.instagram.com/p/reel1/']) for n in range(5)]}
        self.assertEqual(lookalike.check_lookalike(reels, given), [], 'a pattern of reels has no cards to follow')
        self.assertTrue(lookalike.is_carousel({'type': 'Sidecar'}))
        self.assertTrue(lookalike.is_carousel({'type': None, 'pages': '6'}))
        self.assertFalse(lookalike.is_carousel({'type': 'reel', 'pages': 'n/a'}))

    def test_every_warning_is_carried_word_for_word(self):
        given = dict(self.given, warnings=['Stale sheet: the newest row is 2026-11-01.'])
        look = {'patterns': [pattern(n) for n in range(5)]}
        self.assertEqual(len(lookalike.check_lookalike(look, given)), 1)
        self.assertEqual(lookalike.check_lookalike(dict(look, _about='Patterns. Stale sheet: the newest row is 2026-11-01.'), given), [])

    def test_check_reads_the_week_and_says_what_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIn('no lookalike-input.json', lookalike.check('2026-11-23', plans=tmp)[0])
            folder = Path(tmp) / '2026-11-23-week'
            folder.mkdir()
            (folder / 'lookalike-input.json').write_text(json.dumps(self.given))
            self.assertIn('no lookalike.json', lookalike.check('2026-11-23', plans=tmp)[0])
            (folder / 'lookalike.json').write_text(json.dumps({'patterns': [pattern(n) for n in range(6)]}))
            self.assertEqual(lookalike.check('2026-11-23', plans=tmp), [])
        with self.assertRaises(lookalike.LookalikeError):
            lookalike.check('2026-11-24')


if __name__ == '__main__':
    unittest.main()
