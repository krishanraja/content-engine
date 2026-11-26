"""The blind proof harness (scripts/post-pack/story_proof.py; the story engine v5 plan, step 4 and commit 9).

Every board, pool and answer below is invented, in a temporary plans folder, and every transport is a fake: no test
spends anything or reads the live board. What it holds:
  - the pool is blind (no taste key survives, at any depth) and stories after the gather are dropped;
  - his pick is the final picks document's idea_id, and a picks file stands in for the board;
  - one card renderer, four fields, house labels and board notes stripped;
  - a seeded shuffle with exactly half New as A, a sealed key in a gitignored path, the sheet printing only its hash;
  - the tells check, the answers, and a reveal that refuses unanswered pairs or a key that does not match;
  - the thresholds (13 of 18 passes, 12 does not, = counts 0.5, a refused New card fails), and no words of his in
    results.json;
  - the budget and the chain refuse a real run before any call.
"""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import story_proof as sp  # noqa: E402

WEEK = '2030-01-07'
CLEAN = lambda _t: []  # noqa: E731
UNDER = lambda: {'chain_over': False, 'chain_usd': 1, 'chain_cap_usd': 15}  # noqa: E731
OVER = lambda: {'chain_over': True, 'chain_usd': 16, 'chain_cap_usd': 15}  # noqa: E731


def uid(n):
    return f'{n:08d}-0000-4000-8000-000000000000'


def hero(n, hook, fact, url='https://www.warner.com/news/ai', **kw):
    return {'id': uid(n), 'fact': fact, 'story': fact, 'so_what': hook, 'pitch': {'hook': hook, 'headline': hook},
            'source': {'label': 'Warner', 'url': url}, 'source_kind': kw.pop('kind', 'engine'), 'why_here': 'a reason of his', **kw}


def off(oid, hook, copy, url='https://www.bbc.co.uk/news/x', **kw):
    return {'id': oid, 'format': 'Meme, 2 panels, 4:5', 'hook': hook, 'copy': copy, 'funny': hook, 'source': {'label': 'BBC', 'url': url}, **kw}


def board():
    return {'week_start': WEEK, 'checked_on': '2030-01-05',
            'days': {'mon': [hero(1, 'A record label paid twice for one song', 'Warner paid $5m for training data on 3 Jan 2030.'),
                             hero(2, 'Follow the money: a studio sold its own trailers', 'Lionsgate sold 400 trailers to a lab for $2m.', kind='his'),
                             hero(3, 'A theatre priced tickets by AI', 'The Old Vic let a model set prices for 12 nights.')],
                     'wed': [hero(4, 'A model wrote a pop chorus', 'Sony said a model wrote 30% of one chorus.'),
                             hero(5, 'A game studio cut voice actors', 'A studio replaced 12 voice actors with one model.')],
                     'fri': [hero(6, 'A paper said AI art sells less', 'A study of 9,000 sales found AI art sold 20% less.'),
                             hero(7, 'A newsroom tested AI headlines', 'The FT tested 200 AI headlines against its own.')]},
            'offdays': {'tue': [off('cats', 'The cat filed the expenses', 'A meme about a cat.'), off('dogs', 'The dog wrote the memo', 'A meme about a dog.')],
                        'thu': [off('owls', 'The owl ran the meeting', 'A meme about an owl.')],
                        'sat': [{'id': 'goodnews', 'weekly': 'good_news', 'format': 'Uplifting AI news carousel, 5 cards, 4:5', 'hook': 'Five good things'},
                                off('bees', 'The bees kept the hive', 'A meme about bees.'), off('ants', 'The ants built a bridge', 'A meme about ants.')]}}


def sources():
    item = lambda n, idea, at, lane=None: {'id': uid(n), 'idea': idea, 'thesis': 'Why it matters.', 'lane_slot': lane,  # noqa: E731
                                           'source_url': 'https://www.reuters.com/x', 'created_at': at, 'why_here': 'a reason of his',
                                           'source_kind': 'engine', 'score': 0.9}
    return {'week_start': WEEK, 'gathered_at': '2030-01-05T10:00:00Z',
            'series': [{'slug': 'follow_the_money', 'pool': [item(11, 'Universal Music paid $40m to license its catalogue to a lab.', '2030-01-04T10:00:00Z', 'follow_the_money'),
                                                             item(12, 'A late story that came after the board.', '2030-01-06T10:00:00Z', 'follow_the_money')]},
                       {'slug': 'under_the_hood', 'pool': []}, {'slug': 'mind_the_gap', 'pool': []}],
            'unassigned': [item(13, 'Netflix said a model cut its dubbing costs by 30%.', '2030-01-03T10:00:00Z')],
            'outcomes': {'filed': [], 'rejected': [], 'trend': [], 'improved': []}, 'cues': {}, 'asks': []}


