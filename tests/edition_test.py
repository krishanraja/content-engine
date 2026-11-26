"""The weekly edition: its settings, its tools and the Friday run's guard (Krish, 2026-11-25: one email a week,
"makeyourmindup weekly", every Saturday at 08:00 New York; growth-makeyourmindup
docs/plans/2026-11-25-weekly-edition/DESIGN.md, approved with every recommendation).

config/weekly-edition.json is held to its shape here (C3), scripts/edition/edition.py is run on a fixture week (C4: the
week of 9 Nov 2026, the dry run's week, written by hand in tests/fixtures/edition/week-2026-11-09/, its news invented),
and scripts/weekly_edition.py and .github/workflows/weekly-edition.yml are held to the run's walls (C5).

The news comes from the week's daily hub editions (26 Nov 2026: the edition reads the hub pipeline's rows and runs no
gathering of its own), under the hub's subsectors. The subsectors are read here from the fixture's copy of
config/hub-sources.json, which the hub pipeline brings, and the copy is held to the real file once it is here.
"""
import copy
import datetime as dt
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'edition'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import edition as ed  # noqa: E402
import weekly_edition as we  # noqa: E402

FIXTURE = ROOT / 'tests' / 'fixtures' / 'edition' / 'week-2026-11-09'
CONFIG = json.loads((ROOT / 'config' / 'weekly-edition.json').read_text(encoding='utf-8'))
BEAT = json.loads((ROOT / 'config' / 'beat.json').read_text(encoding='utf-8'))
REAL_HUB_SOURCES = ed.HUB_SOURCES_PATH
ed.HUB_SOURCES_PATH = FIXTURE / 'hub-sources.json'
HUB = json.loads(ed.HUB_SOURCES_PATH.read_text(encoding='utf-8'))
WORKFLOW = (ROOT / '.github' / 'workflows' / 'weekly-edition.yml').read_text(encoding='utf-8')
MONDAY = dt.date(2026, 11, 9)
SATURDAY = '2026-11-14'
CLEAN = lambda text: []  # noqa: E731  the kill list's stand-in where a test is not about it


def draft():
    """The fixture week's draft, without its note."""
    d = json.loads((FIXTURE / 'edition.json').read_text(encoding='utf-8'))
    d.pop('_about')
    return d


def section(d, kind, n=0):
    return [s for s in d['sections'] if s['kind'] == kind][n]


def problems(d, kill=CLEAN):
    return ed.check(d, kill=kill)['problems']


def cli(*args, encoding='utf-8'):
    """scripts/edition/edition.py's command line, run as its own process, reading the fixture's subsectors."""
    code = ('import pathlib, sys; sys.path.insert(0, "scripts/edition"); import edition as ed; '
            'ed.HUB_SOURCES_PATH = pathlib.Path(sys.argv[1]); sys.exit(ed.main(sys.argv[2:]))')
    return subprocess.run([sys.executable, '-c', code, str(FIXTURE / 'hub-sources.json'), *args], cwd=ROOT,
                          capture_output=True, text=True, encoding=encoding)


