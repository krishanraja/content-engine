"""config/story-score.json, the story score's rubric (the story engine v5 plan, commit 2): every type's weights sum to
10, every axis a weight or floor names exists with anchors at 10, 7, 4 and 1, every floor names a known axis or check,
and the fun_produce judge sees only the reduced format catalogue. Nothing reads the rubric yet; these hold its shape so
the scorer can trust it."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import idea_checks as ic  # noqa: E402

RUBRIC = json.loads((ROOT / 'config' / 'story-score.json').read_text(encoding='utf-8'))
STYLES = json.loads((ROOT / 'config' / 'style-references.json').read_text(encoding='utf-8'))
SOURCES = ('deterministic', 'probe', 'divergent_judge', 'humour', 'blind_judge')
OPS = ('==', '>=', '<=', 'in')


def strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield str(k)
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)


class Rubric(unittest.TestCase):
    def setUp(self):
        self.axes = {a['id']: a for a in RUBRIC['axes']}

    def test_version_and_dates(self):
        self.assertEqual(RUBRIC['rubric_version'], 'story-score/1')
        self.assertRegex(RUBRIC['from'], r'^20\d\d-\d\d-\d\d$')
        self.assertEqual(RUBRIC['from'], '2026-11-30', 'Ruling, Krish, 2026-11-26: "Newgate, 30th of November"')

    def test_axes_are_unique_and_anchored(self):
        self.assertEqual(len(self.axes), len(RUBRIC['axes']), 'axis ids are unique')
        for core in ('scale', 'absurdity_humour', 'unique_angle', 'whys', 'fit', 'named_thing', 'fun_consume', 'fun_produce'):
            self.assertIn(core, self.axes)
        for aid, a in self.axes.items():
            self.assertIn(a['source'], SOURCES, aid)
            self.assertEqual(sorted(a['anchors']), sorted(RUBRIC['scale']['anchor_points']), aid)
            for point, words in a['anchors'].items():
                self.assertTrue(str(words).strip(), f'{aid} anchor {point} is written out')

    def test_weights_sum_to_ten_and_name_real_axes(self):
        self.assertTrue(RUBRIC['types'])
        for tid, t in RUBRIC['types'].items():
            self.assertAlmostEqual(sum(t['weights'].values()), RUBRIC['scale']['weights_sum'], places=6, msg=tid)
            for axis, w in t['weights'].items():
                self.assertIn(axis, self.axes, f'{tid} weights {axis}')
                self.assertGreaterEqual(w, 0)
                only = self.axes[axis].get('types')
                if only:
                    self.assertIn(tid, only, f'{axis} is scored only on {only}')

    def test_heroes_share_the_planned_weights(self):
        hero = {'whys': 2, 'scale': 2, 'unique_angle': 1.5, 'absurdity_humour': 1.2, 'fun_consume': 1, 'fun_produce': 0.8, 'fit': 0.8, 'named_thing': 0.7}
        for tid in RUBRIC['hero_floors']['types']:
            self.assertEqual(RUBRIC['types'][tid]['weights'], hero, tid)

    def test_every_floor_names_a_known_axis_or_check(self):
        floors = [(tid, f) for tid, t in RUBRIC['types'].items() for f in t.get('floors') or []]
        floors += [('hero', f) for f in RUBRIC['hero_floors']['floors']]
        self.assertTrue(floors)
        for tid, f in floors:
            self.assertIn(f['op'], OPS, tid)
            self.assertTrue(str(f.get('reason') or '').strip(), f'{tid} floor says why')
            self.assertEqual(('axis' in f) + ('check' in f), 1, f'{tid} floor names an axis or a check')
            if 'axis' in f:
                self.assertIn(f['axis'], self.axes, tid)
            else:
                self.assertIn(f['check'], RUBRIC['checks'], tid)
        for tid in RUBRIC['hero_floors']['types']:
            self.assertIn(tid, RUBRIC['types'])

    def test_type_rules_name_real_types(self):
        for r in RUBRIC['type_rules']['rules']:
            self.assertIn(r['type'], RUBRIC['types'])
        for day, tid in RUBRIC['type_rules']['days'].items():
            self.assertIn(tid, RUBRIC['types'], day)

    def test_humour_map_speaks_the_engines_mechanisms(self):
        hm = RUBRIC['humour_map']
        named = [m for ms in hm['mechanism_bonus'].values() for m in ms]
        self.assertEqual(len(named), len(set(named)), 'a mechanism has one bonus')
        self.assertTrue(set(named) <= set(ic.MECHANISMS), set(named) - set(ic.MECHANISMS))
        self.assertTrue(set(RUBRIC['absurd_mechanisms']) <= set(ic.MECHANISMS))
        self.assertIsNone(hm['unavailable'], 'an unread humour axis abstains; it is never a pass')
        self.assertLessEqual(max(hm['base'].values()) + max(int(k) for k in hm['mechanism_bonus']), hm['cap'] + 2)
        self.assertLess(hm['needs_explaining_cap'], hm['base']['supported'])
        for tid in hm['unread_never_first_on']:
            self.assertIn(tid, RUBRIC['types'])

    def test_angle_rule_and_margins(self):
        ang = RUBRIC['angle']
        self.assertAlmostEqual(sum(ang['score_weights'].values()), 1.0, places=6)
        self.assertGreater(ang['humour_margin'], 0)
        self.assertLessEqual(ang['humour_margin'], 10)
        self.assertEqual(ang['divergent']['op'], 'provoke')
        self.assertRegex(ang['divergent']['lane'], r'^[a-z0-9-]+$')
        self.assertEqual({l['id'] for l in ang['lenses']}, {'series', 'funniest_true', 'most_absurd_true'})
        close = RUBRIC['close']
        self.assertGreater(close['margin'], 0)
        self.assertLess(close['margin'], close['fork']['within'])
        for axis in close['fork']['fun_axes'] + close['fork']['weight_axes']:
            self.assertIn(axis, self.axes)

    def test_spend_stays_inside_the_ruling(self):
        self.assertEqual(RUBRIC['budget_usd'], 10)
        costs = {k: v for k, v in RUBRIC['unit_costs'].items() if not k.startswith('_')}
        for op in ('provoke', 'score_judge', 'score_free', 'humour_read', 'council_read'):
            self.assertIn(op, costs)
            self.assertGreaterEqual(costs[op], 0)
        self.assertEqual(costs['score_free'], 0)
        self.assertLess(RUBRIC['spend']['divergent_ops_per_day'], 20, "under the route's 20 quick ops a day")
        self.assertLessEqual(RUBRIC['spend']['usd_per_day'], 5)
        self.assertLessEqual(RUBRIC['council']['max_per_week'], 5)

    def test_growth_evidence_is_sourced_performance_data(self):
        g = RUBRIC['growth_evidence']
        self.assertEqual(g['source']['repo'], 'krishanraja/growth-makeyourmindup')
        self.assertTrue(g['source']['path'].endswith('what-works.md'))
        self.assertRegex(g['source']['blob_sha'], r'^[0-9a-f]{40}$')
        kinds = {r['kind'] for r in g['rows']}
        self.assertTrue({'pattern', 'winner', 'loser'} <= kinds)
        self.assertEqual(len({r['id'] for r in g['rows']}), len(g['rows']))

    def test_fun_produce_sees_only_the_reduced_catalogue(self):
        cat = RUBRIC['format_catalogue']
        for fields in (cat['format_fields'], cat['bank_fields']):
            self.assertFalse(set(fields) & set(cat['never']), 'a field is either sent or never sent')
            for f in fields:
                self.assertNotRegex(f, r'krish|verdict|said|like|taste|cue|why_here', f)
        formats = [x for kind in ('script', 'production') for x in STYLES['formats'][kind]]
        self.assertTrue(formats)
        for f in cat['format_fields']:
            self.assertTrue(any(f in x for x in formats), f'{f} is a field of style-references formats')
        for f in cat['bank_fields']:
            self.assertTrue(any(f in x for x in STYLES['bank']), f'{f} is a field of style-references bank')
        for f in ('krish_verdict', 'krish_said', 'what_i_like_sheet', 'recipes'):
            self.assertIn(f, cat['never'])

    def test_no_taste_reads_and_house_wording(self):
        text = ' '.join(strings({k: v for k, v in RUBRIC.items() if k not in ('_about', 'rulings', 'format_catalogue', 'blind_view')}))
        self.assertIn('why_here', RUBRIC['blind_view']['drop_nested'], 'blind_view names a taste key only to drop it')
        self.assertNotIn('why_here', RUBRIC['blind_view']['keep'])
        self.assertNotIn('—', json.dumps(RUBRIC, ensure_ascii=False), 'no em dash')
        for banned in ('why_here', 'krish_verdict', 'scorecard', 'triage-readback', 'feedback_cues', 'what_i_like_sheet', 'approved_taste'):
            self.assertNotIn(banned, text, f'the rubric names no taste source ({banned})')
        self.assertNotIn('!', ''.join(a for ax in RUBRIC['axes'] for a in ax['anchors'].values()))
        self.assertIsNone(re.search(r'\b(?:color|favor|behavior|(?<!control-)center)\b', text, re.I), 'British spelling')


# ---------------------------------------------------------------------------------------------------------------------
# The scorer (commits 5 and 6). Every story below is invented; every transport is a fake, so no test spends anything.

import shutil  # noqa: E402
import tempfile  # noqa: E402

import humour_check as hc  # noqa: E402
import story_score as ss  # noqa: E402

A = '11111111-2222-4333-8444-555555555555'
B = '22222222-3333-4444-8555-666666666666'
WEEK = '2026-11-23'


def lab(reading='supported', mech=(), explain=False, attempted=True, target=()):
    return {'comic_reading': reading, 'attempted': attempted, 'needs_explaining': explain, 'mechanism': list(mech), 'target': list(target)}


def probe(documented=3, inferred=2, mech=1, counter=1, landing=True, first='documented'):
    return {'schema': 'whys-probe/1', 'documented': documented, 'inferred': inferred, 'sites': 2, 'mechanism_rungs': mech,
            'counter_rungs': counter, 'landing_ok': landing, 'unreadable': [], 'problems': [],
            'rungs': [{'n': 1, 'claimed': 'documented', 'counted': first, 'verified_sites': ['a.com', 'b.com'], 'mechanism': False, 'counter': False}]}


def hero(oid, hook, fact, story=None, url='https://www.warner.com/news/ai', **kw):
    return {'id': oid, 'so_what': kw.pop('so_what', hook), 'fact': fact, 'story': story if story is not None else fact,
            'pitch': {'hook': hook, 'headline': hook, 'question': kw.pop('question', hook)}, 'source': {'label': 'Warner', 'url': url}, **kw}


def analysis(reading='supported', mech=('irony',), deps=0, target=()):
    return {'comic_reading': reading, 'humour_attempt': {'status': 'supported_inference'},
            'interpretations': [{'id': 'i1', 'is_main': True, 'supported_reading': 'comic' if reading == 'supported' else None,
                                 'labels_by_axis': {'mechanism': list(mech), 'target': list(target)}, 'evidence_refs': []}],
            'evidence': [], 'context_dependencies': [{'source_kind': 'cultural', 'required': True}] * deps, 'missing_context': []}


class Poster:
    """A fake divergent route: counts calls, answers provoke with sparks and a judged score with numbers."""

    def __init__(self, scale=10):
        self.calls, self.scale = [], scale

    def __call__(self, body):
        self.calls.append(body)
        if body['op'] == 'provoke':
            return 200, {'ok': True, 'runId': 'run-1', 'sparks': [{'title': 'The label pays twice', 'mechanism': 'reversal'}]}
        n = len(body.get('ideas') or [])
        v = 7 * self.scale / 10
        return 200, {'ok': True, 'results': [{'status': 'novel', 'scores': {'originality': v, 'usefulness': v, 'specificity': v}} for _ in range(n)]}


UNDER = lambda: {'chain_over': False, 'chain_usd': 1, 'chain_cap_usd': 15}  # noqa: E731
OVER = lambda: {'chain_over': True, 'chain_usd': 16, 'chain_cap_usd': 15}  # noqa: E731
CLEAN = lambda _t: []  # noqa: E731


class Deterministic(unittest.TestCase):
    def test_fit_reads_the_focus_sectors_and_their_economics(self):
        story = 'It happened this week.'
        cases = [('A record label paid songwriters for training data', 10),
                 ('A record label trains a model on old demos', 7),
                 ('A startup trains a model on old demos', 1)]
        for hook, want in cases:
            self.assertEqual(ss.fit_axis(ss.blind_view(hero(A, hook, 'x', story=story)), True)[0], want, hook)
        body_only = hero(A, 'A startup trains a model on old demos', 'Musicians noticed.', story=story, so_what='Musicians noticed.')
        self.assertEqual(ss.fit_axis(ss.blind_view(body_only), True)[0], 4)

    def test_named_thing_wants_a_name_and_a_number_or_twist(self):
        lower = 'it changes its app this week.'
        named = lambda hook, fact=lower: ss.named_axis(ss.blind_view(hero(A, hook, fact, story=lower, so_what=lower)), True)[0]  # noqa: E731
        self.assertEqual(named('Suno paid $2 million to Warner'), 10)
        self.assertEqual(named('Suno changes its app', 'it paid 3 labels.'), 7)
        self.assertEqual(named('Suno changes its app'), 4)
        self.assertEqual(named('a startup changes its app'), 1)

    def test_primary_sources_and_money_figure(self):
        v = ss.blind_view(hero(A, 'Warner licenses its catalogue', 'Warner said it was paid $40 million.'))
        self.assertEqual(ss.primary_sources(v), 1, 'warner.com is Warner')
        self.assertEqual(ss.money_figure(v), '$40 million')
        v = ss.blind_view(hero(A, 'Warner licenses its catalogue', 'A deal was done.', url='https://www.sec.gov/Archives/x'))
        self.assertEqual(ss.primary_sources(v), 1, 'a filing host')
        self.assertIsNone(ss.money_figure(v))
        self.assertEqual(ss.primary_sources(ss.blind_view(hero(A, 'Warner licenses', 'x', url='https://blog.example.com/a'))), 0)
        self.assertEqual(ss.site_of('https://news.bbc.co.uk/x'), 'bbc.co.uk')

    def test_primary_is_where_the_fact_was_first_reported_never_an_aggregator(self):
        """Ruling, Krish, 2026-11-26, floor C2: primary is the actor's own site, a filing or official data host, or the
        outlet that first reported the fact; never an aggregator or syndicator."""
        trade = 'https://www.musicbusinessworldwide.com/suno-deal'
        story = lambda **kw: ss.blind_view(hero(A, 'Suno pays labels', 'Suno paid labels.', url=kw.pop('url', 'https://blog.example.com/a'), **kw))  # noqa: E731
        self.assertEqual(ss.primary_sources(story()), 0, 'a blog that only retells it')
        self.assertEqual(ss.primary_sources(story(first_reported=trade)), 1, 'the first report counts, as a url')
        self.assertEqual(ss.primary_sources(story(url=trade, first_reported={'url': trade + '?utm=x'})), 1, 'the same url once')
        self.assertEqual(ss.primary_sources(story(sources=[{'url': trade, 'kind': 'original'}])), 1, 'a source of kind original')
        for agg in ('https://finance.yahoo.com/news/suno', 'https://www.msn.com/en-gb/x', 'https://news.google.com/articles/x',
                    'https://uk.news.yahoo.com/y', 'https://ground.news/article/z'):
            self.assertTrue(ss.never_primary(agg), agg)
            self.assertEqual(ss.primary_sources(story(url=agg, first_reported=agg)), 0, f'never primary: {agg}')
            self.assertEqual(ss.primary_sources(story(url=agg, sources=[{'url': agg, 'kind': 'original'}])), 0, f'not even as original: {agg}')
        self.assertEqual(ss.primary_sources(story(url='https://www.ons.gov.uk/x')), 1, 'an official data host')
        own = ss.blind_view(hero(A, 'The AI Futures Project says AI builds AI', 'The AI Futures Project said so.', url='https://blog.aifutures.org/p'))
        self.assertEqual(ss.primary_sources(own), 1, "the actor's own site, by its name")
        self.assertEqual(ss.primary_sources(story(url='https://www.msn.com/suno')), 0, 'msn is never Suno')
        self.assertEqual(ss.primary_sources(story(first_reported='not a url')), 0)

    def test_fit_reads_named_entities_in_the_sentence_that_carries_the_fact(self):
        fit = lambda hook, fact: ss.fit_axis(ss.blind_view(hero(A, hook, fact, story=fact, so_what=hook)), True)  # noqa: E731
        self.assertEqual(fit('Ubisoft lays off 200 staff to build its own models', 'Ubisoft cut 200 jobs.')[0], 7, 'an entity, no economics')
        self.assertEqual(fit('Warner Music licenses its catalogue to a start-up for $40 million', 'Warner Music was paid $40 million.')[0], 10)
        self.assertEqual(fit('The FA signs an AI deal with DAZN', 'DAZN signed it.')[0], 10, 'a sports broadcaster, and a deal')
        self.assertEqual(fit('A start-up trains a model on old demos', 'A start-up trained it.')[0], 1)

    def test_keyword_stuffing_never_earns_fit(self):
        """Failure scripts-regressed-below-ai-music: a floor that can be met by changing words is gamed. Adding a sector
        word after the fact, without the fact changing, never lifts fit to a hero's 7."""
        fact = 'Microsoft cut Copilot prices by 20 percent on Tuesday.'
        base = 'Microsoft cuts Copilot prices by 20 percent'
        fit = lambda hook: ss.fit_axis(ss.blind_view(hero(A, hook, fact, story=fact, so_what=hook)), True)[0]  # noqa: E731
        self.assertLess(fit(base), 7)
        for stuffed in (base + ', which matters for musicians', base + ': what it means for film studios',
                        base + '. Why it matters for musicians.', base + ', and musicians are watching',
                        base + '. Musicians, take note.', base + ' (big news for record labels)',
                        base + ', with lessons for publishers', base + '. Artists should care.'):
            self.assertLess(fit(stuffed), 7, stuffed)
        self.assertEqual(fit('Microsoft cuts Copilot prices for Spotify by 20 percent'), 10, 'a fact about a sector counts')

    def test_whys_and_mechanism_from_the_probe(self):
        self.assertEqual(ss.whys_axis(probe(3, 2))[0], 8)
        self.assertEqual(ss.whys_axis(probe(5, 2))[0], 10)
        self.assertIsNone(ss.whys_axis(None)[0], 'not probed abstains')
        self.assertIsNone(ss.whys_axis({'error': 'no probe'})[0])
        self.assertEqual(ss.mechanism_axis(probe(3, 0, mech=1))[0], 10)
        self.assertEqual(ss.mechanism_axis(probe(1, 0, mech=1))[0], 7)
        self.assertEqual(ss.mechanism_axis(probe(1, 0, mech=0))[0], 4)

    def test_edition_axes(self):
        item = {'sources': [{'url': 'https://a.com', 'own_domain': True}, {'url': 'https://b.com', 'kind': 'secondary'}]}
        self.assertEqual(ss.sourcing_axis(item)[0], 10)
        self.assertEqual(ss.sourcing_axis({'sources': [{'url': 'https://b.com', 'kind': 'aggregator'}]})[0], 1)
        self.assertEqual(ss.freshness_axis({'date': '2026-11-24'}, WEEK)[0], 10)
        self.assertEqual(ss.freshness_axis({'date': '2026-11-24', 'first_reported': '2026-11-20'}, WEEK)[0], 7)
        self.assertEqual(ss.freshness_axis({'date': '2026-11-20', 'development': True}, WEEK)[0], 4)
        self.assertEqual(ss.freshness_axis({'date': '2026-11-01'}, WEEK)[0], 1)


