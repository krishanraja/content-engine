"""The guards built from the Thursday 5 Nov failure report (docs/learning/2026-11-04-thursday-killed.md, F31 to F35).

Krish, 4 Nov 2026: "Okay, this is shit. I'm going to kill this completely. The visuals are tacky. The subtitles are
all over the place typographically." Each test refuses the bad case Thursday showed and passes a good one shaped like
Monday 2 Nov ("The Ladder", docs/plans/2026-11-02-monday/motion-system.md). The renderer is mocked: no frame is drawn."""
import copy
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'tests'))
os.environ['VE_GATES_OFFLINE'] = '1'

import ve  # noqa: E402
from velib import guards, lint as ve_lint, proof  # noqa: E402
from ve_proof_test import CUT, FIXTURE, approve, fake_render, props_for, whole  # noqa: E402

LADDER = {
    'object': 'One career ladder; every number is drawn on, beside or instead of a rung',
    'moves': [{'move': 'the drop', 'means': 'the junior rung thins as 27% falls to 9%'},
              {'move': 'the missing rung', 'means': 'the ladder returns taller with no bottom rung'}],
    'never': ['No figures or icons acting out a sentence', 'No on-screen words that repeat what he says'],
    'real_artifacts': [{'asset': 'deepseek-xinjiang-recording', 'text': 'the recording as it played'}],
}
CHAT = 'Which of these should need your yes before you send it'


def with_idea(spec, idea=None):
    out = copy.deepcopy(spec)
    out.setdefault('style', {})['idea'] = copy.deepcopy(LADDER if idea is None else idea)
    for beat in out['cuts'][CUT]['beats'][:1]:
        beat['plate'] = {'source': 'asset:deepseek-xinjiang-recording'}
    return out


def codes(lines):
    return sorted({line.split(' ', 1)[0] for line in lines})


class NoIdeaNoProduction(unittest.TestCase):
    def test_a_spec_with_no_named_idea_is_refused_from_9_nov(self):
        self.assertEqual(codes(guards.idea_problems(whole())), ['idea.required'])
        self.assertEqual(guards.idea_problems(whole(day='2026-11-08')), [], 'pieces before 9 Nov are not held')

    def test_each_part_of_the_idea_is_required(self):
        bare = {'object': 'a', 'moves': [{'move': 'x', 'means': 'y'}], 'never': [], 'real_artifacts': []}
        self.assertEqual(codes(guards.idea_problems(with_idea(whole(), bare))),
                         ['idea.moves', 'idea.never', 'idea.object', 'idea.real'])

    def test_the_ladder_passes_and_its_real_artifact_must_be_on_screen(self):
        self.assertEqual(guards.idea_problems(with_idea(whole())), [])
        hidden = with_idea(whole())
        hidden['cuts'][CUT]['beats'][0]['plate'] = {'source': 'take'}
        self.assertEqual(guards.idea_problems(hidden), [], 'the evidence card plays the recording by its src')
        for obj in hidden['objects']:
            (obj.get('params') or {}).pop('src', None)
        self.assertTrue(any('never on screen' in p for p in guards.idea_problems(hidden)))
        none = with_idea(whole(), dict(LADDER, real_artifacts=[], real_none='a pure opinion piece with no document'))
        self.assertEqual(guards.idea_problems(none), [])

    def test_ve_lint_refuses_it(self):
        found = ve_lint.crew_lints(whole())
        self.assertTrue(any(line.startswith('idea.required') for line in found), found[:5])