class TheSettings(unittest.TestCase):
    """C3: config/weekly-edition.json. A setting is a row there, never code."""

    def test_its_shape(self):
        self.assertEqual(CONFIG['schema'], 'content-engine-weekly-edition-config/1')
        self.assertEqual(CONFIG['name'], 'makeyourmindup weekly')
        self.assertEqual(CONFIG['package_schema'], 'content-engine-edition/1')
        self.assertEqual({k: CONFIG['send'][k] for k in ('day', 'time', 'timezone')}, {'day': 'sat', 'time': '08:00', 'timezone': 'America/New_York'})
        self.assertEqual(CONFIG['sections'], ['opener', 'contents', 'piece', 'news', 'pass_it_on', 'close'])
        self.assertEqual(set(CONFIG['section_heads']), {'contents', 'news', 'pass_it_on'})
        self.assertEqual((CONFIG['subject']['min_chars'], CONFIG['subject']['max_chars'], CONFIG['preview_text']['max_chars']), (30, 70, 120))
        w = CONFIG['words']
        self.assertEqual((w['opener']['min_sentences'], w['opener']['max_sentences'], w['opener']['max_words']), (2, 4, 60))
        self.assertEqual((w['piece_summary']['min_words'], w['piece_summary']['max_words']), (50, 80))
        self.assertEqual((w['news_item']['min_sentences'], w['news_item']['max_sentences']), (1, 2))
        self.assertEqual((w['total']['min_words'], w['total']['max_words']), (700, 1000))
        self.assertEqual((CONFIG['news']['min_items'], CONFIG['news']['max_items'], CONFIG['news']['send_min_items']), (6, 10, 4))
        self.assertEqual(CONFIG['news']['per_topic_max'], 2)
        self.assertEqual((CONFIG['news']['from_hub']['route'], CONFIG['news']['from_hub']['table']),
                         ('GET /api/board/<Monday>/edition/news', 'hub_snapshots'))
        self.assertEqual((CONFIG['pieces']['min'], CONFIG['pieces']['max'], CONFIG['pieces']['days']), (1, 3, ['mon', 'wed', 'fri']))
        self.assertEqual(set(CONFIG['pieces']['day_words']), set(CONFIG['pieces']['days']))
        self.assertEqual(CONFIG['good_news'], {**CONFIG['good_news'], 'topic': 'Good news', 'max_items': 3})
        self.assertEqual(CONFIG['news_window']['days'], 7)
        self.assertEqual(CONFIG['news_window']['ends'], {'day': 'fri', 'time': '12:00', 'timezone': 'America/New_York'})

    def test_the_topic_heads_are_the_hubs_subsectors_read_by_key_never_copied(self):
        th = CONFIG['topic_heads']
        self.assertEqual((th['from'], th['list'], th['key'], th['label']), ('config/hub-sources.json', 'subsectors', 'key', 'label'))
        # Every room the hub has is in the edition, Sport among them, until a key is put in leave_out.
        self.assertEqual(th['leave_out'], [])
        heads = ed.topic_heads()
        self.assertEqual([h['key'] for h in heads[:-1]], [row['key'] for row in HUB['subsectors']])
        self.assertEqual([h['label'] for h in heads[:-1]], [row['label'] for row in HUB['subsectors']])
        self.assertEqual(heads[-1], {'key': 'good_news', 'label': 'Good news'})
        text = json.dumps(CONFIG)
        for row in HUB['subsectors']:
            self.assertNotIn(row['label'], text, 'a head is read from config/hub-sources.json, never copied into the edition config')
        avoid = {row['label'] for row in BEAT['avoid']} | {BEAT['enterprise']['label']}
        self.assertFalse(avoid & set(ed.head_labels()))
        # A subsector the hub adds is a head at once.
        more = copy.deepcopy(HUB)
        more['subsectors'].append({'key': 'theatre', 'label': 'Theatre'})
        self.assertIn('Theatre', ed.head_labels(CONFIG, more))

    def test_without_the_hubs_file_the_edition_says_the_hub_merges_first(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaisesRegex(ed.EditionError, 'the hub pipeline .* merges before'):
                ed.hub_sources(Path(t) / 'hub-sources.json')

    @unittest.skipUnless(REAL_HUB_SOURCES.is_file(), 'config/hub-sources.json arrives with the hub pipeline (hub/daily-pipeline)')
    def test_the_fixtures_subsectors_are_the_hubs_own(self):
        real = json.loads(REAL_HUB_SOURCES.read_text(encoding='utf-8'))
        self.assertEqual([(r['key'], r['label']) for r in real['subsectors']], [(r['key'], r['label']) for r in HUB['subsectors']])

    def test_the_link_tags_are_growths_edition_route(self):
        links = CONFIG['links']
        self.assertEqual((links['utm_source'], links['utm_medium'], links['utm_campaign']), ('newsletter', 'email', 'weekly'))
        self.assertEqual(links['utm_content_pattern'], '^edition-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]{1,40}$')
        self.assertEqual(links['places'], ['forward', 'subscribe', 'piece-mon', 'piece-wed', 'piece-fri', 'video-mon', 'video-wed', 'video-fri', 'note'])
        self.assertEqual(links['subscribe_page'], 'https://home.makeyourmindup.ai/subscribe')
        for role, place in links['place_of'].items():
            for day in CONFIG['pieces']['days']:
                self.assertIn(place.format(day=day), links['places'], role)
        # Once growth's route carries its edition block and content-engine vendors it (C2), the two must agree.
        vendored = json.loads((ROOT / 'vendor' / 'makeyourmindup' / 'subscribe-route.json').read_text(encoding='utf-8'))
        if 'edition' in vendored:
            for key in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_content_pattern', 'places'):
                self.assertEqual(vendored['edition'][key], links[key], key)
            self.assertEqual(vendored['page'], links['subscribe_page'])

    def test_the_library_board_and_template_rows(self):
        self.assertEqual(ed.library_paths(SATURDAY), {
            'folder': '2026-11-14 Sat edition - makeyourmindup weekly', 'prefix': '3 Posts/2026-11-14 Sat edition - makeyourmindup weekly',
            'draft': '3 Posts/2026-11-14 Sat edition - makeyourmindup weekly/0 Publish/edition.draft.json',
            'preview': '3 Posts/2026-11-14 Sat edition - makeyourmindup weekly/0 Publish/edition.preview.html'})
        import library
        for path in ed.library_paths(SATURDAY).values():
            if path.endswith(('.json', '.html')):
                self.assertIsNone(library.refusal(path), path)
        board = CONFIG['board']
        self.assertEqual((board['day'], board['press_doc'], board['press_kind'], board['label']), ('sat', 'sat-edition', 'approve_send', 'Approve for send'))
        self.assertFalse(CONFIG['template']['approved'])
        self.assertEqual(ed.TEMPLATES, {})
        # The run's two Friday firings are the workflow's own.
        self.assertEqual(CONFIG['draft_run']['crons_utc'], re.findall(r"cron: '([^']+)'", WORKFLOW))

    def test_the_settings_keep_the_copy_rules_themselves(self):
        for name in ('Krish', 'mind/make', 'CTRL'):
            self.assertIn(name, CONFIG['copy']['never_name'])
        for path in ('config/weekly-edition.json', 'scripts/edition/edition.py', 'scripts/weekly_edition.py', '.github/workflows/weekly-edition.yml',
                     '.agents/skills/weekly-edition/SKILL.md'):
            text = (ROOT / path).read_text(encoding='utf-8')
            self.assertNotIn('\u2014', text, path)
            self.assertNotRegex(text, r'[A-Za-z]! ', path)


class TheDates(unittest.TestCase):
    def test_the_saturday_the_window_and_the_week_the_run_drafts(self):
        self.assertEqual(ed.edition_date(MONDAY).isoformat(), SATURDAY)
        start, end = ed.news_window(MONDAY)
        self.assertEqual((start.isoformat(), end.isoformat()), ('2026-11-06T12:00:00-05:00', '2026-11-13T12:00:00-05:00'))
        d = dt.date.fromisoformat
        self.assertEqual([we.edition_monday(d(x)).isoformat() for x in ('2026-11-13', '2026-11-14', '2026-11-09', '2026-11-15')],
                         ['2026-11-09', '2026-11-09', '2026-11-09', '2026-11-16'])
        with self.assertRaises(ed.EditionError):
            ed.monday_arg('2026-11-10')


class Gather(unittest.TestCase):
    """C4 gather, offline: the fixture week's records and its daily hub editions, through the same read paths the run
    uses."""

    def setUp(self):
        self.read = ed._fixture_reader(FIXTURE)

    def test_the_week_of_9_november(self):
        g = ed.gather(MONDAY, self.read)
        self.assertEqual((g['week_of'], g['edition_date'], g['send_holds']), ('2026-11-09', SATURDAY, False))
        self.assertEqual([p['day'] for p in g['pieces']], ['mon', 'wed', 'fri'])
        mon = g['pieces'][0]
        self.assertEqual(mon['title'], 'When an AI app millions of people loved goes bust, who walks away with the money?')
        self.assertEqual([x['href'] for x in mon['links']], ['https://example.org/makeyourmindup/p/who-walks-away-with-the-money', 'https://example.org/video/mon-5-minutes'])
        self.assertIn('Character.AI', mon['thesis'])
        # Growth's own posted link joins the piece's links once.
        self.assertIn('https://example.org/video/wed-5-minutes', [x['href'] for x in g['pieces'][1]['links']])
        self.assertEqual(len(g['good_news']), 3)
        # The hub's items, under its subsectors in the hub's order, the most covered first.
        self.assertEqual([(c['topic'], c['id'][-2:]) for c in g['candidates']], [
            ('Music', '02'), ('Music', '10'), ('Film & TV', '03'), ('Gaming', '04'), ('Gaming', '12'), ('Sport', '05'),
            ('Publishing & Media', '06'), ('Art & Design', '07')])
        self.assertEqual(g['left_out'], {'outside_window': 2, 'avoid_list': 1, 'no_subsector': 1, 'unreadable': 1, 'repeat': 1})
        self.assertEqual(g['heads'], ed.head_labels())
        self.assertEqual(g['per_topic_max'], 2)
        self.assertEqual(g['hub'], {'from': '2026-11-06', 'to': '2026-11-13', 'days_read': ['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-13'],
                                    'days_missing': ['2026-11-07', '2026-11-08', '2026-11-12']})
        # The same story on two days, its address spelt two ways, is one candidate: the most outlets any day counted, both days.
        first = g['candidates'][0]
        self.assertEqual((first['coverage'], first['days'], first['report_url'], first['report_source']),
                         (6, ['2026-11-09', '2026-11-10'], 'https://example.org/trade/label-licence', 'Example Trade'))
        self.assertEqual(set(first), {'id', 'topic', 'subsector', 'headline', 'dek', 'why', 'report_source', 'report_url', 'date', 'coverage', 'days'})
        self.assertIn('never its source', g['rule'])
        self.assertEqual(g['library']['draft'], '3 Posts/2026-11-14 Sat edition - makeyourmindup weekly/0 Publish/edition.draft.json')

    def test_the_beats_avoid_list_still_refuses_a_hub_story_outright(self):
        self.assertIn('security', ed.avoid_of('Data breach at a streaming service'))
        self.assertIn('regulation', ed.avoid_of('Lawmakers debate a new AI regulation bill'))
        self.assertIsNone(ed.avoid_of('A label licenses its catalogue to an AI music app'))
        # The beat's own exception phrases: job security is not a security story.
        self.assertIsNone(ed.avoid_of('Musicians ask about job security as AI songs chart'))

    def test_a_subsector_left_out_is_no_head_and_its_stories_no_candidates(self):
        cfg = copy.deepcopy(CONFIG)
        cfg['topic_heads']['leave_out'] = ['sport']
        self.assertNotIn('Sport', ed.head_labels(cfg))
        g = ed.gather(MONDAY, self.read, cfg)
        self.assertNotIn('Sport', [c['topic'] for c in g['candidates']])
        self.assertEqual((len(g['candidates']), g['left_out']['no_subsector']), (7, 2))

    def test_a_hub_answer_with_no_rows_gives_no_candidates_and_says_every_day_missing(self):
        start, end = ed.news_window(MONDAY)
        days = [f'2026-11-{d:02d}' for d in range(6, 14)]
        candidates, left_out, hub = ed.hub_candidates({'from': days[0], 'to': days[-1], 'days': [], 'missing': days}, start, end, CONFIG)
        self.assertEqual((candidates, sum(left_out.values()), hub['days_read'], hub['days_missing']), ([], 0, [], days))

    def test_a_week_with_a_piece_not_live_sends_with_what_went_live_and_one_with_none_holds(self):
        view = json.loads((FIXTURE / 'view.json').read_text(encoding='utf-8'))

        def read_with(v):
            return lambda path: v if '/view' in path else self.read(path)
        fri = next(d for d in view['days'] if d['day'] == 'fri')
        fri['pieces'][0]['stage']['state'] = 'scheduled'
        g = ed.gather(MONDAY, read_with(view))
        self.assertEqual([p['day'] for p in g['pieces']], ['mon', 'wed'])
        self.assertEqual(g['not_live'], [{'day': 'fri', 'piece_id': 'f3fcd5e1-573e-4692-a413-db7c5823a10e', 'title': fri['title'], 'why': 'its stage is scheduled'}])
        for d in view['days']:
            for p in d['pieces']:
                p['stage']['state'] = 'missed'
        self.assertTrue(ed.gather(MONDAY, read_with(view))['send_holds'])

    def test_the_command_line_reads_a_fixture(self):
        with tempfile.TemporaryDirectory() as t:
            out = Path(t) / 'gathered.json'
            run = cli('gather', '--monday', '2026-11-09', '--fixture', str(FIXTURE), '--out', str(out))
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(len(json.loads(out.read_text(encoding='utf-8'))['candidates']), 8)
            self.assertEqual(cli('gather', '--monday', '2026-11-10', '--fixture', str(FIXTURE), '--out', str(out)).returncode, 2)


class Links(unittest.TestCase):
    def test_a_link_carries_the_four_tags_for_its_place(self):
        url = ed.tag('https://example.org/p/x?ref=home&utm_source=old#top', SATURDAY, 'piece-mon')
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))
        self.assertEqual(q, {'ref': 'home', 'utm_source': 'newsletter', 'utm_medium': 'email', 'utm_campaign': 'weekly', 'utm_content': 'edition-2026-11-14-piece-mon'})
        self.assertEqual(ed.link_problems(url, SATURDAY, 'piece-mon', 'x', CONFIG), [])
        self.assertTrue(ed.link_problems(url, SATURDAY, 'piece-wed', 'x', CONFIG))
        self.assertTrue(ed.link_problems('https://example.org/p/x', SATURDAY, 'piece-mon', 'x', CONFIG))
        with self.assertRaises(ed.EditionError):
            ed.tag('https://example.org/p/x', SATURDAY, 'piece-tue')
        with self.assertRaises(ed.EditionError):
            ed.tag('http://example.org/p/x', SATURDAY, 'forward')