class Humour(unittest.TestCase):
    def test_the_map_is_the_config_row(self):
        self.assertEqual(ss.humour_score(lab('supported', ['irony'])), 8)
        self.assertEqual(ss.humour_score(lab('supported', ['incongruity'])), 7)
        self.assertEqual(ss.humour_score(lab('supported', ['exaggeration'])), 6)
        self.assertEqual(ss.humour_score(lab('ambiguous')), 3)
        self.assertEqual(ss.humour_score(lab('supported', ['irony'], explain=True)), 2, 'needing explaining caps it')
        self.assertEqual(ss.humour_score(lab('not_supported', attempted=True)), 1)
        self.assertEqual(ss.humour_score(lab('not_supported', attempted=False)), 0)
        self.assertIsNone(ss.humour_score(None), 'no reading abstains, never a pass')

    def test_humour_check_labels_and_the_fact_surface(self):
        self.assertIn('fact', hc.SURFACES)
        got = hc.labels(analysis('supported', ['reversal'], target=['institution']))
        self.assertEqual(got, {'comic_reading': 'supported', 'attempted': True, 'needs_explaining': False, 'mechanism': ['reversal'],
                               'target': ['institution']})
        self.assertTrue(hc.labels(analysis(deps=2))['needs_explaining'])
        self.assertIsNone(hc.labels({'comic_reading': None, 'errors': [{'code': 'x'}]}))
        seen = []
        line = hc.read_line('A label paid for its own songs.', 'fact', lambda req: seen.append(req) or analysis(), 'mon/a:fact')
        self.assertEqual(line['engine']['comic_reading'], 'supported')
        self.assertIn('no joke intended', seen[0]['context']['provided_facts'][0])