class TheOpening(unittest.TestCase):
    """Krish, 2026-11-05: "I think it should go at the start of the longer wide videos 100%,". A piece names the intro
    sting only where ve compile puts it: the 16:9 whole cut of a weekly series piece on its series' day."""

    def wide(self, day='2026-11-13', sting='mind_the_gap'):
        spec = whole(day=day)
        spec['cuts']['proof-wide']['excerpt'] = False
        spec['brand']['intro_sting'] = sting
        return spec

    def test_a_series_piece_with_a_wide_whole_cut_names_its_sting(self):
        self.assertEqual(guards.opening_problems(self.wide()), [])
        self.assertEqual(guards.sting_named(self.wide()), 'mind_the_gap')
        self.assertFalse([line for line in guards.spec_lints(self.wide()) if line.startswith(('opening.', 'offday.'))])

    def test_a_sting_on_a_piece_with_no_wide_whole_cut_is_refused(self):
        tall_only = whole()  # proof-tall is whole; proof-wide stays an excerpt
        tall_only['brand']['intro_sting'] = 'mind_the_gap'
        self.assertEqual(codes(guards.opening_problems(tall_only)), ['opening.sting_no_wide'])
        self.assertIn('opening.sting_no_wide', codes(guards.spec_lints(tall_only)))

    def test_a_sting_on_an_off_day_is_refused_on_any_date_and_once(self):
        # Before MOTION_FROM the off-day guard does not bind, so the opening guard refuses it.
        early = self.wide(day='2026-11-05')  # a Thursday
        self.assertFalse(guards.bound(early))
        self.assertEqual(codes(guards.opening_problems(early)), ['opening.sting_off_day'])
        # From it, offday.chrome refuses it and the opening guard does not say it twice.
        late = self.wide(day='2026-11-12')
        self.assertEqual(guards.opening_problems(late), [])
        self.assertIn('offday.chrome', codes(guards.spec_lints(late)))

    def test_no_sting_named_is_never_refused(self):
        from creative_direction import NO_STING  # noqa: PLC0415
        for value in (None, NO_STING):
            spec = whole(day='2026-11-12')
            spec['brand'].pop('intro_sting', None)
            if value:
                spec['brand']['intro_sting'] = value
            self.assertEqual(guards.opening_problems(spec), [], value)

    def test_the_contract_and_the_direction_say_no_sting_in_the_same_words(self):
        import re  # noqa: PLC0415
        from creative_direction import NO_STING  # noqa: PLC0415
        source = (ROOT / 'packages/contracts/src/production-spec.ts').read_text(encoding='utf-8')
        self.assertEqual(re.search(r"export const VE_NO_STING = '([^']*)'", source).group(1), NO_STING)
        enum = re.search(r"export const VeStingSchema = z\.enum\(\[([^\]]*)\]\)", source).group(1)
        self.assertEqual(sorted(re.findall(r"'([a-z_]+)'", enum)), sorted(guards.STINGS))


class ShowTheRealThing(unittest.TestCase):
    def spec(self, typed):
        spec = with_idea(whole(), dict(LADDER, real_artifacts=[{'asset': 'deepseek-xinjiang-recording', 'text': CHAT}]))
        chip = next(o for o in spec['objects'] if o['device'] == 'query_chip')
        chip['params'] = {'text': typed}
        return spec

    def test_a_device_that_retypes_his_screenshot_is_refused(self):
        found = guards.retype_problems(self.spec('Which of these should need your yes'))
        self.assertEqual(codes(found), ['real.retyped'])
        self.assertIn('show deepseek-xinjiang-recording itself', found[0])

    def test_a_label_that_adds_a_source_passes(self):
        self.assertEqual(guards.retype_problems(self.spec('OPENAI · CHATGPT · 3 NOV 2026')), [])


