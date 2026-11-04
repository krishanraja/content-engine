#!/usr/bin/env python3
"""The failure loop (scripts/learning/, scripts/preflight.py, scripts/velib/preflight.py, scripts/incidents.py).

Krish, 2026-11-04: "how can your system autonomously understand the difference between a repeated failure, why it
happened, what was being done when the failure occurred and how it was being done ... all of this stuff should feed an
intelligent system that automatically gets more intelligent every week". Run: python3 tests/learning_loop_test.py
"""
from __future__ import annotations

import copy
import json
import os
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
os.environ['INCIDENTS_OFFLINE'] = '1'
os.environ['VE_GATES_OFFLINE'] = '1'

import check_failures  # noqa: E402
import preflight  # noqa: E402
from learning import causes, cluster, common, ladder, report  # noqa: E402

UUIDS = [f'00000000-0000-4000-8000-{i:012d}' for i in range(1, 20)]


def regs():
    """A small register: one guarded failure (markers, no test) about captions on his face, its learning, a floor
    standard and group for it, and one floor record."""
    return {
        'failures': {'failures': [{
            'id': 'F90-captions-on-face', 'on': '2026-10-20', 'krish': 'the captions sit right on my face again',
            'what': 'Word captions were drawn over his face in the short cut.', 'status': 'guarded',
            'guards': [{'file': 'scripts/velib/qc_captions.py', 'contains': 'def', 'how': 'lists captions on the face'}],
            'related': ['captions-off-face']}]},
        'learnings': {'learnings': [{'id': 'captions-off-face', 'on': '2026-10-20', 'krish': 'keep words off my face',
                                     'why': 'captions on his face hide him', 'means': 'Captions never sit over his face in any cut.',
                                     'status': 'encoded', 'encoded': [{'file': 'x', 'contains': 'y', 'how': 'z'}]}]},
        'floor': {'standards': {'s1': {'never_beneath': 'Captions never cover his face in any cut.', 'records': ['r1']}},
                  'records': {'r1': {'on': '2026-10-18', 'kind': 'rejected', 'theme': 'words_on_screen', 'formats': ['short_video'],
                                     'what': 'Captions drawn over his face in the short cut', 'his_words': []}}},
        'groups': {'groups': [{'key': 'captions_exact', 'title': 'Captions exact and off his face',
                               'never_beneath': 'Captions never cover his face.', 'check': 'captions off the face', 'members': ['s1']}],
                   'operating': {'members': []}},
    }


def incident(i, **extra):
    return {'id': UUIDS[i], 'at': f'2026-11-0{min(i, 8) + 1}T10:00:00Z', 'stage': 'cut', 'kind': 'krish_reject', 'maker': 've',
            'his_words': 'the captions are on my face again in the short cut', 'floor_groups': ['captions_exact'],
            'failure_ids': [], 'preflight': None, 'meta': {}, **extra}


class Cluster(unittest.TestCase):
    def test_a_repeat_after_its_guard_climbs_one_rung(self):
        r = regs()
        items = common.backfill_items(r) + common.incident_items([incident(1)], r)
        modes = cluster.modes(items, r)
        mode = next(m for m in modes if 'F90-captions-on-face' in m['failure_ids'])
        self.assertEqual(mode['guarded_since'], '2026-10-20')
        self.assertEqual([it['id'] for it in mode['repeats']], [UUIDS[1]], 'the November incident is the repeat; the October record is not')
        steps = ladder.plan(modes, {}, r)
        self.assertEqual(len(steps), 1)
        self.assertEqual((steps[0]['failure_id'], steps[0]['from'], steps[0]['to']), ('F90-captions-on-face', 'lint_warn', 'lint_refuse'))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'failures.json'
            path.write_text(json.dumps(r['failures']), encoding='utf-8')
            self.assertEqual(ladder.apply(steps, path), 1)
            entry = json.loads(path.read_text())['failures'][0]
            self.assertEqual(entry['guard_level'], 'lint_refuse')
            self.assertEqual(entry['mode'], mode['key'])
            self.assertEqual(entry['recurrences'][0]['source'], f'incident:{UUIDS[1]}')
            self.assertEqual(entry['what'], r['failures']['failures'][0]['what'], 'every other field is kept')
            self.assertEqual(check_failures.check_loop_fields({'failures': [entry]}), [])
            # Applying the same step again adds nothing twice.
            ladder.apply(steps, path)
            self.assertEqual(len(json.loads(path.read_text())['failures'][0]['recurrences']), 1)
        # The next repeat climbs again, one rung, never two.
        r2 = copy.deepcopy(r)
        r2['failures']['failures'][0]['guard_level'] = 'lint_refuse'
        self.assertEqual(ladder.plan(cluster.modes(common.backfill_items(r2) + common.incident_items([incident(1)], r2), r2), {}, r2)[0]['to'], 'gate')
        self.assertEqual(ladder.climb('gate'), 'gate')

    def test_nothing_before_the_guard_is_a_repeat(self):
        r = regs()
        early = incident(1, at='2026-10-19T10:00:00Z')
        modes = cluster.modes(common.backfill_items(r) + common.incident_items([early], r), r)
        self.assertFalse(any(m['repeats'] for m in modes))
        self.assertEqual(ladder.plan(modes, {}, r), [])