class Angles(unittest.TestCase):
    def best(self, score=8.0):
        return {'id': 'b', 'score': score, 'sound': True, 'read': lab('not_supported', attempted=False)}

    def funny(self, score, sound=True, **kw):
        return {'id': 'f', 'score': score, 'sound': sound, 'read': lab(**{'reading': 'supported', 'mech': ['absurd_reasoning'], **kw})}

    def test_the_funniest_true_angle_wins_within_the_margin(self):
        got = ss.choose_angle([self.best(), self.funny(7.2)])
        self.assertEqual(got['chosen']['id'], 'f')
        self.assertIn('funniest', got['rule'])

    def test_outside_the_margin_the_best_wins(self):
        self.assertEqual(ss.choose_angle([self.best(), self.funny(6.9)])['chosen']['id'], 'b')

    def test_an_unsound_or_unclear_joke_never_wins(self):
        self.assertEqual(ss.choose_angle([self.best(), self.funny(7.9, sound=False)])['chosen']['id'], 'b')
        self.assertEqual(ss.choose_angle([self.best(), self.funny(7.9, explain=True)])['chosen']['id'], 'b')
        self.assertEqual(ss.choose_angle([self.best(), self.funny(7.9, mech=['exaggeration'])])['chosen']['id'], 'b')

    def test_no_sound_angle_is_said(self):
        got = ss.choose_angle([dict(self.best(), sound=False)])
        self.assertIsNone(got['chosen'])
        self.assertFalse(got['sound'])
        self.assertIsNone(ss.choose_angle([]))

    def test_soundness(self):
        view = ss.blind_view(hero(A, 'Warner is paid twice', 'Warner said it was paid $40 million by the model maker.'))
        judged = {'originality': 7, 'usefulness': 7, 'specificity': 7}
        ok = {'text': 'Warner is paid for the songs it once sued over', 'rests_on': 'it was paid $40 million', 'judge': judged}
        self.assertEqual(ss.sound(ok, view, probe(), hero=True, kill=CLEAN), (True, []))
        para = dict(ok, rests_on='it got forty million dollars')
        self.assertIn('rests on nothing quoted from the sourced fact', ss.sound(para, view, probe(), hero=True)[1])
        weak = dict(ok, judge={'originality': 9, 'usefulness': 4, 'specificity': 5})
        self.assertEqual(len(ss.sound(weak, view, probe(), hero=True)[1]), 2)
        person = dict(ok, read=lab(target=['named_individual']))
        self.assertIn('the humour targets a named individual', ss.sound(person, view, probe(), hero=True)[1])
        self.assertIn('the first why does not climb', ss.sound(ok, view, probe(first='unsupported'), hero=True)[1])
        self.assertIn('kill list', ss.sound(ok, view, probe(), hero=True, kill=lambda _t: ['banned'])[1])

    def test_judge_numbers_and_the_archive_status(self):
        self.assertEqual(ss.judge_numbers({'status': 'novel', 'scores': {'originality': 0.8, 'usefulness': 0.5, 'specificity': 0.7}}),
                         {'originality': 8.0, 'usefulness': 5.0, 'specificity': 7.0, 'status': 'novel'})
        self.assertEqual(ss.angle_score({'status': 'rejected_archive', 'originality': 9}, 8), 0.0)
        j = {'originality': 8, 'usefulness': 6, 'specificity': 6}
        self.assertAlmostEqual(ss.angle_score(j, 8), 0.35 * 8 + 0.25 * 6 + 0.2 * 6 + 0.2 * 8)
        self.assertAlmostEqual(ss.angle_score(j, None), (0.35 * 8 + 0.25 * 6 + 0.2 * 6) / 0.8, places=2)