class OffDays(unittest.TestCase):
    """Krish, 2026-11-04: "Yes, give off days their own music and look - Rotate." """

    def thursday(self):
        spec = whole(day='2026-11-12')  # a Thursday; the fixture's series is mind.the.gap (Fridays)
        spec['brand']['intro_sting'] = 'mind_the_gap'
        return spec  # its bed is no-curves-instrumental, the series bed

    def test_an_off_day_on_the_series_bed_and_sting_is_refused(self):
        self.assertTrue(guards.off_day(self.thursday()))
        self.assertEqual(guards.config()['off_day']['status'], 'approved')
        found = guards.offday_problems(self.thursday())
        self.assertEqual(codes(found), ['offday.bed', 'offday.chrome'])
        self.assertIn('aspire', found[0])

    def test_an_off_day_on_a_rotation_track_passes_and_a_series_day_is_not_held(self):
        beds = guards.off_day_beds()
        self.assertGreaterEqual(len(beds), 2, 'the off-day rotation is the ledger\'s "for": "off-day" tracks')
        self.assertNotIn('no-curves-instrumental', beds)
        for bed in beds:
            spec = whole(day='2026-11-12')
            spec['audio']['bed']['ledger_id'] = bed
            self.assertEqual(guards.offday_problems(spec), [], bed)
        friday = whole(day='2026-11-13')
        self.assertFalse(guards.off_day(friday))
        self.assertEqual(guards.offday_problems(friday), [])

    def test_the_no_sting_sentence_is_no_sting(self):
        # creative_direction's NO_STING says a piece wears none; only a named series sting is chrome (Krish, 2026-11-05).
        from creative_direction import NO_STING  # noqa: PLC0415
        spec = self.thursday()
        spec['brand']['intro_sting'] = NO_STING
        self.assertEqual(codes(guards.offday_problems(spec)), ['offday.bed'])
        self.assertIsNone(guards.sting_named(spec))
        self.assertEqual(guards.opening_problems(spec), [])

    def test_compile_draws_an_off_day_in_the_house_mint_without_the_series_promise(self):
        from velib.compile import compile_cut  # noqa: PLC0415
        from velib.common import load_json  # noqa: PLC0415
        folder = ROOT / 'fixtures/ve/my-test-19s'
        words = [dict(w, end_s=w['onset_s'] + 0.2) for w in load_json(folder / 'words.frames.json')]
        friday = compile_cut(whole(day='2026-11-13'), CUT, words, folder)
        thursday = compile_cut(whole(day='2026-11-12'), CUT, words, folder)
        self.assertNotEqual(friday['tokens']['channel'], friday['tokens']['mint'])
        self.assertEqual(thursday['tokens']['channel'], thursday['tokens']['mint'])
        self.assertEqual(thursday['series']['label'], 'off.day')
        self.assertEqual(thursday['series']['promise'], thursday['series']['site'])
        self.assertNotEqual(friday['series']['promise'], friday['series']['site'])


class Held(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name) / 've'
        self.dir.mkdir()
        self.spec = whole()
        self.props = props_for(self.spec)
        self.spec_file = self.dir / 'spec.json'
        self.spec_file.write_text(json.dumps(self.spec), encoding='utf-8')
        guards.freeze(self.dir)
        record = proof.make(self.spec, CUT, self.dir, self.props, fake_render())
        self.approved = approve(self.spec, record['sha256'])  # his press on 2026-11-12

    def tearDown(self):
        self.tmp.cleanup()

    def refused(self, spec=None, props=None):
        return ve.render_refusal(spec or self.approved, self.spec_file, props or self.props)


class EngineFreeze(Held):
    def test_the_signed_engine_renders_and_a_changed_one_is_refused_until_he_approves_it(self):
        self.assertEqual(self.refused(), [])
        files = dict(guards.engine_files(), **{'apps/renderer/src/engine/chrome/WordCaption.tsx': '0' * 64})
        with mock.patch.object(guards, 'engine_files', return_value=files):
            reasons = self.refused()
            self.assertTrue(any('engine changed' in r and 'WordCaption.tsx' in r for r in reasons), reasons)
            yes = copy.deepcopy(self.approved)
            yes['approvals'].append({'gate': 'exception', 'by': 'Krish', 'said': 'take the new caption build',
                                     'on': '2026-11-12', 'artifact_hash': guards.engine_sha(files)})
            self.assertEqual(self.refused(yes), [])

    def test_no_engine_record_refuses_and_ve_expect_writes_it(self):
        guards.lock_path(self.dir).unlink()
        self.assertTrue(any('run ve expect' in r for r in self.refused()))
        args = types.SimpleNamespace(spec=str(self.spec_file))
        with mock.patch('sys.stdout'):
            self.assertEqual(ve.cmd_expect(args), 0)
        self.assertTrue(guards.lock_path(self.dir).is_file())
        self.assertEqual(self.refused(), [])

    def test_ve_proof_is_refused_on_a_changed_engine(self):
        (self.dir / f'props.{CUT}.json').write_text(json.dumps(self.props), encoding='utf-8')
        args = types.SimpleNamespace(spec=str(self.spec_file), cut=CUT, beat=None, props=None, assets_dir=None,
                                     scale=1.0, no_qc=True)
        files = dict(guards.engine_files(), **{'scripts/velib/compile.py': '1' * 64})
        with mock.patch.object(guards, 'engine_files', return_value=files), \
                mock.patch.object(ve_lint, 'lint', return_value=(self.spec, [])), mock.patch('sys.stdout'):
            self.assertEqual(ve.cmd_proof(args, render_fn=fake_render()), 1)


