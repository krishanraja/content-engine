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
        self.assertIn(RUBRIC['from'], ('2026-11-30', '2026-12-07'))

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
        text = ' '.join(strings({k: v for k, v in RUBRIC.items() if k not in ('_about', 'rulings', 'format_catalogue')}))
        self.assertNotIn('—', json.dumps(RUBRIC, ensure_ascii=False), 'no em dash')
        for banned in ('why_here', 'krish_verdict', 'scorecard', 'triage-readback', 'feedback_cues', 'what_i_like_sheet', 'approved_taste'):
            self.assertNotIn(banned, text, f'the rubric names no taste source ({banned})')
        self.assertNotIn('!', ''.join(a for ax in RUBRIC['axes'] for a in ax['anchors'].values()))
        self.assertIsNone(re.search(r'\b(?:color|favor|behavior|(?<!control-)center)\b', text, re.I), 'British spelling')


if __name__ == '__main__':
    unittest.main()