def full_inputs(oid, key='mon/' + A, *, rests='it was paid $40 million'):
    angle = {'id': key + '#1', 'lens': 'series', 'text': 'Warner is paid for the songs it once sued over', 'rests_on': rests,
             'judge': {'originality': 8, 'usefulness': 8, 'specificity': 8, 'status': 'novel'}}
    return {'probes': {oid: probe(3, 2)}, 'angles': {key: [angle]},
            'reads': {key: {'fact': lab('supported', ['irony']), 'angles': {key + '#1': lab('supported', ['irony'])}}},
            'judged': {key: {a: {'score': 8, 'because': 'it names the money'} for a in ('scale', 'fun_consume', 'fun_produce')}},
            'kill': CLEAN}


class Totals(unittest.TestCase):
    FACT = 'Warner said it was paid $40 million by the model maker for its songs.'

    def opt(self, oid=A, **kw):
        return hero(oid, 'Warner licenses its songs to a model maker for $40 million', self.FACT, **kw)

    def test_a_whole_hero_scores_out_of_100_and_holds_its_floors(self):
        s = ss.score_option('mon/' + A, 'mon', True, self.opt(), full_inputs(A), at='t')
        self.assertEqual(s['type'], 'hero_mon')
        self.assertEqual(s['floors_failed'], [])
        self.assertEqual(s['unread'], [])
        want = sum(w * s['axes'][a] for a, w in RUBRIC['types']['hero_mon']['weights'].items())
        self.assertAlmostEqual(s['total'], round(want, 1))
        self.assertLessEqual(s['total'], 100)
        self.assertEqual(s['angle']['id'], 'mon/' + A + '#1')
        self.assertEqual(s['rubric_version'], 'story-score/1')

    def test_an_unread_axis_abstains_and_too_little_read_is_unscored(self):
        inp = full_inputs(A)
        inp['judged'] = {}
        s = ss.score_option('mon/' + A, 'mon', True, self.opt(), inp)
        self.assertEqual(s['unread'], ['fun_consume', 'fun_produce', 'scale'])
        self.assertIsNotNone(s['total'])
        bare = ss.score_option('mon/' + A, 'mon', True, self.opt(), {'kill': CLEAN})
        self.assertIsNone(bare['total'], 'under min_read_weight: unscored, never ranked on what little was read')

    def test_hero_and_series_floors(self):
        inp = full_inputs(A)
        inp['probes'] = {}
        s = ss.score_option('mon/' + A, 'mon', True, self.opt(), inp)
        self.assertTrue(any(r.endswith('(not read)') and 'three documented' in r for r in s['floors_failed']))
        flat = hero(A, 'Warner licenses its songs to a model maker', 'Warner signed a deal with a model maker.')
        s = ss.score_option('mon/' + A, 'mon', True, flat, full_inputs(A, rests='Warner signed a deal'))
        self.assertIn(RUBRIC['types']['hero_mon']['floors'][0]['reason'], s['floors_failed'])
        inp = full_inputs(A, key='wed/' + A)
        inp['probes'] = {A: probe(3, 2, mech=0)}
        s = ss.score_option('wed/' + A, 'wed', True, self.opt(), inp)
        self.assertIn(RUBRIC['types']['hero_wed']['floors'][0]['reason'], s['floors_failed'])
        inp = full_inputs(A, key='fri/' + A)
        inp['probes'] = {A: probe(3, 2, counter=0)}
        s = ss.score_option('fri/' + A, 'fri', True, self.opt(), inp)
        self.assertIn(RUBRIC['types']['hero_fri']['floors'][0]['reason'], s['floors_failed'])

    def test_types(self):
        self.assertEqual(ss.option_type('tue', False, {'kind': 'meme', 'template': {}}), 'offday_meme')
        self.assertEqual(ss.option_type('sat', False, {'id': 'g'}), 'goodnews')
        self.assertEqual(ss.option_type('tue', False, {'aim': 'utility'}), 'explainer')
        self.assertEqual(ss.option_type('thu', False, {'aim': 'humour'}), 'offday_short')
        self.assertEqual(ss.option_type('fri', True, {}), 'hero_fri')

    def test_a_short_leads_on_humour_the_engine_can_read(self):
        o = {'id': 'x', 'hook': 'Spotify asks the singer to sing less', 'funny': 'The singer is paid to be quiet.', 'aim': 'humour'}
        inp = {'reads': {'tue/x': {'fact': lab('ambiguous'), 'line': lab('not_supported', attempted=True)}}, 'probes': {'x': probe(1, 0)},
               'judged': {'tue/x': {a: {'score': 7, 'because': 'a clear moment'} for a in ('scale', 'fun_consume', 'fun_produce')}}}
        s = ss.score_option('tue/x', 'tue', False, o, inp)
        self.assertEqual(s['type'], 'offday_short')
        self.assertIn('a short leads on humour the engine can read', s['floors_failed'])


def scored(total, type_='hero_mon', **kw):
    return {'total': total, 'type': type_, 'floors_failed': [], 'floored': False, 'humour_unread': False,
            'axes': {'absurdity_humour': kw.pop('fun', 5), 'scale': kw.pop('scale', 5), 'whys': 5}, 'rubric_version': 'story-score/1',
            'at': 't', **kw}


class Order(unittest.TestCase):
    def board(self, *mon, tue=()):
        return {'week_start': WEEK, 'days': {'mon': list(mon), 'wed': [], 'fri': []}, 'offdays': {'tue': list(tue)} if tue else {}}

    def ids(self, ideas, day='mon', group='days'):
        return [o['id'] for o in ideas[group][day]]

    def test_open_days_go_by_total_and_the_first_is_recommended(self):
        ideas = self.board({'id': 'a'}, {'id': 'b', 'recommended': True}, {'id': 'c'})
        new, rep = ss.order_board(ideas, {'mon/a': scored(60), 'mon/b': scored(70), 'mon/c': scored(90)}, None)
        self.assertEqual(self.ids(new), ['c', 'b', 'a'])
        self.assertTrue(new['days']['mon'][0]['recommended'])
        self.assertNotIn('recommended', new['days']['mon'][1])
        self.assertEqual(new['days']['mon'][0]['story_score']['total'], 90)
        self.assertEqual(self.ids(ideas), ['a', 'b', 'c'], 'the input is untouched')
        self.assertEqual(rep['moved'], ['mon'])

    def test_an_answered_day_keeps_its_order_byte_for_byte(self):
        ideas = self.board({'id': 'a'}, {'id': 'b'})
        totals = {'mon/a': scored(10), 'mon/b': scored(90)}
        new, rep = ss.order_board(ideas, totals, {'idea:a': 'approved', 'idea:b': 'open'})
        self.assertEqual(json.dumps(new['days']['mon']), json.dumps(ideas['days']['mon']))
        self.assertEqual(rep['kept'], ['mon'])
        new, _ = ss.order_board(ideas, totals, {'idea:a': 'held', 'idea:b': 'open'})
        self.assertEqual(self.ids(new), ['b', 'a'], 'held is still unanswered (REMAKE)')
        new, _ = ss.order_board(ideas, totals, {})
        self.assertEqual(self.ids(new), ['a', 'b'], 'a status that does not know an option keeps the day')

    def test_his_option_goes_first_at_equal_totals_only(self):
        his = {'id': 'h', 'source_kind': 'his'}
        new, _ = ss.order_board(self.board({'id': 'e', 'source_kind': 'engine'}, his), {'mon/e': scored(80), 'mon/h': scored(80)}, None)
        self.assertEqual(self.ids(new), ['h', 'e'])
        new, _ = ss.order_board(self.board(his, {'id': 'e', 'source_kind': 'engine'}), {'mon/e': scored(81), 'mon/h': scored(80)}, None)
        self.assertEqual(self.ids(new), ['e', 'h'])

    def test_unscored_then_floored_go_last_and_an_unscored_day_is_kept(self):
        new, _ = ss.order_board(self.board({'id': 'f'}, {'id': 'u'}, {'id': 'g'}),
                                {'mon/f': scored(99, floored=True), 'mon/u': scored(None), 'mon/g': scored(40)}, None)
        self.assertEqual(self.ids(new), ['g', 'u', 'f'], 'unscored before floored; floored last')
        new, rep = ss.order_board(self.board({'id': 'u'}, {'id': 'h', 'source_kind': 'his'}), {'mon/u': scored(None), 'mon/h': scored(None)}, None)
        self.assertEqual(self.ids(new), ['u', 'h'])
        self.assertIn('mon', rep['unscored'])

    def test_close_calls_by_margin_and_by_fork(self):
        _, rep = ss.order_board(self.board({'id': 'a'}, {'id': 'b'}), {'mon/a': scored(80), 'mon/b': scored(77)}, None)
        call = rep['close_calls'][0]
        self.assertEqual(call['keys'], ['mon/a', 'mon/b'])
        self.assertEqual(call['says'], RUBRIC['council']['barred_says'])
        new, rep = ss.order_board(self.board({'id': 'a'}, {'id': 'b'}),
                                  {'mon/a': scored(80, fun=9, scale=3), 'mon/b': scored(74, fun=4, scale=8)}, None)
        self.assertIn('fork', rep['close_calls'][0]['why'])
        self.assertEqual(new['days']['mon'][0]['story_score']['close_call'], RUBRIC['council']['barred_says'])
        _, rep = ss.order_board(self.board({'id': 'a'}, {'id': 'b'}), {'mon/a': scored(80), 'mon/b': scored(60)}, None)
        self.assertEqual(rep['close_calls'], [])

    def test_a_council_read_decides_its_pair(self):
        council = {'mon': {'pair': ['mon/b', 'mon/a'], 'winner': 'mon/b'}}
        new, rep = ss.order_board(self.board({'id': 'a'}, {'id': 'b'}), {'mon/a': scored(80), 'mon/b': scored(78)}, None, council)
        self.assertEqual(self.ids(new), ['b', 'a'])
        self.assertEqual(rep['close_calls'][0]['council'], 'mon/b')
        self.assertNotIn('close_call', new['days']['mon'][0]['story_score'])

    def test_a_short_unread_for_humour_is_never_first(self):
        ideas = self.board(tue=({'id': 'x'}, {'id': 'y'}))
        new, _ = ss.order_board(ideas, {'tue/x': scored(90, 'offday_short', humour_unread=True), 'tue/y': scored(70, 'offday_short')}, None)
        self.assertEqual(self.ids(new, 'tue', 'offdays'), ['y', 'x'])

    def test_the_weekly_series_keeps_its_place(self):
        ideas = {'days': {}, 'offdays': {'sat': [{'id': 'goodnews', 'weekly': 'good_news'}, {'id': 'p'}, {'id': 'q'}]}}
        totals = {'sat/goodnews': scored(10, 'goodnews'), 'sat/p': scored(20, 'goodnews'), 'sat/q': scored(30, 'goodnews')}
        new, _ = ss.order_board(ideas, totals, None)
        self.assertEqual(self.ids(new, 'sat', 'offdays'), ['goodnews', 'q', 'p'])