class Folder(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.plans, self.cache, self.docs = self.tmp / 'plans', self.tmp / 'cache', self.tmp / 'docs'
        (self.plans / f'{WEEK}-week').mkdir(parents=True)
        self.docs.mkdir()
        shutil.copy(sp.docs_dir() / 'PROTOCOL.md', self.docs / 'PROTOCOL.md')
        (self.plans / f'{WEEK}-week' / 'ideas.json').write_text(json.dumps(board()), encoding='utf-8')
        (self.plans / f'{WEEK}-week' / 'sources.json').write_text(json.dumps(sources()), encoding='utf-8')
        self.cfg = json.loads(json.dumps(sp.CFG))
        self.cfg['weeks'] = [WEEK]

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def dry(self, arm='S'):
        poster = sp.FakePoster()
        code, summary = sp.run(WEEK, arm, dry=True, plans=self.plans, cache=self.cache, poster=poster, kill=CLEAN, cfg=self.cfg, docs=self.docs)
        return code, summary, poster

    def ready(self):
        """pool, old (from a picks file) and a dry Arm S run."""
        sp.old(WEEK, self.plans, {'mon': uid(2), 'wed': uid(4), 'fri': uid(7)}, cache=self.cache, cfg=self.cfg)
        return self.dry('S')


class PoolTest(Folder):
    def test_the_pool_is_blind_and_drops_stories_after_the_gather(self):
        doc = sp.pool(WEEK, self.plans, self.cfg)
        text = json.dumps(doc)
        for key in ('why_here', 'source_kind', 'score'):
            self.assertNotIn(f'"{key}"', text, key)
        self.assertEqual(doc['taste_left'], [])
        self.assertEqual(doc['dropped_after_cutoff'], [uid(12)])
        mon = [d['id'] for d in doc['drafts']['mon']]
        self.assertIn(uid(11), mon, 'the series story stands on its day')
        self.assertIn(uid(13), mon, 'an unassigned story fills a place left, Monday first')

    def test_it_stops_when_a_taste_key_survives(self):
        cfg = json.loads(json.dumps(self.cfg))
        cfg['taste_keys'] = cfg['taste_keys'] + ['fact']
        with self.assertRaises(sp.ProofError):
            sp.pool(WEEK, self.plans, cfg)

    def test_arm_r_scores_the_old_options_only_and_arm_s_adds_the_pool(self):
        doc = sp.pool(WEEK, self.plans, self.cfg)
        r, s = sp.candidates(doc, 'R'), sp.candidates(doc, 'S')
        self.assertEqual(len(r['days']['mon']), 3)
        self.assertGreater(len(s['days']['mon']), 3)
        self.assertEqual(r['offdays'], s['offdays'])


class OldTest(Folder):
    def test_his_pick_is_the_final_picks_document(self):
        presses = [{'doc': 'picks/fri', 'outcome': 'approved', 'idea_id': uid(6), 'at': '2030-01-07T09:00:00'},
                   {'doc': 'picks/fri', 'outcome': 'approved', 'idea_id': uid(7), 'at': '2030-01-07T10:00:00'},
                   {'doc': 'picks/wed', 'outcome': 'approved', 'idea_id': uid(4), 'at': '2030-01-07T09:00:00'},
                   {'doc': 'picks/wed', 'outcome': 'withdrawn', 'idea_id': uid(4), 'at': '2030-01-07T11:00:00'},
                   {'doc': 'queue/mon-1', 'outcome': 'rejected', 'idea_id': uid(1), 'at': '2030-01-07T09:00:00'}]
        self.assertEqual(sp.picks_from_presses(presses), {'fri': uid(7)})

    def test_a_picks_file_stands_in_and_conflicts_are_listed(self):
        (self.plans / f'{WEEK}-week' / 'scorecard.json').write_text(json.dumps({'picks': {'mon': 'mon-3'}}), encoding='utf-8')
        doc = sp.old(WEEK, self.plans, {'mon': uid(2), 'wed': 'not-on-the-board'}, cache=self.cache, cfg=self.cfg)
        self.assertEqual(doc['source'], 'file')
        self.assertEqual(doc['picks'], {'mon': uid(2), 'wed': None, 'fri': None})
        self.assertEqual(doc['lead']['mon'], uid(1))
        self.assertEqual(doc['lead']['sat'], 'bees', 'the first Saturday option that is not the weekly series')
        self.assertTrue(any(c.startswith('wed:') for c in doc['conflicts']))
        self.assertTrue(any(c.startswith('mon: scorecard.json says mon-3') for c in doc['conflicts']))
        self.assertEqual(doc['pick_ranks_on_board']['mon'], 2)
        self.assertTrue((self.cache / WEEK / 'old.json').exists())


class CardTest(unittest.TestCase):
    def test_one_renderer_four_fields_house_labels_stripped(self):
        view = {'fact': 'The Paypers, 6 Nov 2026: ' + ' '.join(['word'] * 60), 'pitch': {'hook': 'Follow the money: ' + ' '.join(['x'] * 40)},
                'source': {'label': 'Your saved post', 'url': 'https://www.thepaypers.com/a/b'}}
        c = sp.card('Monday, week of 16 Nov', view, True)
        self.assertEqual(list(c), sp.CFG['card']['fields'])
        self.assertFalse(c['What happened'].startswith('The Paypers'), 'a leading publication and date go: the source line names the site')
        self.assertLessEqual(len(c['What happened'].replace('...', '').split()), 35)
        self.assertLessEqual(len(c['The angle'].replace('...', '').split()), 25)
        self.assertNotIn('Follow the money', c['The angle'])
        self.assertEqual(c['Source'], 'thepaypers.com', 'the site only, never the label')
        notes = sp.card('Thursday', {'copy': 'Rebuilt on your Improve: the vote changed three rules.', 'hook': 'Five cards'}, False)
        self.assertEqual(notes['What happened'], 'The vote changed three rules.')

    def test_the_angle_chosen_by_the_engine_replaces_the_own_angle(self):
        view = {'fact': 'A fact.', 'pitch': {'hook': 'The own hook'}}
        self.assertEqual(sp.card('Monday', view, True, 'The engine angle')['The angle'], 'The engine angle')
        self.assertEqual(sp.card('Monday', {'title': 'Only a title'}, True)['The angle'], 'Only a title')


class SealTest(unittest.TestCase):
    def test_exactly_half_new_as_a(self):
        import random
        for n in (18, 17, 2, 1):
            flags = sp.half_new_a(n, random.Random(7))
            self.assertEqual(sum(flags), n // 2, n)
        self.assertEqual(sp.half_new_a(18, random.Random(7)), sp.half_new_a(18, random.Random(7)), 'seeded')

    def test_the_key_lives_in_a_gitignored_path(self):
        key = sp.cache_dir() / 'key.json'
        got = subprocess.run(['git', 'check-ignore', '-q', str(key)], cwd=ROOT)
        self.assertEqual(got.returncode, 0, f'{key} must be gitignored')
        self.assertTrue(str(sp.cache_dir()).replace('\\', '/').endswith('.cache/proof/story-engine-v5'))


class RunTest(Folder):
    def test_a_dry_run_spends_nothing_and_names_the_choice_for_every_slot(self):
        code, summary, poster = self.ready()
        self.assertEqual(code, 0, summary['unread'])
        self.assertEqual(set(summary['steps'].values()), {0})
        self.assertTrue(poster.calls, 'the fake answered')
        self.assertEqual(summary['fake_calls'].get('provoke'), 6, "each hero day's top two")
        for d in ('mon', 'wed', 'fri', 'tue', 'thu', 'sat'):
            self.assertIsNotNone(summary['new'][d], d)
        self.assertNotEqual(summary['new']['sat']['id'], 'goodnews', 'the weekly good news keeps its place')
        self.assertTrue(str(self.cache / 'dry') in str(summary['ledger']) or (self.cache / 'dry').exists())
        self.assertFalse((self.cache / 'spend.jsonl').exists(), 'a dry run never touches the proof ledger')
        self.assertTrue(any(summary['new'][d]['angle'] for d in ('mon', 'wed', 'fri')), 'the dry fakes reach the angle path')
        work = self.cache / 'dry' / 'arm-S'
        scores = json.loads((work / f'{WEEK}-week' / 'scores.json').read_text(encoding='utf-8'))['options']
        self.assertFalse(any('sound angle' in f for s in scores.values() for f in s['floors_failed']), 'a dry hero has a sound angle')
        import board_feed
        import idea_checks as ic
        probes = board_feed.probes_of(WEEK, work)
        ordered = json.loads((work / f'{WEEK}-week' / 'ideas.json').read_text(encoding='utf-8'))
        found = ic.story_findings(ordered, WEEK, None, probes, dict(ic.STORY, **{'from': WEEK}))
        self.assertFalse([f for f in found if 'whys' in f['line']], 'the gate reads the dry probes as three sourced whys')

    def test_pairs_by_idea_id_ties_not_shown(self):
        self.ready()
        rows, not_shown = sp.pairs([WEEK], self.cache, self.cfg)
        kinds = [(r['day'], r['kind']) for r in rows] + [(t['day'], t['kind']) for t in not_shown]
        self.assertEqual(len(kinds), 9, 'three hero leads, three hero picks, two off days, Saturday')
        for r in rows:
            self.assertNotEqual(r['new_id'], r['old_id'])
            self.assertEqual(list(r['new_card']), sp.CFG['card']['fields'])
        for t in not_shown:
            self.assertTrue(t['why'])
        thu = next(x for x in rows + not_shown if x['day'] == 'thu')
        self.assertIn('tie', thu['why'], 'one Thursday option: the same story on both sides')

    def test_the_budget_refuses_a_real_run_before_any_call(self):
        poster = sp.FakePoster()
        code, summary = sp.run(WEEK, 'S', budget_usd=0.2, plans=self.plans, cache=self.cache, poster=poster, cap=UNDER, kill=CLEAN, cfg=self.cfg)
        self.assertEqual(code, 2)
        self.assertEqual(poster.calls, [], 'no call made')
        self.assertTrue(any('no call made' in u for u in summary['unread']))

    def test_the_chain_refuses_a_real_run_before_any_call(self):
        poster = sp.FakePoster()
        code, summary = sp.run(WEEK, 'S', budget_usd=10, plans=self.plans, cache=self.cache, poster=poster, cap=OVER, kill=CLEAN, cfg=self.cfg)
        self.assertEqual(code, 2)
        self.assertEqual(poster.calls, [])

    def test_a_real_run_needs_the_sessions_judges_and_probes(self):
        poster = sp.FakePoster()
        code, summary = sp.run(WEEK, 'S', budget_usd=10, plans=self.plans, cache=self.cache, poster=poster, cap=UNDER, kill=CLEAN, cfg=self.cfg)
        self.assertEqual(code, 2)
        self.assertEqual(poster.calls, [])
        self.assertTrue(any('judged' in u and 'probes' in u for u in summary['unread']), summary['unread'])
        self.assertTrue((self.cache / 'live' / 'arm-S' / f'{WEEK}-week' / 'story' / 'judge-brief.md').exists())

    def test_the_budget_never_passes_the_proof_cap(self):
        self.assertEqual(self.cfg['budget_usd'], 10)
        est = sp.estimate(sp.candidates(sp.pool(WEEK, self.plans, self.cfg), 'S'))
        self.assertGreater(est['usd'], 0)
        self.assertEqual(est['provokes'], 6)


class SheetTest(Folder):
    def test_the_sheet_prints_only_the_hash(self):
        self.ready()
        key, digest = sp.sheet(seed=42, cache=self.cache, cfg=self.cfg, allow_dry=True)
        text = (self.cache / 'sheet.md').read_text(encoding='utf-8')
        self.assertEqual(digest, hashlib.sha256((self.cache / 'key.json').read_bytes()).hexdigest())
        self.assertIn(f'sha256 {digest}', text)
        for p in key['pairs']:
            for side in ('A', 'B'):
                self.assertNotIn(p[side]['idea_id'], text, 'no id on the sheet')
        self.assertNotIn('"seed"', text)
        for word in ('new engine', 'old board', 'Arm S', 'Arm R'):
            self.assertNotIn(word, text)
        self.assertNotIn('—', text)
        self.assertNotIn('!', text)
        self.assertEqual(sum(1 for p in key['pairs'] if p['new'] == 'A'), len(key['pairs']) // 2)

    def test_a_second_key_and_a_dry_sheet_are_refused(self):
        self.ready()
        with self.assertRaises(sp.ProofError):
            sp.sheet(seed=1, cache=self.cache, cfg=self.cfg)
        sp.sheet(seed=1, cache=self.cache, cfg=self.cfg, allow_dry=True)
        with self.assertRaises(sp.ProofError):
            sp.sheet(seed=2, cache=self.cache, cfg=self.cfg, allow_dry=True)

    def test_tells(self):
        self.ready()
        key, _ = sp.sheet(seed=3, cache=self.cache, cfg=self.cfg, allow_dry=True)
        passed, doc = sp.tells(None, self.cache, self.docs, self.cfg)
        packet = Path(doc['packet']).read_text(encoding='utf-8')
        self.assertNotIn('sha256', packet)
        self.assertIn('P01', packet)
        right = self.tmp / 'right.txt'
        right.write_text('\n'.join(f'{p["pair"]}: {p["new"]} because' for p in key['pairs']), encoding='utf-8')
        passed, doc = sp.tells(right, self.cache, self.docs, self.cfg)
        self.assertFalse(passed, 'a reader who tells every pair apart fails the blinding')
        wrong = self.tmp / 'wrong.txt'
        wrong.write_text('\n'.join(f'{p["pair"]}: {"B" if p["new"] == "A" else "A"}' for p in key['pairs']), encoding='utf-8')
        passed, doc = sp.tells(wrong, self.cache, self.docs, self.cfg)
        self.assertFalse(passed, 'a reader who tells every pair apart with the labels swapped has told them apart')
        half = self.tmp / 'half.txt'
        n = len(key['pairs'])
        half.write_text('\n'.join(f'{p["pair"]}: {p["new"] if k < n // 2 else ("B" if p["new"] == "A" else "A")}'
                                  for k, p in enumerate(key['pairs'])), encoding='utf-8')
        passed, doc = sp.tells(half, self.cache, self.docs, self.cfg)
        self.assertTrue(passed, doc)

    def test_the_tells_bar_is_two_sided(self):
        th = sp.protocol()['tells']
        self.assertEqual((th['of'], th['below'], th['above']), (18, 13, 5))
        sealed(self.cache, KINDS)
        for right, ok in ((0, False), (2, False), (5, False), (6, True), (9, True), (12, True), (13, False), (18, False)):
            f = self.tmp / f'g{right}.txt'
            key = json.loads((self.cache / 'key.json').read_text(encoding='utf-8'))
            f.write_text('\n'.join(f'{p["pair"]}: {p["new"] if k < right else ("B" if p["new"] == "A" else "A")}'
                                   for k, p in enumerate(key['pairs'])), encoding='utf-8')
            passed, doc = sp.tells(f, self.cache, self.docs, self.cfg)
            self.assertEqual(passed, ok, f'{right} of 18 right')

    def test_the_sheet_reaches_his_notes_only_after_the_tells_passed(self):
        self.ready()
        key, digest = sp.sheet(seed=5, cache=self.cache, cfg=self.cfg, allow_dry=True)
        out = self.tmp / 'notes' / 'sheet.md'
        with self.assertRaises(sp.ProofError):
            sp.release(out, self.cache, self.cfg)
        self.assertFalse(out.exists(), 'no tells check: nothing is released')
        right = self.tmp / 'right.txt'
        right.write_text('\n'.join(f'{p["pair"]}: {p["new"]}' for p in key['pairs']), encoding='utf-8')
        sp.tells(right, self.cache, self.docs, self.cfg)
        with self.assertRaises(sp.ProofError):
            sp.release(out, self.cache, self.cfg)
        self.assertFalse(out.exists(), 'a failed tells check: nothing is released')
        answers = self.tmp / 'answers.md'
        answers.write_text(answer(key, 6), encoding='utf-8')
        got, problems = sp.record(answers, self.cache)
        self.assertEqual(got, {})
        self.assertIn('never released', problems[0])
        self.assertIn('never released', sp.reveal(self.cache, self.docs, write=False)[1][0])
        n = len(key['pairs'])
        half = self.tmp / 'half.txt'
        half.write_text('\n'.join(f'{p["pair"]}: {p["new"] if k < n // 2 else ("B" if p["new"] == "A" else "A")}'
                                  for k, p in enumerate(key['pairs'])), encoding='utf-8')
        self.assertTrue(sp.tells(half, self.cache, self.docs, self.cfg)[0])
        self.assertEqual(sp.release(out, self.cache, self.cfg), out)
        self.assertIn(f'sha256 {digest}', out.read_text(encoding='utf-8'))
        got, problems = sp.record(answers, self.cache)
        self.assertEqual(problems, [])
        with self.assertRaises(sp.ProofError):
            sp.sheet(seed=6, cache=self.cache, cfg=self.cfg, allow_dry=True, force=True)


def sealed(cache, kinds, refused=(), released=True):
    """A key of len(kinds) pairs, the sheet's hash beside it, alternating New as A."""
    pairs = []
    for n, kind in enumerate(kinds, 1):
        new = {'side': 'new', 'idea_id': f'new-{n}', 'refused': n in refused}
        old = {'side': 'old', 'idea_id': f'old-{n}'}
        a_new = n % 2 == 1
        pairs.append({'pair': f'P{n:02d}', 'week': WEEK, 'day': 'mon', 'kind': kind, 'new': 'A' if a_new else 'B',
                      'A': new if a_new else old, 'B': old if a_new else new, '_row': n - 1})
    key = {'proof': 'story-engine-v5', 'seed': 1, 'made_at': 'x', 'pairs': pairs, 'not_shown': []}
    sp.save(cache / 'key.json', key)
    digest = sp.sha256_of(cache / 'key.json')
    sp.save(cache / 'sheet.json', {'sha256': digest, 'pairs': [p['pair'] for p in pairs]})
    if released:
        sp.save(cache / 'release.json', {'sha256': digest, 'out': 'notes', 'at': 'x'})
    return key


def answer(key, new_wins, equal=0, note='a phrase only he would write about the cards'):
    lines = []
    for n, p in enumerate(key['pairs']):
        if n < new_wins:
            g = p['new'] + '+'
        elif n < new_wins + equal:
            g = '='
        else:
            g = ('B' if p['new'] == 'A' else 'A') + '++'
        lines.append(f'{p["pair"]}: {g} ; seen before? n ; would make A? y B? n ; note: {note}')
    return '\n'.join(lines)


KINDS = ['hero_vs_lead'] * 6 + ['hero_vs_pick'] * 6 + ['offday_vs_lead'] * 4 + ['saturday_vs_lead'] * 2


class RevealTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.cache, self.docs = self.tmp / 'cache', self.tmp / 'docs'
        self.docs.mkdir()
        shutil.copy(sp.docs_dir() / 'PROTOCOL.md', self.docs / 'PROTOCOL.md')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def reveal_with(self, text, key_kinds=KINDS, refused=()):
        key = sealed(self.cache, key_kinds, refused)
        f = self.tmp / 'answers.md'
        f.write_text(text(key), encoding='utf-8')
        got, problems = sp.record(f, self.cache)
        self.assertEqual(problems, [])
        return sp.reveal(self.cache, self.docs)

    def test_13_of_18_passes_and_12_does_not(self):
        results, problems = self.reveal_with(lambda k: answer(k, 13))
        self.assertEqual(problems, [])
        self.assertEqual(results['counts']['new_preferred'], 13)
        self.assertEqual(results['verdict'], 'pass')
        results, _ = self.reveal_with(lambda k: answer(k, 12))
        self.assertEqual(results['verdict'], 'inconclusive')
        results, _ = self.reveal_with(lambda k: answer(k, 10))
        self.assertEqual(results['verdict'], 'fail')

    def test_equal_counts_half(self):
        results, _ = self.reveal_with(lambda k: answer(k, 12, equal=2))
        self.assertEqual(results['counts']['new_preferred'], 13.0)
        self.assertEqual(results['verdict'], 'pass')

    def test_the_hero_lead_bar_and_the_refused_subject_bar(self):
        # 13 wins, but only 3 of them on the six hero-lead pairs.
        kinds = ['hero_vs_pick'] * 10 + ['hero_vs_lead'] * 6 + ['offday_vs_lead'] * 2
        results, _ = self.reveal_with(lambda k: answer(k, 13), kinds)
        self.assertEqual(results['counts']['hero_vs_lead']['points'], 3)
        self.assertNotEqual(results['verdict'], 'pass')
        results, _ = self.reveal_with(lambda k: answer(k, 18), refused=(2,))
        self.assertEqual(results['counts']['new_on_refused_subject'], 1)
        self.assertEqual(results['verdict'], 'fail')

    def test_fewer_pairs_scale_the_bar(self):
        self.assertEqual(sp.bar({'of': 18, 'at_least': 13}, 15), 11)
        self.assertEqual(sp.bar({'of': 6, 'at_least': 4}, 5), 4)
        self.assertEqual(sp.bar({'of': 18, 'at_least': 13}, 18), 13)

    def test_it_refuses_an_unanswered_pair_and_a_key_that_does_not_match(self):
        key = sealed(self.cache, KINDS)
        f = self.tmp / 'a.md'
        f.write_text('\n'.join(answer(key, 18).splitlines()[:-1]), encoding='utf-8')
        sp.record(f, self.cache)
        results, problems = sp.reveal(self.cache, self.docs)
        self.assertIsNone(results)
        self.assertIn('P18', problems[0])
        f.write_text(answer(key, 18), encoding='utf-8')
        sp.record(f, self.cache)
        k = json.loads((self.cache / 'key.json').read_text(encoding='utf-8'))
        k['pairs'][0]['new'] = 'B'
        (self.cache / 'key.json').write_text(json.dumps(k), encoding='utf-8')
        results, problems = sp.reveal(self.cache, self.docs)
        self.assertIsNone(results)
        self.assertIn('does not match', problems[0])
        k['pairs'][0]['new'] = 'A'
        (self.cache / 'key.json').write_text(json.dumps(k), encoding='utf-8')
        sp.save(self.cache / 'sheet.json', {'sha256': sp.sha256_of(self.cache / 'key.json')})
        results, problems = sp.reveal(self.cache, self.docs)
        self.assertIn('another key', problems[0], 'a sheet released on another key is refused')

    def test_results_hold_ids_letters_and_counts_only(self):
        results, _ = self.reveal_with(lambda k: answer(k, 13))
        text = (self.docs / 'results.json').read_text(encoding='utf-8')
        self.assertNotIn('a phrase only he would write', text)
        self.assertNotIn('note', text)
        for r in results['pairs']:
            self.assertEqual(set(r), {'pair', 'week', 'day', 'kind', 'new', 'grade', 'new_points', 'seen_before', 'would_make_new',
                                      'would_make_old', 'new_id', 'old_id', 'new_refused'})
        self.assertEqual(results['engine_sha'], sp.frozen_sha(self.docs))

    def test_answers_parse(self):
        got, problems = sp.parse_answers('P01: A++ ; seen before? y ; would make A? y B? n ; note: fine\nP02: =\nP03: C+\nP04: ')
        self.assertEqual(got['P01'], {'grade': 'A++', 'seen_before': True, 'make_a': True, 'make_b': False, 'note': 'fine'})
        self.assertEqual(got['P02']['grade'], '=')
        self.assertEqual(len(problems), 1)
        self.assertNotIn('P04', got)


class ProtocolTest(unittest.TestCase):
    def test_the_protocol_freezes_the_engine_and_the_thresholds(self):
        th = sp.protocol()
        self.assertEqual((th['new_preferred']['at_least'], th['new_preferred']['of']), (13, 18))
        self.assertEqual((th['hero_vs_lead']['at_least'], th['hero_vs_lead']['of']), (4, 6))
        self.assertEqual(th['new_on_refused_subject']['at_most'], 0)
        self.assertEqual(th['equal_counts'], 0.5)
        sha = sp.frozen_sha()
        self.assertRegex(sha or '', r'^[0-9a-f]{40}$')
        text = (sp.docs_dir() / 'PROTOCOL.md').read_text(encoding='utf-8')
        self.assertIn('30 Nov', text, 'the forward hold-out')
        self.assertNotIn('—', text)
        self.assertNotIn('!', text)

    def test_the_scorer_never_imports_the_proof(self):
        src = (ROOT / 'scripts' / 'post-pack' / 'story_score.py').read_text(encoding='utf-8')
        self.assertNotRegex(src, r'(?m)^\s*(?:import|from)\s+story_proof\b')


if __name__ == '__main__':
    unittest.main()