class Causes(unittest.TestCase):
    def test_an_incident_with_no_receipt_is_standard_not_read_with_no_model(self):
        r = regs()
        modes = cluster.modes(common.backfill_items(r) + common.incident_items([incident(1)], r), r)
        mode = next(m for m in modes if m['repeats'])
        found = causes.deterministic(mode, r)
        self.assertEqual(found[0]['cause'], 'standard_not_read')
        self.assertIn(f'incident {UUIDS[1]}.preflight: null', found[0]['evidence'])
        self.assertEqual(causes.unresolved(modes, {mode['key']: found}), [], 'a traced mode never reaches the model')

    def test_a_receipt_without_the_floor_read_is_named(self):
        r = regs()
        it = incident(1, preflight=[{'check': 'failures', 'version_or_hash': 'abc', 'at': 'x'}])
        modes = cluster.modes(common.backfill_items(r) + common.incident_items([it], r), r)
        found = causes.deterministic(next(m for m in modes if m['repeats']), r)
        self.assertEqual(found[0]['cause'], 'standard_not_read')
        self.assertIn('no floor read', found[0]['evidence'])

    def test_a_full_receipt_and_markers_only_is_check_missing(self):
        r = regs()
        it = incident(1, preflight=[{'check': 'floor', 'format': 'short_video', 'version_or_hash': 'a', 'at': 'x'},
                                    {'check': 'failures', 'version_or_hash': 'b', 'at': 'x'}])
        modes = cluster.modes(common.backfill_items(r) + common.incident_items([it], r), r)
        found = [c['cause'] for c in causes.deterministic(next(m for m in modes if m['repeats']), r)]
        self.assertIn('check_missing', found)
        self.assertNotIn('standard_not_read', found)

    def test_the_model_must_quote_an_incident_field(self):
        asked = [{'mode': 'm', 'incidents': [{'id': UUIDS[1], 'his_words': 'the captions are on my face again in the short cut'}]}]
        kept = causes.merge_model([
            {'mode': 'm', 'cause': 'brief_gap', 'quote': 'captions are on my face again'},
            {'mode': 'm', 'cause': 'brief_gap', 'quote': 'the brief never said where captions go'},
            {'mode': 'm', 'cause': 'vibes', 'quote': 'captions are on my face again'},
            {'mode': 'other', 'cause': 'brief_gap', 'quote': 'captions are on my face again'},
        ], asked)
        self.assertEqual(len(kept['m']), 1)
        self.assertEqual(kept['m'][0]['cause'], 'brief_gap')