class Records(unittest.TestCase):
    def test_judge_lines_need_evidence(self):
        text = ('## mon/aa\nscale: 8/10 because a whole sector is paid\nfun_consume: 7/10 because\n'
                'fun_produce: 11/10 because it shows the cheque\nuplift: 6/10 because it helps people\n'
                'scale: 6 out of ten\n## tue/x\n- fun_consume: 5.5 / 10 because one moment worth repeating\n')
        got, problems = ss.parse_judge(text, ['scale', 'fun_consume', 'fun_produce'])
        self.assertEqual(got, {'mon/aa': {'scale': {'score': 8.0, 'because': 'a whole sector is paid'}},
                               'tue/x': {'fun_consume': {'score': 5.5, 'because': 'one moment worth repeating'}}})
        self.assertEqual(len(problems), 4, problems)

    def test_the_council_needs_every_seat_and_the_chair(self):
        seats = RUBRIC['council']['seats']
        text = '\n'.join(f'{s}: A Score 7/10 (fact); B Score 5/10 (assumption)' for s in seats) + '\nChair: B, because the money is named'
        got, problems = ss.parse_council(text)
        self.assertEqual(problems, [])
        self.assertEqual(got['chair'], 'B')
        self.assertEqual(got['seats']['Scale']['A'], {'score': 7.0, 'basis': 'fact'})
        got, problems = ss.parse_council('\n'.join(text.splitlines()[1:]))
        self.assertTrue(any(p.startswith(seats[0]) for p in problems))
        got, _ = ss.parse_council(text.replace('Chair: B', 'Chair: unknown'))
        self.assertEqual(got['chair'], 'unknown')

    def test_the_council_brief_is_blind(self):
        a = ss.blind_view(hero(A, 'Warner is paid', 'Warner was paid.', from_press='2026-11-16/queue/mon-1', why_here='close to'))
        b = ss.blind_view(hero(B, 'Sony is paid', 'Sony was paid.', source_kind='his'))
        text = ss.council_brief('mon', a, b, True, True)
        for word in ('queue/mon-1', 'source_kind', 'close to', 'Krish'):
            self.assertNotIn(word, text, word)
        self.assertEqual(ss.ab_pair('mon', 'mon/a', 'mon/b'), ss.ab_pair('mon', 'mon/a', 'mon/b'))

    def test_the_judge_brief_sends_only_the_reduced_catalogue(self):
        styles = json.loads((ROOT / 'config' / 'style-references.json').read_text(encoding='utf-8'))
        text = ss.judge_brief([('mon/aa', ss.blind_view(hero(A, 'Warner is paid', 'x')), True, ['fun_produce'])], ['fun_produce'], styles=styles)
        for word in ('krish_verdict', 'krish_said', 'what_i_like_sheet', 'recipes', '"from"', '"evidence"', '"status"'):
            self.assertNotIn(word, text, word)
        self.assertIn('## mon/aa', text)
        self.assertIn('higgsfield', text)