class TwoLoops(Held):
    def test_a_third_full_render_waits_for_his_next_press(self):
        for at in ('2026-11-13T09:00:00Z', '2026-11-13T10:00:00Z'):
            self.assertEqual(self.refused(), [], at)
            guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now=at)
        reasons = self.refused()
        self.assertTrue(any('2 full renders' in r and 'bring him' in r for r in reasons), reasons)
        pressed = {'proof': [{'by': 'Krish', 'at': '2026-11-13T11:00:00Z', 'sha256': 'x', 'verdict': 'approve'}]}
        self.assertEqual(guards.loop_problems(self.approved, CUT, self.dir, pressed), [])

    def test_renders_before_his_press_do_not_count(self):
        for at in ('2026-11-11T09:00:00Z', '2026-11-11T10:00:00Z'):
            guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now=at)
        self.assertEqual(self.refused(), [], 'his 12 Nov press came after both renders')


class OneTypeSystem(Held):
    def thursday_props(self):
        props = copy.deepcopy(self.props)
        props['format'], props['captionStyle'], props['title'] = 'face-with-proof', 'word', 'Give your AI two rules'
        props['captions'][0]['swipeIndex'] = 0
        props['beats'][1]['layout'], props['beats'][1]['plate'] = 'STAGE', {'source': 'none'}
        props['objects'].append({'obj': 'headline', 'device': 'headline', 'fromFrame': 0, 'toFrame': 10, 'params': {}})
        props['beats'][1]['uses'] = list(props['beats'][1]['uses']) + ['headline']
        return props

    def test_thursdays_treatments_are_listed_and_never_refused_by_count(self):
        # Krish, 4 Nov 2026: "it needs to look good, and it didn't that time": judged moving, not counted.
        found = guards.type_treatments(self.thursday_props())
        self.assertGreater(len(found), 4, found)
        self.assertIn(['dek', 'loud caption word'], found)
        self.assertIn(['structure', 'held title'], found)
        self.assertEqual(guards.config()['type']['mode'], 'advisory')
        self.assertFalse(any('type treatments' in r for r in self.refused(props=self.thursday_props())))
        self.assertIn('dek as loud caption word', guards.type_note(self.thursday_props()))

    def test_a_limit_mode_would_still_refuse_and_his_yes_admit(self):
        props = self.thursday_props()
        limited = dict(guards.config(), type={'mode': 'limit', 'max_treatments': 4})
        with mock.patch.object(guards, 'config', return_value=limited):
            self.assertTrue(guards.type_problems(self.approved, props))
            yes = copy.deepcopy(self.approved)
            yes['approvals'].append({'gate': 'exception', 'by': 'Krish', 'said': 'keep the serif loud word', 'on': '2026-11-12',
                                     'artifact_hash': guards.canonical_sha(guards.type_treatments(props))})
            self.assertEqual(guards.type_problems(yes, props), [])

    def test_ve_proof_records_the_treatments(self):
        (self.dir / f'props.{CUT}.json').write_text(json.dumps(self.props), encoding='utf-8')
        args = types.SimpleNamespace(spec=str(self.spec_file), cut=CUT, beat=None, props=None, assets_dir=None,
                                     scale=1.0, no_qc=True)
        with mock.patch.object(ve_lint, 'lint', return_value=(self.spec, [])), mock.patch('sys.stdout'):
            self.assertEqual(ve.cmd_proof(args, render_fn=fake_render()), 0)
        record = json.loads((self.dir / 'proof' / f'{CUT}.json').read_text(encoding='utf-8'))
        self.assertEqual(record['type'], guards.type_treatments(self.props))

    def test_device_roles_are_read_from_the_renderer(self):
        self.assertEqual(guards.device_roles('kinetic_stat'), ['data', 'display'])
        self.assertEqual(guards.device_roles('no_such_device'), [])


if __name__ == '__main__':
    unittest.main()