class Check(unittest.TestCase):
    """C4 check: the draft against the contract and the copy rules."""

    def test_the_fixture_draft_is_clean(self):
        result = ed.check(draft())
        self.assertEqual((result['problems'], result['warnings']), ([], []))
        self.assertEqual(result['checks'], {'voice': 'pass', 'kill_list': 'pass', 'sources': 'pass', 'words': 704})

    def test_the_real_kill_list_runs_and_vetoes(self):
        if not shutil.which('node'):
            self.skipTest('node is not installed here')
        self.assertEqual(ed.kill_list_vetoes('We read the week so you can decide.'), [])
        self.assertTrue(ed.kill_list_vetoes('A seamless way to unlock value.'))
        d = draft()
        section(d, 'close')['text'] = 'That is the week, and we will unlock more next Saturday.'
        self.assertTrue(any('kill list' in p for p in problems(d, kill=ed.kill_list_vetoes)))
        self.assertEqual(ed.check(d)['checks']['kill_list'], 'fail')

    def test_the_copy_rules(self):
        cases = [
            ('opener', 'text', 'This week we followed the money \u2014 three times. Below are the pieces.', 'em dash'),
            ('opener', 'text', 'This week we followed the money \u2013 three times. Below are the pieces.', 'a dash used as a dash'),
            ('opener', 'text', 'This week we followed the money -- three times. Below are the pieces.', 'a dash used as a dash'),
            ('opener', 'text', 'This week we followed the money three times. Below are the pieces!', 'exclamation mark'),
            ('opener', 'text', 'This week we followed the color of money. Below are the pieces.', 'US spelling (color)'),
            ('opener', 'text', 'This week Krish followed the money. Below are the pieces.', 'names Krish'),
            ('close', 'text', 'Thanks from everyone at mind/make.', 'names mind/make'),
        ]
        for kind, key, text, says in cases:
            d = draft()
            section(d, kind)[key] = text
            found = problems(d)
            self.assertTrue(any(says in p for p in found), f'{says}: {found}')
            self.assertEqual(ed.check(d, kill=CLEAN)['checks']['voice'], 'fail')
        # A date range keeps its en dash; a proper noun's spelling is the publisher's.
        d = draft()
        section(d, 'opener')['text'] = 'This week ran from 9\u201313 November. The Lincoln Center story is below.'
        self.assertEqual(problems(d), [])

    def test_the_evidence_is_not_held_to_the_edition_voice(self):
        d = draft()
        section(d, 'news')['groups'][0]['items'][0]['quote'] = 'The best deal we have ever signed! It centers on licensing.'
        self.assertEqual(problems(d), [])

    def test_every_news_item_carries_its_primary_source(self):
        for key, value, says in [('quote', '', 'quote missing'), ('source_url', 'http://example.org/x', 'not an https address'),
                                 ('source_name', ' ', 'source_name missing'), ('checked_at', '13 November', 'ISO 8601'),
                                 ('source_url', ed.tag('https://example.org/records/news/ai-licence', SATURDAY, 'note'), 'carries the edition\'s tags')]:
            d = draft()
            section(d, 'news')['groups'][0]['items'][0][key] = value
            result = ed.check(d, kill=CLEAN)
            self.assertTrue(any(says in p for p in result['problems']), f'{key}: {result["problems"]}')
            self.assertEqual(result['checks']['sources'], 'fail')

    def test_the_link_tags_and_their_places(self):
        d = draft()
        section(d, 'piece', 1)['url'] = ed.tag('https://example.org/p/wed', SATURDAY, 'piece-mon')
        self.assertTrue(any('piece wed url: utm_content' in p for p in problems(d)))
        d = draft()
        section(d, 'pass_it_on')['url'] = ed.tag('https://example.org/elsewhere', SATURDAY, 'forward')
        self.assertTrue(any('one subscribe page' in p for p in problems(d)))
        d = draft()
        section(d, 'piece')['video_url'] = 'https://example.org/video/mon-5-minutes'
        self.assertTrue(any('piece mon video_url: carries utm_source 0 times' in p for p in problems(d)))

    def test_the_structure_and_the_word_budgets(self):
        def broken(change):
            d = draft()
            change(d)
            return problems(d)
        self.assertTrue(any('out of order' in p for p in broken(lambda d: d['sections'].insert(0, d['sections'].pop(1)))))
        self.assertTrue(any('opener: 1 sentences' in p for p in broken(lambda d: section(d, 'opener').update(text='One sentence only.'))))
        self.assertTrue(any('at most 60' in p for p in broken(lambda d: section(d, 'opener').update(text='We read it. ' + 'Word ' * 60 + 'end.'))))
        self.assertTrue(any('summary is 4 words' in p for p in broken(lambda d: section(d, 'piece').update(summary='Too short to read.'))))
        self.assertTrue(any('contents: 3 lines' in p for p in broken(lambda d: section(d, 'contents')['lines'].pop())))
        self.assertTrue(any('label' in p for p in broken(lambda d: section(d, 'piece').update(label='Who gets paid'))))
        self.assertTrue(any('in day order' in p for p in broken(lambda d: d['sections'].insert(2, d['sections'].pop(3)))))
        self.assertTrue(any('is a Sunday' in p for p in broken(lambda d: d.update(edition_date='2026-11-15'))))
        self.assertTrue(any('week_of' in p for p in broken(lambda d: d.update(week_of='2026-11-02'))))
        self.assertTrue(any('subject is 9 characters' in p for p in broken(lambda d: d.update(subject='Too short'))))
        self.assertTrue(any('not a key' in p for p in broken(lambda d: d.update(signed_by='someone'))))
        self.assertTrue(any("topic 'Weather'" in p for p in broken(lambda d: section(d, 'news')['groups'][0].update(topic='Weather'))))
        self.assertTrue(any('at most 3' in p for p in broken(lambda d: section(d, 'news')['groups'][-1]['items'].append(copy.deepcopy(section(d, 'news')['groups'][-1]['items'][0])))))
        self.assertTrue(any('1 or 2' in p for p in broken(lambda d: section(d, 'news')['groups'][0]['items'][0].update(text='One. Two. Three.'))))
        self.assertTrue(any('0 piece sections' in p for p in broken(lambda d: d.update(sections=[s for s in d['sections'] if s['kind'] != 'piece']))))

    def test_six_to_ten_items_and_at_least_four_to_send(self):
        def with_items(n):
            d = draft()
            item = section(d, 'news')['groups'][0]['items'][0]
            labels = [row['label'] for row in HUB['subsectors']]
            section(d, 'news')['groups'] = [{'topic': labels[i // 2], 'items': [copy.deepcopy(item) for _ in range(min(2, n - i))]}
                                            for i in range(0, n, 2)]
            return ed.check(d, kill=CLEAN)
        self.assertTrue(any('at most 10' in p for p in with_items(11)['problems']))
        self.assertTrue(any('at least 4' in p for p in with_items(3)['problems']))
        five = with_items(5)
        self.assertFalse(any('items' in p for p in five['problems']), five['problems'])
        self.assertTrue(any('under the 6' in w for w in five['warnings']))

    def test_at_most_two_items_a_subsector(self):
        d = draft()
        music = section(d, 'news')['groups'][0]
        music['items'] = [copy.deepcopy(music['items'][0]) for _ in range(3)]
        self.assertIn('news Music: 3 items; at most 2 a subsector', problems(d))
        music['items'].pop()
        self.assertFalse(any('a subsector' in p for p in problems(d)))

    def test_a_package_cannot_claim_checks_it_did_not_pass(self):
        d = draft()
        d['checks'] = {'voice': 'pass', 'kill_list': 'pass', 'sources': 'pass', 'words': 1}
        self.assertTrue(any('are not what the check finds' in p for p in problems(d)))


class RenderAndPackage(unittest.TestCase):
    def test_the_preview_is_plain_accessible_and_real_text(self):
        page = ed.render(draft())
        self.assertTrue(page.startswith('<!doctype html>\n<html lang="en-GB">'))
        self.assertIn('<h1>Who got paid when an AI app went bust, and a UK number two</h1>', page)
        for head in ('In this edition', 'Also this week', 'Pass it on', 'Music', 'Good news', 'Saturday 14 November 2026'):
            self.assertIn(head, page)
        self.assertIn('alt="The Monday cover: the app&#x27;s logo on an empty office chair."', page)
        self.assertIn('not in the email', page)
        self.assertNotIn('<script', page)
        d = draft()
        section(d, 'close')['text'] = 'Close <b>bold</b>.'
        self.assertIn('Close &lt;b&gt;bold&lt;/b&gt;.', ed.render(d))
        with self.assertRaises(ed.EditionError):
            ed.render(draft(), 'newsletter-weekly-edition')

    def test_the_package_is_the_contracts_exact_bytes(self):
        with tempfile.TemporaryDirectory() as t:
            out = Path(t)
            done = ed.package(draft(), out, kill=CLEAN)
            data = (out / '0 Publish' / 'edition.draft.json').read_bytes()
            self.assertEqual(done['sha256'], hashlib.sha256(data).hexdigest())
            pkg = json.loads(data.decode('utf-8'))
            self.assertEqual(data, (json.dumps(pkg, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8'))
            self.assertTrue(data.endswith(b'}\n') and b'\r' not in data)
            self.assertEqual(list(pkg), sorted(pkg))
            self.assertEqual(pkg['checks'], {'kill_list': 'pass', 'sources': 'pass', 'voice': 'pass', 'words': 704})
            self.assertEqual(done['draft_path'], '3 Posts/2026-11-14 Sat edition - makeyourmindup weekly/0 Publish/edition.draft.json')
            self.assertTrue((out / '0 Publish' / 'edition.preview.html').read_text(encoding='utf-8').startswith('<!doctype html>'))
            self.assertEqual(ed.check(pkg, kill=CLEAN)['problems'], [])
            # The same draft packages to the same bytes every time.
            with tempfile.TemporaryDirectory() as t2:
                self.assertEqual(ed.package(draft(), Path(t2), kill=CLEAN)['sha256'], done['sha256'])
            # send.py files it into the edition's own folder, both files through the library's path rule.
            import send
            planned = send.plan(out)
            self.assertEqual([p[0] for p in planned], [done['draft_path'], done['preview_path']])

    def test_a_draft_with_a_problem_is_never_packaged(self):
        d = draft()
        section(d, 'opener')['text'] = 'We read the week! Here it is.'
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaises(ed.EditionError):
                ed.package(d, Path(t), kill=CLEAN)
            self.assertFalse((Path(t) / '0 Publish').exists())

    def test_the_command_line_check_knows_a_package_by_its_bytes_and_its_date(self):
        with tempfile.TemporaryDirectory() as t:
            out = Path(t) / 'pack'
            ed.package(draft(), out, kill=CLEAN)
            path = out / '0 Publish' / 'edition.draft.json'
            run = lambda *a: cli('check', str(path), *a)  # noqa: E731
            if shutil.which('node'):
                self.assertEqual(run('--date', SATURDAY).returncode, 0, run('--date', SATURDAY).stdout)
            wrong = run('--date', '2026-11-21')
            self.assertEqual(wrong.returncode, 1)
            self.assertIn('this run drafts the edition of 2026-11-21', wrong.stdout)
            path.write_text(json.dumps(json.loads(path.read_text(encoding='utf-8'))), encoding='utf-8')
            self.assertIn('canonical bytes', run().stdout)


class TheFridayRun(unittest.TestCase):
    """C5: the guard and the workflow's walls."""

    def test_the_guard_reads_the_saturday_card(self):
        sha = 'a' * 64
        view = {'days': [{'day': 'fri', 'edition': None}, {'day': 'sat', 'edition': {'edition_date': SATURDAY, 'sha256': sha}}]}
        self.assertTrue(we.view_has_edition(view, MONDAY))
        self.assertFalse(we.view_has_edition({'days': [{'day': 'sat', 'edition': None}]}, MONDAY))
        self.assertFalse(we.view_has_edition({'days': [{'day': 'sat', 'edition': {'edition_date': '2026-11-21', 'sha256': sha}}]}, MONDAY))
        self.assertFalse(we.view_has_edition({'days': [{'day': 'sat'}]}, MONDAY))
        self.assertEqual(we.decide(MONDAY, False, lambda m: True)[0], False)
        self.assertEqual(we.decide(MONDAY, False, lambda m: False)[0], True)
        self.assertEqual(we.decide(MONDAY, True, lambda m: True)[0], True)

    def test_the_guard_takes_only_a_typed_monday(self):
        run = subprocess.run([sys.executable, 'scripts/weekly_edition.py', 'check', '--week', '2026-11-10'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(run.returncode, 2)
        self.assertEqual(run.stdout, '')

    def test_the_workflow_fires_twice_on_friday_writes_records_only_and_is_fenced(self):
        crons = re.findall(r"cron: '([^']+)'", WORKFLOW)
        self.assertEqual(crons, ['17 20 * * 5', '47 23 * * 5'])
        self.assertIn('repository_dispatch:\n    types: [weekly-edition]', WORKFLOW)
        self.assertRegex(WORKFLOW, r'workflow_dispatch:\n\s+inputs:\n\s+week:')
        self.assertIn('python3 scripts/weekly_edition.py "$@" >> "$GITHUB_OUTPUT"', WORKFLOW)
        self.assertRegex(WORKFLOW, r"if: steps\.guard\.outputs\.go == 'true'\n\s+uses: anthropics/claude-code-action")
        self.assertRegex(WORKFLOW, r'permissions:\n  contents: read\n  id-token: write\n')
        self.assertIn('.agents/skills/weekly-edition/SKILL.md', WORKFLOW)
        # A scheduled job that runs Claude builds, publishes or bumps no board (tests/no-claude-routines.test.ts), and
        # never pushes or merges.
        steps = '\n'.join(line for line in WORKFLOW.splitlines() if not line.lstrip().startswith('#'))
        self.assertNotRegex(steps, r'board_web\.py|board_feed\.py|git push|gh pr|week_board\.py|publish-web')
        # Only the draft is taken from the run: checked again for its own Saturday, its preview drawn again, filed into
        # the guard's folder whatever the run wrote.
        self.assertIn('python3 scripts/edition/edition.py check "$out/0 Publish/edition.draft.json" --date "$SATURDAY"', WORKFLOW)
        self.assertIn('python3 scripts/edition/edition.py render "$out/0 Publish/edition.draft.json"', WORKFLOW)
        self.assertIn('python3 scripts/post-pack/send.py "$out" --as "3 Posts/$FOLDER"', WORKFLOW)
        tools = re.search(r'--allowedTools "([^"]+)"', WORKFLOW).group(1).split(',')
        self.assertIn('Bash(python3 scripts/edition/edition.py:*)', tools)
        self.assertIn('Bash(python3 scripts/engine.py GET:*)', tools)
        self.assertFalse([t for t in tools if 'send.py' in t], 'the run never files to the library itself')


if __name__ == '__main__':
    unittest.main()