class Spend(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def cfg(self, **spend):
        cfg = json.loads(json.dumps(RUBRIC))
        cfg['spend'].update(spend)
        return cfg

    def view(self):
        return ss.blind_view(hero(A, 'Warner is paid', 'Warner was paid.'))

    def test_the_budget_refuses_before_the_poster_is_called(self):
        poster = Poster()
        ledger = ss.Ledger(self.dir / 'l.jsonl', 0.1, today='2026-11-26')
        got = ss.provoke(self.view(), True, [], ledger, poster=poster, cap=UNDER)
        self.assertEqual(got['status'], 'skipped')
        self.assertIn('budget', got['reason'])
        self.assertEqual(poster.calls, [], 'no call made')
        results, skipped = ss.judge(['an angle'], [], ledger, poster=poster, cap=UNDER)
        self.assertEqual((results, poster.calls), ([None], []))
        self.assertTrue(skipped)

    def test_never_above_the_ruling_and_the_day_caps(self):
        self.assertEqual(ss.Ledger(None, 50).budget, RUBRIC['budget_usd'])
        ledger = ss.Ledger(None, 10, self.cfg(usd_per_day=0.2), today='2026-11-26')
        self.assertIsNotNone(ledger.reserve('provoke', 0.15)[0])
        self.assertIsNone(ledger.reserve('provoke', 0.15)[0])
        ledger = ss.Ledger(None, 10, self.cfg(divergent_ops_per_day=1), today='2026-11-26')
        first, _ = ledger.reserve('provoke', 0.15, divergent=True)
        self.assertIsNone(ledger.reserve('provoke', 0.15, divergent=True)[0])
        ledger.settle(first, 0)
        self.assertIsNotNone(ledger.reserve('provoke', 0.15, divergent=True)[0], 'a released reservation frees its place')

    def test_the_ledger_persists_and_sums_metered_cost(self):
        path = self.dir / 'l.jsonl'
        ledger = ss.Ledger(path, 10, today='2026-11-26')
        e, _ = ledger.reserve('score_judge', 0.3, divergent=True)
        ledger.settle(e, 0.12)
        again = ss.Ledger(path, 10, today='2026-11-26')
        self.assertAlmostEqual(again.spent(), 0.12)
        self.assertEqual(again.summary()['calls'], 1)

    def test_the_chain_cap_comes_first_and_is_never_a_pass(self):
        poster = Poster()
        ledger = ss.Ledger(None, 10, today='2026-11-26')
        got = ss.provoke(self.view(), True, [], ledger, poster=poster, cap=OVER)
        self.assertEqual(got['status'], 'skipped')
        self.assertEqual(poster.calls, [])
        self.assertEqual(ledger.spent(), 0, 'a refused call is released')

    def test_the_bodies_are_the_routes(self):
        poster = Poster(scale=1)
        ledger = ss.Ledger(None, 10, today='2026-11-26')
        got = ss.provoke(self.view(), True, ['an old post'], ledger, poster=poster, cap=UNDER)
        self.assertEqual(got['status'], 'ok')
        body = poster.calls[0]
        self.assertEqual((body['op'], body['namespace'], body['temperament'], body['count']), ('provoke', 'content-engine:angles', 'balanced', 3))
        self.assertEqual(body['cliches'], ['an old post'])
        results, skipped = ss.judge(['one', 'two'], ['the obvious take'], ledger, poster=poster, cap=UNDER)
        body = poster.calls[1]
        self.assertTrue(body['judge'])
        self.assertEqual(body['obvious'], ['the obvious take'])
        self.assertAlmostEqual(ss.judge_numbers(results[0])['originality'], 7.0, msg='a 0 to 1 scale is put on 0 to 10')
        self.assertEqual(skipped, [])
        self.assertAlmostEqual(ledger.spent(), 0.45)

    def test_a_served_call_is_settled_to_its_metered_cost(self):
        class Metered(Poster):
            def __call__(self, body):
                status, answer = super().__call__(body)
                return status, {**answer, 'usage': {'cost_usd': 0.42}}
        ledger = ss.Ledger(None, 10, today='2026-11-26')
        got = ss.provoke(self.view(), True, [], ledger, poster=Metered(), cap=UNDER)
        self.assertEqual(got['metered'], {'by': 'route', 'usd': 0.42})
        self.assertAlmostEqual(ledger.spent(), 0.42, msg="the route's own figure, not the $0.15 estimate")
        # No figure in the answer: the chain's change over the call raises the reservation, never lowers it.
        chain = iter([1.0, 1.0, 1.9])
        ledger = ss.Ledger(None, 10, today='2026-11-26')
        got = ss.provoke(self.view(), True, [], ledger, poster=Poster(), cap=lambda: {'chain_over': False, 'chain_usd': next(chain), 'chain_cap_usd': 15})
        self.assertEqual(got['metered']['by'], 'chain')
        self.assertAlmostEqual(ledger.spent(), 0.9)
        ledger = ss.Ledger(None, 10, today='2026-11-26')
        got = ss.provoke(self.view(), True, [], ledger, poster=Poster(), cap=UNDER)
        self.assertEqual(got['metered']['by'], 'reservation')
        self.assertAlmostEqual(ledger.spent(), RUBRIC['unit_costs']['provoke'], msg='a chain that did not move leaves the estimate')
        # A cost over its estimate counts at once: the next call is refused when it leaves no room.
        ledger = ss.Ledger(None, 0.5, today='2026-11-26')
        poster = Metered()
        self.assertEqual(ss.provoke(self.view(), True, [], ledger, poster=poster, cap=UNDER)['status'], 'ok')
        self.assertEqual(ss.provoke(self.view(), True, [], ledger, poster=poster, cap=UNDER)['status'], 'skipped')
        self.assertEqual(len(poster.calls), 1)

    def test_each_week_has_its_own_ledger(self):
        self.assertNotEqual(ss.ledger_of('2026-11-23'), ss.ledger_of('2026-11-30'))
        self.assertTrue(str(ss.ledger_of('2026-11-30')).replace('\\', '/').endswith('.cache/story-score/2026-11-30.jsonl'))

    def test_a_humour_read_reserves_and_an_unreachable_engine_spends_nothing(self):
        ledger = ss.Ledger(None, 10, today='2026-11-26')
        got, _why = ss.humour('Warner was paid twice.', 'fact', 'mon/a:fact', ledger, lambda req: analysis())
        self.assertEqual(got['comic_reading'], 'supported')
        self.assertAlmostEqual(ledger.spent(), RUBRIC['unit_costs']['humour_read'])
        self.assertEqual(ss.humour('x', 'fact', 'r', ledger, None)[0], None)
        self.assertAlmostEqual(ledger.spent(), RUBRIC['unit_costs']['humour_read'])


class Floors(unittest.TestCase):
    def test_an_explainer_with_no_steps_is_not_read_and_one_unchecked_step_fails(self):
        self.assertIsNone(ss.steps_verifiable({'copy': 'How the ad price works.'}))
        self.assertEqual(ss.floors_failed('explainer', {}, {'steps_verifiable': None}), [], 'no steps: the floor is not read')
        unchecked = {'steps': [{'text': 'Open settings', 'checked': 'https://help.openai.com/x'}, {'text': 'Turn it off'}]}
        self.assertFalse(ss.steps_verifiable(unchecked))
        failed, noted = ss.floor_lines('explainer', {}, {'steps_verifiable': False})
        self.assertEqual((failed, len(noted)), ([], 1), 'unruled, so a note until a ruling or a failure names it')
        self.assertTrue(ss.steps_verifiable({'steps': [{'text': 'Open settings', 'checked': 'https://help.openai.com/x'}]}))

    def test_the_three_floors_are_hard_again(self):
        """Ruling, Krish, 2026-11-26: a hero in a focus sector, a hero's primary source and a short or meme on the beat
        are hard again, each made honest."""
        checks = {'probe_documented': 3, 'probe_rungs': 5, 'landing_ok': True, 'primary_sources': 0, 'sound_angle': True,
                  'money_figure_sourced': True}
        failed, noted = ss.floor_lines('hero_mon', {'fit': 4, 'named_thing': 7}, checks)
        self.assertEqual(set(failed), {"a hero's topic is in a focus sector", 'a hero has at least one primary source'})
        self.assertEqual(noted, [])
        failed, _ = ss.floor_lines('hero_mon', {'fit': 7, 'named_thing': 7}, dict(checks, primary_sources=1, money_figure_sourced=False))
        self.assertEqual(failed, ['a Monday follows the money: it needs a sourced money figure'], 'a series floor stays hard')
        short = {'comic_reading': 'supported', 'needs_explaining': False, 'probe_documented': 1}
        self.assertEqual(ss.floors_failed('offday_short', {'fit': 1}, short), ['a short is on the beat'])
        self.assertEqual(ss.floors_failed('offday_meme', {'fit': 1}, {'comic_reading': 'supported', 'needs_explaining': False, 'template_ok': True}),
                         ['a meme is on the beat'])

    def test_a_wildcard_hero_needs_fit_4_and_nothing_else_relaxes(self):
        checks = {'probe_documented': 3, 'probe_rungs': 5, 'landing_ok': True, 'primary_sources': 1, 'sound_angle': True,
                  'money_figure_sourced': True}
        self.assertEqual(RUBRIC['hero_floors']['wildcard_fit_min'], 4)
        self.assertEqual(ss.floors_failed('hero_mon', {'fit': 4, 'named_thing': 7}, checks, wildcard=True), [])
        self.assertEqual(ss.floors_failed('hero_mon', {'fit': 1, 'named_thing': 7}, checks, wildcard=True), ['a wildcard hero is at least near the beat'])
        self.assertEqual(ss.floors_failed('hero_mon', {'fit': 4, 'named_thing': 7}, dict(checks, primary_sources=0), wildcard=True),
                         ['a hero has at least one primary source'])
        o = hero(A, 'A startup trains a model on old demos', 'A startup trained it.', wildcard=True)
        self.assertTrue(ss.blind_view(o)['wildcard'])


class Edition(unittest.TestCase):
    def item(self, iid, topic, own=True, date_='2026-11-24'):
        return {'id': iid, 'title': f'Spotify pays songwriters ${iid} million', 'summary': 'Spotify paid songwriters.', 'topic': topic,
                'date': date_, 'sources': [{'url': 'https://spotify.com/a', 'own_domain': own}, {'url': 'https://b.com', 'kind': 'secondary'}]}

    def test_score_item_and_its_floors(self):
        s = ss.score_item(self.item('1', 'music'), WEEK, judged={'scale': {'score': 8, 'because': 'a sector'}})
        self.assertEqual(s['type'], 'edition_item')
        self.assertEqual(s['floors_failed'], [])
        self.assertIsNotNone(s['total'])
        s = ss.score_item(self.item('2', 'music', own=False, date_='2026-11-01'), WEEK)
        self.assertEqual(len(s['floors_failed']), 2)

    def test_select_edition_holds_topics_and_counts(self):
        items = [self.item(str(n), t) for n, t in enumerate(['music'] * 5 + ['film'] * 2 + ['sport', 'games', 'news'])]
        judged = {it['id']: {'scale': {'score': 10 - int(it['id']) / 2, 'because': 'a sector'}} for it in items}
        got = ss.select_edition(items, WEEK, judged=judged)
        topics = [it['topic'] for it, _s in got['items']]
        self.assertLessEqual(max(topics.count(t) for t in set(topics)), RUBRIC['edition']['per_topic'])
        self.assertLessEqual(len(set(topics)), RUBRIC['edition']['topics'][1])
        self.assertGreaterEqual(len(got['items']), RUBRIC['edition']['min'])
        self.assertFalse(got['short'])
        self.assertTrue(ss.select_edition(items[:2], WEEK, judged=judged)['short'])


class Cli(unittest.TestCase):
    """The whole Sunday chain on fakes: zero paid calls, a temp plans folder, the real board left alone."""

    def setUp(self):
        self.plans = Path(tempfile.mkdtemp())
        self.folder = self.plans / f'{WEEK}-week'
        self.folder.mkdir()
        self.ledger = str(self.plans / 'spend.jsonl')

    def tearDown(self):
        shutil.rmtree(self.plans, ignore_errors=True)

    def write(self, name, data):
        p = self.folder / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        return p

    def run_cli(self, *argv, **kw):
        kw.setdefault('kill', CLEAN)
        kw.setdefault('today', '2026-11-26')
        return ss.main([argv[0], WEEK, '--plans', str(self.plans), *argv[1:]], **kw)

    def judge_all(self, ideas):
        rows = []
        for key, day, main, o in ss.board(ideas):
            tid = ss.option_type(day, main, o)
            rows.append(f'## {key}')
            rows += [f'{a}: 7/10 because it names the thing' for a in ('scale', 'fun_consume', 'fun_produce', 'uplift', 'utility')
                     if RUBRIC['types'][tid]['weights'].get(a)]
        p = self.folder / 'judge-reply.md'
        p.write_text('\n'.join(rows), encoding='utf-8')
        return p

    def test_the_chain_end_to_end(self):
        fact_a = 'Warner said it signed a deal with a model maker.'
        fact_b = 'Sony said it was paid $40 million by the model maker for its songs.'
        ideas = {'week_start': WEEK, 'days': {'mon': [hero(A, 'Warner signs with a model maker', fact_a),
                                                      hero(B, 'Sony is paid $40 million for its songs', fact_b, url='https://www.sony.com/x')],
                                              'wed': [], 'fri': []},
                 'offdays': {'tue': [{'id': 'x', 'hook': 'Spotify asks singers to sing less', 'funny': 'Paid to be quiet.', 'aim': 'humour'}]}}
        self.write('ideas.json', ideas)
        self.write('sources.json', {'week_start': WEEK, 'recent_posts': [{'title': 'An old post about labels', 'date': '2026-11-10'}]})
        self.write('story/angles.json', {'obvious': ['Labels sell out to AI'], 'options': {
            f'mon/{B}': [{'lens': 'funniest_true', 'text': 'Sony is paid for songs the model already learnt', 'rests_on': 'it was paid $40 million'}]}})
        self.write('story/probes.json', {A: probe(3, 2), B: probe(4, 1)})
        poster = Poster()
        self.assertEqual(self.run_cli('angles', '--provoke', '--judge', '--ledger', self.ledger, poster=poster, cap=UNDER), 0)
        self.assertEqual([b['op'] for b in poster.calls], ['provoke', 'provoke', 'score'], "each hero day's top two, then one batch")
        self.assertEqual(self.run_cli('humour', '--ledger', self.ledger, read=lambda req: analysis()), 0)
        self.assertEqual(self.run_cli('record', str(self.judge_all(ideas))), 0)
        self.assertEqual(self.run_cli('score'), 0)
        self.assertEqual(self.run_cli('order'), 2, 'no status and not fresh: nothing is ordered blind')
        self.assertEqual(self.run_cli('order', '--fresh', '--write'), 0)
        after = json.loads((self.folder / 'ideas.json').read_text(encoding='utf-8'))
        self.assertEqual([o['id'] for o in after['days']['mon']], [B, A], 'the sourced money story leads')
        self.assertTrue(after['days']['mon'][0]['recommended'])
        self.assertEqual(after['days']['mon'][0]['story_score']['rubric_version'], 'story-score/1')
        self.assertEqual(json.loads((self.folder / 'scores.json').read_text(encoding='utf-8'))['unscored'], [])
        summary = ss.Ledger(self.ledger, today='2026-11-26').summary()
        self.assertLessEqual(summary['spent_usd'], RUBRIC['budget_usd'])
        self.assertAlmostEqual(summary['spent_usd'], 0.6 + (summary['calls'] - 3) * 0.005, places=4)

    def test_angle_ids_follow_the_words_and_sparks_are_carried_forward(self):
        ideas = {'week_start': WEEK, 'days': {'mon': [hero(A, 'Warner signs with a model maker', 'Warner said it signed a deal.')],
                                              'wed': [], 'fri': []}}
        self.write('ideas.json', ideas)
        self.write('sources.json', {'recent_posts': []})
        lens = {'lens': 'series', 'text': 'Warner is paid for what it sued over', 'rests_on': 'signed a deal'}
        self.write('story/angles.json', {'options': {f'mon/{A}': [lens]}})
        poster = Poster()
        self.assertEqual(self.run_cli('angles', '--provoke', '--judge', '--ledger', self.ledger, poster=poster, cap=UNDER), 0)
        path = self.folder / 'story' / 'angles.json'
        first = {x['text']: x for x in json.loads(path.read_text(encoding='utf-8'))['pooled'][f'mon/{A}']}
        self.assertIn('The label pays twice reversal', first, 'the spark is pooled')
        # The pool changes: a new lens angle goes first. Without --provoke the spark stays; ids follow the words.
        doc = json.loads(path.read_text(encoding='utf-8'))
        doc['options'][f'mon/{A}'] = [{'lens': 'funniest_true', 'text': 'A new angle nobody judged', 'rests_on': 'signed a deal'}, lens]
        path.write_text(json.dumps(doc), encoding='utf-8')
        calls = len(poster.calls)
        self.assertEqual(self.run_cli('angles', '--ledger', self.ledger, poster=poster, cap=UNDER), 0)
        self.assertEqual(len(poster.calls), calls, 'no call without --provoke or --judge')
        again = {x['text']: x for x in json.loads(path.read_text(encoding='utf-8'))['pooled'][f'mon/{A}']}
        for text, x in first.items():
            self.assertEqual(again[text]['id'], x['id'], text)
            self.assertEqual(again[text]['judge'], x['judge'], 'a judge read stays with its words')
        self.assertEqual(again['The label pays twice reversal']['run_id'], 'run-1', 'the paid spark is carried forward')
        self.assertIsNone(again['A new angle nobody judged']['judge'], "a new text is never given another angle's numbers")
        self.assertEqual(self.run_cli('angles', '--provoke', '--ledger', self.ledger, poster=poster, cap=UNDER), 0)
        self.assertEqual(len(poster.calls), calls, 'a key with sparks already paid for is not provoked again')

    def test_a_step_that_did_not_run_exits_2(self):
        self.write('ideas.json', {'week_start': WEEK, 'days': {'mon': [hero(A, 'Warner signs', 'Warner signed.')], 'wed': [], 'fri': []}})
        self.write('sources.json', {'recent_posts': []})
        poster = Poster()
        self.assertEqual(self.run_cli('angles', '--provoke', '--ledger', self.ledger, poster=poster, cap=OVER), 2)
        self.assertEqual(poster.calls, [])
        self.assertEqual(self.run_cli('score'), 2, 'unscored is never a pass')
        self.assertEqual(self.run_cli('council-brief', '--day', 'mon'), 2, 'no close call to brief')

    def test_council_brief_and_record(self):
        ideas = {'week_start': WEEK, 'days': {'mon': [hero(A, 'Warner signs', 'Warner signed.'), hero(B, 'Sony signs', 'Sony signed.')],
                                              'wed': [], 'fri': []}}
        self.write('ideas.json', ideas)
        self.write('scores.json', {'options': {f'mon/{A}': scored(80), f'mon/{B}': scored(78)}})
        self.assertEqual(self.run_cli('order', '--fresh'), 0)
        self.assertEqual(self.run_cli('council-brief', '--day', 'mon'), 0)
        self.assertIn('## A', (self.folder / 'story' / 'council-mon.md').read_text(encoding='utf-8'))
        asked = json.loads((self.folder / 'story' / 'council.json').read_text(encoding='utf-8'))['mon']
        reply = '\n'.join(f'{s}: A Score 6/10 (fact); B Score 8/10 (fact)' for s in RUBRIC['council']['seats']) + '\nChair: B because it is bigger'
        p = self.folder / 'reply.md'
        p.write_text(reply, encoding='utf-8')
        self.assertEqual(self.run_cli('council-record', '--day', 'mon', str(p)), 0)
        rec = json.loads((self.folder / 'story' / 'council.json').read_text(encoding='utf-8'))['mon']
        self.assertEqual(rec['winner'], asked['B'])
        self.assertEqual(self.run_cli('order', '--fresh', '--write'), 0)
        after = json.loads((self.folder / 'ideas.json').read_text(encoding='utf-8'))
        self.assertEqual(after['days']['mon'][0]['id'], asked['B'].split('/')[1])
        p.write_text('Chair: A', encoding='utf-8')
        self.assertEqual(self.run_cli('council-record', '--day', 'mon', str(p)), 2, 'a council read missing its seats is never a pass')


class DryRun(unittest.TestCase):
    """The zero-spend dry run on a copy of the real 23 Nov board: every option scored on fakes, the order changes only
    on open days, and the real file is never written."""

    def test_a_scored_and_ordered_23_nov_copy_holds_the_gate(self):
        """The plan's verification: a realistic scored and ordered copy of 23 Nov (fake transports, middling judges, a
        sourced probe for every option) carries every option's score in order; what it fails is a hard floor, for the
        reason that floor names (the 23 Nov heroes were mostly off the sectors and rest on secondary reports: the
        floors are right to refuse them, tests/story_honest_board_test.py); swapping two open options or deleting a
        score fails with story."""
        real = ROOT / 'docs' / 'plans' / f'{WEEK}-week'
        plans = Path(tempfile.mkdtemp())
        try:
            folder = plans / f'{WEEK}-week'
            (folder / 'story').mkdir(parents=True)
            shutil.copy(real / 'ideas.json', folder / 'ideas.json')
            shutil.copy(real / 'sources.json', folder / 'sources.json')
            ideas = json.loads((folder / 'ideas.json').read_text(encoding='utf-8'))
            ids = [str(o.get('id')).lower() for _k, _d, _m, o in ss.board(ideas)]
            (folder / 'story' / 'probes.json').write_text(json.dumps({i: probe(3, 2) for i in ids}), encoding='utf-8')
            run = lambda *argv, **kw: ss.main([argv[0], WEEK, '--plans', str(plans), *argv[1:]], kill=CLEAN, today='2026-11-26', **kw)  # noqa: E731
            ledger = str(plans / 'spend.jsonl')
            self.assertEqual(run('angles', '--provoke', '--judge', '--ledger', ledger, poster=Poster(), cap=UNDER), 0)
            self.assertEqual(run('humour', '--ledger', ledger, read=lambda req: analysis()), 0)
            rows = []
            for key, _day, _main, _o in ss.board(ideas):
                rows.append(f'## {key}')
                rows += [f'{a}: 6/10 because the facts name it' for a in ('scale', 'fun_consume', 'fun_produce', 'uplift', 'utility')]
            (folder / 'reply.md').write_text('\n'.join(rows), encoding='utf-8')
            self.assertEqual(run('record', str(folder / 'reply.md')), 0)
            self.assertEqual(run('score'), 0)
            self.assertEqual(run('order', '--fresh', '--write'), 0)
            scored = json.loads((folder / 'ideas.json').read_text(encoding='utf-8'))
        finally:
            shutil.rmtree(plans, ignore_errors=True)
        cfg = dict(ic.STORY, **{'from': WEEK})
        ladders = {i: {'schema': 'why-ladder/1', 'rungs': [{'n': n, 'evidence': [{'url': 'https://a.example/x'}]} for n in range(1, 6)]}
                   for i in ids}
        found = ic.story_findings(scored, WEEK, None, ladders, cfg)
        per_option = [f['line'] for f in found if f['code'] == 'story' and f['ref'] not in ('mon', 'wed', 'fri')]
        self.assertEqual(per_option, [], 'every option scored, every open day in order')
        hard = {f['reason'] for t in RUBRIC['types'] for f in ss.floors_for(t) if f.get('hard', True)}
        for f in found:
            if f['code'] == 'story_floor':
                self.assertTrue(any(r in f['line'] for r in hard), f'only a hard floor refuses, by its reason: {f["line"]}')
        swapped = json.loads(json.dumps(scored))
        day, n = next((d, n) for d in ('mon', 'wed', 'fri') for n in range(len(swapped['days'][d]) - 1)
                      if bool(swapped['days'][d][n]['story_score']['floors_failed']) == bool(swapped['days'][d][n + 1]['story_score']['floors_failed'])
                      and swapped['days'][d][n]['story_score']['total'] != swapped['days'][d][n + 1]['story_score']['total'])
        opts = swapped['days'][day]
        opts[n], opts[n + 1] = opts[n + 1], opts[n]
        self.assertIn('story', [f['code'] for f in ic.story_findings(swapped, WEEK, None, ladders, cfg)])
        removed = json.loads(json.dumps(scored))
        removed['days']['fri'][0].pop('story_score')
        self.assertIn('story', [f['code'] for f in ic.story_findings(removed, WEEK, None, ladders, cfg)])

    def test_the_23_nov_board_on_fakes(self):
        real = ROOT / 'docs' / 'plans' / f'{WEEK}-week'
        before = (real / 'ideas.json').read_bytes()
        plans = Path(tempfile.mkdtemp())
        try:
            folder = plans / f'{WEEK}-week'
            (folder / 'story').mkdir(parents=True)
            shutil.copy(real / 'ideas.json', folder / 'ideas.json')
            shutil.copy(real / 'sources.json', folder / 'sources.json')
            ideas = json.loads((folder / 'ideas.json').read_text(encoding='utf-8'))
            heroes = [o['id'].lower() for d in ('mon', 'wed', 'fri') for o in ideas['days'][d]]
            (folder / 'story' / 'probes.json').write_text(json.dumps({h: probe(3, 2) for h in heroes}), encoding='utf-8')
            run = lambda *argv, **kw: ss.main([argv[0], WEEK, '--plans', str(plans), *argv[1:]], kill=CLEAN, today='2026-11-26', **kw)  # noqa: E731
            poster = Poster()
            ledger = str(plans / 'spend.jsonl')
            self.assertEqual(run('angles', '--provoke', '--judge', '--ledger', ledger, poster=poster, cap=UNDER), 0)
            self.assertEqual(sum(1 for b in poster.calls if b['op'] == 'provoke'), 6)
            self.assertEqual(sum(1 for b in poster.calls if b['op'] == 'score'), 1)
            self.assertEqual(run('humour', '--ledger', ledger, read=lambda req: analysis()), 0)
            rows = []
            for key, _day, _main, _o in ss.board(ideas):
                rows.append(f'## {key}')
                rows += [f'{a}: 6/10 because the facts name it' for a in ('scale', 'fun_consume', 'fun_produce', 'uplift', 'utility')]
            reply = folder / 'reply.md'
            reply.write_text('\n'.join(rows), encoding='utf-8')
            self.assertEqual(run('record', str(reply)), 0)
            self.assertEqual(run('score'), 0)
            scores = json.loads((folder / 'scores.json').read_text(encoding='utf-8'))['options']
            self.assertEqual(len(scores), len(ss.board(ideas)))
            self.assertTrue(all(s['total'] is not None for s in scores.values()))
            first_mon = ideas['days']['mon'][0]['id'].lower()
            status = {}
            for _key, day, main, o in ss.board(ideas):
                status[ss.status_key('days' if main else 'offdays', day, o)] = 'open'
            status[f'idea:{first_mon}'] = 'approved'
            sp = folder / 'status.json'
            sp.write_text(json.dumps({'status': status}), encoding='utf-8')
            self.assertEqual(run('order', '--status', str(sp), '--write'), 0)
            after = json.loads((folder / 'ideas.json').read_text(encoding='utf-8'))
            self.assertEqual(json.dumps(after['days']['mon']), json.dumps(ideas['days']['mon']), 'an answered day is untouched')
            self.assertTrue(all('story_score' in o for d in ('wed', 'fri') for o in after['days'][d]))
            self.assertLessEqual(ss.Ledger(ledger, today='2026-11-26').summary()['spent_usd'], RUBRIC['budget_usd'])
        finally:
            shutil.rmtree(plans, ignore_errors=True)
        self.assertEqual((real / 'ideas.json').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