class Report(unittest.TestCase):
    def test_proposals_cap_at_three_and_cite_incident_ids(self):
        r = regs()
        modes = []
        for n in range(5):
            items = [common.item(id=UUIDS[n * 2 + 1], source='incident', on='2026-11-02', stage='cut', what=f'thing {n}')]
            modes.append({'key': f'cut/g{n}/thing', 'stage': 'cut', 'group': f'g{n}', 'items': items, 'repeats': items,
                          'failure_ids': [], 'learning_ids': []})
        window = {it['id'] for m in modes for it in m['items']}
        props = report.proposals(modes, {}, [], window)
        self.assertEqual(len(props), report.MAX_PROPOSALS)
        self.assertEqual(report.MAX_PROPOSALS, 3)
        for p in props:
            self.assertTrue(p['scope']['key'].startswith('loop:'))
            self.assertTrue(p['evidence_ids'] and p['regression_cases'])
            self.assertIn(p['proposal_class'], ('engine_quality', 'taste'))
        self.assertEqual(report.metrics(modes, window)['repeat_rate'], 1.0)

    def test_the_now_line_is_one_line_replaced_each_week(self):
        with tempfile.TemporaryDirectory() as tmp:
            now = Path(tmp) / 'NOW.md'
            now.write_text('## What is next\n\n- Next: x\n- North Star check (2026-11-04): holds.\n', encoding='utf-8')
            numbers = {'metrics': {'items': 4, 'repeats': 1, 'repeat_rate': 0.25}}
            self.assertTrue(report.write_now(report.now_line('2026-11-08', numbers, 1), now))
            self.assertTrue(report.write_now(report.now_line('2026-11-15', numbers, 0), now))
            text = now.read_text()
            self.assertEqual(text.count(report.NOW_MARK), 1)
            self.assertIn('2026-11-15', text)
            self.assertLess(text.index(report.NOW_MARK), text.index('- North Star check'))


class Preflight(unittest.TestCase):
    def spec(self, day):
        return {'piece_id': 'p', 'publish_day': day, 'cuts': {'short': {'aspect': '9:16', 'beats': []}}}

    def test_ve_brief_refuses_without_the_preflight_from_9_nov_and_passes_before(self):
        import ve  # noqa: PLC0415
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / 'piece'
            directory = folder / 've'
            directory.mkdir(parents=True)
            spec_file = directory / 'spec.json'

            def brief(day):
                spec = self.spec(day)
                with patch('ve._ve_dir', return_value=(spec_file, spec, directory)), \
                        patch('velib.brief.write_briefs', return_value=[]) as write:
                    code = ve.cmd_brief(Namespace(piece=str(folder), cut='short', script=None, move=None, check=None,
                                                  plate=None, beat=None))
                return code, write.called

            self.assertEqual(brief('2026-11-06'), (0, True), 'a piece before 9 Nov briefs as before')
            self.assertEqual(brief('2026-11-09'), (1, False), 'from 9 Nov no preflight refuses the brief')
            preflight.write(str(folder), [preflight.receipt('floor', preflight.floor_version(), 'short_video')], environ={})
            self.assertEqual(brief('2026-11-09'), (1, False), 'the failure register is still unread')
            preflight.write(str(folder), [preflight.receipt('failures', preflight.failures_version())], environ={})
            self.assertEqual(brief('2026-11-13'), (0, True))
            # A receipt read before the floor changed is stale.
            from velib import preflight as gate  # noqa: PLC0415
            with patch('preflight.floor_version', return_value='0' * 16):
                problems = gate.problems(self.spec('2026-11-13'), directory, ['short'])
            self.assertEqual(len(problems), 1)
            self.assertIn('read before it last changed', problems[0])
            self.assertIn('scripts/floor.py --format short_video', problems[0])
            # The ledger's usage totals pass over the receipts.
            from velib import ledger  # noqa: PLC0415
            with patch('velib.ledger.piece_dir', return_value=folder):
                self.assertEqual(ledger.totals('piece')['claude_tokens'], 0)

    def test_the_making_record_takes_a_receipt(self):
        sent = []
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / 'post.json').write_text(json.dumps({'piece_id': UUIDS[0]}))
            lines = preflight.write(str(folder), [preflight.receipt('skill', preflight.skill_version('make-piece'), name='make-piece')],
                                    call=lambda m, p, b: (sent.append((p, b)), (200, '{}'))[1], environ={})
        self.assertTrue(any('making record' in x for x in lines))
        self.assertEqual(sent[0][0], f'/api/content-ideas/{UUIDS[0]}/making')
        self.assertEqual(sent[0][1]['preflight'][0]['name'], 'make-piece')


class Register(unittest.TestCase):
    def test_check_failures_refuses_a_malformed_loop_field(self):
        bad = {'failures': [{'id': 'x', 'guard_level': 'shouty', 'causes': [{'cause': 'gremlins', 'evidence': 'e'}],
                             'recurrences': [{'on': '2026-11-01'}]}]}
        self.assertEqual(len(check_failures.check_loop_fields(bad)), 3)


if __name__ == '__main__':
    unittest.main(verbosity=1)
