"""Treatments are applied by rule, never chosen (docs/ve/TREATMENTS.md; Krish, 2026-11-18: "I don't want 300 different
choices in the UI so figure out how")."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.treatments import ROLES, check_bank, load_bank, main, plan_beat, plan_cut, plan_still  # noqa: E402


def spec(energy=None, treatments=None):
    style = {'motion': {'module': 'living-ui', 'reason': 'x'}}
    if energy:
        style['energy'] = energy
    if treatments:
        style['treatments'] = treatments
    return {'style': style,
            'objects': [{'obj': 'n', 'device': 'kinetic_stat'}, {'obj': 'r', 'device': 'receipt_print'},
                        {'obj': 'c', 'device': 'typing_bubble'}],
            'cuts': {'short': {'beats': [
                {'id': 'b1', 'role': 'hook', 'face': 'full', 'uses': ['c']},
                {'id': 'b2', 'role': 'anchor', 'uses': ['n']},
                {'id': 'b3', 'role': 'pivot', 'uses': ['r']},
                {'id': 'b4', 'role': 'call', 'uses': []}]}}}


class BankTest(unittest.TestCase):
    def setUp(self):
        self.bank = load_bank()

    def test_the_bank_holds(self):
        self.assertEqual(check_bank(self.bank), [])

    def test_every_device_named_in_a_kind_is_a_registered_device(self):
        devices = json.loads((ROOT / 'config/ve/devices.json').read_text(encoding='utf-8'))
        ids = set(devices.get('devices', devices))
        for kind, named in self.bank['rules']['device_kinds'].items():
            self.assertEqual([d for d in named if d not in ids], [], kind)

    def test_a_broken_bank_is_refused(self):
        bad = copy.deepcopy(self.bank)
        bad['treatments']['hook-hit']['recipe'].append({'primitive': 'lens-flare'})
        del bad['rules']['video']['by_role']['call']
        faults = check_bank(bad)
        self.assertTrue(any('lens-flare' in f for f in faults))
        self.assertTrue(any('by_role' in f for f in faults))

    def test_nothing_draws_until_its_card_is_built(self):
        self.assertFalse(any(p['built'] for p in self.bank['primitives'].values()))
        plan = plan_cut(spec(), 'short', self.bank)
        self.assertFalse(any(e['drawable'] for es in plan['beats'].values() for e in es))


class RuleTest(unittest.TestCase):
    def setUp(self):
        self.bank = load_bank()

    def test_every_role_resolves(self):
        for role in ROLES:
            plan_beat(self.bank, role, face=None, devices=[], energy=None)
        with self.assertRaises(ValueError):
            plan_beat(self.bank, 'intro', face=None, devices=[], energy=None)

    def test_beats_get_treatments_from_what_they_are_for(self):
        beats = plan_cut(spec(), 'short', self.bank)['beats']
        self.assertEqual([e['treatment'] for e in beats['b1']], ['subject-lift', 'hook-hit'])
        self.assertEqual([e['treatment'] for e in beats['b2']], ['number-glow'])
        # pivot-split is retired: a break on the turn reads as a layout change (Ruling, Krish, 2026-11-20: one staging per cut).
        self.assertEqual([e['treatment'] for e in beats['b3']], ['receipt-paper'])
        self.assertEqual(beats['b4'], [])

    def test_never_more_than_the_cap_on_a_beat(self):
        cap = self.bank['limits']['max_treatments_per_beat']
        got = plan_beat(self.bank, 'payoff', face='full', devices=['kinetic_stat', 'receipt_print'], energy='high')
        self.assertEqual(len(got), cap)

    def test_the_look_sets_the_strength(self):
        calm = plan_cut(spec('calm'), 'short', self.bank)['beats']['b2'][0]['strength']
        high = plan_cut(spec('high'), 'short', self.bank)['beats']['b2'][0]['strength']
        self.assertLess(calm, high)
        with self.assertRaises(ValueError):
            plan_cut(spec('wild'), 'short', self.bank)

    def test_off_is_the_only_switch_and_none_are_chosen_one_by_one(self):
        self.assertEqual(plan_cut(spec(treatments='off'), 'short', self.bank)['beats'], {})
        with self.assertRaises(ValueError):
            plan_cut(spec(treatments=['hook-hit']), 'short', self.bank)

    def test_stills_get_only_what_their_content_needs(self):
        self.assertEqual([e['treatment'] for e in plan_still('carousel', bank=self.bank)], ['still-grain'])
        self.assertEqual([e['treatment'] for e in plan_still('carousel', photo=True, number=True, bank=self.bank)],
                         ['still-grain', 'still-duotone', 'still-glow'])
        self.assertEqual([e['treatment'] for e in plan_still('cover', face=True, bank=self.bank)],
                         ['subject-lift', 'still-grain'])
        self.assertEqual(plan_still('meme', photo=True, bank=self.bank), [])

    def test_the_check_command(self):
        self.assertEqual(main(['check']), 0)


if __name__ == '__main__':
    unittest.main()
